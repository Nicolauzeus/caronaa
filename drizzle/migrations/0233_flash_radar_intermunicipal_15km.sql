-- 0233: Flash radar can show requests across municipal boundaries within 15 km.
-- Retains authentication, driver authorization, verified GPS, vehicle capacity,
-- booking state, skip list, and atomic acceptance safeguards.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_flash_driver_radar_orders(p_max_distance_m integer DEFAULT 15000)
 RETURNS TABLE(ride_id uuid, passenger_id uuid, passenger_name text, passenger_avatar text, municipality text, vehicle_type text, service_mode text, origin_label text, origin_lat double precision, origin_lng double precision, destination_label text, destination_lat double precision, destination_lng double precision, meeting_point_label text, meeting_point_lat double precision, meeting_point_lng double precision, walk_distance_m integer, seats_requested integer, estimated_fare_cents integer, driver_earnings_cents integer, distance_to_pickup_m double precision, expires_in_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_vehicle text;
  v_flash public.flash_driver_presence%ROWTYPE;
  v_radius integer:=least(greatest(coalesce(p_max_distance_m,15000),1000),15000);
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

  WHERE r.status='SEARCHING' AND r.expires_at>now()
    AND r.passenger_id<>v_uid AND r.vehicle_type=v_vehicle
    AND coalesce(r.seats_requested,1)<=v_flash.available_seats
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
$function$;
REVOKE ALL ON FUNCTION public.get_flash_driver_radar_orders(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_flash_driver_radar_orders(integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
