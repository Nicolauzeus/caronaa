-- 0246 | Do not expose legacy matrícula in passenger radar; preserve approval guards.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  v_missing text[];
  v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  SELECT r0.* INTO r FROM public.professional_access_requests r0
    LEFT JOIN public.professional_driver_authorizations a ON a.user_id=v_uid
    WHERE r0.user_id=v_uid
    ORDER BY (r0.status='APPROVED' AND r0.vehicle_type=a.vehicle_type) DESC,
             r0.submitted_at DESC,r0.id DESC LIMIT 1;

  v_missing := CASE WHEN r.id IS NULL
    THEN public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')
    ELSE public.professional_access_missing(
      v_uid,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality)
  END;

  SELECT coalesce(bool_or(a.approved AND a.vehicle_type=r.vehicle_type),false)
    INTO v_approved
    FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid;

  RETURN jsonb_build_object(
    'authorized',v_approved AND cardinality(v_missing)=0
      AND r.status='APPROVED'
      AND NOT EXISTS (SELECT 1 FROM public.professional_access_requests blocked
        WHERE blocked.user_id=v_uid AND blocked.status IN ('PENDING','REJECTED','CHANGES_REQUESTED'))
      AND EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id=v_uid
          AND u.email_confirmed_at IS NOT NULL
      ),
    'profileMissing',to_jsonb(v_missing),
    'request',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',r.id,'status',r.status,'access_type',r.access_type,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,
      'passenger_seats',r.passenger_seats,'municipality',r.municipality,
      'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,
      'review_reason',r.review_reason) END
  );
END
$function$
;

CREATE OR REPLACE FUNCTION public.quick_ride_request_audience(p_ride_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ride public.professional_quick_rides%ROWTYPE;
  v_count integer := 0;
  v_viewers jsonb := '[]'::jsonb;
  v_accepted jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ride FROM public.professional_quick_rides WHERE id=p_ride_id;
  IF NOT FOUND OR v_ride.passenger_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not your request' USING ERRCODE='42501';
  END IF;
  IF v_ride.status NOT IN ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS') OR
     (v_ride.status='SEARCHING' AND v_ride.expires_at<=now()) THEN
    RETURN jsonb_build_object('watching_count',0,'viewers','[]'::jsonb,'accepted_driver',NULL);
  END IF;

  IF v_ride.status='SEARCHING' THEN
    SELECT count(*)::integer INTO v_count
      FROM public.quick_ride_driver_views v
      WHERE v.ride_id=p_ride_id AND v.last_viewed_at>now()-interval '12 seconds';
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',viewing.driver_id,
      'name',coalesce(nullif(btrim(p.full_name),''),'Motorista CARONAA'),
      'photo',CASE WHEN p.avatar_url LIKE 'https://%' THEN p.avatar_url ELSE NULL END,
      'vehicle_plate',NULL
    ) ORDER BY viewing.last_viewed_at DESC),'[]'::jsonb) INTO v_viewers
    FROM (
      SELECT driver_id,last_viewed_at FROM public.quick_ride_driver_views
      WHERE ride_id=p_ride_id AND last_viewed_at>now()-interval '12 seconds'
      ORDER BY last_viewed_at DESC LIMIT 8
    ) viewing
    JOIN public.profiles p ON p.id=viewing.driver_id;
  END IF;
  IF v_ride.driver_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id',p.id,
      'name',coalesce(nullif(btrim(p.full_name),''),'Motorista CARONAA'),
      'photo',CASE WHEN p.avatar_url LIKE 'https://%' THEN p.avatar_url ELSE NULL END,
      'plate',nullif(btrim(p.vehicle_plate),''),
      'vehicle',nullif(btrim(concat_ws(' ',p.vehicle_brand,p.vehicle_description)),'')
    ) INTO v_accepted
    FROM public.profiles p
    WHERE p.id=v_ride.driver_id;
  END IF;
  RETURN jsonb_build_object(
    'watching_count',v_count,
    'viewers',coalesce(v_viewers,'[]'::jsonb),
    'accepted_driver',v_accepted
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;
REVOKE ALL ON FUNCTION public.quick_ride_request_audience(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quick_ride_request_audience(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;