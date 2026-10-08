-- One first publication per linked response and travel role; existing creation RPCs retain matching.
CREATE TABLE public.form_ride_publications (
  submission_id uuid NOT NULL REFERENCES public.form_submissions(submission_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('request','offer')),
  request_id uuid REFERENCES public.ride_requests(request_id),
  offer_id uuid REFERENCES public.ride_offers(offer_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, kind),
  CHECK ((kind = 'request' AND request_id IS NOT NULL AND offer_id IS NULL) OR
         (kind = 'offer' AND offer_id IS NOT NULL AND request_id IS NULL))
);
ALTER TABLE public.form_ride_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.form_ride_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.form_ride_publications TO authenticated;
CREATE POLICY own_form_publications ON public.form_ride_publications FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT ALL ON public.form_ride_publications TO service_role;

CREATE FUNCTION public.get_sts_ride_seed() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE s public.form_submissions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT f.* INTO s FROM public.form_submissions f
    JOIN public.form_submission_account_links l ON l.submission_id = f.submission_id
    WHERE l.user_id = auth.uid() AND l.confirmed_at IS NOT NULL AND f.user_id = auth.uid()
      AND f.source IN ('sts-2026','sts2026','sts_2026')
      AND coalesce(f.raw_payload->>'cancelled', 'false') <> 'true'
      AND coalesce(f.raw_payload->>'invalid', 'false') <> 'true';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('submissionId',s.submission_id,'intent',s.tipo_usuario,
    'origin',s.origem_trajeto,'destination',s.destino_trajeto,'createdAt',s.created_at,
    'raw',s.raw_payload || jsonb_build_object('departureWindow',s.faixa_horario));
END;
$$;

CREATE FUNCTION public.publish_sts_ride(p_submission_id uuid, p_kind text, p_details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE s public.form_submissions%ROWTYPE; publication uuid; d date; t time; n integer; price numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT f.* INTO s FROM public.form_submissions f
    JOIN public.form_submission_account_links l ON l.submission_id = f.submission_id
    WHERE f.submission_id = p_submission_id AND l.user_id = auth.uid()
      AND f.user_id = auth.uid() AND l.confirmed_at IS NOT NULL FOR UPDATE OF f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Form not linked to this account' USING ERRCODE = '42501'; END IF;
  IF s.source NOT IN ('sts-2026','sts2026','sts_2026') OR coalesce(s.raw_payload->>'cancelled','false') = 'true'
    OR coalesce(s.raw_payload->>'invalid','false') = 'true' THEN RAISE EXCEPTION 'Invalid form'; END IF;
  IF p_kind NOT IN ('request','offer') OR p_kind IS NULL THEN RAISE EXCEPTION 'Invalid travel role'; END IF;
  SELECT coalesce(request_id,offer_id) INTO publication FROM public.form_ride_publications
    WHERE submission_id = p_submission_id AND kind = p_kind;
  IF publication IS NOT NULL THEN RETURN publication; END IF;
  d := (p_details->>'rideDate')::date; t := (p_details->>'departureTime')::time;
  n := (p_details->>'count')::integer; price := (p_details->>'price')::numeric;
  IF d IS NULL OR t IS NULL OR n IS NULL OR n NOT BETWEEN 1 AND 6 OR price IS NULL
    OR price < 0 OR price > 1000 OR price::text IN ('NaN','Infinity','-Infinity')
    OR nullif(btrim(p_details->>'origin'),'') IS NULL OR length(p_details->>'origin') > 160
    OR nullif(btrim(p_details->>'destination'),'') IS NULL OR length(p_details->>'destination') > 160
    THEN RAISE EXCEPTION 'Incomplete publication'; END IF;
  IF d NOT BETWEEN '2026-10-07'::date AND '2026-10-09'::date
    OR (d+t) AT TIME ZONE 'America/Fortaleza' > '2026-10-09T22:00:00-03:00'::timestamptz
    OR (d+t) AT TIME ZONE 'America/Fortaleza' <= clock_timestamp() THEN RAISE EXCEPTION 'Expired STS journey'; END IF;
  IF p_kind = 'offer' AND coalesce(p_details->>'audience','') NOT IN ('ANY','FEMININO','MASCULINO') THEN RAISE EXCEPTION 'Confirm audience'; END IF;
  -- Existing active publications are never overwritten or supplemented silently.
  IF EXISTS (SELECT 1 FROM public.ride_requests WHERE user_id = auth.uid() AND status IN ('open','matched')
       AND (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza' > clock_timestamp())
    OR EXISTS (SELECT 1 FROM public.rides WHERE (passenger_user_id = auth.uid() OR driver_user_id = auth.uid()) AND status = 'IN_PROGRESS')
    OR EXISTS (SELECT 1 FROM public.ride_offers WHERE user_id = auth.uid() AND status IN ('available','full')
       AND (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza' > clock_timestamp())
    THEN RAISE EXCEPTION 'You already have an active publication'; END IF;
  IF p_kind = 'request' THEN
    publication := public.create_ride_request(p_details->>'origin',p_details->>'destination',d,t,n,p_price => price,
      p_origin_lat => (p_details->>'originLat')::double precision, p_origin_lng => (p_details->>'originLng')::double precision,
      p_destination_lat => (p_details->>'destinationLat')::double precision, p_destination_lng => (p_details->>'destinationLng')::double precision);
    INSERT INTO public.form_ride_publications(submission_id,user_id,kind,request_id) VALUES(p_submission_id,auth.uid(),p_kind,publication);
  ELSE
    publication := public.create_ride_offer(p_details->>'origin',p_details->>'destination',d,t,n,
      p_total_price => price, p_passenger_gender_preference => p_details->>'audience',
      p_origin_lat => (p_details->>'originLat')::double precision, p_origin_lng => (p_details->>'originLng')::double precision,
      p_destination_lat => (p_details->>'destinationLat')::double precision, p_destination_lng => (p_details->>'destinationLng')::double precision);
    INSERT INTO public.form_ride_publications(submission_id,user_id,kind,offer_id) VALUES(p_submission_id,auth.uid(),p_kind,publication);
  END IF;
  RETURN publication;
END;
$$;
REVOKE ALL ON FUNCTION public.get_sts_ride_seed() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.publish_sts_ride(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_sts_ride_seed(), public.publish_sts_ride(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
