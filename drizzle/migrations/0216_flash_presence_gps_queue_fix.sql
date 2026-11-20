-- CARONAA F07 / 0216: unify Flash GPS heartbeat with authoritative radar tables.
-- Required after 0209. Only new heartbeats change availability; historical rides untouched.
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.professional_service_regions r
    JOIN public.caronaa_service_municipalities c
      ON c.municipality=r.municipality
    WHERE r.municipality=v_city
      AND r.dispatch_enabled AND r.public_discovery_enabled
      AND EXISTS (
        SELECT 1 FROM public.professional_driver_authorizations a
        WHERE a.user_id=v_uid AND a.approved
          AND CASE WHEN a.vehicle_type='MOTO' THEN c.moto_enabled
                   WHEN a.vehicle_type='CAR' THEN c.car_enabled ELSE false END
      )
  ) THEN
    RAISE EXCEPTION 'DRIVER_REGION_NOT_ENABLED' USING ERRCODE='42501';
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

REVOKE ALL ON FUNCTION public.update_flash_driver_heartbeat_gps(
  double precision,double precision,double precision,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_flash_driver_heartbeat_gps(
  double precision,double precision,double precision,text
) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
