-- 0206 | CARONAA GPS quality and Flash contract repair.
-- Apply MANUALLY in the Supabase SQL editor only after reviewing the target environment.
-- This migration is never executed by ChatGPT. A single transaction prevents partial upgrades.
-- The public discovery endpoint reveals ONLY ~100m positions; precise GPS is for
-- authorized ride participants after the ride has been accepted.
BEGIN;

ALTER TABLE public.flash_driver_presence
  ADD COLUMN IF NOT EXISTS last_sampled_at timestamptz;

-- The privileged server validates Google municipality and browser timestamp.
-- Preserve the real sample timestamp instead of converting old fixes into fresh GPS.
CREATE OR REPLACE FUNCTION public.publish_verified_professional_position_v2(
  p_user_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m double precision, p_municipality text, p_sampled_at_ms bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $gps_publish$
DECLARE
  v_sample timestamptz;
  v_city text := btrim(coalesce(p_municipality,''));
  v_vehicle text;
  v_previous public.professional_driver_locations%ROWTYPE;
  v_elapsed double precision;
  v_distance double precision;
BEGIN
  IF p_user_id IS NULL OR p_sampled_at_ms IS NULL OR
     p_lat IS NULL OR p_lng IS NULL OR p_accuracy_m IS NULL OR
     NOT (p_lat BETWEEN -90 AND 90) OR NOT (p_lng BETWEEN -180 AND 180) OR
     NOT (p_accuracy_m > 0 AND p_accuracy_m <= 150) THEN
    RAISE EXCEPTION 'GPS_INVALID_FIX' USING ERRCODE='22023';
  END IF;
  v_sample := to_timestamp(p_sampled_at_ms::double precision / 1000.0);
  IF v_sample < now()-interval '30 seconds' OR v_sample > now()+interval '5 seconds' THEN
    RAISE EXCEPTION 'GPS_STALE_SAMPLE' USING ERRCODE='22023';
  END IF;
  SELECT a.vehicle_type INTO v_vehicle
    FROM public.professional_driver_authorizations a
    WHERE a.user_id=p_user_id AND a.approved=true;
  IF v_vehicle NOT IN ('CAR','MOTO') OR v_vehicle IS NULL OR
     NOT public.driver_platform_access_allowed(p_user_id) THEN
    RAISE EXCEPTION 'DRIVER_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.professional_service_regions r
    JOIN public.caronaa_service_municipalities c ON c.municipality=r.municipality
    WHERE r.municipality=v_city AND r.public_discovery_enabled
      AND CASE WHEN v_vehicle='MOTO' THEN c.moto_enabled ELSE c.car_enabled END
  ) THEN
    RAISE EXCEPTION 'MUNICIPALITY_NOT_ENABLED' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.professional_presence p
    WHERE p.user_id=p_user_id AND p.is_available=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_OFFLINE' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_previous FROM public.professional_driver_locations
    WHERE user_id=p_user_id FOR UPDATE;
  IF FOUND THEN
    v_elapsed := extract(epoch FROM (v_sample-v_previous.sampled_at));
    IF v_elapsed <= 0 THEN
      RAISE EXCEPTION 'GPS_OLDER_THAN_LAST_SAMPLE' USING ERRCODE='22023';
    END IF;
    IF v_elapsed <= 90 THEN
      v_distance := 6371000.0*2*asin(least(1.0,sqrt(
        power(sin(radians((p_lat-v_previous.lat)/2)),2) +
        cos(radians(v_previous.lat))*cos(radians(p_lat))*
        power(sin(radians((p_lng-v_previous.lng)/2)),2)
      )));
      IF v_distance > greatest(300.0, v_elapsed*65.0+
          v_previous.accuracy_m+p_accuracy_m) THEN
        RAISE EXCEPTION 'GPS_IMPLAUSIBLE_JUMP' USING ERRCODE='22023';
      END IF;
    END IF;
  END IF;
  UPDATE public.professional_presence
    SET municipality=v_city,last_seen_at=now(),updated_at=now()
    WHERE user_id=p_user_id AND is_available=true;
  INSERT INTO public.professional_driver_locations
    (user_id,municipality,lat,lng,accuracy_m,sampled_at,updated_at)
    VALUES(p_user_id,v_city,p_lat,p_lng,p_accuracy_m,v_sample,now())
    ON CONFLICT(user_id) DO UPDATE SET
      municipality=EXCLUDED.municipality,
      lat=EXCLUDED.lat,lng=EXCLUDED.lng,
      accuracy_m=EXCLUDED.accuracy_m,sampled_at=EXCLUDED.sampled_at,
      updated_at=now();
  RETURN true;
