-- Road-distance passenger fares are quoted server-side for an unaccepted
-- proposal. Existing confirmed/completed rides remain untouched.
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS route_distance_km numeric(14,6),
  ADD COLUMN IF NOT EXISTS passenger_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS passenger_group_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS tariff_reference text;

ALTER TABLE public.rides
  ADD CONSTRAINT rides_route_quote_complete_check CHECK (
    (route_distance_km IS NULL AND passenger_price IS NULL AND passenger_group_total IS NULL AND tariff_reference IS NULL)
    OR
    (route_distance_km IS NOT NULL AND route_distance_km > 0
      AND passenger_price IS NOT NULL AND passenger_price >= 0
      AND passenger_group_total IS NOT NULL AND passenger_group_total >= 0
      AND tariff_reference IS NOT NULL AND length(btrim(tariff_reference)) > 0)
  );

-- Legacy split recalculation must never overwrite a quote, finalized fare, or
-- a proposal on which either participant has already acted.
CREATE OR REPLACE FUNCTION public.recalculate_ride_cost_split(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rides
  SET total_price = 0.00,
      passenger_contribution = 0.00,
      updated_at = clock_timestamp()
  WHERE offer_id = p_offer_id
    AND status = 'MATCHED'
    AND route_distance_km IS NULL
    AND passenger_accepted_at IS NULL
    AND driver_accepted_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_ride_cost_split(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_ride_total_cost(uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.persist_ride_route_quote(
  p_ride_id uuid,
  p_route_distance_km numeric,
  p_passenger_price numeric,
  p_group_total numeric,
  p_tariff_reference text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ride_row public.rides%ROWTYPE; v_passenger_count integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted server operation required' USING ERRCODE = '42501';
  END IF;
  IF p_route_distance_km IS NULL OR p_route_distance_km <= 0
     OR p_passenger_price IS NULL OR p_passenger_price < 0
     OR p_group_total IS NULL OR p_group_total < 0
     OR p_tariff_reference <> 'caronaa-km-6-per-11-v1' THEN
    RAISE EXCEPTION 'Invalid fare quote';
  END IF;
  IF round(p_route_distance_km * 600 / 11, 2) <> p_passenger_price THEN
    RAISE EXCEPTION 'Fare does not match the configured tariff';
  END IF;

  SELECT * INTO ride_row FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF ride_row.route_distance_km IS NOT NULL THEN RETURN false; END IF;
  IF ride_row.status <> 'MATCHED'
     OR ride_row.passenger_accepted_at IS NOT NULL
     OR ride_row.driver_accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unaccepted proposal can be quoted';
  END IF;
  SELECT rr.passenger_count INTO v_passenger_count
  FROM public.ride_requests rr WHERE rr.request_id = ride_row.request_id;
  IF v_passenger_count IS NULL OR round(p_passenger_price * v_passenger_count, 2) <> p_group_total THEN
    RAISE EXCEPTION 'Group fare does not match the request';
  END IF;

  UPDATE public.rides SET
    route_distance_km = p_route_distance_km,
    passenger_price = p_passenger_price,
    passenger_group_total = p_group_total,
    tariff_reference = p_tariff_reference,
    total_price = p_group_total,
    passenger_contribution = p_group_total,
    updated_at = clock_timestamp()
  WHERE ride_id = p_ride_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_ride_route_quote(uuid, numeric, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_ride_route_quote(uuid, numeric, numeric, numeric, text) TO service_role;

-- Preserve the existing bilateral workflow while requiring a server-saved
-- road quote before either participant can accept the proposal.
DO $accept_guard$
DECLARE definition text; anchor text; replacement text;
BEGIN
  SELECT pg_get_functiondef('public.respond_to_ride_match(uuid,text)'::regprocedure)
    INTO definition;
  anchor := 'IF r.status <> ''MATCHED'' THEN RAISE EXCEPTION ''Match proposal is no longer active''; END IF;';
  IF position(anchor IN definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate bilateral acceptance status guard';
  END IF;
  replacement := anchor || E'\n  IF p_response = ''ACCEPT'' AND (r.route_distance_km IS NULL OR r.passenger_price IS NULL OR r.passenger_group_total IS NULL) THEN\n    RAISE EXCEPTION ''Calcule o preço do trecho antes de aceitar esta combinação.'';\n  END IF;';
  EXECUTE replace(definition, anchor, replacement);
END
$accept_guard$;

NOTIFY pgrst, 'reload schema';
