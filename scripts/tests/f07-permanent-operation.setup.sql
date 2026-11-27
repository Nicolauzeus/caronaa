-- Synthetic, disposable fixture ONLY. No credentials or production data.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('fixture.uid',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000001','admin');
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role=$2) $$;
CREATE TABLE public.caronaa_f07_pilot_control(id boolean PRIMARY KEY,enabled boolean,activated_at timestamptz,expires_at timestamptz,updated_at timestamptz);
INSERT INTO public.caronaa_f07_pilot_control VALUES(true,true,'2000-01-01','2000-01-02',now());
CREATE FUNCTION public.caronaa_f07_test_dispatch_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT now() $$;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text) TO service_role;
CREATE FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE TABLE public.caronaa_f07_simulated_driver_positions(id integer);
INSERT INTO public.caronaa_f07_simulated_driver_positions VALUES(1);
GRANT ALL ON public.caronaa_f07_simulated_driver_positions TO service_role;
CREATE TABLE public.caronaa_f07_pilot_authorization_audit(user_id uuid,was_previously_approved boolean,expires_at timestamptz,revoked_at timestamptz);
INSERT INTO public.caronaa_f07_pilot_authorization_audit VALUES('00000000-0000-0000-0000-000000000099',false,'2000-01-02',null);
CREATE TABLE public.caronaa_service_municipalities(municipality text PRIMARY KEY,pricing_region text,car_enabled boolean,moto_enabled boolean);
-- Exactly the live 17 municipalities on 27/11/2026; NOT the historical activation catalog.
INSERT INTO public.caronaa_service_municipalities
SELECT city,CASE WHEN city=ANY(ARRAY['Fortaleza','Maracanaú','Pacatuba','Guaiúba']) THEN 'FORTALEZA_CORRIDOR' ELSE 'MACICO_BATURITE' END,true,true
FROM unnest(ARRAY['Acarape','Aracoiaba','Aratuba','Barreira','Baturité','Capistrano','Fortaleza','Guaiúba','Guaramiranga','Itapiúna','Maracanaú','Mulungu','Pacatuba','Pacoti','Palmácia','Redenção','Ocara']) city;

CREATE TABLE public.professional_service_regions(municipality text PRIMARY KEY,public_discovery_enabled boolean,dispatch_enabled boolean);
INSERT INTO public.professional_service_regions SELECT municipality,true,true FROM public.caronaa_service_municipalities;
CREATE TABLE public.caronaa_quick_tariff_policies(pricing_region text,vehicle_type text,published boolean,intermunicipal_enabled boolean,base_cents integer,policy_version text);
INSERT INTO public.caronaa_quick_tariff_policies VALUES
 ('MACICO_BATURITE','MOTO',true,true,0,'macico-moto-piloto'),
 ('MACICO_BATURITE','CAR',true,true,500,'macico-car-piloto'),
 ('FORTALEZA_CORRIDOR','MOTO',true,true,350,'fortaleza-moto-piloto'),
 ('FORTALEZA_CORRIDOR','CAR',true,true,550,'fortaleza-car-piloto');
CREATE TABLE public.professional_quick_rides(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),passenger_id uuid,driver_id uuid,status text,municipality text,vehicle_type text,expires_at timestamptz,updated_at timestamptz);
INSERT INTO public.professional_quick_rides VALUES('00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000081',null,'IN_PROGRESS','Acarape','CAR',now()-interval '1 day',now());
CREATE TABLE public.caronaa_quick_fare_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),passenger_id uuid,ride_id uuid,expires_at timestamptz,issued_at timestamptz DEFAULT now(),destination_municipality text,municipality text,pricing_region text,vehicle_type text,origin_label text,destination_label text,origin_lat double precision,origin_lng double precision,destination_lat double precision,destination_lng double precision,customer_pays_cents integer);
CREATE TABLE public.caronaa_quick_legacy_destination_verifications(quote_id uuid,destination_municipality text,verified_at timestamptz);
CREATE TABLE public.professional_presence(user_id uuid,is_available boolean);
-- Only the underlying request engine is substituted: no dispatch/payment/external provider here.
-- The actual installed region, quoted-submit and assignment-guard bodies follow verbatim.
CREATE FUNCTION public.quick_ride_request(text,text,text,text,double precision,double precision,double precision,double precision)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE ride uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.professional_quick_rides WHERE passenger_id=auth.uid() AND status IN('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS') AND expires_at>now()) THEN RAISE EXCEPTION 'Duplicate active request'; END IF;
 INSERT INTO public.professional_quick_rides(passenger_id,status,municipality,vehicle_type,expires_at,updated_at)
 VALUES(auth.uid(),'SEARCHING',$1,$2,now()+interval '3 minutes',now()) RETURNING id INTO ride;
 RETURN ride;
END $$;
CREATE OR REPLACE FUNCTION public.caronaa_quick_region_status(p_municipality text, p_vehicle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.caronaa_quick_submit_quoted(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Allow an explicit waiting window for a passenger even with no driver online.
  -- The existing atomic request guard still prevents duplicate active requests.
  UPDATE public.professional_quick_rides
    SET expires_at=now()+interval '30 minutes',updated_at=now()
    WHERE id=r_id AND passenger_id=auth.uid() AND status='SEARCHING';
  UPDATE public.caronaa_quick_fare_quotes SET ride_id=r_id WHERE id=q.id;
  RETURN r_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_driver_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;


GRANT EXECUTE ON FUNCTION public.caronaa_quick_region_status(text,text),public.caronaa_quick_submit_quoted(uuid) TO authenticated;
CREATE TRIGGER assignment_guard BEFORE UPDATE ON public.professional_quick_rides FOR EACH ROW EXECUTE FUNCTION public.guard_caronaa_quick_driver_assignment();
CREATE TABLE public.fixture_before AS SELECT 'municipalities' kind, to_jsonb(c) payload FROM public.caronaa_service_municipalities c
UNION ALL SELECT 'tariffs',to_jsonb(t) FROM public.caronaa_quick_tariff_policies t
UNION ALL SELECT 'regions',to_jsonb(r) FROM public.professional_service_regions r
UNION ALL SELECT 'temporary',to_jsonb(a) FROM public.caronaa_f07_pilot_authorization_audit a
UNION ALL SELECT 'ride',to_jsonb(r) FROM public.professional_quick_rides r;

CREATE TABLE public.professional_access_requests(user_id uuid,status text,reviewed_by uuid);
CREATE TABLE public.professional_driver_locations(user_id uuid);
CREATE OR REPLACE FUNCTION public.caronaa_f07_pilot_location_expiry_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
CREATE TRIGGER temporary_expiry_guard BEFORE INSERT OR UPDATE ON public.professional_driver_locations FOR EACH ROW EXECUTE FUNCTION public.caronaa_f07_pilot_location_expiry_guard();
