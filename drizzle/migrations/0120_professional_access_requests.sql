CREATE TABLE IF NOT EXISTS public.professional_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED')),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('CAR','MOTO')),
  car_category text CHECK (car_category IS NULL OR car_category IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')),
  passenger_seats smallint NOT NULL CHECK (passenger_seats BETWEEN 1 AND 7),
  municipality text NOT NULL,
  snapshot jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS professional_access_one_pending
  ON public.professional_access_requests(user_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS professional_access_requests_user_idx
  ON public.professional_access_requests(user_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.professional_access_request_events (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.professional_access_requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('SUBMITTED','APPROVED','REJECTED','CHANGES_REQUESTED')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.professional_access_requests TO authenticated;
GRANT ALL ON public.professional_access_requests TO service_role;
GRANT ALL ON public.professional_access_request_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.professional_access_request_events_id_seq TO service_role;
ALTER TABLE public.professional_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_access_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own professional access requests" ON public.professional_access_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.professional_access_missing(
  p_user uuid, p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text
) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p record; v text[] := '{}'; v_plate text;
BEGIN
  SELECT full_name, avatar_url, vehicle_brand, vehicle_description, vehicle_plate INTO p
    FROM public.profiles WHERE id = p_user;
  IF coalesce(p.avatar_url,'') !~ '^https://' THEN v := v || 'PHOTO'::text; END IF;
  IF coalesce(btrim(p.full_name),'') !~ '^\S{2,}(\s+\S+)+$' THEN v := v || 'FULL_NAME'::text; END IF;
  IF length(btrim(coalesce(p.vehicle_brand,'') || ' ' || coalesce(p.vehicle_description,''))) < 3 THEN v := v || 'VEHICLE_MODEL'::text; END IF;
  v_plate := upper(regexp_replace(coalesce(p.vehicle_plate,''), '[\s-]', '', 'g'));
  IF v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN v := v || 'PLATE'::text; END IF;
  IF p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('CAR','MOTO') THEN v := v || 'VEHICLE_TYPE'::text;
  ELSIF p_vehicle_type = 'CAR' AND (p_car_category IS NULL OR p_car_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')) THEN v := v || 'CAR_CATEGORY'::text;
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 7
     OR (p_vehicle_type = 'MOTO' AND p_seats <> 1)
     OR (p_vehicle_type = 'CAR' AND p_car_category IN ('HATCH','SEDAN','PICKUP') AND p_seats > 4)
     OR (p_vehicle_type = 'CAR' AND p_car_category = 'SUV' AND p_seats > 6) THEN v := v || 'SEATS'::text; END IF;
  IF length(btrim(coalesce(p_municipality,''))) < 2 THEN v := v || 'MUNICIPALITY'::text; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.submit_professional_access_request(
  p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_uid uuid := auth.uid(); v_missing text[]; v_id uuid; v_cat text; p record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  v_cat := CASE WHEN p_vehicle_type = 'CAR' THEN p_car_category END;
  v_missing := public.professional_access_missing(v_uid, p_vehicle_type, v_cat, p_seats, p_municipality);
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing, ',') USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_access_requests WHERE user_id=v_uid AND status='PENDING') THEN
    RAISE EXCEPTION 'Já existe uma solicitação em análise' USING ERRCODE='23505';
  END IF;
  SELECT full_name, avatar_url, vehicle_brand, vehicle_description,
         upper(regexp_replace(vehicle_plate,'[\s-]','','g')) AS plate INTO p
    FROM public.profiles WHERE id=v_uid;
  INSERT INTO public.professional_access_requests(user_id, vehicle_type, car_category, passenger_seats, municipality, snapshot)
  VALUES (v_uid, p_vehicle_type, v_cat, p_seats, btrim(p_municipality),
    jsonb_build_object('full_name',btrim(p.full_name),'avatar_url',p.avatar_url,
      'vehicle_model',btrim(coalesce(p.vehicle_brand,'')||' '||coalesce(p.vehicle_description,'')),
      'vehicle_plate',p.plate,'vehicle_type',p_vehicle_type,'car_category',v_cat,
      'passenger_seats',p_seats,'municipality',btrim(p_municipality)))
  RETURNING id INTO v_id;
  INSERT INTO public.professional_access_request_events(request_id, actor_id, action) VALUES (v_id, v_uid, 'SUBMITTED');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_professional_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_uid uuid := auth.uid(); r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.professional_access_requests WHERE user_id=v_uid ORDER BY submitted_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'authorized', EXISTS (SELECT 1 FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid AND a.approved),
    'profileMissing', to_jsonb(public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')),
    'request', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'status',r.status,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,'passenger_seats',r.passenger_seats,
      'municipality',r.municipality,'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,'review_reason',r.review_reason) END);
END $$;

CREATE OR REPLACE FUNCTION public.admin_professional_access_queue()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',q.id,'user_id',q.user_id,'status',q.status,
      'snapshot',q.snapshot,'submitted_at',q.submitted_at,'reviewed_at',q.reviewed_at,'review_reason',q.review_reason,
      'current_missing',to_jsonb(public.professional_access_missing(q.user_id,q.vehicle_type,q.car_category,q.passenger_seats,q.municipality)))
      ORDER BY (q.status='PENDING') DESC, q.submitted_at DESC)
    FROM (SELECT * FROM public.professional_access_requests ORDER BY submitted_at DESC LIMIT 50) q), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_professional_access(p_request_id uuid, p_decision text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_admin uuid := auth.uid(); r record; v_missing text[]; v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
  IF p_decision NOT IN ('APPROVED','REJECTED','CHANGES_REQUESTED') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  IF p_decision <> 'APPROVED' AND (v_reason IS NULL OR length(v_reason) < 5) THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 5 caracteres)' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.professional_access_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'Solicitação já analisada'; END IF;
  IF r.user_id = v_admin THEN RAISE EXCEPTION 'Autoaprovação não permitida' USING ERRCODE='42501'; END IF;
  IF p_decision = 'APPROVED' THEN
    v_missing := public.professional_access_missing(r.user_id, r.vehicle_type, r.car_category, r.passenger_seats, r.municipality);
    IF cardinality(v_missing) > 0 THEN
      RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing, ',') USING ERRCODE='22023'; END IF;
    INSERT INTO public.professional_driver_authorizations(user_id, approved, vehicle_type, approved_at, updated_at)
    VALUES (r.user_id, true, r.vehicle_type, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET approved=true, vehicle_type=EXCLUDED.vehicle_type, approved_at=now(), updated_at=now();
  END IF;
  UPDATE public.professional_access_requests SET status=p_decision, reviewed_by=v_admin, reviewed_at=now(),
    review_reason=v_reason, updated_at=now() WHERE id=r.id;
  INSERT INTO public.professional_access_request_events(request_id, actor_id, action, reason) VALUES (r.id, v_admin, p_decision, v_reason);
END $$;

REVOKE ALL ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_professional_access_request(text,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_professional_access_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_professional_access(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_professional_access_request(text,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_professional_access_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_professional_access(uuid,text,text) TO authenticated;