END
$gps_publish$;
REVOKE ALL ON FUNCTION public.publish_verified_professional_position_v2(
  uuid,double precision,double precision,double precision,text,bigint
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_verified_professional_position_v2(
  uuid,double precision,double precision,double precision,text,bigint
) TO service_role;

-- Legacy privileged callers remain compatible, with accuracy <=150m.
-- New code always uses the timestamp-aware _v2 endpoint.
CREATE OR REPLACE FUNCTION public.publish_verified_professional_position(
  p_user_id uuid,p_lat double precision,p_lng double precision,
  p_accuracy_m double precision,p_municipality text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $gps_compat$
BEGIN
  RETURN public.publish_verified_professional_position_v2(
    p_user_id,p_lat,p_lng,p_accuracy_m,p_municipality,
    floor(extract(epoch FROM clock_timestamp())*1000)::bigint
  );
END
$gps_compat$;
REVOKE ALL ON FUNCTION public.publish_verified_professional_position(
  uuid,double precision,double precision,double precision,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_verified_professional_position(
  uuid,double precision,double precision,double precision,text
) TO service_role;

-- Online/Offline: use the real professional_presence schema, never is_online.
-- Do not silently grant permission from a client-supplied vehicle or municipality.
CREATE OR REPLACE FUNCTION public.set_flash_driver_online(
  p_is_online boolean,
  p_dispatch_mode text DEFAULT 'ALL',
  p_available_seats integer DEFAULT 4,
  p_destination_label text DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL,
  p_destination_lng double precision DEFAULT NULL,
  p_destination_municipality text DEFAULT NULL,
  p_route_geojson jsonb DEFAULT NULL,
  p_route_polyline text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $flash_online$
DECLARE
  v_uid uuid := auth.uid();
  v_vehicle text;
  v_route public.geometry;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_is_online IS NULL OR p_dispatch_mode NOT IN ('ALL','ON_ROUTE','EXCLUSIVE') OR
     p_available_seats IS NULL OR p_available_seats < 1 OR p_available_seats > 7 THEN
    RAISE EXCEPTION 'INVALID_FLASH_CONFIGURATION' USING ERRCODE='22023';
  END IF;
  IF p_is_online THEN
    SELECT a.vehicle_type INTO v_vehicle FROM public.professional_driver_authorizations a
      WHERE a.user_id=v_uid AND a.approved=true;
    IF v_vehicle NOT IN ('CAR','MOTO') OR v_vehicle IS NULL THEN
      RAISE EXCEPTION 'DRIVER_NOT_AUTHORIZED' USING ERRCODE='42501';
    END IF;
    IF NOT public.driver_platform_access_allowed(v_uid) THEN
      RAISE EXCEPTION 'COMMISSION_BLOCKED' USING ERRCODE='42501';
    END IF;
    IF v_vehicle='MOTO' AND p_available_seats<>1 THEN
      RAISE EXCEPTION 'MOTO_ONE_SEAT_ONLY' USING ERRCODE='22023';
    END IF;
    IF p_destination_lat IS NOT NULL OR p_destination_lng IS NOT NULL THEN
      IF NOT (p_destination_lat BETWEEN -90 AND 90) OR
         NOT (p_destination_lng BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'INVALID_DESTINATION' USING ERRCODE='22023';
      END IF;
    END IF;
    IF p_route_geojson IS NOT NULL THEN
      BEGIN
        v_route := public.ST_SetSRID(public.ST_GeomFromGeoJSON(p_route_geojson),4326);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'INVALID_ROUTE_GEOMETRY' USING ERRCODE='22023';
      END;
      IF public.ST_GeometryType(v_route)<>'ST_LineString' OR
         NOT public.ST_IsValid(v_route) OR
         public.ST_NPoints(v_route)<2 OR public.ST_NPoints(v_route)>500 THEN
        RAISE EXCEPTION 'INVALID_ROUTE_GEOMETRY' USING ERRCODE='22023';
      END IF;
    END IF;
    IF p_dispatch_mode='ON_ROUTE' AND
       (p_destination_lat IS NULL OR p_destination_lng IS NULL OR v_route IS NULL) THEN
      RAISE EXCEPTION 'ON_ROUTE_REQUIRES_ROUTE' USING ERRCODE='22023';
    END IF;
  END IF;

  INSERT INTO public.flash_driver_presence
    (user_id,is_online,dispatch_mode,available_seats,destination_label,
     destination_lat,destination_lng,destination_municipality,
     route_geom,route_polyline,last_lat,last_lng,last_accuracy_m,
     current_municipality,last_gps_at,last_sampled_at,updated_at)
  VALUES(v_uid,p_is_online,p_dispatch_mode,p_available_seats,
    CASE WHEN p_is_online THEN p_destination_label ELSE NULL END,
    CASE WHEN p_is_online THEN p_destination_lat ELSE NULL END,
    CASE WHEN p_is_online THEN p_destination_lng ELSE NULL END,
    NULL,v_route,
    CASE WHEN p_is_online THEN p_route_polyline ELSE NULL END,
    NULL,NULL,NULL,NULL,NULL,NULL,now())
  ON CONFLICT(user_id) DO UPDATE SET
    is_online=EXCLUDED.is_online,
    dispatch_mode=EXCLUDED.dispatch_mode,
    available_seats=EXCLUDED.available_seats,
    destination_label=EXCLUDED.destination_label,
    destination_lat=EXCLUDED.destination_lat,
    destination_lng=EXCLUDED.destination_lng,
    destination_municipality=NULL,
    route_geom=EXCLUDED.route_geom,
    route_polyline=EXCLUDED.route_polyline,
    last_lat=NULL,last_lng=NULL,last_accuracy_m=NULL,
    current_municipality=NULL,last_gps_at=NULL,last_sampled_at=NULL,updated_at=now();

  INSERT INTO public.professional_presence
    (user_id,is_available,mode,last_seen_at,municipality,updated_at)
  VALUES(v_uid,p_is_online,'LOCAL',now(),NULL,now())
  ON CONFLICT(user_id) DO UPDATE SET
    is_available=EXCLUDED.is_available,
    mode='LOCAL',last_seen_at=now(),municipality=NULL,updated_at=now();

  IF NOT p_is_online THEN
    DELETE FROM public.professional_driver_locations WHERE user_id=v_uid;
  END IF;
  RETURN jsonb_build_object('is_online',p_is_online,
    'dispatch_mode',p_dispatch_mode,'available_seats',p_available_seats,
    'has_route',v_route IS NOT NULL);
END
$flash_online$;
REVOKE ALL ON FUNCTION public.set_flash_driver_online(
  boolean,text,integer,text,double precision,double precision,text,jsonb,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_flash_driver_online(
  boolean,text,integer,text,double precision,double precision,text,jsonb,text
) TO authenticated;

-- Never write unchecked client coordinates directly into the professional radar.
-- A recent, accurate, municipality-verified sample is required first.
CREATE OR REPLACE FUNCTION public.update_flash_driver_heartbeat_gps_v2(
  p_lat double precision,p_lng double precision,p_accuracy_m double precision,
  p_sampled_at_ms bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $flash_heartbeat$
DECLARE
  v_uid uuid := auth.uid();
  v_sample timestamptz;
  v_flash public.flash_driver_presence%ROWTYPE;
  v_fix public.professional_driver_locations%ROWTYPE;
  v_vehicle text;
  v_meters double precision;
  v_elapsed double precision;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_sampled_at_ms IS NULL OR p_lat IS NULL OR p_lng IS NULL OR p_accuracy_m IS NULL
     OR NOT (p_lat BETWEEN -90 AND 90) OR NOT (p_lng BETWEEN -180 AND 180)
     OR NOT (p_accuracy_m > 0 AND p_accuracy_m <=150) THEN
    RAISE EXCEPTION 'INVALID_GPS_FIX' USING ERRCODE='22023';
  END IF;
  v_sample:=to_timestamp(p_sampled_at_ms::double precision/1000.0);
  IF v_sample<now()-interval '30 seconds' OR v_sample>now()+interval '5 seconds' THEN
    RAISE EXCEPTION 'STALE_GPS_FIX' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_flash FROM public.flash_driver_presence
    WHERE user_id=v_uid FOR UPDATE;
  IF NOT FOUND OR NOT v_flash.is_online THEN
    RAISE EXCEPTION 'FLASH_DRIVER_OFFLINE' USING ERRCODE='42501';
  END IF;
  IF v_flash.last_sampled_at IS NOT NULL AND v_sample<=v_flash.last_sampled_at THEN
    RETURN jsonb_build_object('success',false,'reason','STALE_OR_REPLAYED_GPS');
  END IF;
  SELECT a.vehicle_type INTO v_vehicle FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved=true;
  IF v_vehicle NOT IN ('CAR','MOTO') OR v_vehicle IS NULL OR
     NOT public.driver_platform_access_allowed(v_uid) THEN
    RAISE EXCEPTION 'DRIVER_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  SELECT l.* INTO v_fix FROM public.professional_driver_locations l
    JOIN public.professional_service_regions r
      ON r.municipality=l.municipality AND r.public_discovery_enabled
    JOIN public.caronaa_service_municipalities c
      ON c.municipality=l.municipality
    WHERE l.user_id=v_uid AND l.accuracy_m<=150
      AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND CASE WHEN v_vehicle='MOTO' THEN c.moto_enabled ELSE c.car_enabled END;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.professional_presence p
    WHERE p.user_id=v_uid AND p.is_available
      AND p.last_seen_at>now()-interval '90 seconds'
  ) THEN
    RAISE EXCEPTION 'VERIFIED_GPS_REQUIRED' USING ERRCODE='42501';
  END IF;
  v_meters:=6371000.0*2*asin(least(1.0,sqrt(
    power(sin(radians((p_lat-v_fix.lat)/2)),2) +
    cos(radians(v_fix.lat))*cos(radians(p_lat))*
    power(sin(radians((p_lng-v_fix.lng)/2)),2)
  )));
  v_elapsed:=extract(epoch FROM (now()-v_fix.sampled_at));
  IF v_meters>least(1500.0,greatest(150.0,v_elapsed*45.0+
    v_fix.accuracy_m+p_accuracy_m+75.0)) THEN
    RAISE EXCEPTION 'GPS_IMPLAUSIBLE_JUMP' USING ERRCODE='22023';
  END IF;
  IF v_flash.last_sampled_at IS NOT NULL AND
      v_flash.last_lat IS NOT NULL AND v_flash.last_lng IS NOT NULL THEN
    v_elapsed:=extract(epoch FROM (v_sample-v_flash.last_sampled_at));
    v_meters:=6371000.0*2*asin(least(1.0,sqrt(
      power(sin(radians((p_lat-v_flash.last_lat)/2)),2) +
      cos(radians(v_flash.last_lat))*cos(radians(p_lat))*
      power(sin(radians((p_lng-v_flash.last_lng)/2)),2)
    )));
    IF v_meters>greatest(200.0,v_elapsed*55.0+
        coalesce(v_flash.last_accuracy_m,0)+p_accuracy_m) THEN
      RAISE EXCEPTION 'GPS_IMPLAUSIBLE_JUMP' USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE public.flash_driver_presence SET
    last_lat=p_lat,last_lng=p_lng,last_accuracy_m=p_accuracy_m,
    current_municipality=v_fix.municipality,last_gps_at=now(),
    last_sampled_at=v_sample,updated_at=now()
    WHERE user_id=v_uid AND is_online=true;
  UPDATE public.professional_presence SET
    last_seen_at=now(),municipality=v_fix.municipality,updated_at=now()
    WHERE user_id=v_uid AND is_available=true;
  RETURN jsonb_build_object('success',true,'municipality',v_fix.municipality);
END
$flash_heartbeat$;
REVOKE ALL ON FUNCTION public.update_flash_driver_heartbeat_gps_v2(
  double precision,double precision,double precision,bigint
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_flash_driver_heartbeat_gps_v2(
  double precision,double precision,double precision,bigint
) TO authenticated;

-- Retire the insecure legacy RPC: it used nonexistent latitude/longitude columns.
REVOKE ALL ON FUNCTION public.update_flash_driver_heartbeat_gps(
  double precision,double precision,double precision,text
) FROM PUBLIC,anon,authenticated;

-- Public radar: approximate ~100m markers only, with strict quality/age/fees,
-- never the driver's raw point or a marker representing the viewer's own car.
CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(
  p_lat double precision,p_lng double precision,p_vehicle text,
  p_radius_km double precision DEFAULT 15.0
) RETURNS TABLE(driver_key text,lat double precision,lng double precision,
  seen_at timestamptz,distance_km double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $radar_radius$
DECLARE v_radius double precision:=least(greatest(coalesce(p_radius_km,15),1),30);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_vehicle NOT IN ('CAR','MOTO') OR
     NOT (p_lat BETWEEN -90 AND 90) OR NOT (p_lng BETWEEN -180 AND 180)
  THEN RETURN; END IF;
  RETURN QUERY
  WITH c AS(
    SELECT md5(l.user_id::text||current_date::text) AS k,
      round(l.lat::numeric,3)::double precision AS approx_lat,
      round(l.lng::numeric,3)::double precision AS approx_lng,
      l.updated_at AS seen,
      (6371.0*2*asin(least(1.0,sqrt(
        power(sin(radians((l.lat-p_lat)/2)),2)+
        cos(radians(p_lat))*cos(radians(l.lat))*
        power(sin(radians((l.lng-p_lng)/2)),2)
      )))) AS km
    FROM public.professional_driver_locations l
    JOIN public.professional_presence p
      ON p.user_id=l.user_id AND p.is_available
      AND p.municipality=l.municipality
    JOIN public.professional_driver_authorizations a
      ON a.user_id=l.user_id AND a.approved AND a.vehicle_type=p_vehicle
    JOIN public.professional_service_regions r
      ON r.municipality=l.municipality AND r.public_discovery_enabled
    WHERE l.user_id<>auth.uid()
      AND public.driver_platform_access_allowed(l.user_id)
      AND l.accuracy_m<=150 AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND p.last_seen_at>now()-interval '90 seconds'
  )
  SELECT k,approx_lat,approx_lng,seen,round(km::numeric,1)::double precision
    FROM c WHERE km<=v_radius ORDER BY km LIMIT 50;
END
$radar_radius$;
REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(
  double precision,double precision,text,double precision
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(
  double precision,double precision,text,double precision
) TO authenticated;

CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(
  p_municipality text,p_vehicle text
) RETURNS TABLE(driver_key text,lat double precision,lng double precision,
  seen_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $radar_legacy$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_vehicle NOT IN ('CAR','MOTO') THEN RETURN; END IF;
  RETURN QUERY
  SELECT md5(l.user_id::text||current_date::text),
    round(l.lat::numeric,3)::double precision,
    round(l.lng::numeric,3)::double precision,l.updated_at
  FROM public.professional_driver_locations l
  JOIN public.professional_presence p
    ON p.user_id=l.user_id AND p.is_available AND p.municipality=l.municipality
  JOIN public.professional_driver_authorizations a
    ON a.user_id=l.user_id AND a.approved AND a.vehicle_type=p_vehicle
  JOIN public.professional_service_regions r
    ON r.municipality=l.municipality AND r.public_discovery_enabled
  WHERE l.municipality=btrim(p_municipality)
    AND l.user_id<>auth.uid()
    AND public.driver_platform_access_allowed(l.user_id)
    AND l.accuracy_m<=150 AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
    AND p.last_seen_at>now()-interval '90 seconds'
  ORDER BY l.updated_at DESC LIMIT 100;
END
$radar_legacy$;
REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  TO authenticated;

-- Query only eligible, server-confirmed Flash drivers and dispatchable trips.
-- Preserve the existing PostgREST table return signature.
CREATE OR REPLACE FUNCTION public.get_flash_driver_radar_orders(
  p_max_distance_m integer DEFAULT 15000
) RETURNS TABLE(
  ride_id uuid,passenger_id uuid,passenger_name text,passenger_avatar text,
  municipality text,vehicle_type text,service_mode text,origin_label text,
  origin_lat double precision,origin_lng double precision,
  destination_label text,destination_lat double precision,
  destination_lng double precision,meeting_point_label text,
  meeting_point_lat double precision,meeting_point_lng double precision,
  walk_distance_m integer,seats_requested integer,
  estimated_fare_cents integer,driver_earnings_cents integer,
  distance_to_pickup_m double precision,expires_in_seconds integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $flash_orders$
DECLARE
  v_uid uuid:=auth.uid();
  v_vehicle text;
  v_flash public.flash_driver_presence%ROWTYPE;
  v_radius integer:=least(greatest(coalesce(p_max_distance_m,15000),1000),30000);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT a.vehicle_type INTO v_vehicle FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved=true;
  IF v_vehicle IS NULL OR NOT public.driver_platform_access_allowed(v_uid) THEN RETURN; END IF;
  SELECT * INTO v_flash FROM public.flash_driver_presence
    WHERE user_id=v_uid AND is_online AND last_gps_at>now()-interval '90 seconds'
      AND last_sampled_at>now()-interval '90 seconds'
      AND last_accuracy_m<=150;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.professional_driver_locations l
    JOIN public.professional_presence p ON p.user_id=l.user_id
    WHERE l.user_id=v_uid AND l.accuracy_m<=150
      AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND p.is_available AND p.last_seen_at>now()-interval '90 seconds'
  ) THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.id,r.passenger_id,coalesce(p.full_name,'Passageiro'),p.avatar_url,
    r.municipality,r.vehicle_type,coalesce(r.service_mode,'EXCLUSIVE'),
    r.origin_label,r.origin_lat,r.origin_lng,r.destination_label,
    r.destination_lat,r.destination_lng,r.meeting_point_label,
    r.meeting_point_lat,r.meeting_point_lng,
    coalesce(r.walk_distance_m,0),coalesce(r.seats_requested,1),
    r.estimated_fare_cents,r.driver_earnings_cents,
    public.ST_Distance(
      public.ST_SetSRID(public.ST_MakePoint(v_flash.last_lng,v_flash.last_lat),4326)::geography,
      public.ST_SetSRID(public.ST_MakePoint(
        coalesce(r.meeting_point_lng,r.origin_lng),
        coalesce(r.meeting_point_lat,r.origin_lat)),4326)::geography
    ) AS distance_to_pickup_m,
    greatest(0,extract(epoch FROM (r.expires_at-now()))::integer)
  FROM public.professional_quick_rides r
  JOIN public.profiles p ON p.id=r.passenger_id
  JOIN public.professional_service_regions sr
    ON sr.municipality=r.municipality AND sr.dispatch_enabled
  JOIN public.caronaa_service_municipalities cm
    ON cm.municipality=r.municipality
  WHERE r.status='SEARCHING' AND r.expires_at>now()
    AND r.passenger_id<>v_uid AND r.vehicle_type=v_vehicle
    AND coalesce(r.seats_requested,1)<=v_flash.available_seats
    AND CASE WHEN v_vehicle='MOTO' THEN cm.moto_enabled ELSE cm.car_enabled END
    AND NOT EXISTS(
      SELECT 1 FROM public.flash_order_driver_skips s
      WHERE s.ride_id=r.id AND s.driver_id=v_uid
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.professional_quick_rides active
      WHERE active.driver_id=v_uid
        AND active.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
    )
    AND (
      (v_flash.dispatch_mode IN ('ALL','EXCLUSIVE') AND public.ST_DWithin(
        public.ST_SetSRID(public.ST_MakePoint(v_flash.last_lng,v_flash.last_lat),4326)::geography,
        public.ST_SetSRID(public.ST_MakePoint(
          coalesce(r.meeting_point_lng,r.origin_lng),
          coalesce(r.meeting_point_lat,r.origin_lat)),4326)::geography,
        v_radius
      ))
      OR
      (v_flash.dispatch_mode IN ('ALL','ON_ROUTE') AND v_flash.route_geom IS NOT NULL
        AND public.ST_DWithin(v_flash.route_geom::geography,
          public.ST_SetSRID(public.ST_MakePoint(
            coalesce(r.meeting_point_lng,r.origin_lng),
            coalesce(r.meeting_point_lat,r.origin_lat)),4326)::geography,500))
    )
  ORDER BY 21 ASC LIMIT 5;
END
$flash_orders$;
REVOKE ALL ON FUNCTION public.get_flash_driver_radar_orders(integer)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_flash_driver_radar_orders(integer)
  TO authenticated;

-- Accepting a ride cannot bypass verified driver, proximity or debt checks.
-- PIN is intentionally not returned to the DRIVER in the acceptance response.
CREATE OR REPLACE FUNCTION public.respond_flash_order(
  p_ride_id uuid,p_accept boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $flash_accept$
DECLARE
  v_uid uuid:=auth.uid();
  v_vehicle text;
  v_flash public.flash_driver_presence%ROWTYPE;
  v_ride public.professional_quick_rides%ROWTYPE;
  v_pin text;
  v_near boolean:=false;
  v_pickup public.geography;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT coalesce(p_accept,false) THEN
    INSERT INTO public.flash_order_driver_skips(ride_id,driver_id,skipped_at)
    VALUES(p_ride_id,v_uid,now()) ON CONFLICT(ride_id,driver_id) DO NOTHING;
    RETURN jsonb_build_object('success',true,'action','SKIPPED');
  END IF;
  SELECT a.vehicle_type INTO v_vehicle FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved=true;
  IF v_vehicle IS NULL OR NOT public.driver_platform_access_allowed(v_uid) THEN
    RAISE EXCEPTION 'DRIVER_NOT_AUTHORIZED_OR_FEES' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_flash FROM public.flash_driver_presence
    WHERE user_id=v_uid AND is_online
      AND last_gps_at>now()-interval '90 seconds'
      AND last_sampled_at>now()-interval '90 seconds'
      AND last_accuracy_m<=150 FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.professional_driver_locations l
    JOIN public.professional_presence p ON p.user_id=l.user_id
    WHERE l.user_id=v_uid AND l.accuracy_m<=150
      AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND p.is_available AND p.last_seen_at>now()-interval '90 seconds'
  ) THEN
    RAISE EXCEPTION 'VERIFIED_GPS_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_ride FROM public.professional_quick_rides
    WHERE id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR v_ride.status<>'SEARCHING' OR v_ride.expires_at<=now() THEN
    RAISE EXCEPTION 'ALREADY_TAKEN' USING ERRCODE='P0001';
  END IF;
  IF v_ride.passenger_id=v_uid OR v_ride.vehicle_type<>v_vehicle OR
     coalesce(v_ride.seats_requested,1)>v_flash.available_seats OR
     NOT EXISTS(
       SELECT 1 FROM public.professional_service_regions r
       JOIN public.caronaa_service_municipalities c ON c.municipality=r.municipality
       WHERE r.municipality=v_ride.municipality AND r.dispatch_enabled
         AND CASE WHEN v_vehicle='MOTO' THEN c.moto_enabled ELSE c.car_enabled END
     ) OR EXISTS(
       SELECT 1 FROM public.professional_quick_rides active
       WHERE active.driver_id=v_uid AND active.id<>p_ride_id
         AND active.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
     ) THEN
    RAISE EXCEPTION 'RIDE_NOT_ELIGIBLE' USING ERRCODE='42501';
  END IF;
  v_pickup:=public.ST_SetSRID(public.ST_MakePoint(
    coalesce(v_ride.meeting_point_lng,v_ride.origin_lng),
    coalesce(v_ride.meeting_point_lat,v_ride.origin_lat)),4326)::geography;
  IF v_flash.dispatch_mode IN ('ALL','EXCLUSIVE') THEN
    v_near:=public.ST_DWithin(
      public.ST_SetSRID(public.ST_MakePoint(v_flash.last_lng,v_flash.last_lat),4326)::geography,
      v_pickup,15000);
  END IF;
  IF NOT v_near AND v_flash.dispatch_mode IN ('ALL','ON_ROUTE')
      AND v_flash.route_geom IS NOT NULL THEN
    v_near:=public.ST_DWithin(v_flash.route_geom::geography,v_pickup,500);
  END IF;
  IF NOT v_near THEN RAISE EXCEPTION 'OUTSIDE_DISPATCH_RADIUS' USING ERRCODE='42501'; END IF;
  v_pin:=lpad((floor(random()*9000)+1000)::text,4,'0');
  UPDATE public.professional_quick_rides SET
    driver_id=v_uid,status='ACCEPTED',accepted_at=now(),start_pin=v_pin,updated_at=now()
  WHERE id=p_ride_id AND status='SEARCHING' AND expires_at>now()
  RETURNING * INTO v_ride;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_TAKEN' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.caronaa_quick_queue_events
    (ride_id,driver_id,event_type,created_at)
    VALUES(p_ride_id,v_uid,'ORDER_ACCEPTED',now());
  RETURN jsonb_build_object('success',true,'action','ACCEPTED',
    'ride_id',v_ride.id,'status',v_ride.status,
    'origin_label',v_ride.origin_label,'destination_label',v_ride.destination_label);
END
$flash_accept$;
REVOKE ALL ON FUNCTION public.respond_flash_order(uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_flash_order(uuid,boolean)
  TO authenticated;

-- Older F07 accept RPC must use exactly the same secure dispatcher.
CREATE OR REPLACE FUNCTION public.quick_ride_accept(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $legacy_accept$
BEGIN
  PERFORM public.respond_flash_order(p_id,true);
  RETURN true;
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  RETURN false;
END
$legacy_accept$;
REVOKE ALL ON FUNCTION public.quick_ride_accept(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_accept(uuid) TO authenticated;

-- Align the deployed arrival guard with migration 0153 and with the UI.
-- Use the actual boarding point when a meeting point was chosen.
CREATE OR REPLACE FUNCTION public.quick_ride_detect_arrival(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $arrival$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF auth.uid() IS NULL OR NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Ride unavailable' USING ERRCODE='42501';
  END IF;
  IF q.status='ARRIVED' THEN RETURN true; END IF;
  IF q.status<>'ACCEPTED' THEN RETURN false; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.professional_driver_locations l
    WHERE l.user_id=q.driver_id AND l.accuracy_m<=50
      AND l.sampled_at>=now()-interval '45 seconds'
      AND l.updated_at>=now()-interval '45 seconds'
      AND 6371000.0*2*asin(least(1.0,sqrt(
        power(sin(radians((l.lat-coalesce(q.meeting_point_lat,q.origin_lat))/2)),2)+
        cos(radians(coalesce(q.meeting_point_lat,q.origin_lat)))*cos(radians(l.lat))*
        power(sin(radians((l.lng-coalesce(q.meeting_point_lng,q.origin_lng))/2)),2)
      )))<=75
  ) THEN RETURN false; END IF;
  UPDATE public.professional_quick_rides
    SET status='ARRIVED',arrived_at=now(),updated_at=now() WHERE id=p_id;
  RETURN true;
END
$arrival$;
REVOKE ALL ON FUNCTION public.quick_ride_detect_arrival(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_detect_arrival(uuid) TO authenticated;

-- Only the passenger and assigned driver can see precise operational GPS.
-- Never treat the reported point as live when it is >90s old or >150m accuracy.
CREATE OR REPLACE FUNCTION public.quick_ride_map_context(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $ride_map$
DECLARE q public.professional_quick_rides%ROWTYPE; v_point jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id;
  IF NOT FOUND OR (q.passenger_id<>auth.uid() AND q.driver_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Ride unavailable' USING ERRCODE='42501';
  END IF;
  IF q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS') THEN
    SELECT jsonb_build_object(
      'lat',l.lat,'lng',l.lng,'seenAt',l.updated_at,
      'sampledAt',l.sampled_at,'accuracyM',l.accuracy_m
    ) INTO v_point
    FROM public.professional_driver_locations l
    JOIN public.professional_driver_authorizations a
      ON a.user_id=l.user_id AND a.approved
    JOIN public.professional_presence p
      ON p.user_id=l.user_id AND p.is_available
    WHERE l.user_id=q.driver_id
      AND l.accuracy_m<=150
      AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND p.last_seen_at>now()-interval '90 seconds';
  END IF;
  RETURN jsonb_build_object(
    'id',q.id,'status',
    CASE WHEN q.status='SEARCHING' AND q.expires_at<now() THEN 'EXPIRED'
      ELSE q.status END,
    'origin',jsonb_build_object(
      'lat',coalesce(q.meeting_point_lat,q.origin_lat),
      'lng',coalesce(q.meeting_point_lng,q.origin_lng)),
    'destination',jsonb_build_object('lat',q.destination_lat,'lng',q.destination_lng),
    'driver',v_point
  );
END
$ride_map$;
REVOKE ALL ON FUNCTION public.quick_ride_map_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_map_context(uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
