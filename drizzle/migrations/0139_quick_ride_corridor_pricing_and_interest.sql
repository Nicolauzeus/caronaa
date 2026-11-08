-- CARONAA: region-gated, server-quoted quick rides; additive and OFF until approved.
-- Apply after 0129, 0136 and 0138 in staging. NEVER activates municipalities.
BEGIN;
CREATE TABLE IF NOT EXISTS public.caronaa_service_municipalities (
  municipality text PRIMARY KEY,
  pricing_region text NOT NULL CHECK (pricing_region IN ('FORTALEZA_CORRIDOR','MACICO_BATURITE')),
  car_enabled boolean NOT NULL DEFAULT false,
  moto_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_municipality_nonempty CHECK (length(btrim(municipality)) BETWEEN 2 AND 120)
);
ALTER TABLE public.caronaa_service_municipalities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_service_municipalities FROM PUBLIC, anon, authenticated;

-- Coverage inventory, NOT automatic authorization. Requires separate admin approval
-- and the existing professional_service_regions dispatch/discovery switches.
INSERT INTO public.caronaa_service_municipalities(municipality,pricing_region) VALUES
 ('Fortaleza','FORTALEZA_CORRIDOR'),
 ('Maracanaú','FORTALEZA_CORRIDOR'),
 ('Pacatuba','FORTALEZA_CORRIDOR'),
 ('Guaiúba','FORTALEZA_CORRIDOR'),
 ('Acarape','MACICO_BATURITE'),
 ('Redenção','MACICO_BATURITE'),
 ('Aracoiaba','MACICO_BATURITE'),
 ('Baturité','MACICO_BATURITE'),
 ('Barreira','MACICO_BATURITE'),
 ('Ocara','MACICO_BATURITE'),
 ('Capistrano','MACICO_BATURITE'),
 ('Itapiúna','MACICO_BATURITE'),
 ('Aratuba','MACICO_BATURITE'),
 ('Guaramiranga','MACICO_BATURITE'),
 ('Mulungu','MACICO_BATURITE'),
 ('Pacoti','MACICO_BATURITE'),
 ('Palmácia','MACICO_BATURITE')
ON CONFLICT(municipality) DO NOTHING;
INSERT INTO public.professional_service_regions(municipality, public_discovery_enabled,dispatch_enabled)
  SELECT municipality,false,false FROM public.caronaa_service_municipalities
ON CONFLICT(municipality) DO NOTHING;

-- Commercial policy must be explicitly published; no invented car/moto rates.
CREATE TABLE IF NOT EXISTS public.caronaa_quick_tariff_policies (
  pricing_region text NOT NULL CHECK (pricing_region IN ('FORTALEZA_CORRIDOR','MACICO_BATURITE')),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('CAR','MOTO')),
  base_cents integer NOT NULL DEFAULT 0 CHECK (base_cents >= 0),
  per_km_cents integer NOT NULL DEFAULT 0 CHECK (per_km_cents >= 0),
  per_minute_cents integer NOT NULL DEFAULT 0 CHECK (per_minute_cents >= 0),
  minimum_cents integer NOT NULL DEFAULT 0 CHECK (minimum_cents >= 0),
  commission_bps integer NOT NULL CHECK (commission_bps BETWEEN 0 AND 4000),
  processing_fee_cents integer NOT NULL DEFAULT 0 CHECK (processing_fee_cents >= 0),
  minimum_platform_margin_cents integer NOT NULL DEFAULT 50 CHECK (minimum_platform_margin_cents >= 0),
  intermunicipal_enabled boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT 'draft-v0' CHECK(length(policy_version) BETWEEN 3 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(pricing_region,vehicle_type),
  CONSTRAINT quick_rate_card_published_complete CHECK (
    NOT published OR (
      minimum_cents >= 450 AND
      (pricing_region='MACICO_BATURITE' AND vehicle_type='MOTO'
       OR (base_cents+per_km_cents+per_minute_cents)>0)
    )
  )
);
ALTER TABLE public.caronaa_quick_tariff_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_quick_tariff_policies FROM PUBLIC, anon, authenticated;
-- Presets are DRAFT until real-world margin/regulatory validation.
INSERT INTO public.caronaa_quick_tariff_policies(
  pricing_region,vehicle_type,minimum_cents,commission_bps,policy_version,published
) VALUES ('MACICO_BATURITE','MOTO',750,2000,'macico-moto-750-11km-draft',false)
ON CONFLICT(pricing_region,vehicle_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.caronaa_quick_official_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 160),
  municipality text NOT NULL REFERENCES public.caronaa_service_municipalities(municipality),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  center_lat double precision NOT NULL CHECK(center_lat BETWEEN -90 AND 90),
  center_lng double precision NOT NULL CHECK(center_lng BETWEEN -180 AND 180),
  radius_m integer NOT NULL CHECK(radius_m BETWEEN 100 AND 30000),
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT official_activity_valid_period CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS caronaa_quick_activities_time_idx ON public.caronaa_quick_official_activities(municipality,starts_at,ends_at) WHERE published;
ALTER TABLE public.caronaa_quick_official_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_quick_official_activities FROM PUBLIC, anon, authenticated;

