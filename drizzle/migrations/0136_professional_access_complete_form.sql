-- F07: formulário único de solicitação de motorista. Aplicar após 0120/0135 conforme ambiente.
-- Não executar automaticamente em produção. A foto já deve estar no bucket avatars.
CREATE OR REPLACE FUNCTION public.submit_professional_access_request_complete(
  p_full_name text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_plate text,
  p_vehicle_color text, p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_id uuid; v_cat text; v_missing text[]; v_color text := btrim(coalesce(p_vehicle_color,''));
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE='42501'; END IF;
  IF length(v_color) < 2 OR length(v_color) > 40 THEN
    RAISE EXCEPTION 'Dados pendentes: VEHICLE_COLOR' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_full_name,''))) > 150 OR length(btrim(coalesce(p_vehicle_brand,''))) > 80
    OR length(btrim(coalesce(p_vehicle_model,''))) > 100 OR length(btrim(coalesce(p_vehicle_plate,''))) > 12
    OR length(btrim(coalesce(p_municipality,''))) > 120 THEN
    RAISE EXCEPTION 'Dados acima do limite permitido' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid AND a.approved) THEN
    RAISE EXCEPTION 'Motorista já autorizado' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.professional_access_requests WHERE user_id=v_uid AND status='PENDING') THEN
    RAISE EXCEPTION 'Já existe uma solicitação em análise' USING ERRCODE='23505';
  END IF;
  UPDATE public.profiles SET full_name=btrim(coalesce(p_full_name,'')),
     vehicle_brand=btrim(coalesce(p_vehicle_brand,'')),
     vehicle_description=btrim(coalesce(p_vehicle_model,'')),
     vehicle_plate=upper(regexp_replace(coalesce(p_vehicle_plate,''),'[[:space:]-]','','g')),
     updated_at=now()
   WHERE id=v_uid RETURNING * INTO v_profile;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  v_cat := CASE WHEN p_vehicle_type='CAR' THEN p_car_category ELSE NULL END;
  v_missing := public.professional_access_missing(v_uid,p_vehicle_type,v_cat,p_seats,p_municipality);
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %',array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  INSERT INTO public.professional_access_requests(
    user_id,vehicle_type,car_category,passenger_seats,municipality,snapshot
  ) VALUES (
    v_uid,p_vehicle_type,v_cat,p_seats,btrim(p_municipality),
    jsonb_build_object(
      'full_name',v_profile.full_name,'avatar_url',v_profile.avatar_url,
      'vehicle_brand',v_profile.vehicle_brand,'vehicle_model',btrim(coalesce(v_profile.vehicle_brand,'')||' '||coalesce(v_profile.vehicle_description,'')),
      'vehicle_color',v_color,'vehicle_plate',v_profile.vehicle_plate,'vehicle_type',p_vehicle_type,
      'car_category',v_cat,'passenger_seats',p_seats,'municipality',btrim(p_municipality)
    )
  ) RETURNING id INTO v_id;
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action) VALUES (v_id,v_uid,'SUBMITTED');
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.submit_professional_access_request_complete(text,text,text,text,text,text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_professional_access_request_complete(text,text,text,text,text,text,text,integer,text) TO authenticated;

-- Proteção adicional na análise: pedidos sem cor não podem receber aprovação.
-- Reaproveita as regras atuais de admin, autoaprovação, pendências e auditoria.
CREATE OR REPLACE FUNCTION public.admin_review_professional_access(p_request_id uuid,p_decision text,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_admin uuid := auth.uid(); r record; v_missing text[]; v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
  IF NOT public.has_role(v_admin,'admin') THEN RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
  IF p_decision NOT IN ('APPROVED','REJECTED','CHANGES_REQUESTED') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  IF p_decision <> 'APPROVED' AND (v_reason IS NULL OR length(v_reason)<5) THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 5 caracteres)' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.professional_access_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF r.status <> 'PENDING' THEN RAISE EXCEPTION 'Solicitação já analisada'; END IF;
  IF r.user_id=v_admin THEN RAISE EXCEPTION 'Autoaprovação não permitida' USING ERRCODE='42501'; END IF;
  IF p_decision='APPROVED' THEN
    IF length(btrim(coalesce(r.snapshot->>'vehicle_color','')))<2 THEN
      RAISE EXCEPTION 'Dados pendentes: VEHICLE_COLOR' USING ERRCODE='22023'; END IF;
    v_missing := public.professional_access_missing(r.user_id,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality);
    IF cardinality(v_missing)>0 THEN RAISE EXCEPTION 'Dados pendentes: %',array_to_string(v_missing,',') USING ERRCODE='22023'; END IF;
    INSERT INTO public.professional_driver_authorizations(user_id,approved,vehicle_type,approved_at,updated_at)
      VALUES(r.user_id,true,r.vehicle_type,now(),now())
      ON CONFLICT(user_id) DO UPDATE SET approved=true,vehicle_type=EXCLUDED.vehicle_type,approved_at=now(),updated_at=now();
  END IF;
  UPDATE public.professional_access_requests SET status=p_decision,reviewed_by=v_admin,reviewed_at=now(),
    review_reason=v_reason,updated_at=now() WHERE id=r.id;
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
    VALUES(r.id,v_admin,p_decision,v_reason);
END $$;
REVOKE ALL ON FUNCTION public.admin_review_professional_access(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_professional_access(uuid,text,text) TO authenticated;
