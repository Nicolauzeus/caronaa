-- F07: persist verified destination for all new quotes and safely recover
-- legacy intra-municipal quotes without mutating their immutable fare snapshot.
-- Requires the 0143 destination-verification and pilot-control migration.
BEGIN;

ALTER TABLE public.caronaa_quick_fare_quotes
  ADD COLUMN IF NOT EXISTS destination_municipality text
  REFERENCES public.caronaa_service_municipalities(municipality);

-- Only the trusted server (service_role) may persist a Google-verified result.
-- A stale/legacy quote is never silently assumed to be intra-municipal.
CREATE TABLE IF NOT EXISTS public.caronaa_quick_legacy_destination_verifications (
  quote_id uuid PRIMARY KEY
    REFERENCES public.caronaa_quick_fare_quotes(id) ON DELETE CASCADE,
  destination_municipality text NOT NULL
    REFERENCES public.caronaa_service_municipalities(municipality),
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caronaa_quick_legacy_destination_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_quick_legacy_destination_verifications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE
  ON public.caronaa_quick_legacy_destination_verifications TO service_role;

CREATE OR REPLACE FUNCTION public.caronaa_quick_submit_quoted(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $submit$
DECLARE
  q public.caronaa_quick_fare_quotes%ROWTYPE;
  r_id uuid;
  v_destination text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.caronaa_quick_fare_quotes
    WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE='42501';
  END IF;
  -- Idempotent re-submission does not create a second ride.
  IF q.ride_id IS NOT NULL THEN RETURN q.ride_id; END IF;
  IF q.expires_at <= now() THEN
    RAISE EXCEPTION 'Quote expired';
  END IF;

  v_destination := q.destination_municipality;
  IF v_destination IS NULL THEN
    -- A legacy same-city destination may only be supplied after the
    -- authenticated server re-verifies its stored destination coordinates.
    SELECT v.destination_municipality INTO v_destination
      FROM public.caronaa_quick_legacy_destination_verifications v
      WHERE v.quote_id=q.id
        AND v.destination_municipality=q.municipality
        AND v.verified_at >= q.issued_at;
    IF v_destination IS NULL THEN
      RAISE EXCEPTION 'Quote destination is not verified';
    END IF;
  END IF;

  IF NOT public.caronaa_f07_test_dispatch_allowed() THEN
    RAISE EXCEPTION 'Pilot dispatch window has ended' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_service_municipalities o
    JOIN public.professional_service_regions r ON r.municipality=o.municipality
    JOIN public.caronaa_quick_tariff_policies t
      ON t.pricing_region=o.pricing_region AND t.vehicle_type=q.vehicle_type
    WHERE o.municipality=q.municipality AND o.pricing_region=q.pricing_region
      AND r.public_discovery_enabled AND r.dispatch_enabled AND t.published
      AND CASE WHEN q.vehicle_type='MOTO' THEN o.moto_enabled ELSE o.car_enabled END
      AND (v_destination=o.municipality OR t.intermunicipal_enabled)
  ) THEN
    RAISE EXCEPTION 'Origin, tariff or intermunicipal dispatch unavailable'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_service_municipalities d
    JOIN public.professional_service_regions r ON r.municipality=d.municipality
    WHERE d.municipality=v_destination
      AND r.public_discovery_enabled AND r.dispatch_enabled
      AND CASE WHEN q.vehicle_type='MOTO' THEN d.moto_enabled ELSE d.car_enabled END
  ) THEN
    RAISE EXCEPTION 'Destination not approved for this mode' USING ERRCODE='42501';
  END IF;
  -- Keep the original atomic dispatch and its one-request-per-passenger rules.
  r_id := public.quick_ride_request(
    q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
    q.origin_lat,q.origin_lng,q.destination_lat,q.destination_lng
  );
  UPDATE public.caronaa_quick_fare_quotes SET ride_id=r_id WHERE id=q.id;
  RETURN r_id;
END;
$submit$;
REVOKE ALL ON FUNCTION public.caronaa_quick_submit_quoted(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_submit_quoted(uuid) TO authenticated;

-- Driver allocation must honor the same trusted legacy-verification record;
-- otherwise an old same-city quote could be requested but never accepted.
CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_driver_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $assignment$
BEGIN
  IF OLD.status='SEARCHING' AND NEW.status='ACCEPTED' THEN
    IF NOT public.caronaa_f07_test_dispatch_allowed() OR NOT EXISTS (
      SELECT 1 FROM public.caronaa_quick_fare_quotes q
      JOIN public.caronaa_service_municipalities o
        ON o.municipality=q.municipality
      JOIN public.professional_service_regions os
        ON os.municipality=o.municipality
      JOIN public.caronaa_quick_tariff_policies t
        ON t.pricing_region=o.pricing_region AND t.vehicle_type=q.vehicle_type
      LEFT JOIN public.caronaa_quick_legacy_destination_verifications v
        ON v.quote_id=q.id AND v.destination_municipality=q.municipality
           AND v.verified_at>=q.issued_at
      JOIN public.caronaa_service_municipalities d
        ON d.municipality=COALESCE(q.destination_municipality,v.destination_municipality)
      JOIN public.professional_service_regions ds
        ON ds.municipality=d.municipality
      WHERE q.ride_id=OLD.id
        AND q.municipality=OLD.municipality
        AND q.vehicle_type=OLD.vehicle_type
        AND os.dispatch_enabled AND os.public_discovery_enabled
        AND ds.dispatch_enabled AND ds.public_discovery_enabled
        AND t.published
        AND (o.municipality=d.municipality OR t.intermunicipal_enabled)
        AND CASE WHEN q.vehicle_type='MOTO' THEN o.moto_enabled AND d.moto_enabled
                 ELSE o.car_enabled AND d.car_enabled END
    ) THEN
      RAISE EXCEPTION 'Destination, origin or tariff is no longer approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$assignment$;
REVOKE ALL ON FUNCTION public.guard_caronaa_quick_driver_assignment()
  FROM PUBLIC,anon,authenticated;

COMMIT;
