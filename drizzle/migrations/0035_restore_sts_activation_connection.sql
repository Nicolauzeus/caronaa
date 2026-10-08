CREATE TABLE IF NOT EXISTS public.form_submission_account_links (
 submission_id uuid PRIMARY KEY REFERENCES public.form_submissions(submission_id) ON DELETE CASCADE,
 user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 linked_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz, onboarding_completed_at timestamptz
);
GRANT ALL ON public.form_submission_account_links TO service_role;
REVOKE ALL ON public.form_submission_account_links FROM PUBLIC,anon,authenticated;
ALTER TABLE public.form_submission_account_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS form_submissions_identity_lookup_idx ON public.form_submissions ((lower(trim(email)))) WHERE user_id IS NULL;
CREATE OR REPLACE FUNCTION public.get_form_account_activation() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,auth AS $$
DECLARE u auth.users%ROWTYPE; ids uuid[]; s public.form_submissions%ROWTYPE;
BEGIN
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.form_submission_account_links WHERE user_id=u.id AND confirmed_at IS NOT NULL) THEN RETURN jsonb_build_object('status','confirmed'); END IF;
 SELECT array_agg(submission_id) INTO ids FROM public.form_submissions WHERE user_id=u.id;
 IF coalesce(array_length(ids,1),0)=0 THEN
  SELECT array_agg(submission_id) INTO ids FROM public.form_submissions WHERE user_id IS NULL AND u.email_confirmed_at IS NOT NULL AND lower(trim(email))=lower(trim(u.email));
 END IF;
 IF coalesce(array_length(ids,1),0)=0 AND u.phone_confirmed_at IS NOT NULL AND nullif(u.phone,'') IS NOT NULL THEN
  SELECT array_agg(submission_id) INTO ids FROM public.form_submissions WHERE user_id IS NULL AND regexp_replace(whatsapp,'[^0-9]','','g')=regexp_replace(u.phone,'[^0-9]','','g');
 END IF;
 IF coalesce(array_length(ids,1),0)=0 THEN RETURN jsonb_build_object('status','none'); END IF;
 IF array_length(ids,1)>1 THEN RETURN jsonb_build_object('status','ambiguous'); END IF;
 SELECT * INTO s FROM public.form_submissions WHERE submission_id=ids[1];
 RETURN jsonb_build_object('status','ready','submission',jsonb_build_object('submissionId',s.submission_id,'name',s.nome,'email',s.email,'whatsapp',s.whatsapp,'intent',s.tipo_usuario,'origin',s.origem_trajeto,'destination',s.destino_trajeto,'departureWindow',s.faixa_horario,'transport',s.transporte_atual));
