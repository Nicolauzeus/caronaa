-- CARONAA 0217 | Radius-based cross-municipality F07 driver visibility
-- Apply manually after 0209 and 0214; 0216 recommended for fresh GPS.
-- No changes to historical fares, journeys, payments or commission.
BEGIN;

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
    AND l.municipality=p.municipality
    AND l.accuracy_m<=150
    AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
  JOIN public.professional_service_regions r
    ON r.municipality=l.municipality
    AND r.dispatch_enabled AND r.public_discovery_enabled
  JOIN public.caronaa_service_municipalities driver_city
    ON driver_city.municipality=l.municipality
  JOIN public.professional_service_regions pickup_region
    ON pickup_region.municipality=q.municipality
    AND pickup_region.dispatch_enabled AND pickup_region.public_discovery_enabled
  JOIN public.caronaa_service_municipalities pickup_city
    ON pickup_city.municipality=q.municipality
  WHERE auth.uid() IS NOT NULL AND public.driver_platform_access_allowed(auth.uid())
    AND l.municipality=btrim(p_municipality)
    AND CASE WHEN q.vehicle_type='MOTO' THEN driver_city.moto_enabled ELSE driver_city.car_enabled END
    AND CASE WHEN q.vehicle_type='MOTO' THEN pickup_city.moto_enabled ELSE pickup_city.car_enabled END
    AND q.status='SEARCHING' AND q.expires_at>now()
    AND q.passenger_id<>auth.uid()
    AND 6371.0*2*asin(least(1.0,sqrt(
      power(sin(radians((coalesce(q.meeting_point_lat,q.origin_lat)-l.lat)/2)),2)+
      cos(radians(l.lat))*cos(radians(coalesce(q.meeting_point_lat,q.origin_lat)))*
      power(sin(radians((coalesce(q.meeting_point_lng,q.origin_lng)-l.lng)/2)),2)
    )))<=15
  ORDER BY q.requested_at
  LIMIT 30;
$function$


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

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_service_regions sr
    JOIN public.caronaa_service_municipalities cm ON cm.municipality=sr.municipality
    WHERE sr.municipality=v_ride.municipality AND sr.dispatch_enabled AND sr.public_discovery_enabled
      AND CASE WHEN v_ride.vehicle_type='MOTO' THEN cm.moto_enabled ELSE cm.car_enabled END
  ) THEN RAISE EXCEPTION 'Pickup region is not dispatch enabled' USING ERRCODE='42501'; END IF;

  SELECT
  (
    EXISTS(
      SELECT 1 FROM public.professional_presence p
      JOIN public.professional_driver_locations l ON l.user_id=p.user_id
      WHERE p.user_id=v_user AND p.is_available AND p.municipality=l.municipality
        AND EXISTS (
          SELECT 1 FROM public.professional_service_regions sr
          JOIN public.caronaa_service_municipalities cm ON cm.municipality=sr.municipality
          WHERE sr.municipality=l.municipality AND sr.dispatch_enabled AND sr.public_discovery_enabled
            AND CASE WHEN v_ride.vehicle_type='MOTO' THEN cm.moto_enabled ELSE cm.car_enabled END
        )
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
        AND EXISTS (
          SELECT 1 FROM public.professional_service_regions sr
          JOIN public.caronaa_service_municipalities cm ON cm.municipality=sr.municipality
          WHERE sr.municipality=f.current_municipality AND sr.dispatch_enabled AND sr.public_discovery_enabled
            AND CASE WHEN v_ride.vehicle_type='MOTO' THEN cm.moto_enabled ELSE cm.car_enabled END
        )
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
$function$


REVOKE ALL ON FUNCTION public.quick_ride_driver_queue(text),public.quick_ride_view_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_driver_queue(text),public.quick_ride_view_request(uuid) TO authenticated;
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
      AND p.municipality=l.municipality
    JOIN public.professional_driver_authorizations a
      ON a.user_id=l.user_id AND a.approved AND a.vehicle_type=p_vehicle
    JOIN public.professional_service_regions r
      ON r.municipality=l.municipality AND r.public_discovery_enabled AND r.dispatch_enabled
    JOIN public.caronaa_service_municipalities cm
      ON cm.municipality=l.municipality
      AND CASE WHEN p_vehicle='MOTO' THEN cm.moto_enabled ELSE cm.car_enabled END
    WHERE l.user_id<>auth.uid()
      AND public.driver_platform_access_allowed(l.user_id)
      AND l.accuracy_m<=150 AND l.sampled_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND p.last_seen_at>now()-interval '90 seconds'
  )
  SELECT k,approx_lat,approx_lng,seen,round(km::numeric,1)::double precision
    FROM c WHERE km<=v_radius ORDER BY km LIMIT 50;
END
$function$


REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(double precision,double precision,text,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(double precision,double precision,text,double precision) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
