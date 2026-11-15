-- The driver cannot claim arrival based only on a button press.
-- Uses verified, recent, accurate GPS, never the client-provided distance.
CREATE OR REPLACE FUNCTION public.quick_ride_detect_arrival(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
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
   AND 6371000*2*asin(least(1.0,sqrt(
     power(sin(radians((l.lat-q.origin_lat)/2)),2)+
     cos(radians(q.origin_lat))*cos(radians(l.lat))*
     power(sin(radians((l.lng-q.origin_lng)/2)),2)
   ))) <= 75
 ) THEN RETURN false; END IF;
 UPDATE public.professional_quick_rides SET status='ARRIVED',updated_at=now() WHERE id=p_id;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.quick_ride_transition(p_id uuid,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE; u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (u<>q.passenger_id AND u IS DISTINCT FROM q.driver_id) THEN
  RAISE EXCEPTION 'Ride not found' USING ERRCODE='42501';
 END IF;
 IF p_status='CANCELLED' AND q.status IN ('SEARCHING','ACCEPTED','ARRIVED') THEN
  UPDATE public.professional_quick_rides SET status='CANCELLED',updated_at=now() WHERE id=p_id;
 ELSIF u=q.driver_id AND q.status='ACCEPTED' AND p_status='ARRIVED' THEN
  RETURN public.quick_ride_detect_arrival(p_id);
 ELSE
  RAISE EXCEPTION 'Use protected boarding or completion flow' USING ERRCODE='42501';
 END IF;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.quick_ride_detect_arrival(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_detect_arrival(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
