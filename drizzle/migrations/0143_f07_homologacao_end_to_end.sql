-- 0143 | F07 test-environment schema and guarded pilot flow.
-- Safe to apply schema separately; DOES NOT enable commercial cities/tariffs.
-- Run scripts/sql/f07-homologacao-ativar.sql in an ISOLATED staging DB only.
-- Keep real-world commercial/regulated transport DISABLED in production.
BEGIN;

ALTER TABLE public.caronaa_quick_fare_quotes
  ADD COLUMN IF NOT EXISTS destination_municipality text
    REFERENCES public.caronaa_service_municipalities(municipality);

-- Include the destination city in the immutable, server-issued fare contract.
-- Only the first ride_id association may change; no other field can be edited.
CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_quote_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $snapshot$
BEGIN
  IF (to_jsonb(NEW) - 'ride_id') IS DISTINCT FROM (to_jsonb(OLD) - 'ride_id')
     OR (OLD.ride_id IS NOT NULL AND NEW.ride_id IS DISTINCT FROM OLD.ride_id) THEN
    RAISE EXCEPTION 'Immutable quick fare snapshot cannot be changed';
  END IF;
  RETURN NEW;
END
$snapshot$;
REVOKE ALL ON FUNCTION public.guard_caronaa_quick_quote_snapshot()
  FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.caronaa_f07_pilot_control (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_activation_expiry CHECK(
    activated_at IS NULL OR (expires_at IS NOT NULL AND expires_at>activated_at)
  )
);
INSERT INTO public.caronaa_f07_pilot_control(id,enabled) VALUES(true,false)
ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.caronaa_f07_pilot_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_f07_pilot_control FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.caronaa_f07_pilot_control TO service_role;

CREATE TABLE IF NOT EXISTS public.caronaa_f07_pilot_authorization_audit (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK(vehicle_type IN ('CAR','MOTO')),
  was_previously_approved boolean NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT pilot_expiry_after_activation CHECK(expires_at>activated_at)
);
ALTER TABLE public.caronaa_f07_pilot_authorization_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_f07_pilot_authorization_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.caronaa_f07_pilot_authorization_audit TO service_role;

-- Before pilot activation the existing production authorizations remain intact.
-- Once activated, the sandbox closes automatically after the expiry timestamp.
CREATE OR REPLACE FUNCTION public.caronaa_f07_test_dispatch_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $allowed$
  SELECT coalesce((
    SELECT (c.activated_at IS NULL OR
            (c.enabled AND c.expires_at IS NOT NULL AND c.expires_at>now()))
    FROM public.caronaa_f07_pilot_control c WHERE c.id=true
  ),true);
$allowed$;
REVOKE ALL ON FUNCTION public.caronaa_f07_test_dispatch_allowed()
  FROM PUBLIC,anon,authenticated;

