CREATE OR REPLACE FUNCTION public.get_validation_export(
  p_kind text,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_event text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;

  IF p_kind = 'raw_analytics' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]') INTO result FROM (
      SELECT created_at, source, campaign_event, tipo_usuario, ocupacao, origem_trajeto, destino_trajeto,
        faixa_horario, frequencia_semanal, transporte_atual, custo_atual_faixa, custo_referencia,
        intencao_passageiro, intencao_motorista,
        coalesce((SELECT string_agg(f.codigo_dor::text || ' (intensidade ' || coalesce(f.intensidade::text, 'N/D') || CASE WHEN f.principal THEN ', principal)' ELSE ')' END, '; ' ORDER BY f.codigo_dor)
          FROM public.form_submission_pain_points f WHERE f.submission_id = form_submissions.submission_id AND f.selecionada), '') AS dores
      FROM public.form_submissions
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR raw_payload ->> 'campaign' = p_campaign)
        AND (p_event IS NULL OR campaign_event = p_event) AND (p_tipo_usuario IS NULL OR tipo_usuario = p_tipo_usuario)
    ) x;
  ELSIF p_kind = 'leads' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]') INTO result FROM (
      SELECT submission_id, created_at, nome, whatsapp, email, tipo_usuario, origem_trajeto, destino_trajeto, faixa_horario
      FROM public.form_submissions
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR raw_payload ->> 'campaign' = p_campaign)
        AND (p_event IS NULL OR campaign_event = p_event) AND (p_tipo_usuario IS NULL OR tipo_usuario = p_tipo_usuario)
    ) x;
  ELSIF p_kind = 'pain_ranking' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.selected_count DESC), '[]') INTO result FROM (
      SELECT f.codigo_dor, count(*)::int selected_count, round(avg(f.intensidade), 2) average_intensity,
        count(*) FILTER (WHERE f.principal)::int principal_count
      FROM public.form_submission_pain_points f JOIN public.form_submissions s ON s.submission_id = f.submission_id
      WHERE f.selecionada AND (p_period_start IS NULL OR s.created_at >= p_period_start) AND (p_period_end IS NULL OR s.created_at < p_period_end)
        AND (p_source IS NULL OR s.source = p_source) AND (p_campaign IS NULL OR s.raw_payload ->> 'campaign' = p_campaign)
        AND (p_event IS NULL OR s.campaign_event = p_event) AND (p_tipo_usuario IS NULL OR s.tipo_usuario = p_tipo_usuario)
      GROUP BY f.codigo_dor
    ) x;
  ELSIF p_kind = 'intent' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.respondents DESC), '[]') INTO result FROM (
      SELECT intent::text AS category, count(*)::int respondents
      FROM public.form_submissions s
      CROSS JOIN LATERAL (VALUES (s.intencao_passageiro), (s.intencao_motorista)) AS i(intent)
      WHERE i.intent IS NOT NULL AND (p_period_start IS NULL OR s.created_at >= p_period_start) AND (p_period_end IS NULL OR s.created_at < p_period_end)
        AND (p_source IS NULL OR s.source = p_source) AND (p_campaign IS NULL OR s.raw_payload ->> 'campaign' = p_campaign)
        AND (p_event IS NULL OR s.campaign_event = p_event) AND (p_tipo_usuario IS NULL OR s.tipo_usuario = p_tipo_usuario)
      GROUP BY intent
    ) x;
  ELSIF p_kind IN ('profile', 'transport', 'costs') THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.respondents DESC), '[]') INTO result FROM (
      SELECT CASE p_kind WHEN 'profile' THEN tipo_usuario::text WHEN 'transport' THEN coalesce(transporte_atual, 'NÃO INFORMADO') ELSE coalesce(custo_atual_faixa, 'NÃO INFORMADO') END AS category,
        count(*)::int respondents
      FROM public.form_submissions
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR raw_payload ->> 'campaign' = p_campaign)
        AND (p_event IS NULL OR campaign_event = p_event) AND (p_tipo_usuario IS NULL OR tipo_usuario = p_tipo_usuario)
      GROUP BY 1
    ) x;
  ELSIF p_kind = 'funnel' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.event_name), '[]') INTO result FROM (
      SELECT event_name::text, count(*)::int events, count(DISTINCT coalesce(user_id::text, anonymous_session_id))::int people
      FROM public.form_funnel_events
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR campaign = p_campaign) AND (p_event IS NULL OR campaign_event = p_event)
      GROUP BY event_name
    ) x;
  ELSIF p_kind = 'match' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.event_name), '[]') INTO result FROM (
      SELECT event_name::text, count(*)::int events, count(DISTINCT coalesce(ride_id, match_id, event_id::text))::int unique_records
      FROM public.product_events
      WHERE event_name IN ('RIDE_REQUEST_CREATED','RIDE_OFFER_CREATED','MATCH_CREATED','RIDE_COMPLETED')
        AND (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR campaign = p_campaign)
      GROUP BY event_name
    ) x;
  ELSE RAISE EXCEPTION 'Unknown export kind';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_validation_export(text,timestamptz,timestamptz,text,text,text,public.form_tipo_usuario) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_validation_export(text,timestamptz,timestamptz,text,text,text,public.form_tipo_usuario) TO authenticated, service_role;
