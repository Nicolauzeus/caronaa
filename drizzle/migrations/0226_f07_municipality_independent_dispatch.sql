-- 0226: Municipality-independent driver dispatch; GPS, authorization, 15-km radius and fare rules preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.update_flash_driver_heartbeat_gps(
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision DEFAULT NULL,
  p_municipality text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $heartbeat$
DECLARE
  v_uid uuid := auth.uid();
  v_city text := btrim(coalesce(p_municipality,''));
  v_updated uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy_m IS NULL
     OR NOT (p_lat BETWEEN -90 AND 90)
     OR NOT (p_lng BETWEEN -180 AND 180)
     OR NOT (p_accuracy_m > 0 AND p_accuracy_m <= 150) THEN
    RAISE EXCEPTION 'GPS_ACCURACY_REQUIRED' USING ERRCODE='22023';
  END IF;
  
  -- Online is only valid when an active Flash session already exists.
  UPDATE public.flash_driver_presence
  SET last_lat=p_lat, last_lng=p_lng,
      last_accuracy_m=p_accuracy_m, current_municipality=v_city,
      last_gps_at=now(), last_sampled_at=now(), updated_at=now()
  WHERE user_id=v_uid AND is_online=true
  RETURNING user_id INTO v_updated;
  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'FLASH_DRIVER_NOT_ONLINE' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.professional_presence(
    user_id,is_available,mode,last_seen_at,municipality,updated_at
  ) VALUES(v_uid,true,'LOCAL',now(),v_city,now())
  ON CONFLICT(user_id) DO UPDATE SET
    is_available=true,mode='LOCAL',last_seen_at=now(),
    municipality=EXCLUDED.municipality,updated_at=now();
  INSERT INTO public.professional_driver_locations(
    user_id,municipality,lat,lng,accuracy_m,sampled_at,updated_at
  ) VALUES(v_uid,v_city,p_lat,p_lng,p_accuracy_m,now(),now())
  ON CONFLICT(user_id) DO UPDATE SET
    municipality=EXCLUDED.municipality,
    lat=EXCLUDED.lat,lng=EXCLUDED.lng,accuracy_m=EXCLUDED.accuracy_m,
    sampled_at=now(),updated_at=now();
  RETURN jsonb_build_object('success',true,'published',true,'municipality',v_city);
END;
$heartbeat$;
CREATE OR REPLACE FUNCTION public.quick_ride_driver_queue(p_municipality text)
 RETURNS TABLE(id uuid, vehicle_type text, origin_label text, destination_label text, requested_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    q.id,q.vehicle_type,
    q.municipality || ' - embarque proximo',
    q.municipality || ' - destino reservado',
    q.requested_at,q.expires_at
  FROM public.professional_quick_rides q
  JOIN public.professional_driver_authorizations a
    ON a.user_id=auth.uid() AND a.approved AND a.vehicle_type=q.vehicle_type
  JOIN public.professional_presence p ON p.user_id=a.user_id
    AND p.is_available AND p.last_seen_at>now()-interval '90 seconds'
  JOIN public.professional_driver_locations l ON l.user_id=a.user_id
    AND l.accuracy_m<=150
    AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
  WHERE auth.uid() IS NOT NULL AND public.driver_platform_access_allowed(auth.uid())
    AND q.status='SEARCHING' AND q.expires_at>now()
    AND q.passenger_id<>auth.uid()
    AND 6371.0*2*asin(least(1.0,sqrt(
      power(sin(radians((coalesce(q.meeting_point_lat,q.origin_lat)-l.lat)/2)),2)+
      cos(radians(l.lat))*cos(radians(coalesce(q.meeting_point_lat,q.origin_lat)))*
      power(sin(radians((coalesce(q.meeting_point_lng,q.origin_lng)-l.lng)/2)),2)
    )))<=15
  ORDER BY q.requested_at
  LIMIT 30;
$function$;
CREATE OR REPLACE FUNCTION public.quick_ride_view_request(p_ride_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_ride public.professional_quick_rides%ROWTYPE;
  v_allowed boolean := false;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ride FROM public.professional_quick_rides WHERE id=p_ride_id;
  IF NOT FOUND OR v_ride.status<>'SEARCHING' OR v_ride.expires_at<=now()
    OR v_ride.passenger_id=v_user THEN
    RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_user AND a.approved AND a.vehicle_type=v_ride.vehicle_type
  ) THEN RAISE EXCEPTION 'Driver unavailable' USING ERRCODE='42501'; END IF;

  

  SELECT
  (
    EXISTS(
      SELECT 1 FROM public.professional_presence p
      JOIN public.professional_driver_locations l ON l.user_id=p.user_id
      WHERE p.user_id=v_user AND p.is_available
        
        AND p.last_seen_at>now()-interval '90 seconds'
        AND l.updated_at>now()-interval '90 seconds'
        AND l.sampled_at>now()-interval '90 seconds'
        AND l.accuracy_m<=150
        AND 6371.0*2*asin(least(1.0,sqrt(
            power(sin(radians((coalesce(v_ride.meeting_point_lat,v_ride.origin_lat)-l.lat)/2)),2)+
            cos(radians(l.lat))*cos(radians(coalesce(v_ride.meeting_point_lat,v_ride.origin_lat)))*
            power(sin(radians((coalesce(v_ride.meeting_point_lng,v_ride.origin_lng)-l.lng)/2)),2)
        )))<=15
    )
    OR
    EXISTS(
      SELECT 1 FROM public.flash_driver_presence f
      WHERE f.user_id=v_user AND f.is_online
        
        AND f.last_gps_at>now()-interval '90 seconds'
        AND f.last_accuracy_m<=150
        AND f.last_lat IS NOT NULL AND f.last_lng IS NOT NULL
        AND f.available_seats>=coalesce(v_ride.seats_requested,1)
        AND 6371.0*2*asin(least(1.0,sqrt(
            power(sin(radians((coalesce(v_ride.meeting_point_lat,v_ride.origin_lat)-f.last_lat)/2)),2)+
            cos(radians(f.last_lat))*cos(radians(coalesce(v_ride.meeting_point_lat,v_ride.origin_lat)))*
            power(sin(radians((coalesce(v_ride.meeting_point_lng,v_ride.origin_lng)-f.last_lng)/2)),2)
        )))<=15
    )
  ) INTO v_allowed;

  IF NOT v_allowed THEN RAISE EXCEPTION 'Driver is not eligible to view this request' USING ERRCODE='42501'; END IF;
  INSERT INTO public.quick_ride_driver_views(ride_id,driver_id)
  VALUES(p_ride_id,v_user)
  ON CONFLICT(ride_id,driver_id) DO UPDATE
    SET last_viewed_at=now()
    WHERE public.quick_ride_driver_views.last_viewed_at<now()-interval '4 seconds';

  SELECT jsonb_build_object(
      'name',coalesce(nullif(btrim(p.full_name),''),'Passageiro CARONAA'),
      'photo',CASE WHEN p.avatar_url LIKE 'https://%' THEN p.avatar_url ELSE NULL END
    ) INTO v_result
  FROM public.profiles p WHERE p.id=v_ride.passenger_id;
  RETURN coalesce(v_result,jsonb_build_object('name','Passageiro CARONAA','photo',NULL));
END;
$function$;
CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(p_lat double precision, p_lng double precision, p_vehicle text, p_radius_km double precision DEFAULT 15.0)
 RETURNS TABLE(driver_key text, lat double precision, lng double precision, seen_at timestamp with time zone, distance_km double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_radius double precision:=least(greatest(coalesce(p_radius_km,15),1),15);
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
    JOIN public.professional_driver_authorizations a
      ON a.user_id=l.user_id AND a.approved AND a.vehicle_type=p_vehicle
    WHERE l.user_id<>auth.uid()
      AND public.driver_platform_access_allowed(l.user_id)
      AND l.accuracy_m<=150 AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND p.last_seen_at>now()-interval '90 seconds'
  )
  SELECT k,approx_lat,approx_lng,seen,round(km::numeric,1)::double precision
    FROM c WHERE km<=v_radius ORDER BY km LIMIT 50;
END
$function$;
CREATE OR REPLACE FUNCTION public.quick_ride_accept(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $accept$
DECLARE
  v_uid uuid:=auth.uid();
  v_vehicle text;
  v_ride public.professional_quick_rides%ROWTYPE;
  v_fix public.professional_driver_locations%ROWTYPE;
  v_distance_m double precision;
  v_pin text:=lpad((floor(random()*9000)+1000)::text,4,'0');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT a.vehicle_type INTO v_vehicle
    FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved=true;
  IF v_vehicle IS NULL OR NOT public.driver_platform_access_allowed(v_uid) THEN
    RAISE EXCEPTION 'DRIVER_NOT_AUTHORIZED_OR_FEES' USING ERRCODE='42501';
  END IF;
  SELECT l.* INTO v_fix
    FROM public.professional_driver_locations l
    JOIN public.professional_presence p ON p.user_id=l.user_id
    JOIN public.professional_service_regions sr ON sr.municipality=l.municipality
    WHERE l.user_id=v_uid AND p.is_available
      AND sr.public_discovery_enabled
      AND p.last_seen_at>now()-interval '90 seconds'
      AND l.accuracy_m<=150
      AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFIED_GPS_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_ride FROM public.professional_quick_rides
    WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_ride.status<>'SEARCHING' OR v_ride.expires_at<=now() THEN
    RETURN false;
  END IF;
  IF v_ride.passenger_id=v_uid OR v_ride.vehicle_type<>v_vehicle
    OR (v_vehicle='MOTO' AND coalesce(v_ride.seats_requested,1)>1)
    OR EXISTS (
      SELECT 1 FROM public.professional_quick_rides active
      WHERE active.driver_id=v_uid AND active.id<>p_id
        AND active.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
    ) THEN RETURN false;
  END IF;
  v_distance_m:=6371000.0*2*asin(least(1.0,sqrt(
    power(sin(radians((v_fix.lat-coalesce(v_ride.meeting_point_lat,v_ride.origin_lat))/2)),2)+
    cos(radians(v_fix.lat))*
    cos(radians(coalesce(v_ride.meeting_point_lat,v_ride.origin_lat)))*
    power(sin(radians((v_fix.lng-coalesce(v_ride.meeting_point_lng,v_ride.origin_lng))/2)),2)
  )));
  IF v_distance_m>15000 THEN RETURN false; END IF;
  UPDATE public.professional_quick_rides
    SET driver_id=v_uid,status='ACCEPTED',
        start_pin=v_pin,accepted_at=now(),updated_at=now()
    WHERE id=p_id AND status='SEARCHING' AND expires_at>now();
  IF NOT FOUND THEN RETURN false; END IF;
  -- Do not INSERT ride_id/driver_id/event_type/created_at:
  -- those columns do not exist. The AFTER UPDATE trigger above already
  -- upserts (municipality, changed_at) in the safe Realtime event table.
  RETURN true;
END;
$accept$;
CREATE OR REPLACE FUNCTION public.respond_flash_order(p_ride_id uuid,p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $respond$
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
  IF NOT FOUND OR NOT EXISTS (
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
     coalesce(v_ride.seats_requested,1)>v_flash.available_seats OR EXISTS (
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
  IF NOT v_near THEN
    RAISE EXCEPTION 'OUTSIDE_DISPATCH_RADIUS' USING ERRCODE='42501';
  END IF;
  v_pin:=lpad((floor(random()*9000)+1000)::text,4,'0');
  UPDATE public.professional_quick_rides SET
    driver_id=v_uid,status='ACCEPTED',accepted_at=now(),
    start_pin=v_pin,updated_at=now()
  WHERE id=p_ride_id AND status='SEARCHING' AND expires_at>now()
  RETURNING * INTO v_ride;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_TAKEN' USING ERRCODE='P0001'; END IF;
  -- The AFTER UPDATE trigger handles the municipality-only queue signal.
  RETURN jsonb_build_object('success',true,'action','ACCEPTED',
    'ride_id',v_ride.id,'status',v_ride.status,
    'origin_label',v_ride.origin_label,'destination_label',v_ride.destination_label);
END;
$respond$;
REVOKE ALL ON FUNCTION public.update_flash_driver_heartbeat_gps(double precision,double precision,double precision,text),public.quick_ride_driver_queue(text),public.quick_ride_view_request(uuid),public.discover_caronaa_quick_drivers(double precision,double precision,text,double precision),public.quick_ride_accept(uuid),public.respond_flash_order(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_flash_driver_heartbeat_gps(double precision,double precision,double precision,text),public.quick_ride_driver_queue(text),public.quick_ride_view_request(uuid),public.discover_caronaa_quick_drivers(double precision,double precision,text,double precision),public.quick_ride_accept(uuid),public.respond_flash_order(uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