-- Environment-scoped pilot approval: only the trusted server, via service_role,
-- after an additional private server environment check, can call this RPC.
-- Unlike administrative approval, pilot access is audited separately and can
-- be revoked; no user account, client or fake metadata can invoke it directly.
CREATE OR REPLACE FUNCTION public.caronaa_f07_pilot_activate_driver(
  p_user_id uuid,p_vehicle_type text
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $pilot$
DECLARE v_until timestamptz; v_prior boolean:=false;
        v_original boolean; v_record record;
BEGIN
  IF p_user_id IS NULL OR p_vehicle_type NOT IN ('CAR','MOTO')
      OR p_vehicle_type IS NULL THEN
    RAISE EXCEPTION 'Piloto ou veiculo invalido' USING ERRCODE='22023';
  END IF;
  SELECT enabled,expires_at INTO v_record
    FROM public.caronaa_f07_pilot_control WHERE id=true FOR UPDATE;
  IF NOT FOUND OR v_record.enabled IS DISTINCT FROM true
     OR v_record.expires_at IS NULL OR v_record.expires_at<=now() THEN
    RAISE EXCEPTION 'Homologacao F07 indisponivel' USING ERRCODE='42501';
  END IF;
  v_until:=v_record.expires_at;
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id=p_user_id AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Conta nao confirmada' USING ERRCODE='42501';
  END IF;
  IF NOT public.driver_platform_access_allowed(p_user_id) THEN
    RAISE EXCEPTION 'Motorista bloqueado por repasses' USING ERRCODE='42501';
  END IF;
  SELECT a.approved,a.vehicle_type INTO v_record
    FROM public.professional_driver_authorizations a
    WHERE a.user_id=p_user_id FOR UPDATE;
  IF FOUND THEN
    v_prior:=v_record.approved;
    IF v_prior AND v_record.vehicle_type IS DISTINCT FROM p_vehicle_type THEN
      RAISE EXCEPTION 'Tipo de veiculo ja aprovado difere do solicitado'
        USING ERRCODE='42501';
    END IF;
  END IF;
  -- Do not convert an earlier pilot approval into a permanent manual
  -- approval when this pilot endpoint is called a second time.
  SELECT was_previously_approved INTO v_original
    FROM public.caronaa_f07_pilot_authorization_audit
    WHERE user_id=p_user_id;
  IF FOUND THEN v_prior:=v_original; END IF;

  INSERT INTO public.professional_driver_authorizations(
    user_id,approved,vehicle_type,approved_at,updated_at
  ) VALUES(p_user_id,true,p_vehicle_type,now(),now())
  ON CONFLICT(user_id) DO UPDATE SET
    approved=true,vehicle_type=EXCLUDED.vehicle_type,
    approved_at=coalesce(public.professional_driver_authorizations.approved_at,now()),
    updated_at=now();

  -- Test-only record; do not rewrite an existing human admin review as if
  -- the administrator had approved this account.
  INSERT INTO public.caronaa_f07_pilot_authorization_audit(
    user_id,vehicle_type,was_previously_approved,activated_at,expires_at,revoked_at
  ) VALUES(p_user_id,p_vehicle_type,v_prior,now(),v_until,NULL)
  ON CONFLICT(user_id) DO UPDATE SET
    vehicle_type=EXCLUDED.vehicle_type,
    was_previously_approved=(
      public.caronaa_f07_pilot_authorization_audit.was_previously_approved
      OR EXCLUDED.was_previously_approved
    ),
    activated_at=now(),expires_at=EXCLUDED.expires_at,revoked_at=NULL;

  INSERT INTO public.professional_presence(
    user_id,is_available,mode,last_seen_at,updated_at
  ) VALUES(p_user_id,true,'LOCAL',now(),now())
  ON CONFLICT(user_id) DO UPDATE SET
    is_available=true,last_seen_at=now(),updated_at=now();
  -- No GPS is stored or published here. Separate explicit consent is required.
  RETURN v_until;
END
$pilot$;
REVOKE ALL ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text)
  TO service_role;

