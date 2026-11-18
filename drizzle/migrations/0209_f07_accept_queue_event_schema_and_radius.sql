-- CARONAA F07 / 0209: atomic ride acceptance and accurate driver queue.
-- 2026-11-18 incident: event table only has municipality / changed_at,
-- but quick_ride_accept() and respond_flash_order() inserted old event columns.
-- The AFTER UPDATE trigger already publishes a privacy-safe municipality event.
-- Do not modify existing fares, rides, accounts, GPS or authorization rows.
BEGIN;

DO $checks$
BEGIN
  IF to_regclass('public.caronaa_quick_queue_events') IS NULL OR
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='caronaa_quick_queue_events'
        AND column_name='municipality'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='caronaa_quick_queue_events'
        AND column_name='changed_at'
    ) THEN
    RAISE EXCEPTION 'F07: migration 0148 is required (municipality/changed_at queue events)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.professional_quick_rides'::regclass
      AND t.tgname='caronaa_quick_queue_realtime_event' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'F07: safe realtime queue trigger is missing';
  END IF;
END;
$checks$;

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
      AND p.municipality=l.municipality AND sr.public_discovery_enabled
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
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.professional_service_regions sr
      JOIN public.caronaa_service_municipalities c ON c.municipality=sr.municipality
      WHERE sr.municipality=v_ride.municipality AND sr.dispatch_enabled
        AND CASE WHEN v_vehicle='MOTO' THEN c.moto_enabled ELSE c.car_enabled END
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

-- The Flash driver's alternate acceptance RPC had the same obsolete INSERT.
-- Keep all its existing auth, fresh GPS, fleet, coverage and radius gates.
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
     coalesce(v_ride.seats_requested,1)>v_flash.available_seats OR
     NOT EXISTS (
       SELECT 1 FROM public.professional_service_regions r
       JOIN public.caronaa_service_municipalities c ON c.municipality=r.municipality
       WHERE r.municipality=v_ride.municipality AND r.dispatch_enabled
         AND CASE WHEN v_vehicle='MOTO' THEN c.moto_enabled ELSE c.car_enabled END
     ) OR EXISTS (
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

-- Offer only rides that satisfy the same real GPS freshness, vehicle,
-- municipality and 15km boarding radius gates used by quick_ride_accept().
CREATE OR REPLACE FUNCTION public.quick_ride_driver_queue(p_municipality text)
RETURNS TABLE (
  id uuid,vehicle_type text,origin_label text,destination_label text,
  requested_at timestamptz,expires_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $queue$
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
    AND l.municipality=p.municipality
    AND l.accuracy_m<=150
    AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
  JOIN public.professional_service_regions r
    ON r.municipality=l.municipality
    AND r.dispatch_enabled AND r.public_discovery_enabled
  WHERE auth.uid() IS NOT NULL AND public.driver_platform_access_allowed(auth.uid())
    AND q.municipality=btrim(p_municipality)
    AND q.municipality=l.municipality
    AND q.status='SEARCHING' AND q.expires_at>now()
    AND q.passenger_id<>auth.uid()
    AND 6371.0*2*asin(least(1.0,sqrt(
      power(sin(radians((coalesce(q.meeting_point_lat,q.origin_lat)-l.lat)/2)),2)+
      cos(radians(l.lat))*cos(radians(coalesce(q.meeting_point_lat,q.origin_lat)))*
      power(sin(radians((coalesce(q.meeting_point_lng,q.origin_lng)-l.lng)/2)),2)
    )))<=15
  ORDER BY q.requested_at
  LIMIT 30;
$queue$;

REVOKE ALL ON FUNCTION public.quick_ride_accept(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_accept(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_flash_order(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_flash_order(uuid,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.quick_ride_driver_queue(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_driver_queue(text) TO authenticated;

COMMENT ON FUNCTION public.quick_ride_accept(uuid) IS
  'F07: atomic guarded acceptance; AFTER UPDATE trigger handles municipality-safe queue events';
COMMENT ON FUNCTION public.quick_ride_driver_queue(text) IS
  'F07: dispatchable 15km offers with verified real GPS <=150m and <90s age';
NOTIFY pgrst,'reload schema';
COMMIT;
