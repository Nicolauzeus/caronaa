-- Quick ride bilateral ratings: separate lifecycle key, same one-to-five-star policy.
CREATE TABLE IF NOT EXISTS public.quick_ride_ratings (
 ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
 reviewer_user_id uuid NOT NULL REFERENCES auth.users(id),
 rated_user_id uuid NOT NULL REFERENCES auth.users(id),
 score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (char_length(comment)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(ride_id,reviewer_user_id),
 CHECK(reviewer_user_id<>rated_user_id)
);
CREATE INDEX IF NOT EXISTS quick_ride_ratings_rated_idx ON public.quick_ride_ratings(rated_user_id);
ALTER TABLE public.quick_ride_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_ratings FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quick_ride_rate(p_id uuid,p_score integer,p_comment text DEFAULT '')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE; other_user uuid;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.status<>'COMPLETED' OR
    auth.uid() NOT IN (q.driver_id,q.passenger_id) THEN
  RAISE EXCEPTION 'Completed participant ride required' USING ERRCODE='42501';
 END IF;
 IF p_score IS NULL OR p_score NOT BETWEEN 1 AND 5 OR
    char_length(coalesce(p_comment,''))>1000 THEN
  RAISE EXCEPTION 'Invalid rating' USING ERRCODE='22023';
 END IF;
 other_user:=CASE WHEN auth.uid()=q.driver_id THEN q.passenger_id ELSE q.driver_id END;
 INSERT INTO public.quick_ride_ratings(ride_id,reviewer_user_id,rated_user_id,score,comment)
 VALUES (p_id,auth.uid(),other_user,p_score,btrim(coalesce(p_comment,'')));
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.quick_ride_my_rating(p_id uuid)
RETURNS TABLE(score integer,comment text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT r.score,r.comment,r.created_at
 FROM public.quick_ride_ratings r
 JOIN public.professional_quick_rides q ON q.id=r.ride_id
 WHERE r.ride_id=p_id AND r.reviewer_user_id=auth.uid()
 AND q.status='COMPLETED'
 AND (q.driver_id=auth.uid() OR q.passenger_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.quick_ride_rate(uuid,integer,text),
 public.quick_ride_my_rating(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_rate(uuid,integer,text),
 public.quick_ride_my_rating(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
