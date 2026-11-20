-- 0223: The boarding PIN, not proximity to the pickup, authorizes the start.
-- Arrival is a driver declaration; it does not begin or charge the ride.
CREATE OR REPLACE FUNCTION public.quick_ride_detect_arrival(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Ride unavailable' USING ERRCODE='42501';
 END IF;
 IF q.status='ARRIVED' THEN RETURN true; END IF;
 IF q.status<>'ACCEPTED' THEN RETURN false; END IF;
 UPDATE public.professional_quick_rides SET status='ARRIVED',updated_at=now() WHERE id=p_id;
 RETURN true;
END; $$;

-- Auditable cancellation, independent of location, and never a completion.
CREATE TABLE IF NOT EXISTS public.quick_ride_driver_cancellations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ride_id uuid NOT NULL UNIQUE REFERENCES public.professional_quick_rides(id),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 previous_status text NOT NULL CHECK (previous_status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')),
 reason text,
 cancelled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quick_ride_driver_cancellations_driver_idx
 ON public.quick_ride_driver_cancellations(driver_id,cancelled_at DESC);
ALTER TABLE public.quick_ride_driver_cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_driver_cancellations FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quick_ride_cancel_by_driver(
 p_id uuid,p_reason text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 q public.professional_quick_rides%ROWTYPE;
 v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF char_length(coalesce(v_reason,''))>500 THEN
   RAISE EXCEPTION 'Cancellation reason too long' USING ERRCODE='22023';
 END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Ride unavailable' USING ERRCODE='42501';
 END IF;
 IF q.status='CANCELLED' THEN
   RETURN EXISTS(SELECT 1 FROM public.quick_ride_driver_cancellations WHERE ride_id=p_id AND driver_id=auth.uid());
 END IF;
 IF q.status NOT IN ('ACCEPTED','ARRIVED','IN_PROGRESS') THEN
   RAISE EXCEPTION 'Ride cannot be cancelled in this phase' USING ERRCODE='23514';
 END IF;
 -- A cancellation must not be mistaken for a confirmed dropoff.
 UPDATE public.professional_quick_rides
 SET status='CANCELLED',completed_at=NULL,updated_at=now() WHERE id=p_id;
 INSERT INTO public.quick_ride_driver_cancellations(ride_id,driver_id,previous_status,reason)
 VALUES(p_id,auth.uid(),q.status,v_reason);
 RETURN true;
END; $$;

-- Keep the two-party cancellation and the protected PIN/dropoff paths.
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
   IF u=q.driver_id AND q.status IN ('ACCEPTED','ARRIVED') THEN
     RETURN public.quick_ride_cancel_by_driver(p_id,NULL);
   END IF;
   UPDATE public.professional_quick_rides SET status='CANCELLED',updated_at=now() WHERE id=p_id;
 ELSIF u=q.driver_id AND q.status='ACCEPTED' AND p_status='ARRIVED' THEN
   RETURN public.quick_ride_detect_arrival(p_id);
 ELSE
   RAISE EXCEPTION 'Use protected boarding or completion flow' USING ERRCODE='42501';
 END IF;
 RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.quick_ride_detect_arrival(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.quick_ride_cancel_by_driver(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.quick_ride_transition(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_detect_arrival(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quick_ride_cancel_by_driver(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quick_ride_transition(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
