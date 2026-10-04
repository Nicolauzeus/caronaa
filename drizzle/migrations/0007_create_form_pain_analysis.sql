CREATE OR REPLACE FUNCTION public.get_form_pain_analysis(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_event text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL,
  p_ocupacao text DEFAULT NULL,
  p_sort_by text DEFAULT 'frequency',
  p_frequency_weight numeric DEFAULT 1,
  p_intensity_weight numeric DEFAULT 1,
  p_primary_weight numeric DEFAULT 1,
  p_interest_weight numeric DEFAULT 1
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
  pain_catalog AS (
    SELECT *
    FROM (VALUES
      ('DOR_01'::public.form_dor_codigo, 'Acesso a uma opção adequada para determinado trajeto'),
      ('DOR_02'::public.form_dor_codigo, 'Lotação e desconforto em horários de pico'),
      ('DOR_03'::public.form_dor_codigo, 'Preço elevado de alternativas individuais'),
      ('DOR_04'::public.form_dor_codigo, 'Tempo e complexidade do deslocamento'),
      ('DOR_05'::public.form_dor_codigo, 'Lugares disponíveis em carros que poderiam ser compartilhados'),
      ('DOR_06'::public.form_dor_codigo, 'Falta de confiança para pegar/oferecer carona a desconhecidos')
    ) AS catalog(codigo_dor, label)
  ),
  filtered_submissions AS (
    SELECT fs.*
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
  sample AS (
    SELECT count(*)::numeric AS total
    FROM filtered_submissions
  ),
  selected_pains AS (
    SELECT fpp.*, fs.intencao_passageiro, fs.intencao_motorista
    FROM public.form_submission_pain_points fpp
    INNER JOIN filtered_submissions fs ON fs.submission_id = fpp.submission_id
    WHERE fpp.selecionada
  ),
  pain_counts AS (
    SELECT
      codigo_dor,
      count(*) AS selected_count,
      count(*) FILTER (WHERE principal) AS principal_count,
      round(avg(intensidade) FILTER (WHERE intensidade IS NOT NULL), 2) AS average_intensity,
      count(*) FILTER (WHERE intensidade = 1) AS intensity_1,
      count(*) FILTER (WHERE intensidade = 2) AS intensity_2,
      count(*) FILTER (WHERE intensidade = 3) AS intensity_3,
      count(*) FILTER (WHERE intensidade = 4) AS intensity_4,
      count(*) FILTER (WHERE intensidade = 5) AS intensity_5
    FROM selected_pains
    GROUP BY codigo_dor
  ),
  interest_by_pain AS (
    SELECT
      selected_pains.codigo_dor,
      round(avg(interest.value), 2) AS average_interest
    FROM selected_pains
    CROSS JOIN LATERAL (
      VALUES
        (CASE selected_pains.intencao_passageiro
          WHEN 'HOJE' THEN 5
          WHEN 'PROVAVELMENTE' THEN 4
          WHEN 'TALVEZ' THEN 3
          WHEN 'PROVAVELMENTE_NAO' THEN 2
          WHEN 'NAO' THEN 1
          ELSE NULL
        END),
        (CASE selected_pains.intencao_motorista
          WHEN 'HOJE' THEN 5
          WHEN 'PROVAVELMENTE' THEN 4
          WHEN 'TALVEZ' THEN 3
          WHEN 'PROVAVELMENTE_NAO' THEN 2
          WHEN 'NAO' THEN 1
          ELSE NULL
        END)
    ) AS interest(value)
    WHERE interest.value IS NOT NULL
    GROUP BY selected_pains.codigo_dor
  ),
  weights AS (
    SELECT
      greatest(COALESCE(p_frequency_weight, 0), 0) AS frequency_weight,
      greatest(COALESCE(p_intensity_weight, 0), 0) AS intensity_weight,
      greatest(COALESCE(p_primary_weight, 0), 0) AS primary_weight,
      greatest(COALESCE(p_interest_weight, 0), 0) AS interest_weight
  ),
  normalized AS (
    SELECT
      pain_catalog.codigo_dor,
      pain_catalog.label,
      COALESCE(pain_counts.selected_count, 0)::numeric AS selected_count,
      CASE WHEN sample.total = 0 THEN 0 ELSE round((COALESCE(pain_counts.selected_count, 0)::numeric / sample.total) * 100, 2) END AS selected_percentage,
      COALESCE(pain_counts.principal_count, 0)::numeric AS principal_count,
      CASE WHEN sample.total = 0 THEN 0 ELSE round((COALESCE(pain_counts.principal_count, 0)::numeric / sample.total) * 100, 2) END AS principal_percentage,
      pain_counts.average_intensity,
      jsonb_build_object(
        '1', COALESCE(pain_counts.intensity_1, 0),
        '2', COALESCE(pain_counts.intensity_2, 0),
        '3', COALESCE(pain_counts.intensity_3, 0),
        '4', COALESCE(pain_counts.intensity_4, 0),
        '5', COALESCE(pain_counts.intensity_5, 0)
      ) AS intensity_distribution,
      interest_by_pain.average_interest
    FROM pain_catalog
    CROSS JOIN sample
    LEFT JOIN pain_counts ON pain_counts.codigo_dor = pain_catalog.codigo_dor
    LEFT JOIN interest_by_pain ON interest_by_pain.codigo_dor = pain_catalog.codigo_dor
  ),
  scored AS (
    SELECT
      normalized.*,
      normalized.selected_percentage AS frequency_score,
      round((COALESCE(normalized.average_intensity, 0) / 5) * 100, 2) AS intensity_score,
      normalized.principal_percentage AS primary_pain_score,
      round(((COALESCE(normalized.average_interest, 1) - 1) / 4) * 100, 2) AS interest_score
    FROM normalized
  ),
  final AS (
    SELECT
      scored.*,
      CASE
        WHEN weights.frequency_weight + weights.intensity_weight + weights.primary_weight + weights.interest_weight = 0 THEN 0
        ELSE round((
          scored.frequency_score * weights.frequency_weight +
          scored.intensity_score * weights.intensity_weight +
          scored.primary_pain_score * weights.primary_weight +
          scored.interest_score * weights.interest_weight
        ) / (
          weights.frequency_weight + weights.intensity_weight + weights.primary_weight + weights.interest_weight
        ), 2)
      END AS opportunity_score
    FROM scored
    CROSS JOIN weights
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
    'sampleSize', (SELECT total FROM sample),
    'formula', jsonb_build_object(
      'description', 'Opportunity Score = média ponderada de frequencyScore, intensityScore, primaryPainScore e interestScore, normalizada para 0-100.',
      'frequencyScore', 'percentual da amostra que selecionou a dor',
      'intensityScore', 'intensidade média / 5 * 100',
      'primaryPainScore', 'percentual da amostra que marcou a dor como principal',
      'interestScore', 'média de interesse convertida para 1-5 e normalizada: (média - 1) / 4 * 100',
      'interestScale', jsonb_build_object('NAO', 1, 'PROVAVELMENTE_NAO', 2, 'TALVEZ', 3, 'PROVAVELMENTE', 4, 'HOJE', 5),
      'weights', jsonb_build_object(
        'frequency', greatest(COALESCE(p_frequency_weight, 0), 0),
        'intensity', greatest(COALESCE(p_intensity_weight, 0), 0),
        'primaryPain', greatest(COALESCE(p_primary_weight, 0), 0),
        'interest', greatest(COALESCE(p_interest_weight, 0), 0)
      )
    ),
    'sortBy', CASE
      WHEN p_sort_by IN ('frequency', 'intensity', 'primaryPain', 'interest') THEN p_sort_by
      ELSE 'frequency'
    END,
    'painPoints', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'codigoDor', final.codigo_dor,
          'label', final.label,
          'selectedCount', final.selected_count,
          'selectedPercentage', final.selected_percentage,
          'principalCount', final.principal_count,
          'principalPercentage', final.principal_percentage,
          'averageIntensity', final.average_intensity,
          'intensityDistribution', final.intensity_distribution,
          'averageInterest', final.average_interest,
          'scores', jsonb_build_object(
            'frequencyScore', final.frequency_score,
            'intensityScore', final.intensity_score,
            'primaryPainScore', final.primary_pain_score,
            'interestScore', final.interest_score,
            'opportunityScore', final.opportunity_score
          )
        )
        ORDER BY
          CASE WHEN p_sort_by = 'intensity' THEN final.intensity_score END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'primaryPain' THEN final.primary_pain_score END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'interest' THEN final.interest_score END DESC NULLS LAST,
          CASE WHEN p_sort_by NOT IN ('intensity', 'primaryPain', 'interest') THEN final.frequency_score END DESC NULLS LAST,
          final.codigo_dor ASC
      )
      FROM final
    ), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.get_form_pain_analysis(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  public.form_tipo_usuario,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_form_pain_analysis(
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  public.form_tipo_usuario,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric
) TO authenticated, service_role;
