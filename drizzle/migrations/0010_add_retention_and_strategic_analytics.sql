-- Analytics are deliberately computed in Postgres: clients only receive aggregates.
CREATE INDEX IF NOT EXISTS product_events_completed_retention_idx
  ON public.product_events (user_id, created_at, ride_id)
  WHERE event_name = 'RIDE_COMPLETED';

CREATE INDEX IF NOT EXISTS product_events_route_supply_demand_idx
  ON public.product_events (event_name, created_at)
  WHERE event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED');

CREATE OR REPLACE FUNCTION public.get_retention_metrics(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH authorized AS (SELECT public.has_role(auth.uid(), 'admin') AS is_admin),
  completed AS (
    SELECT pe.user_id, COALESCE(pe.ride_id, pe.event_id::text) AS completed_ride_id,
      min(pe.created_at) AS completed_at
    FROM public.product_events pe CROSS JOIN authorized a
    WHERE a.is_admin AND pe.event_name = 'RIDE_COMPLETED'
      AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
      AND (p_period_end IS NULL OR pe.created_at < p_period_end)
      AND (p_source IS NULL OR pe.source = p_source)
      AND (p_campaign IS NULL OR pe.campaign = p_campaign)
    GROUP BY pe.user_id, COALESCE(pe.ride_id, pe.event_id::text)
  ),
  roles AS (
    SELECT pe.user_id,
      bool_or(pe.event_name = 'RIDE_REQUEST_CREATED') AS is_passenger,
      bool_or(pe.event_name = 'RIDE_OFFER_CREATED') AS is_driver
    FROM public.product_events pe WHERE pe.event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED')
    GROUP BY pe.user_id
  ),
  per_user AS (
    SELECT c.user_id, count(*)::int AS ride_count, min(c.completed_at) AS first_completed_at,
      CASE WHEN coalesce(r.is_passenger, false) AND coalesce(r.is_driver, false) THEN 'AMBOS'::public.form_tipo_usuario
           WHEN coalesce(r.is_driver, false) THEN 'MOTORISTA'::public.form_tipo_usuario
           ELSE 'PASSAGEIRO'::public.form_tipo_usuario END AS profile
    FROM completed c LEFT JOIN roles r ON r.user_id = c.user_id
    GROUP BY c.user_id, r.is_passenger, r.is_driver
  ),
  -- Calculate the first return from completed rides only; a match never qualifies.
  users AS (
    SELECT pu.user_id, pu.ride_count, pu.first_completed_at, pu.profile,
      (SELECT min(c.completed_at) FROM completed c WHERE c.user_id = pu.user_id AND c.completed_at > pu.first_completed_at) AS second_completed_at
    FROM per_user pu
  ),
  scoped AS (SELECT * FROM users WHERE p_tipo_usuario IS NULL OR profile = p_tipo_usuario),
  profile_distribution AS (
    SELECT profile, count(*) FILTER (WHERE ride_count = 1)::int AS one,
      count(*) FILTER (WHERE ride_count = 2)::int AS two,
      count(*) FILTER (WHERE ride_count >= 3)::int AS "threeOrMore"
    FROM scoped GROUP BY profile
  )
  SELECT jsonb_build_object(
    'usersWith1Ride', count(*) FILTER (WHERE ride_count = 1),
    'usersWith2Rides', count(*) FILTER (WHERE ride_count = 2),
    'usersWith3OrMoreRides', count(*) FILTER (WHERE ride_count >= 3),
    'repeatRate7d', coalesce(round(100.0 * count(*) FILTER (WHERE second_completed_at <= first_completed_at + interval '7 days') / nullif(count(*), 0), 2), 0),
    'repeatRate30d', coalesce(round(100.0 * count(*) FILTER (WHERE second_completed_at <= first_completed_at + interval '30 days') / nullif(count(*), 0), 2), 0),
    'distribution', jsonb_build_object('one', count(*) FILTER (WHERE ride_count = 1), 'two', count(*) FILTER (WHERE ride_count = 2), 'threeToFive', count(*) FILTER (WHERE ride_count BETWEEN 3 AND 5), 'sixOrMore', count(*) FILTER (WHERE ride_count >= 6)),
    'byProfile', coalesce((SELECT jsonb_object_agg(profile, jsonb_build_object('one', one, 'two', two, 'threeOrMore', "threeOrMore")) FROM profile_distribution), '{}'::jsonb)
  ) FROM scoped;
$$;

CREATE OR REPLACE FUNCTION public.get_strategic_crossings(
  p_period_start timestamptz DEFAULT NULL, p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL, p_campaign text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH authorized AS (SELECT public.has_role(auth.uid(), 'admin') AS is_admin),
  submissions AS (
    SELECT fs.* FROM public.form_submissions fs CROSS JOIN authorized a
    WHERE a.is_admin AND (p_period_start IS NULL OR fs.created_at >= p_period_start)
      AND (p_period_end IS NULL OR fs.created_at < p_period_end) AND (p_source IS NULL OR fs.source = p_source)
      AND (p_campaign IS NULL OR fs.raw_payload ->> 'campaign' = p_campaign)
  ),
  interest AS (
    SELECT s.*, x.value AS interest_score FROM submissions s CROSS JOIN LATERAL (VALUES
      (CASE s.intencao_passageiro WHEN 'HOJE' THEN 5 WHEN 'PROVAVELMENTE' THEN 4 WHEN 'TALVEZ' THEN 3 WHEN 'PROVAVELMENTE_NAO' THEN 2 WHEN 'NAO' THEN 1 END),
      (CASE s.intencao_motorista WHEN 'HOJE' THEN 5 WHEN 'PROVAVELMENTE' THEN 4 WHEN 'TALVEZ' THEN 3 WHEN 'PROVAVELMENTE_NAO' THEN 2 WHEN 'NAO' THEN 1 END)
    ) x(value) WHERE x.value IS NOT NULL
  ),
  pain AS (SELECT f.submission_id, avg(f.intensidade)::numeric AS avg_intensity FROM public.form_submission_pain_points f JOIN submissions s ON s.submission_id = f.submission_id WHERE f.selecionada GROUP BY f.submission_id),
  ride_events AS (
    SELECT pe.* FROM public.product_events pe CROSS JOIN authorized a WHERE a.is_admin
      AND pe.event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED', 'RIDE_COMPLETED')
      AND (p_period_start IS NULL OR pe.created_at >= p_period_start) AND (p_period_end IS NULL OR pe.created_at < p_period_end)
      AND (p_source IS NULL OR pe.source = p_source) AND (p_campaign IS NULL OR pe.campaign = p_campaign)
  ),
  supply_demand AS (
    SELECT coalesce(metadata->>'origin', 'NÃO INFORMADA') AS origin, coalesce(metadata->>'destination', 'NÃO INFORMADO') AS destination,
      coalesce(metadata->>'timeWindow', 'NÃO INFORMADO') AS time_window,
      count(*) FILTER (WHERE event_name = 'RIDE_REQUEST_CREATED')::int AS requests,
      count(*) FILTER (WHERE event_name = 'RIDE_OFFER_CREATED')::int AS offers
    FROM ride_events WHERE event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED') GROUP BY 1,2,3
  ),
  activity_roles AS (
    SELECT user_id, bool_or(event_name = 'RIDE_REQUEST_CREATED') AS passenger, bool_or(event_name = 'RIDE_OFFER_CREATED') AS driver,
      bool_or(event_name = 'RIDE_COMPLETED') AS completed FROM ride_events GROUP BY user_id
  ),
  segments AS (SELECT CASE WHEN passenger AND driver THEN 'AMBOS' WHEN driver THEN 'MOTORISTA' ELSE 'PASSAGEIRO' END AS profile, completed FROM activity_roles WHERE passenger OR driver)
  SELECT jsonb_build_object(
    'profilePainAndIntent', coalesce((SELECT jsonb_agg(jsonb_build_object('profile', profile, 'respondents', respondents, 'averagePainIntensity', avg_pain, 'averageIntent', avg_intent) ORDER BY avg_pain DESC NULLS LAST) FROM (SELECT s.tipo_usuario AS profile, count(DISTINCT s.submission_id)::int respondents, round(avg(p.avg_intensity),2) avg_pain, round(avg(i.interest_score),2) avg_intent FROM submissions s LEFT JOIN pain p ON p.submission_id=s.submission_id LEFT JOIN interest i ON i.submission_id=s.submission_id GROUP BY s.tipo_usuario) x), '[]'::jsonb),
    'painIntent', coalesce((SELECT jsonb_agg(jsonb_build_object('painCode', pain_code, 'respondents', respondents, 'averageIntensity', avg_intensity, 'averageIntent', avg_intent) ORDER BY avg_intent DESC NULLS LAST) FROM (SELECT f.codigo_dor AS pain_code, count(DISTINCT f.submission_id)::int respondents, round(avg(f.intensidade),2) avg_intensity, round(avg(i.interest_score),2) avg_intent FROM public.form_submission_pain_points f JOIN submissions s ON s.submission_id=f.submission_id LEFT JOIN interest i ON i.submission_id=s.submission_id WHERE f.selecionada GROUP BY f.codigo_dor) x), '[]'::jsonb),
    'routesWithStrongPain', coalesce((SELECT jsonb_agg(jsonb_build_object('origin', origin,'destination',destination,'strongPainRespondents',respondents,'averagePainIntensity',avg_pain) ORDER BY respondents DESC) FROM (SELECT coalesce(s.origem_trajeto,'NÃO INFORMADA') origin,s.destino_trajeto destination,count(*)::int respondents,round(avg(p.avg_intensity),2) avg_pain FROM submissions s JOIN pain p ON p.submission_id=s.submission_id WHERE p.avg_intensity >= 4 GROUP BY s.origem_trajeto,s.destino_trajeto) x), '[]'::jsonb),
    'demandByTime', coalesce((SELECT jsonb_agg(jsonb_build_object('timeWindow', time_window,'respondents',respondents) ORDER BY respondents DESC) FROM (SELECT faixa_horario time_window,count(*)::int respondents FROM submissions WHERE tipo_usuario IN ('PASSAGEIRO','AMBOS') GROUP BY faixa_horario) x), '[]'::jsonb),
    'supplyDemandByRoute', coalesce((SELECT jsonb_agg(jsonb_build_object('origin',origin,'destination',destination,'timeWindow',time_window,'requests',requests,'offers',offers,'requestGap',requests-offers,'offerGap',offers-requests) ORDER BY abs(requests-offers) DESC) FROM supply_demand), '[]'::jsonb),
    'currentSpendBySegment', coalesce((SELECT jsonb_agg(jsonb_build_object('profile',profile,'costRange',cost_range,'respondents',respondents) ORDER BY respondents DESC) FROM (SELECT tipo_usuario profile,custo_atual_faixa cost_range,count(*)::int respondents FROM submissions GROUP BY tipo_usuario,custo_atual_faixa) x), '[]'::jsonb),
    'transportInterest', coalesce((SELECT jsonb_agg(jsonb_build_object('transport',transport,'respondents',respondents,'averageIntent',avg_intent) ORDER BY avg_intent DESC NULLS LAST) FROM (SELECT transporte_atual transport,count(DISTINCT submission_id)::int respondents,round(avg(interest_score),2) avg_intent FROM interest GROUP BY transporte_atual) x), '[]'::jsonb),
    'conversionToCompletedRide', coalesce((SELECT jsonb_agg(jsonb_build_object('profile',profile,'usersWithIntent',users_with_intent,'usersWithCompletedRide',users_with_completed,'conversionRate',conversion_rate) ORDER BY conversion_rate DESC) FROM (SELECT profile,count(*)::int users_with_intent,count(*) FILTER (WHERE completed)::int users_with_completed,coalesce(round(100.0*count(*) FILTER (WHERE completed)/nullif(count(*),0),2),0) conversion_rate FROM segments GROUP BY profile) x), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_retention_metrics(timestamptz,timestamptz,text,text,public.form_tipo_usuario) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retention_metrics(timestamptz,timestamptz,text,text,public.form_tipo_usuario) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_strategic_crossings(timestamptz,timestamptz,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_strategic_crossings(timestamptz,timestamptz,text,text) TO authenticated, service_role;