-- Optional controlled cleanup at the end of an individual pilot.
CREATE OR REPLACE FUNCTION public.caronaa_f07_pilot_deactivate_driver(
  p_user_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $cleanup$
DECLARE v_record public.caronaa_f07_pilot_authorization_audit%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM public.caronaa_f07_pilot_authorization_audit
    WHERE user_id=p_user_id AND revoked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.caronaa_f07_pilot_authorization_audit
    SET revoked_at=now() WHERE user_id=p_user_id;
  UPDATE public.professional_presence SET is_available=false,updated_at=now()
    WHERE user_id=p_user_id;
  DELETE FROM public.professional_driver_locations WHERE user_id=p_user_id;
  IF NOT v_record.was_previously_approved AND NOT EXISTS(
    SELECT 1 FROM public.professional_access_requests r
    WHERE r.user_id=p_user_id AND r.status='APPROVED' AND r.reviewed_by IS NOT NULL
  ) THEN
    UPDATE public.professional_driver_authorizations
      SET approved=false,updated_at=now() WHERE user_id=p_user_id;
  END IF;
  RETURN true;
END
$cleanup$;
REVOKE ALL ON FUNCTION public.caronaa_f07_pilot_deactivate_driver(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_pilot_deactivate_driver(uuid)
  TO service_role;

-- An expired pilot permission cannot continue to send fresh GPS even when
-- the historical approved flag remains set pending controlled cleanup.
CREATE OR REPLACE FUNCTION public.caronaa_f07_pilot_location_expiry_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $locationguard$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.caronaa_f07_pilot_authorization_audit a
    WHERE a.user_id=NEW.user_id AND a.revoked_at IS NULL
      AND a.expires_at<=now() AND NOT a.was_previously_approved
      AND NOT EXISTS(
        SELECT 1 FROM public.professional_access_requests q
        WHERE q.user_id=NEW.user_id AND q.status='APPROVED'
          AND q.reviewed_by IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Piloto F07 expirado; encerre a autorizacao temporaria'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
$locationguard$;
REVOKE ALL ON FUNCTION public.caronaa_f07_pilot_location_expiry_guard()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS caronaa_f07_pilot_location_expiry
  ON public.professional_driver_locations;
CREATE TRIGGER caronaa_f07_pilot_location_expiry
BEFORE INSERT OR UPDATE ON public.professional_driver_locations
FOR EACH ROW EXECUTE FUNCTION public.caronaa_f07_pilot_location_expiry_guard();

-- Back-compatible status response; prevents the test switch from surviving
-- its expiration, without disabling pre-existing non-pilot service areas.
CREATE OR REPLACE FUNCTION public.caronaa_quick_region_status(
  p_municipality text,p_vehicle text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $status$
DECLARE r record; enabled boolean; tariff boolean; commercial boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_vehicle NOT IN ('CAR','MOTO')
    OR length(btrim(coalesce(p_municipality,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Invalid quick region or vehicle' USING ERRCODE='22023';
  END IF;
  SELECT c.pricing_region,c.car_enabled,c.moto_enabled,
         coalesce(s.public_discovery_enabled,false) AS radar,
         coalesce(s.dispatch_enabled,false) AS dispatch
  INTO r FROM public.caronaa_service_municipalities c
  LEFT JOIN public.professional_service_regions s ON s.municipality=c.municipality
  WHERE lower(c.municipality)=lower(btrim(p_municipality)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','OUTSIDE','region',null,
      'radar',false,'dispatch',false);
  END IF;
  enabled:=CASE WHEN p_vehicle='MOTO' THEN r.moto_enabled ELSE r.car_enabled END;
  SELECT t.published INTO tariff FROM public.caronaa_quick_tariff_policies t
  WHERE t.pricing_region=r.pricing_region AND t.vehicle_type=p_vehicle;
  commercial:=coalesce(enabled AND r.dispatch AND r.radar AND tariff,false)
    AND public.caronaa_f07_test_dispatch_allowed();
  RETURN jsonb_build_object(
    'status',CASE WHEN commercial THEN 'ENABLED' ELSE 'WAITLIST' END,
    'region',r.pricing_region,'radar',r.radar,'dispatch',commercial
  );
END
$status$;
REVOKE ALL ON FUNCTION public.caronaa_quick_region_status(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_region_status(text,text)
  TO authenticated;

-- Server-issued route-specific quote: validate BOTH origin and destination
-- immediately before creating the ride; older quotes without destination are
-- rejected rather than inferred from unverified free-text.
CREATE OR REPLACE FUNCTION public.caronaa_quick_submit_quoted(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $submit$
DECLARE q public.caronaa_quick_fare_quotes%ROWTYPE; r_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.caronaa_quick_fare_quotes
  WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE='42501';
  END IF;
  IF q.ride_id IS NOT NULL THEN RETURN q.ride_id; END IF;
  IF q.expires_at<=now() OR q.destination_municipality IS NULL THEN
    RAISE EXCEPTION 'Quote expired or missing verified destination';
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
      AND (
        q.destination_municipality=o.municipality OR t.intermunicipal_enabled
      )
  ) THEN
    RAISE EXCEPTION 'Origin, tariff or intermunicipal dispatch unavailable'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.caronaa_service_municipalities d
    JOIN public.professional_service_regions r ON r.municipality=d.municipality
    WHERE d.municipality=q.destination_municipality
      AND r.public_discovery_enabled AND r.dispatch_enabled
      AND CASE WHEN q.vehicle_type='MOTO' THEN d.moto_enabled ELSE d.car_enabled END
  ) THEN
    RAISE EXCEPTION 'Destination not approved for this mode' USING ERRCODE='42501';
  END IF;
  r_id:=public.quick_ride_request(
    q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
    q.origin_lat,q.origin_lng,q.destination_lat,q.destination_lng
  );
  UPDATE public.caronaa_quick_fare_quotes SET ride_id=r_id WHERE id=q.id;
  RETURN r_id;
END
$submit$;
REVOKE ALL ON FUNCTION public.caronaa_quick_submit_quoted(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_submit_quoted(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_driver_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $assignment$
BEGIN
  IF OLD.status='SEARCHING' AND NEW.status='ACCEPTED' THEN
    IF NOT public.caronaa_f07_test_dispatch_allowed() OR NOT EXISTS(
      SELECT 1 FROM public.caronaa_quick_fare_quotes q
      JOIN public.caronaa_service_municipalities o
        ON o.municipality=q.municipality
      JOIN public.professional_service_regions os ON os.municipality=o.municipality
      JOIN public.caronaa_quick_tariff_policies t
        ON t.pricing_region=o.pricing_region AND t.vehicle_type=q.vehicle_type
      JOIN public.caronaa_service_municipalities d
        ON d.municipality=q.destination_municipality
      JOIN public.professional_service_regions ds ON ds.municipality=d.municipality
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
END
$assignment$;
REVOKE ALL ON FUNCTION public.guard_caronaa_quick_driver_assignment()
  FROM PUBLIC,anon,authenticated;

-- Contract-only static Pix for an authenticated participant of a COMPLETED
-- professional ride. Never performs a transfer, settles the fare or exposes a
-- key to other users. No invented Pix key or automatic bank confirmation.
CREATE OR REPLACE FUNCTION public.get_completed_quick_ride_pix(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $pix$
DECLARE r public.professional_quick_rides%ROWTYPE;
        q public.caronaa_quick_fare_quotes%ROWTYPE;
        v_key text; v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.professional_quick_rides WHERE id=p_ride_id;
  IF NOT FOUND OR (
    r.passenger_id IS DISTINCT FROM auth.uid() AND
    r.driver_id IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Quick ride not found' USING ERRCODE='42501';
  END IF;
  IF r.status<>'COMPLETED' OR r.driver_id IS NULL THEN
    RAISE EXCEPTION 'Pix so apos conclusao da corrida' USING ERRCODE='22023';
  END IF;
  SELECT * INTO q FROM public.caronaa_quick_fare_quotes
    WHERE ride_id=p_ride_id;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM r.passenger_id
     OR q.municipality IS DISTINCT FROM r.municipality
     OR q.vehicle_type IS DISTINCT FROM r.vehicle_type
     OR q.customer_pays_cents<450
     OR q.customer_pays_cents <> q.driver_receives_cents+q.platform_commission_cents THEN
    RAISE EXCEPTION 'Contrato de tarifa inconsistente; Pix bloqueado'
      USING ERRCODE='22023';
  END IF;
  SELECT d.pix_key INTO v_key FROM public.driver_pix_settings d
    WHERE d.user_id=r.driver_id;
  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id=r.driver_id;
  RETURN jsonb_build_object(
    'available',coalesce(length(btrim(v_key)),0)>0,
    'key',nullif(btrim(v_key),''),
    'name',coalesce(nullif(btrim(v_name),''),'Motorista'),
    'amountCents',q.customer_pays_cents,
    'rideId',r.id,
    'paymentMethod','MANUAL_DRIVER_PIX',
    'automaticConfirmation',false,
    'pilotOnly',(q.policy_version LIKE '%-piloto')
  );
END
$pix$;
REVOKE ALL ON FUNCTION public.get_completed_quick_ride_pix(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_completed_quick_ride_pix(uuid)
  TO authenticated;

COMMENT ON TABLE public.caronaa_f07_pilot_authorization_audit IS
  'Test-only declaratory pilot grants (not administrative driver licensing).';
COMMENT ON FUNCTION public.get_completed_quick_ride_pix(uuid) IS
  'Participant-only post-completion static Pix; not a bank transaction or confirmation.';
NOTIFY pgrst,'reload schema';
COMMIT;