END; $$;
CREATE OR REPLACE FUNCTION public.confirm_form_account_activation(p_submission_id uuid,p_changes jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE u auth.users%ROWTYPE; s public.form_submissions%ROWTYPE; activation jsonb;
BEGIN
 SELECT * INTO u FROM auth.users WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.form_submissions WHERE submission_id=p_submission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Form submission not found' USING ERRCODE='P0002'; END IF;
 IF s.user_id IS DISTINCT FROM u.id THEN
  activation:=public.get_form_account_activation();
  IF s.user_id IS NOT NULL OR activation->>'status' IS DISTINCT FROM 'ready' OR activation->'submission'->>'submissionId' IS DISTINCT FROM p_submission_id::text THEN RAISE EXCEPTION 'Form submission cannot be linked to this account' USING ERRCODE='42501'; END IF;
 END IF;
 UPDATE public.form_submissions SET user_id=u.id,nome=coalesce(nullif(trim(p_changes->>'name'),''),nome),whatsapp=coalesce(nullif(trim(p_changes->>'whatsapp'),''),whatsapp),origem_trajeto=coalesce(nullif(trim(p_changes->>'origin'),''),origem_trajeto),destino_trajeto=coalesce(nullif(trim(p_changes->>'destination'),''),destino_trajeto),faixa_horario=coalesce(nullif(trim(p_changes->>'departureWindow'),''),faixa_horario) WHERE submission_id=p_submission_id;
 INSERT INTO public.form_submission_account_links(submission_id,user_id,confirmed_at,onboarding_completed_at) VALUES(p_submission_id,u.id,now(),now()) ON CONFLICT(submission_id) DO UPDATE SET confirmed_at=coalesce(public.form_submission_account_links.confirmed_at,EXCLUDED.confirmed_at),onboarding_completed_at=coalesce(public.form_submission_account_links.onboarding_completed_at,EXCLUDED.onboarding_completed_at);
 RETURN jsonb_build_object('status','confirmed');
END; $$;
REVOKE ALL ON FUNCTION public.get_form_account_activation(),public.confirm_form_account_activation(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_form_account_activation(),public.confirm_form_account_activation(uuid,jsonb) TO authenticated,service_role;
CREATE TABLE IF NOT EXISTS public.form_ride_publications (
 submission_id uuid NOT NULL REFERENCES public.form_submissions(submission_id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('request','offer')),
 request_id uuid REFERENCES public.ride_requests(request_id),offer_id uuid REFERENCES public.ride_offers(offer_id),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(submission_id,kind),
 CHECK((kind='request' AND request_id IS NOT NULL AND offer_id IS NULL) OR (kind='offer' AND offer_id IS NOT NULL AND request_id IS NULL))
);
GRANT SELECT ON public.form_ride_publications TO authenticated;
GRANT ALL ON public.form_ride_publications TO service_role;
REVOKE ALL ON public.form_ride_publications FROM PUBLIC,anon;
ALTER TABLE public.form_ride_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_form_publications ON public.form_ride_publications FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS passenger_gender_preference text NOT NULL DEFAULT 'ANY' CHECK(passenger_gender_preference IN ('ANY','FEMININO','MASCULINO'));
CREATE OR REPLACE FUNCTION public.get_sts_ride_seed() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE s public.form_submissions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT f.* INTO s FROM public.form_submissions f JOIN public.form_submission_account_links l ON l.submission_id=f.submission_id WHERE l.user_id=auth.uid() AND l.confirmed_at IS NOT NULL AND f.user_id=auth.uid() AND f.source IN ('sts-2026','sts2026','sts_2026') AND coalesce(f.raw_payload->>'cancelled','false')<>'true' AND coalesce(f.raw_payload->>'invalid','false')<>'true';
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('submissionId',s.submission_id,'intent',s.tipo_usuario,'origin',s.origem_trajeto,'destination',s.destino_trajeto,'createdAt',s.created_at,'raw',s.raw_payload||jsonb_build_object('departureWindow',s.faixa_horario));
END; $$;
CREATE OR REPLACE FUNCTION public.publish_sts_ride(p_submission_id uuid,p_kind text,p_details jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE s public.form_submissions%ROWTYPE; publication uuid; d date; t time; n integer; price numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT f.* INTO s FROM public.form_submissions f JOIN public.form_submission_account_links l ON l.submission_id=f.submission_id WHERE f.submission_id=p_submission_id AND l.user_id=auth.uid() AND f.user_id=auth.uid() AND l.confirmed_at IS NOT NULL FOR UPDATE OF f;
 IF NOT FOUND THEN RAISE EXCEPTION 'Form not linked to this account' USING ERRCODE='42501'; END IF;
 IF s.source NOT IN ('sts-2026','sts2026','sts_2026') OR coalesce(s.raw_payload->>'cancelled','false')='true' OR coalesce(s.raw_payload->>'invalid','false')='true' THEN RAISE EXCEPTION 'Invalid form'; END IF;
 IF p_kind NOT IN ('request','offer') OR p_kind IS NULL THEN RAISE EXCEPTION 'Invalid travel role'; END IF;
 SELECT coalesce(request_id,offer_id) INTO publication FROM public.form_ride_publications WHERE submission_id=p_submission_id AND kind=p_kind;
 IF publication IS NOT NULL THEN RETURN publication; END IF;
 d:=(p_details->>'rideDate')::date; t:=(p_details->>'departureTime')::time; n:=(p_details->>'count')::integer; price:=(p_details->>'price')::numeric;
 IF d IS NULL OR t IS NULL OR n IS NULL OR n NOT BETWEEN 1 AND 6 OR price IS NULL OR price<0 OR price>1000 OR price::text IN ('NaN','Infinity','-Infinity') OR nullif(btrim(p_details->>'origin'),'') IS NULL OR length(p_details->>'origin')>160 OR nullif(btrim(p_details->>'destination'),'') IS NULL OR length(p_details->>'destination')>160 THEN RAISE EXCEPTION 'Incomplete publication'; END IF;
 IF d NOT BETWEEN '2026-10-07'::date AND '2026-10-09'::date OR (d+t) AT TIME ZONE 'America/Fortaleza'>'2026-10-09T22:00:00-03:00'::timestamptz OR (d+t) AT TIME ZONE 'America/Fortaleza'<=clock_timestamp() THEN RAISE EXCEPTION 'Expired STS journey'; END IF;
 IF p_kind='offer' AND coalesce(p_details->>'audience','') NOT IN ('ANY','FEMININO','MASCULINO') THEN RAISE EXCEPTION 'Confirm audience'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,74120392));
 IF EXISTS(SELECT 1 FROM public.ride_requests WHERE user_id=auth.uid() AND status IN ('open','matched') AND (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza'>clock_timestamp()) OR EXISTS(SELECT 1 FROM public.rides WHERE (passenger_user_id=auth.uid() OR driver_user_id=auth.uid()) AND status='IN_PROGRESS') OR EXISTS(SELECT 1 FROM public.ride_offers WHERE user_id=auth.uid() AND status IN ('available','full') AND (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza'>clock_timestamp()) THEN RAISE EXCEPTION 'You already have an active publication'; END IF;
 IF p_kind='request' THEN
  publication:=public.create_ride_request(p_details->>'origin',p_details->>'destination',d,t,n,p_price=>price,p_origin_lat=>(p_details->>'originLat')::double precision,p_origin_lng=>(p_details->>'originLng')::double precision,p_destination_lat=>(p_details->>'destinationLat')::double precision,p_destination_lng=>(p_details->>'destinationLng')::double precision);
  INSERT INTO public.form_ride_publications(submission_id,user_id,kind,request_id) VALUES(p_submission_id,auth.uid(),p_kind,publication);
 ELSE
  publication:=public.create_ride_offer(p_details->>'origin',p_details->>'destination',d,t,n,p_total_price=>price,p_origin_lat=>(p_details->>'originLat')::double precision,p_origin_lng=>(p_details->>'originLng')::double precision,p_destination_lat=>(p_details->>'destinationLat')::double precision,p_destination_lng=>(p_details->>'destinationLng')::double precision);
  UPDATE public.ride_offers SET passenger_gender_preference=p_details->>'audience' WHERE offer_id=publication;
  INSERT INTO public.form_ride_publications(submission_id,user_id,kind,offer_id) VALUES(p_submission_id,auth.uid(),p_kind,publication);
 END IF;
 RETURN publication;
END; $$;
REVOKE ALL ON FUNCTION public.get_sts_ride_seed(),public.publish_sts_ride(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_sts_ride_seed(),public.publish_sts_ride(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';