-- Immutable monetary snapshot: never derive the commission from a changed policy
-- after dispatch. No money movement or Asaas charge is made by this migration.
CREATE TABLE IF NOT EXISTS public.caronaa_quick_fare_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text NOT NULL REFERENCES public.caronaa_service_municipalities(municipality),
  pricing_region text NOT NULL,
  vehicle_type text NOT NULL CHECK(vehicle_type IN ('CAR','MOTO')),
  origin_label text NOT NULL CHECK(length(btrim(origin_label)) BETWEEN 3 AND 180),
  destination_label text NOT NULL CHECK(length(btrim(destination_label)) BETWEEN 3 AND 180),
  origin_lat double precision NOT NULL CHECK(origin_lat BETWEEN -90 AND 90),
  origin_lng double precision NOT NULL CHECK(origin_lng BETWEEN -180 AND 180),
  destination_lat double precision NOT NULL CHECK(destination_lat BETWEEN -90 AND 90),
  destination_lng double precision NOT NULL CHECK(destination_lng BETWEEN -180 AND 180),
  distance_km numeric(10,3) NOT NULL CHECK(distance_km > 0 AND distance_km < 1500),
  duration_minutes numeric(10,2) NOT NULL CHECK(duration_minutes >= 0),
  customer_pays_cents integer NOT NULL CHECK(customer_pays_cents >= 450),
  driver_receives_cents integer NOT NULL CHECK(driver_receives_cents >= 0),
  commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 0 AND 4000),
  platform_commission_cents integer NOT NULL CHECK(platform_commission_cents >= 0),
  platform_processing_fee_cents integer NOT NULL CHECK(platform_processing_fee_cents >= 0),
  policy_version text NOT NULL,
  activity_id uuid REFERENCES public.caronaa_quick_official_activities(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '3 minutes'),
  ride_id uuid UNIQUE REFERENCES public.professional_quick_rides(id),
  CONSTRAINT quick_quote_balanced CHECK(
    customer_pays_cents = driver_receives_cents + platform_commission_cents
  )
);
CREATE INDEX IF NOT EXISTS quick_fare_user_recent_idx ON public.caronaa_quick_fare_quotes(passenger_id,issued_at DESC);
ALTER TABLE public.caronaa_quick_fare_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_quick_fare_quotes FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.caronaa_coverage_interest (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text NOT NULL CHECK(length(btrim(municipality)) BETWEEN 2 AND 120),
  vehicle_type text NOT NULL CHECK(vehicle_type IN ('CAR','MOTO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,municipality,vehicle_type)
);
ALTER TABLE public.caronaa_coverage_interest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_coverage_interest FROM PUBLIC, anon, authenticated;

-- Public-facing response still requires authenticated user but no GPS is stored.
CREATE OR REPLACE FUNCTION public.caronaa_quick_region_status(p_municipality text,p_vehicle text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r record; enabled boolean; tariff_published boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_vehicle NOT IN ('CAR','MOTO') OR length(btrim(coalesce(p_municipality,''))) NOT BETWEEN 2 AND 120
   THEN RAISE EXCEPTION 'Invalid region or vehicle'; END IF;
 SELECT c.pricing_region, c.car_enabled,c.moto_enabled,
        coalesce(p.public_discovery_enabled,false) AS radar,
        coalesce(p.dispatch_enabled,false) AS dispatch
 INTO r FROM public.caronaa_service_municipalities c
 LEFT JOIN public.professional_service_regions p ON p.municipality=c.municipality
 WHERE lower(c.municipality)=lower(btrim(p_municipality))
 LIMIT 1;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('status','OUTSIDE','region',null,'radar',false,'dispatch',false);
 END IF;
 enabled := CASE WHEN p_vehicle='MOTO' THEN r.moto_enabled ELSE r.car_enabled END;
 SELECT coalesce(published,false) INTO tariff_published
 FROM public.caronaa_quick_tariff_policies
 WHERE pricing_region=r.pricing_region AND vehicle_type=p_vehicle;
 RETURN jsonb_build_object(
   'status', CASE WHEN enabled AND r.dispatch AND r.radar AND coalesce(tariff_published,false)
       THEN 'ENABLED' ELSE 'WAITLIST' END,
   'region',r.pricing_region,
   'radar',r.radar AND r.dispatch AND enabled AND coalesce(tariff_published,false),
   'dispatch',r.dispatch AND enabled AND r.radar AND coalesce(tariff_published,false)
 );
END; $$;
REVOKE ALL ON FUNCTION public.caronaa_quick_region_status(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_region_status(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.caronaa_register_coverage_interest(p_municipality text,p_vehicle text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_vehicle NOT IN ('CAR','MOTO') OR length(btrim(coalesce(p_municipality,''))) NOT BETWEEN 2 AND 120
  THEN RAISE EXCEPTION 'Invalid service interest'; END IF;
 INSERT INTO public.caronaa_coverage_interest(user_id,municipality,vehicle_type)
 VALUES(auth.uid(),left(btrim(p_municipality),120),p_vehicle)
 ON CONFLICT(user_id,municipality,vehicle_type)
 DO UPDATE SET updated_at=now();
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.caronaa_register_coverage_interest(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_register_coverage_interest(text,text) TO authenticated;

-- No exact location in public radar; only opted-in, authorized, fresh drivers.
CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(p_municipality text,p_vehicle text)
RETURNS TABLE(driver_key text,lat double precision,lng double precision,seen_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_vehicle NOT IN ('CAR','MOTO') THEN RETURN; END IF;
 RETURN QUERY
 SELECT md5(l.user_id::text||current_date::text),
   round(l.lat::numeric,2)::double precision,
   round(l.lng::numeric,2)::double precision,l.updated_at
 FROM public.professional_driver_locations l
 JOIN public.professional_presence p ON p.user_id=l.user_id
 JOIN public.professional_driver_authorizations a ON a.user_id=l.user_id
 JOIN public.professional_service_regions r ON r.municipality=l.municipality
 JOIN public.caronaa_service_municipalities c ON c.municipality=l.municipality
 JOIN public.caronaa_quick_tariff_policies t
   ON t.pricing_region=c.pricing_region AND t.vehicle_type=p_vehicle AND t.published
 WHERE l.municipality=btrim(p_municipality)
   AND a.approved AND a.vehicle_type=p_vehicle AND p.is_available
   AND p.last_seen_at>now()-interval '90 seconds'
   AND l.updated_at>now()-interval '90 seconds'
   AND l.user_id<>auth.uid()
   AND r.public_discovery_enabled AND r.dispatch_enabled
   AND CASE WHEN p_vehicle='CAR' THEN c.car_enabled ELSE c.moto_enabled END
 ORDER BY l.updated_at DESC LIMIT 100;
END; $$;
REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.caronaa_quick_submit_quoted(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE q public.caronaa_quick_fare_quotes%ROWTYPE; ride uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.caronaa_quick_fare_quotes WHERE id=p_quote_id FOR UPDATE;
 IF NOT FOUND OR q.passenger_id<>auth.uid() THEN RAISE EXCEPTION 'Quote not found' USING ERRCODE='42501'; END IF;
 IF q.ride_id IS NOT NULL THEN RETURN q.ride_id; END IF;
 IF q.expires_at<=now() THEN RAISE EXCEPTION 'Quote expired'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.caronaa_service_municipalities m
   JOIN public.professional_service_regions p ON p.municipality=m.municipality
   WHERE m.municipality=q.municipality AND m.pricing_region=q.pricing_region
     AND p.public_discovery_enabled AND p.dispatch_enabled
     AND CASE WHEN q.vehicle_type='CAR' THEN m.car_enabled ELSE m.moto_enabled END
 ) THEN RAISE EXCEPTION 'Quick rides are not available in this area' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.caronaa_quick_tariff_policies p
   WHERE p.pricing_region=q.pricing_region AND p.vehicle_type=q.vehicle_type AND p.published)
 THEN RAISE EXCEPTION 'Quick ride tariff no longer available'; END IF;
 -- Original guarded 0129 lifecycle is reused, including active-ride uniqueness.
 ride := public.quick_ride_request(q.municipality,q.vehicle_type,q.origin_label,
   q.destination_label,q.origin_lat,q.origin_lng,q.destination_lat,q.destination_lng);
 UPDATE public.caronaa_quick_fare_quotes SET ride_id=ride WHERE id=q.id;
 RETURN ride;
END; $$;
REVOKE ALL ON FUNCTION public.caronaa_quick_submit_quoted(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_submit_quoted(uuid) TO authenticated;

-- No bypass through legacy direct RPC. The old /viagem-rapida page must
-- redirect to /home, and only the server-verified quote may create new rides.
REVOKE EXECUTE ON FUNCTION public.quick_ride_request(
 text,text,text,text,double precision,double precision,double precision,double precision
) FROM authenticated;

-- Admin control: does not grant itself professional licensing / approval.
CREATE OR REPLACE FUNCTION public.admin_set_caronaa_quick_city(
 p_municipality text,p_car boolean,p_moto boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 UPDATE public.caronaa_service_municipalities
 SET car_enabled=p_car,moto_enabled=p_moto,updated_at=now()
 WHERE municipality=btrim(p_municipality);
 IF NOT FOUND THEN RAISE EXCEPTION 'City not in approved corridor inventory'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_caronaa_quick_city(text,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_caronaa_quick_city(text,boolean,boolean) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_caronaa_quick_commercial_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'cities', coalesce((SELECT jsonb_agg(
    jsonb_build_object('municipality',c.municipality,'region',c.pricing_region,
      'car',c.car_enabled,'moto',c.moto_enabled,
      'interest',coalesce((SELECT count(*) FROM public.caronaa_coverage_interest i
        WHERE i.municipality=c.municipality),0)
    ) ORDER BY c.pricing_region,c.municipality)
    FROM public.caronaa_service_municipalities c),'[]'::jsonb),
  'policies', coalesce((SELECT jsonb_agg(to_jsonb(p)
    ORDER BY p.pricing_region,p.vehicle_type)
    FROM public.caronaa_quick_tariff_policies p),'[]'::jsonb),
  'activities', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.starts_at DESC)
    FROM (SELECT * FROM public.caronaa_quick_official_activities ORDER BY starts_at DESC LIMIT 30) a),'[]'::jsonb)
 );
END; $$;
REVOKE ALL ON FUNCTION public.admin_caronaa_quick_commercial_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_caronaa_quick_commercial_overview() TO authenticated;

-- Secure finance configuration. No consumer/driver can set a margin or campaign.
CREATE OR REPLACE FUNCTION public.admin_set_caronaa_quick_tariff(
 p_region text,p_vehicle text,
 p_base integer,p_per_km integer,p_per_minute integer,p_minimum integer,
 p_commission_bps integer,p_processing_fee integer,p_margin integer,
 p_intermunicipal boolean,p_publish boolean,p_version text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 IF p_region NOT IN ('FORTALEZA_CORRIDOR','MACICO_BATURITE')
    OR p_vehicle NOT IN ('CAR','MOTO')
    OR p_base IS NULL OR p_base<0
    OR p_per_km IS NULL OR p_per_km<0
    OR p_per_minute IS NULL OR p_per_minute<0
    OR p_minimum IS NULL OR p_minimum<450
    OR p_commission_bps IS NULL OR p_commission_bps NOT BETWEEN 0 AND 4000
    OR p_processing_fee IS NULL OR p_processing_fee<0
    OR p_margin IS NULL OR p_margin<0
    OR p_intermunicipal IS NULL OR p_publish IS NULL
    OR length(btrim(coalesce(p_version,''))) NOT BETWEEN 3 AND 100 THEN
   RAISE EXCEPTION 'Invalid quick tariff policy';
 END IF;
 IF p_region='MACICO_BATURITE' AND p_commission_bps<>2000
   THEN RAISE EXCEPTION 'Maciço commission must be 20 percent outside approved events'; END IF;
 IF p_region='MACICO_BATURITE' AND p_vehicle='MOTO' AND p_minimum<>750
   THEN RAISE EXCEPTION 'Maciço moto minimum is R$7.50 in the approved pilot policy'; END IF;
 INSERT INTO public.caronaa_quick_tariff_policies(
   pricing_region,vehicle_type,base_cents,per_km_cents,per_minute_cents,
   minimum_cents,commission_bps,processing_fee_cents,minimum_platform_margin_cents,
   intermunicipal_enabled,published,policy_version,updated_at
 ) VALUES (
   p_region,p_vehicle,p_base,p_per_km,p_per_minute,p_minimum,
   p_commission_bps,p_processing_fee,p_margin,p_intermunicipal,p_publish,
   btrim(p_version),now()
 )
 ON CONFLICT(pricing_region,vehicle_type) DO UPDATE SET
   base_cents=excluded.base_cents,per_km_cents=excluded.per_km_cents,
   per_minute_cents=excluded.per_minute_cents,
   minimum_cents=excluded.minimum_cents,commission_bps=excluded.commission_bps,
   processing_fee_cents=excluded.processing_fee_cents,
   minimum_platform_margin_cents=excluded.minimum_platform_margin_cents,
   intermunicipal_enabled=excluded.intermunicipal_enabled,
   published=excluded.published,policy_version=excluded.policy_version,updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_caronaa_quick_tariff(
 text,text,integer,integer,integer,integer,integer,integer,integer,boolean,boolean,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_caronaa_quick_tariff(
 text,text,integer,integer,integer,integer,integer,integer,integer,boolean,boolean,text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_caronaa_quick_activity(
 p_id uuid,p_title text,p_city text,
 p_starts_at timestamptz,p_ends_at timestamptz,
 p_lat double precision,p_lng double precision,p_radius_m integer,
 p_published boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at<=p_starts_at
    OR length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 160
    OR p_lat IS NULL OR p_lng IS NULL
    OR NOT (p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180)
    OR p_radius_m IS NULL OR p_radius_m NOT BETWEEN 100 AND 30000
    OR p_published IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.caronaa_service_municipalities c WHERE c.municipality=btrim(p_city)
    ) THEN
  RAISE EXCEPTION 'Invalid official activity';
 END IF;
 v_id:=coalesce(p_id,gen_random_uuid());
 INSERT INTO public.caronaa_quick_official_activities(
   id,title,municipality,starts_at,ends_at,center_lat,center_lng,radius_m,published
 ) VALUES(v_id,btrim(p_title),btrim(p_city),p_starts_at,p_ends_at,p_lat,p_lng,p_radius_m,p_published)
 ON CONFLICT(id) DO UPDATE SET
   title=excluded.title,municipality=excluded.municipality,
   starts_at=excluded.starts_at,ends_at=excluded.ends_at,
   center_lat=excluded.center_lat,center_lng=excluded.center_lng,
   radius_m=excluded.radius_m,published=excluded.published,updated_at=now();
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_upsert_caronaa_quick_activity(
 uuid,text,text,timestamptz,timestamptz,double precision,double precision,integer,boolean
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_caronaa_quick_activity(
 uuid,text,text,timestamptz,timestamptz,double precision,double precision,integer,boolean
) TO authenticated;

COMMENT ON TABLE public.caronaa_quick_fare_quotes IS
 'Server-generated immutable quick ride fare snapshots. No automatic Pix/Asaas settlement.';
COMMENT ON TABLE public.caronaa_service_municipalities IS
 'Staged geographical coverage from Fortaleza through Maracanau/Pacatuba/Guaiuba to Macico. All new modes OFF by default.';
NOTIFY pgrst,'reload schema';
COMMIT;
