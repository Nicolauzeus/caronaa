-- 0234: Guard against passengers pretending to be online drivers.
-- A driver-role account may always go online while awaiting authorization or GPS.
BEGIN;
CREATE OR REPLACE FUNCTION public.set_flash_driver_online(p_is_online boolean, p_dispatch_mode text DEFAULT 'ALL'::text, p_available_seats integer DEFAULT 4, p_destination_label text DEFAULT NULL::text, p_destination_lat double precision DEFAULT NULL::double precision, p_destination_lng double precision DEFAULT NULL::double precision, p_destination_municipality text DEFAULT NULL::text, p_route_geojson jsonb DEFAULT NULL::jsonb, p_route_polyline text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_vehicle text;
  v_route public.geometry;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  -- Only actual driver-role accounts can declare driver presence.
  -- Approval, municipality, Pix and first GPS fix are NOT prerequisites.
  IF p_is_online AND NOT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.id=v_uid AND p.active_role='MOTORISTA'
  ) THEN
    RAISE EXCEPTION 'DRIVER_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_is_online IS NULL OR p_dispatch_mode NOT IN ('ALL','ON_ROUTE','EXCLUSIVE') OR
     p_available_seats IS NULL OR p_available_seats < 1 OR p_available_seats > 7 THEN
    RAISE EXCEPTION 'INVALID_FLASH_CONFIGURATION' USING ERRCODE='22023';
  END IF;
  IF p_is_online THEN
    -- Being connected is not authorization to receive/accept orders.
    -- Queue and acceptance RPCs continue to require approved account and valid GPS.
    SELECT coalesce(
      (SELECT a.vehicle_type FROM public.professional_driver_authorizations a
       WHERE a.user_id=v_uid AND a.approved=true LIMIT 1),
      (SELECT upper(p.vehicle_type) FROM public.profiles p WHERE p.id=v_uid)
    ) INTO v_vehicle;
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
$function$;
REVOKE ALL ON FUNCTION public.set_flash_driver_online(boolean,text,integer,text,double precision,double precision,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_flash_driver_online(boolean,text,integer,text,double precision,double precision,text,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
