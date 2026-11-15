-- Corrida Rapida: janela de confirmacao de desembarque.
-- Nenhuma finalizacao por silencio ate haver comprovacao GPS validada no servidor.
CREATE TABLE IF NOT EXISTS public.quick_ride_dropoff_reviews (
 ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
 requested_at timestamptz NOT NULL DEFAULT now(),
 deadline_at timestamptz NOT NULL,
 passenger_response text CHECK (passenger_response IN ('CONFIRMED','CONTESTED')),
 resolved_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_ride_dropoff_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_dropoff_reviews FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quick_ride_request_dropoff(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() OR q.status<>'IN_PROGRESS' THEN
  RAISE EXCEPTION 'Cannot request dropoff' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.quick_ride_dropoff_reviews(ride_id,deadline_at)
 VALUES (p_id,now()+interval '30 seconds')
 ON CONFLICT (ride_id) DO NOTHING;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.quick_ride_respond_dropoff(p_id uuid,p_response text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
 d public.quick_ride_dropoff_reviews%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() OR q.status<>'IN_PROGRESS' THEN
  RAISE EXCEPTION 'Dropoff response unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
 IF NOT FOUND OR d.resolved_at IS NOT NULL OR d.deadline_at<now() OR
   p_response NOT IN ('CONFIRMED','CONTESTED') THEN
  RAISE EXCEPTION 'Dropoff response is closed' USING ERRCODE='42501';
 END IF;
 UPDATE public.quick_ride_dropoff_reviews SET passenger_response=p_response,
  resolved_at=now(),updated_at=now() WHERE ride_id=p_id;
 IF p_response='CONFIRMED' THEN
  UPDATE public.professional_quick_rides
  SET status='COMPLETED',completed_at=now(),updated_at=now() WHERE id=p_id;
 END IF;
 RETURN true;
END; $$;

-- Read-only participant view; never reveals codes or unrelated rides.
CREATE OR REPLACE FUNCTION public.quick_ride_dropoff_state(p_id uuid)
RETURNS TABLE(deadline_at timestamptz,passenger_response text,resolved_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT d.deadline_at,d.passenger_response,d.resolved_at
 FROM public.quick_ride_dropoff_reviews d
 JOIN public.professional_quick_rides q ON q.id=d.ride_id
 WHERE d.ride_id=p_id AND (q.driver_id=auth.uid() OR q.passenger_id=auth.uid());
$$;

REVOKE ALL ON FUNCTION public.quick_ride_request_dropoff(uuid),
 public.quick_ride_respond_dropoff(uuid,text),public.quick_ride_dropoff_state(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_request_dropoff(uuid),
 public.quick_ride_respond_dropoff(uuid,text),public.quick_ride_dropoff_state(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
