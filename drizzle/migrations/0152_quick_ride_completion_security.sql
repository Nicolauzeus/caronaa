-- Hardening: a boarding PIN can only be issued once; attempts cannot be reset.
CREATE OR REPLACE FUNCTION public.quick_ride_issue_boarding_pin(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
 v_salt uuid:=gen_random_uuid(); v_code text;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid()
    OR q.status NOT IN ('ACCEPTED','ARRIVED') THEN
  RAISE EXCEPTION 'Boarding PIN unavailable' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.quick_ride_boarding_secrets WHERE ride_id=p_id) THEN
  RAISE EXCEPTION 'Boarding PIN already issued; contact support if expired' USING ERRCODE='42501';
 END IF;
 v_code:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%1000000)::text,6,'0');
 INSERT INTO public.quick_ride_boarding_secrets(ride_id,pin_hash,salt,attempts,expires_at)
 VALUES(p_id,encode(sha256(convert_to(v_code||v_salt::text,'UTF8')),'hex'),v_salt,0,now()+interval '15 minutes');
 RETURN v_code;
END; $$;

-- Expired confirmation: called by either participant while viewing the ride.
-- The server, not the client map, verifies recent accurate driver GPS at destination.
CREATE OR REPLACE FUNCTION public.quick_ride_finalize_after_timeout(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
 d public.quick_ride_dropoff_reviews%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR
    (q.driver_id IS DISTINCT FROM auth.uid() AND q.passenger_id IS DISTINCT FROM auth.uid())
    OR q.status<>'IN_PROGRESS' THEN
  RAISE EXCEPTION 'Ride unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
 IF NOT FOUND OR d.deadline_at>now() OR d.passenger_response IS NOT NULL
    OR d.resolved_at IS NOT NULL THEN RETURN false; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.professional_driver_locations l
   WHERE l.user_id=q.driver_id AND l.accuracy_m<=50
     AND l.sampled_at>=now()-interval '45 seconds'
     AND l.updated_at>=now()-interval '45 seconds'
     AND 6371000*2*asin(least(1.0,sqrt(
       power(sin(radians((l.lat-q.destination_lat)/2)),2)+
       cos(radians(q.destination_lat))*cos(radians(l.lat))*
       power(sin(radians((l.lng-q.destination_lng)/2)),2)
     ))) <= 75
 ) THEN RETURN false; END IF;
 UPDATE public.quick_ride_dropoff_reviews SET resolved_at=now(),updated_at=now()
 WHERE ride_id=p_id;
 UPDATE public.professional_quick_rides SET status='COMPLETED',
  completed_at=now(),updated_at=now() WHERE id=p_id;
 RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.quick_ride_finalize_after_timeout(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_finalize_after_timeout(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
