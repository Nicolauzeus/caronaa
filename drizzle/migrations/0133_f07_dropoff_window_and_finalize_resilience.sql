CREATE OR REPLACE FUNCTION public.quick_ride_request_dropoff(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() OR q.status<>'IN_PROGRESS' THEN
  RAISE EXCEPTION 'Cannot request dropoff' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.quick_ride_dropoff_reviews(ride_id,deadline_at)
 VALUES (p_id, now() + interval '120 seconds')
 ON CONFLICT (ride_id) DO UPDATE
   SET deadline_at = now() + interval '120 seconds', updated_at = now()
   WHERE public.quick_ride_dropoff_reviews.resolved_at IS NULL
     AND public.quick_ride_dropoff_reviews.passenger_response IS NULL;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.quick_ride_finalize_after_timeout(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
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
 IF NOT FOUND OR d.deadline_at > now() OR d.passenger_response IS NOT NULL
    OR d.resolved_at IS NOT NULL THEN RETURN false; END IF;
 UPDATE public.quick_ride_dropoff_reviews SET resolved_at=now(), updated_at=now() WHERE ride_id=p_id;
 UPDATE public.professional_quick_rides SET status='COMPLETED', completed_at=now(), updated_at=now() WHERE id=p_id;
 RETURN true;
END; $$;