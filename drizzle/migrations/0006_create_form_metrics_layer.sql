CREATE TABLE IF NOT EXISTS public.form_starts (
  start_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_session_id text,
  source text NOT NULL,
  campaign text,
  campaign_event text NOT NULL,
  tipo_usuario public.form_tipo_usuario,
  ocupacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT form_starts_identity_check
    CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS form_starts_created_at_idx
ON public.form_starts (created_at);

CREATE INDEX IF NOT EXISTS form_starts_source_idx
ON public.form_starts (source);

CREATE INDEX IF NOT EXISTS form_starts_campaign_idx
ON public.form_starts (campaign);

CREATE INDEX IF NOT EXISTS form_starts_campaign_event_idx
ON public.form_starts (campaign_event);

CREATE INDEX IF NOT EXISTS form_starts_tipo_usuario_idx
ON public.form_starts (tipo_usuario);

CREATE INDEX IF NOT EXISTS form_starts_ocupacao_idx
ON public.form_starts (ocupacao);

CREATE INDEX IF NOT EXISTS form_submissions_ocupacao_idx
ON public.form_submissions (ocupacao);

GRANT INSERT ON public.form_starts TO anon, authenticated;
GRANT SELECT ON public.form_starts TO authenticated;
GRANT ALL ON public.form_starts TO service_role;

ALTER TABLE public.form_starts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can register form starts" ON public.form_starts;
CREATE POLICY "Anyone can register form starts"
ON public.form_starts FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read form starts" ON public.form_starts;
CREATE POLICY "Admins can read form starts"
ON public.form_starts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_form_metrics(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_event text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL,
  p_ocupacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH authorized AS (
    SELECT public.has_role(auth.uid(), 'admin') AS is_admin
  ),
  filtered_starts AS (
    SELECT *
    FROM public.form_starts fs
    CROSS JOIN authorized
    WHERE authorized.is_admin
      AND (p_period_start IS NULL OR fs.created_at >= p_period_start)
      AND (p_period_end IS NULL OR fs.created_at < p_period_end)
      AND (p_source IS NULL OR fs.source = p_source)
      AND (p_campaign IS NULL OR fs.campaign = p_campaign)
      AND (p_event IS NULL OR fs.campaign_event = p_event)
      AND (p_tipo_usuario IS NULL OR fs.tipo_usuario = p_tipo_usuario)
      AND (p_ocupacao IS NULL OR fs.ocupacao = p_ocupacao)
  ),
  filtered_submissions AS (
    SELECT *
    FROM public.form_submissions fs
    CROSS JOIN authorized
    WHERE authorized.is_admin
      AND (p_period_start IS NULL OR fs.created_at >= p_period_start)
      AND (p_period_end IS NULL OR fs.created_at < p_period_end)
      AND (p_source IS NULL OR fs.source = p_source)
      AND (p_campaign IS NULL OR fs.raw_payload ->> 'campaign' = p_campaign)
      AND (p_event IS NULL OR fs.campaign_event = p_event)
      AND (p_tipo_usuario IS NULL OR fs.tipo_usuario = p_tipo_usuario)
      AND (p_ocupacao IS NULL OR fs.ocupacao = p_ocupacao)
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM filtered_starts) AS started,
      (SELECT count(*) FROM filtered_submissions) AS completed
  ),
  pain_totals AS (
    SELECT count(*)::numeric AS total_completed
    FROM filtered_submissions
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object(
      'periodStart', p_period_start,
      'periodEnd', p_period_end,
      'source', p_source,
      'campaign', p_campaign,
      'event', p_event,
      'tipoUsuario', p_tipo_usuario,
      'ocupacao', p_ocupacao
    ),
    'totals', (
      SELECT jsonb_build_object(
        'started', started,
        'completed', completed,
        'completionRate', CASE WHEN started = 0 THEN 0 ELSE round((completed::numeric / started::numeric) * 100, 2) END,
        'passageiros', (SELECT count(*) FROM filtered_submissions WHERE tipo_usuario = 'PASSAGEIRO'),
        'motoristas', (SELECT count(*) FROM filtered_submissions WHERE tipo_usuario = 'MOTORISTA'),
        'ambos', (SELECT count(*) FROM filtered_submissions WHERE tipo_usuario = 'AMBOS')
      )
      FROM totals
    ),
    'distributions', jsonb_build_object(
      'ocupacao', COALESCE((SELECT jsonb_object_agg(key, value) FROM (SELECT ocupacao AS key, count(*) AS value FROM filtered_submissions GROUP BY ocupacao) grouped WHERE key IS NOT NULL), '{}'::jsonb),
      'faixaHorario', COALESCE((SELECT jsonb_object_agg(key, value) FROM (SELECT faixa_horario AS key, count(*) AS value FROM filtered_submissions GROUP BY faixa_horario) grouped WHERE key IS NOT NULL), '{}'::jsonb),
      'frequenciaSemanal', COALESCE((SELECT jsonb_object_agg(key, value) FROM (SELECT frequencia_semanal AS key, count(*) AS value FROM filtered_submissions GROUP BY frequencia_semanal) grouped WHERE key IS NOT NULL), '{}'::jsonb),
      'transporteAtual', COALESCE((SELECT jsonb_object_agg(key, value) FROM (SELECT transporte_atual AS key, count(*) AS value FROM filtered_submissions GROUP BY transporte_atual) grouped WHERE key IS NOT NULL), '{}'::jsonb),
      'custoAtualFaixa', COALESCE((SELECT jsonb_object_agg(key, value) FROM (SELECT custo_atual_faixa AS key, count(*) AS value FROM filtered_submissions GROUP BY custo_atual_faixa) grouped WHERE key IS NOT NULL), '{}'::jsonb)
    ),
    'painPoints', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'codigoDor', pain.codigo_dor,
          'selectedCount', pain.selected_count,
          'selectedPercentage', CASE WHEN pain_totals.total_completed = 0 THEN 0 ELSE round((pain.selected_count::numeric / pain_totals.total_completed) * 100, 2) END,
          'principalCount', pain.principal_count,
          'principalPercentage', CASE WHEN pain_totals.total_completed = 0 THEN 0 ELSE round((pain.principal_count::numeric / pain_totals.total_completed) * 100, 2) END,
          'averageIntensity', pain.average_intensity
        )
        ORDER BY pain.codigo_dor
      )
      FROM (
        SELECT
          fpp.codigo_dor,
          count(*) FILTER (WHERE fpp.selecionada) AS selected_count,
          count(*) FILTER (WHERE fpp.principal) AS principal_count,
          round(avg(fpp.intensidade) FILTER (WHERE fpp.intensidade IS NOT NULL), 2) AS average_intensity
        FROM public.form_submission_pain_points fpp
        INNER JOIN filtered_submissions fs ON fs.submission_id = fpp.submission_id
        GROUP BY fpp.codigo_dor
      ) pain
      CROSS JOIN pain_totals
    ), '[]'::jsonb),
    'intentByProfile', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'tipoUsuario', intent.tipo_usuario,
          'passageiro', intent.passageiro,
          'motorista', intent.motorista
        )
        ORDER BY intent.tipo_usuario
      )
      FROM (
        SELECT
          tipo_usuario,
          COALESCE(jsonb_object_agg(intencao_passageiro, passenger_count) FILTER (WHERE intencao_passageiro IS NOT NULL), '{}'::jsonb) AS passageiro,
          COALESCE(jsonb_object_agg(intencao_motorista, driver_count) FILTER (WHERE intencao_motorista IS NOT NULL), '{}'::jsonb) AS motorista
        FROM (
          SELECT
            tipo_usuario,
            intencao_passageiro,
            intencao_motorista,
            count(*) OVER (PARTITION BY tipo_usuario, intencao_passageiro) AS passenger_count,
            count(*) OVER (PARTITION BY tipo_usuario, intencao_motorista) AS driver_count
          FROM filtered_submissions
        ) counted
        GROUP BY tipo_usuario
      ) intent
    ), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.get_form_metrics(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  public.form_tipo_usuario,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_form_metrics(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  public.form_tipo_usuario,
  text
) TO authenticated, service_role;
