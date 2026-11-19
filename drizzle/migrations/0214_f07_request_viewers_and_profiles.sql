-- CARONAA F07 / 0214: precise request-view receipts, identity projection, 30s UX.
-- Apply MANUALLY after 0210/0213 in staging first. No pricing, GPS sharing,
-- payment, commission, automatic role activation or existing rides are changed.
-- A driver is counted only while the actual request card is visible on screen.
BEGIN;

CREATE TABLE IF NOT EXISTS public.quick_ride_driver_views (
  ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id,driver_id)
);
CREATE INDEX IF NOT EXISTS quick_ride_driver_views_live_idx
  ON public.quick_ride_driver_views(ride_id,last_viewed_at DESC);
ALTER TABLE public.quick_ride_driver_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_driver_views FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.quick_ride_driver_views TO service_role;

-- The definer validates the actual driver account, live permission and near
-- GPS BEFORE registering a view or projecting a short passenger identity.
-- Do not expose auth.users, coordinates, Whatsapp, PIN or payment details.
CREATE OR REPLACE FUNCTION public.quick_ride_view_request(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $view$
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
      WHERE p.user_id=v_user AND p.is_available AND p.municipality=l.municipality
        AND l.municipality=v_ride.municipality
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
        AND f.current_municipality=v_ride.municipality
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
$view$;

-- Only the request's passenger can learn who actually viewed their own ride.
-- A view expires after 12s without a visible-card heartbeat. The accepted
-- driver is returned separately, even if their last view has expired.
CREATE OR REPLACE FUNCTION public.quick_ride_request_audience(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $audience$
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
      'registration',nullif(btrim(mp.registration_number),'')
    ) ORDER BY viewing.last_viewed_at DESC),'[]'::jsonb) INTO v_viewers
    FROM (
      SELECT driver_id,last_viewed_at FROM public.quick_ride_driver_views
      WHERE ride_id=p_ride_id AND last_viewed_at>now()-interval '12 seconds'
      ORDER BY last_viewed_at DESC LIMIT 8
    ) viewing
    JOIN public.profiles p ON p.id=viewing.driver_id
    LEFT JOIN public.professional_mototaxi_profiles mp ON mp.user_id=viewing.driver_id;
  END IF;
  IF v_ride.driver_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id',p.id,
      'name',coalesce(nullif(btrim(p.full_name),''),'Motorista CARONAA'),
      'photo',CASE WHEN p.avatar_url LIKE 'https://%' THEN p.avatar_url ELSE NULL END,
      'registration',nullif(btrim(mp.registration_number),'')
    ) INTO v_accepted
    FROM public.profiles p
    LEFT JOIN public.professional_mototaxi_profiles mp ON mp.user_id=p.id
    WHERE p.id=v_ride.driver_id;
  END IF;
  RETURN jsonb_build_object(
    'watching_count',v_count,
    'viewers',coalesce(v_viewers,'[]'::jsonb),
    'accepted_driver',v_accepted
  );
END;
$audience$;

REVOKE ALL ON FUNCTION public.quick_ride_view_request(uuid),
  public.quick_ride_request_audience(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_view_request(uuid),
  public.quick_ride_request_audience(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
