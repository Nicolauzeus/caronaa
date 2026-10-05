-- Form submissions and their pains are written only through the RPC below.
-- A browser must never be able to attach a pain to an arbitrary submission_id.
DROP POLICY IF EXISTS "Anyone can submit form response pain points" ON public.form_submission_pain_points;
DROP POLICY IF EXISTS "Anyone can submit form responses" ON public.form_submissions;

REVOKE INSERT, UPDATE, DELETE ON public.form_submissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.form_submission_pain_points FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_form_response(
  p_submission jsonb,
  p_pain_points jsonb,
  p_anonymous_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id uuid;
  v_user_id uuid := auth.uid();
  v_existing public.form_submissions%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_submission) <> 'object' OR jsonb_typeof(p_pain_points) <> 'array' THEN
    RAISE EXCEPTION 'Invalid form submission payload' USING ERRCODE = '22023';
  END IF;
  IF v_user_id IS NULL AND (p_anonymous_session_id IS NULL OR length(trim(p_anonymous_session_id)) = 0) THEN
    RAISE EXCEPTION 'Anonymous session is required' USING ERRCODE = '42501';
  END IF;
  IF p_anonymous_session_id IS NOT NULL AND length(p_anonymous_session_id) > 200 THEN
    RAISE EXCEPTION 'Anonymous session is invalid' USING ERRCODE = '22023';
  END IF;

  v_submission_id := (p_submission ->> 'submission_id')::uuid;
  SELECT * INTO v_existing FROM public.form_submissions WHERE submission_id = v_submission_id;
  IF FOUND THEN
    IF (v_user_id IS NOT NULL AND v_existing.user_id = v_user_id)
       OR (v_user_id IS NULL AND v_existing.user_id IS NULL AND v_existing.anonymous_session_id = p_anonymous_session_id) THEN
      RETURN v_submission_id;
    END IF;
    RAISE EXCEPTION 'Submission does not belong to this client' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(p_pain_points) <> 6
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_pain_points) point
                WHERE point ->> 'codigo_dor' NOT IN ('DOR_01','DOR_02','DOR_03','DOR_04','DOR_05','DOR_06')
                   OR point ->> 'selecionada' NOT IN ('true','false')
                   OR point ->> 'principal' NOT IN ('true','false'))
     OR (SELECT count(DISTINCT point ->> 'codigo_dor') FROM jsonb_array_elements(p_pain_points) point) <> 6 THEN
    RAISE EXCEPTION 'Invalid pain points payload' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.form_submissions (
    submission_id, user_id, anonymous_session_id, source, campaign, campaign_event, tipo_usuario,
    ocupacao, origem_trajeto, destino_trajeto, faixa_horario, frequencia_semanal, transporte_atual,
    custo_atual_faixa, custo_referencia, intencao_passageiro, intencao_motorista, nome, whatsapp,
    email, consentimento, raw_payload
  ) VALUES (
    v_submission_id, v_user_id, CASE WHEN v_user_id IS NULL THEN p_anonymous_session_id ELSE NULL END,
    p_submission ->> 'source', p_submission ->> 'campaign', p_submission ->> 'campaign_event',
    (p_submission ->> 'tipo_usuario')::public.form_tipo_usuario, p_submission ->> 'ocupacao',
    p_submission ->> 'origem_trajeto', p_submission ->> 'destino_trajeto', p_submission ->> 'faixa_horario',
    p_submission ->> 'frequencia_semanal', p_submission ->> 'transporte_atual', p_submission ->> 'custo_atual_faixa',
    (p_submission ->> 'custo_referencia')::public.form_custo_referencia,
    (p_submission ->> 'intencao_passageiro')::public.form_intencao,
    (p_submission ->> 'intencao_motorista')::public.form_intencao,
    p_submission ->> 'nome', p_submission ->> 'whatsapp', p_submission ->> 'email', true, p_submission
  );
  INSERT INTO public.form_submission_pain_points (submission_id, codigo_dor, selecionada, principal, intensidade)
  SELECT v_submission_id, (point ->> 'codigo_dor')::public.form_dor_codigo,
    (point ->> 'selecionada')::boolean, (point ->> 'principal')::boolean,
    CASE WHEN (point ->> 'principal')::boolean THEN (point ->> 'intensidade')::integer ELSE NULL END
  FROM jsonb_array_elements(p_pain_points) point;
  RETURN v_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_form_response(jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_form_response(jsonb, jsonb, text) TO anon, authenticated, service_role;
