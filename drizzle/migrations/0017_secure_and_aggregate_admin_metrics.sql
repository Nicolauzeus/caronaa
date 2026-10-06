-- product_events is a business-event log, not a browser telemetry endpoint.
-- Browser page/form telemetry remains in funnel_events with its privacy-safe RLS policy.
-- Contact and other column-backed values are stripped server-side before raw persistence.
-- Replace legacy raw_payload campaign filters with the structured campaign column.
CREATE OR REPLACE FUNCTION public.get_validation_export(
  p_kind text,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_event text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_kind = 'raw_analytics' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]') INTO result FROM (
      SELECT created_at, source, campaign_event, tipo_usuario, ocupacao, origem_trajeto, destino_trajeto,
        faixa_horario, frequencia_semanal, transporte_atual, custo_atual_faixa, custo_referencia,
        intencao_passageiro, intencao_motorista,
        coalesce((SELECT string_agg(f.codigo_dor::text || ' (intensidade ' || coalesce(f.intensidade::text, 'N/D') || CASE WHEN f.principal THEN ', principal)' ELSE ')' END, '; ' ORDER BY f.codigo_dor)
          FROM public.form_submission_pain_points f WHERE f.submission_id = s.submission_id AND f.selecionada), '') AS dores
      FROM public.form_submissions s
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR campaign = p_campaign)
        AND (p_event IS NULL OR campaign_event = p_event) AND (p_tipo_usuario IS NULL OR tipo_usuario = p_tipo_usuario)
    ) x;
  ELSIF p_kind = 'leads' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]') INTO result FROM (
      SELECT submission_id, created_at, nome, whatsapp, email, tipo_usuario, origem_trajeto, destino_trajeto, faixa_horario
      FROM public.form_submissions
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR campaign = p_campaign)
        AND (p_event IS NULL OR campaign_event = p_event) AND (p_tipo_usuario IS NULL OR tipo_usuario = p_tipo_usuario)
    ) x;
  ELSIF p_kind = 'pain_ranking' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.selected_count DESC), '[]') INTO result FROM (
      SELECT f.codigo_dor, count(*)::int selected_count, round(avg(f.intensidade), 2) average_intensity,
        count(*) FILTER (WHERE f.principal)::int principal_count
      FROM public.form_submission_pain_points f JOIN public.form_submissions s ON s.submission_id = f.submission_id
      WHERE f.selecionada AND (p_period_start IS NULL OR s.created_at >= p_period_start) AND (p_period_end IS NULL OR s.created_at < p_period_end)
        AND (p_source IS NULL OR s.source = p_source) AND (p_campaign IS NULL OR s.campaign = p_campaign)
        AND (p_event IS NULL OR s.campaign_event = p_event) AND (p_tipo_usuario IS NULL OR s.tipo_usuario = p_tipo_usuario)
      GROUP BY f.codigo_dor
    ) x;
  ELSIF p_kind = 'intent' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.respondents DESC), '[]') INTO result FROM (
      SELECT intent::text AS category, count(*)::int respondents
      FROM public.form_submissions s CROSS JOIN LATERAL (VALUES (s.intencao_passageiro), (s.intencao_motorista)) AS i(intent)
      WHERE i.intent IS NOT NULL AND (p_period_start IS NULL OR s.created_at >= p_period_start) AND (p_period_end IS NULL OR s.created_at < p_period_end)
        AND (p_source IS NULL OR s.source = p_source) AND (p_campaign IS NULL OR s.campaign = p_campaign)
        AND (p_event IS NULL OR s.campaign_event = p_event) AND (p_tipo_usuario IS NULL OR s.tipo_usuario = p_tipo_usuario)
      GROUP BY intent
    ) x;
  ELSIF p_kind IN ('profile', 'transport', 'costs') THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.respondents DESC), '[]') INTO result FROM (
      SELECT CASE p_kind WHEN 'profile' THEN tipo_usuario::text WHEN 'transport' THEN coalesce(transporte_atual, 'NÃO INFORMADO') ELSE coalesce(custo_atual_faixa, 'NÃO INFORMADO') END AS category,
        count(*)::int respondents
      FROM public.form_submissions
      WHERE (p_period_start IS NULL OR created_at >= p_period_start) AND (p_period_end IS NULL OR created_at < p_period_end)
        AND (p_source IS NULL OR source = p_source) AND (p_campaign IS NULL OR campaign = p_campaign)
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
  ELSE
    RAISE EXCEPTION 'Unsupported export kind';
  END IF;
  RETURN coalesce(result, '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_validation_export(text,timestamptz,timestamptz,text,text,text,public.form_tipo_usuario) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_validation_export(text,timestamptz,timestamptz,text,text,text,public.form_tipo_usuario) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.submit_form_response(
  p_submission jsonb, p_pain_points jsonb, p_anonymous_session_id text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_submission_id uuid; v_user_id uuid := auth.uid(); v_existing public.form_submissions%ROWTYPE; v_raw_payload jsonb;
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
  v_submission_id := coalesce((p_submission ->> 'submissionId')::uuid, (p_submission ->> 'submission_id')::uuid);
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
          OR point ->> 'selecionada' NOT IN ('true','false') OR point ->> 'principal' NOT IN ('true','false'))
     OR (SELECT count(DISTINCT point ->> 'codigo_dor') FROM jsonb_array_elements(p_pain_points) point) <> 6 THEN
    RAISE EXCEPTION 'Invalid pain points payload' USING ERRCODE = '22023';
  END IF;
  v_raw_payload := p_submission - ARRAY[
    'name','whatsapp','email','destinationNeighborhood','originNeighborhood','destinationReference',
    'intent','occupation','weeklyFrequency','departureWindow','currentTransport','routeCostRange',
    'costPeriod','source','campaign','campaignEvent','submissionId','createdAt'
  ];
  INSERT INTO public.form_submissions (
    submission_id, user_id, anonymous_session_id, source, campaign, campaign_event, tipo_usuario,
    ocupacao, origem_trajeto, destino_trajeto, faixa_horario, frequencia_semanal, transporte_atual,
    custo_atual_faixa, custo_referencia, intencao_passageiro, intencao_motorista, nome, whatsapp,
    email, consentimento, raw_payload
  ) VALUES (
    v_submission_id, v_user_id, CASE WHEN v_user_id IS NULL THEN p_anonymous_session_id ELSE NULL END,
    coalesce(p_submission ->> 'source', p_submission ->> 'source'), coalesce(p_submission ->> 'campaign', p_submission ->> 'campaign'), coalesce(p_submission ->> 'campaignEvent', p_submission ->> 'campaign_event'),
    coalesce(p_submission ->> 'intent', p_submission ->> 'tipo_usuario')::public.form_tipo_usuario, coalesce(p_submission ->> 'occupation', p_submission ->> 'ocupacao'),
    coalesce(p_submission ->> 'originNeighborhood', p_submission ->> 'origem_trajeto'), coalesce(p_submission ->> 'destinationNeighborhood', p_submission ->> 'destino_trajeto'), coalesce(p_submission ->> 'departureWindow', p_submission ->> 'departure_window'),
    coalesce(p_submission ->> 'weeklyFrequency', p_submission ->> 'weekly_frequency'), coalesce(p_submission ->> 'currentTransport', p_submission ->> 'transporte_atual'), coalesce(p_submission ->> 'routeCostRange', p_submission ->> 'custo_atual_faixa'),
    coalesce(p_submission ->> 'costPeriod', p_submission ->> 'cost_period')::public.form_custo_referencia,
    coalesce(p_submission ->> 'passengerInterest', p_submission ->> 'passenger_interest')::public.form_intencao,
    coalesce(p_submission ->> 'driverInterest', p_submission ->> 'driver_interest')::public.form_intencao,
    coalesce(p_submission ->> 'name', p_submission ->> 'nome'), p_submission ->> 'whatsapp', p_submission ->> 'email', true, v_raw_payload
  );
  INSERT INTO public.form_submission_pain_points (submission_id, codigo_dor, selecionada, principal, intensidade)
  SELECT v_submission_id, (point ->> 'codigo_dor')::public.form_dor_codigo,
    (point ->> 'selecionada')::boolean, (point ->> 'principal')::boolean,
    CASE WHEN (point ->> 'principal')::boolean THEN (point ->> 'intensidade')::integer ELSE NULL END
  FROM jsonb_array_elements(p_pain_points) point;
  RETURN v_submission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_form_response(jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_form_response(jsonb,jsonb,text) TO anon, authenticated, service_role;

-- The profile-created registration event is the authenticated acquisition identity.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assigned_role public.app_role;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('caronaa:first-admin'));
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
          coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'))
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    avatar_url = coalesce(public.profiles.avatar_url, EXCLUDED.avatar_url), updated_at = now();
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN assigned_role := 'user'; ELSE assigned_role := 'admin'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.product_events (event_name, user_id, status, source, trusted_source)
  VALUES ('USER_REGISTERED', NEW.id, 'registered', 'direct', true) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.product_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.product_events TO authenticated;

DROP POLICY IF EXISTS "Users register their own product events" ON public.product_events;
DROP POLICY IF EXISTS "Users register their own non-match product events" ON public.product_events;
DROP POLICY IF EXISTS "Users register their own non-operational product events" ON public.product_events;
DROP POLICY IF EXISTS "Admins read product events" ON public.product_events;
CREATE POLICY "Admins read product events" ON public.product_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Funnel page/start/step events are client telemetry; submission outcomes are server facts.
ALTER TABLE public.funnel_events ADD COLUMN trusted_source boolean NOT NULL DEFAULT false;
REVOKE UPDATE, DELETE ON public.funnel_events FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Anyone can register funnel events" ON public.funnel_events;
CREATE POLICY "Clients register telemetry funnel events" ON public.funnel_events
  FOR INSERT TO anon, authenticated WITH CHECK (
    event_name IN ('landing_view', 'form_started', 'form_step_completed')
    AND NOT trusted_source
    AND (user_id IS NULL OR auth.uid() = user_id)
  );

UPDATE public.funnel_events fe SET trusted_source = true,
  source = fs.source, campaign = fs.campaign,
  metadata = fe.metadata || jsonb_build_object('profile', fs.tipo_usuario)
FROM public.form_submissions fs
WHERE fe.event_name IN ('form_completed', 'lead_created')
  AND fe.submission_id = fs.submission_id
  AND fe.user_id IS NOT DISTINCT FROM fs.user_id
  AND fe.anonymous_session_id IS NOT DISTINCT FROM fs.anonymous_session_id;

WITH duplicates AS (
  SELECT event_id, row_number() OVER (PARTITION BY submission_id, event_name ORDER BY created_at, event_id) AS duplicate_number
  FROM public.funnel_events
  WHERE trusted_source AND submission_id IS NOT NULL AND event_name IN ('form_completed', 'lead_created')
)
DELETE FROM public.funnel_events fe USING duplicates d
WHERE fe.event_id = d.event_id AND d.duplicate_number > 1;

CREATE UNIQUE INDEX funnel_events_trusted_submission_outcome_once_idx
  ON public.funnel_events (submission_id, event_name)
  WHERE trusted_source AND submission_id IS NOT NULL AND event_name IN ('form_completed', 'lead_created');

CREATE OR REPLACE FUNCTION public.track_form_submission_funnel_outcomes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE outcome_metadata jsonb;
BEGIN
  outcome_metadata := jsonb_build_object(
    'profile', NEW.tipo_usuario,
    'leadType', NEW.raw_payload ->> 'leadType',
    'activationStatus', NEW.raw_payload ->> 'activationStatus'
  );
  INSERT INTO public.funnel_events (
    event_name, anonymous_session_id, user_id, source, campaign, campaign_event,
    submission_id, metadata, created_at, trusted_source
  ) VALUES (
    'form_completed', NEW.anonymous_session_id, NEW.user_id, NEW.source, NEW.campaign,
    NEW.campaign_event, NEW.submission_id, outcome_metadata, NEW.created_at, true
  ) ON CONFLICT DO NOTHING;
  INSERT INTO public.funnel_events (
    event_name, anonymous_session_id, user_id, source, campaign, campaign_event,
    submission_id, metadata, created_at, trusted_source
  ) VALUES (
    'lead_created', NEW.anonymous_session_id, NEW.user_id, NEW.source, NEW.campaign,
    NEW.campaign_event, NEW.submission_id, outcome_metadata, NEW.created_at, true
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER form_submission_track_funnel_outcomes
  AFTER INSERT ON public.form_submissions FOR EACH ROW
  EXECUTE FUNCTION public.track_form_submission_funnel_outcomes();
REVOKE ALL ON FUNCTION public.track_form_submission_funnel_outcomes() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS funnel_events_admin_aggregation_idx
  ON public.funnel_events (created_at, source, campaign, campaign_event, event_name);
CREATE INDEX IF NOT EXISTS product_events_admin_aggregation_idx
  ON public.product_events (event_name, created_at, source, campaign)
  WHERE trusted_source;
CREATE INDEX IF NOT EXISTS product_events_admin_profile_idx
  ON public.product_events ((metadata ->> 'profile'), created_at)
  WHERE trusted_source;

-- Registration is already a profile-created database event; mark historic rows
-- that can be verified against profiles and keep future rows trusted.
UPDATE public.product_events pe SET trusted_source = true
FROM public.profiles p
WHERE pe.event_name = 'USER_REGISTERED' AND pe.user_id = p.id;

CREATE OR REPLACE FUNCTION public.track_registered_user_product_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.product_events (event_name, user_id, status, source, trusted_source)
  VALUES ('USER_REGISTERED', NEW.id, 'registered', 'direct', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill profile metadata for verified match events so the admin filter can
-- operate on the same event population without downloading event rows.
UPDATE public.product_events pe
SET metadata = pe.metadata || jsonb_build_object('profile', 'PASSAGEIRO')
FROM public.ride_matches rm
WHERE pe.event_name = 'MATCH_CREATED' AND pe.trusted_source
  AND pe.match_id = rm.match_id::text AND pe.user_id = rm.passenger_user_id;

UPDATE public.product_events pe
SET metadata = pe.metadata || jsonb_build_object(
  'profile', CASE pe.metadata ->> 'domainEvent'
    WHEN 'RIDE_REQUEST_CREATED' THEN 'PASSAGEIRO'
    WHEN 'RIDE_OFFER_CREATED' THEN 'MOTORISTA'
  END
)
WHERE pe.event_name = 'RIDE_REPEATED' AND pe.trusted_source
  AND pe.metadata ->> 'domainEvent' IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED');

CREATE OR REPLACE FUNCTION public.track_ride_creation_product_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  event_kind public.product_event_name;
  prior_count integer;
  domain_ride_id text;
  domain_request_id uuid;
  domain_offer_id uuid;
  profile_name text;
  event_metadata jsonb;
BEGIN
  IF TG_TABLE_NAME = 'ride_requests' THEN
    event_kind := 'RIDE_REQUEST_CREATED'; profile_name := 'PASSAGEIRO';
    domain_request_id := NEW.request_id; domain_ride_id := NEW.request_id::text;
    SELECT count(*) INTO prior_count FROM public.ride_requests WHERE user_id = NEW.user_id;
    event_metadata := jsonb_build_object('requestId', NEW.request_id, 'origin', NEW.origin,
      'destination', NEW.destination, 'timeWindow', NEW.departure_time, 'profile', profile_name,
      'passengerCount', NEW.passenger_count);
  ELSE
    event_kind := 'RIDE_OFFER_CREATED'; profile_name := 'MOTORISTA';
    domain_offer_id := NEW.offer_id; domain_ride_id := NEW.offer_id::text;
    SELECT count(*) INTO prior_count FROM public.ride_offers WHERE user_id = NEW.user_id;
    event_metadata := jsonb_build_object('offerId', NEW.offer_id, 'origin', NEW.origin,
      'destination', NEW.destination, 'timeWindow', NEW.departure_time, 'profile', profile_name,
      'availableSeats', NEW.available_seats);
  END IF;

  INSERT INTO public.product_events (
    event_name, user_id, ride_id, status, source, metadata, created_at,
    request_id, offer_id, trusted_source
  ) VALUES (
    event_kind, NEW.user_id, domain_ride_id, NEW.status, 'direct', event_metadata,
    NEW.created_at, domain_request_id, domain_offer_id, true
  );
  IF prior_count > 1 THEN
    INSERT INTO public.product_events (event_name, user_id, ride_id, status, source, metadata, created_at, trusted_source)
    VALUES ('RIDE_REPEATED', NEW.user_id, domain_ride_id, NEW.status, 'direct',
      jsonb_build_object('domainEvent', event_kind, 'profile', profile_name), NEW.created_at, true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_persisted_match_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE passenger_count integer; created_ride_id uuid;
BEGIN
  SELECT rr.passenger_count INTO passenger_count FROM public.ride_requests rr WHERE rr.request_id = NEW.request_id;
  INSERT INTO public.rides (match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at)
  VALUES (NEW.match_id, NEW.request_id, NEW.offer_id, NEW.passenger_user_id, NEW.driver_user_id, 'MATCHED', NEW.created_at)
  ON CONFLICT (match_id) DO UPDATE SET match_id = EXCLUDED.match_id
  RETURNING ride_id INTO created_ride_id;
  UPDATE public.ride_matches SET ride_id = created_ride_id::text WHERE match_id = NEW.match_id;
  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, created_at)
  VALUES (created_ride_id, NULL, 'MATCHED', NEW.created_at) ON CONFLICT DO NOTHING;
  INSERT INTO public.product_events (
    event_name, user_id, ride_id, match_id, status, source, created_at,
    request_id, offer_id, passenger_user_id, driver_user_id, metadata, trusted_source
  ) VALUES (
    'MATCH_CREATED', NEW.passenger_user_id, created_ride_id::text, NEW.match_id::text,
    NEW.status, 'direct', NEW.created_at, NEW.request_id, NEW.offer_id,
    NEW.passenger_user_id, NEW.driver_user_id,
    jsonb_build_object('requestId', NEW.request_id, 'offerId', NEW.offer_id,
      'passengerUserId', NEW.passenger_user_id, 'driverUserId', NEW.driver_user_id,
      'rideId', created_ride_id, 'seatsOccupied', passenger_count, 'profile', 'PASSAGEIRO'), true
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_ride_status_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE event_source text; event_campaign text;
BEGIN
  SELECT pe.source, pe.campaign INTO event_source, event_campaign
  FROM public.product_events pe
  WHERE pe.event_name = 'MATCH_CREATED' AND pe.match_id = NEW.match_id::text
  ORDER BY pe.created_at LIMIT 1;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'COMPLETED' THEN
    INSERT INTO public.product_events (
      event_name, user_id, ride_id, match_id, status, source, campaign, created_at, request_id,
      offer_id, passenger_user_id, driver_user_id, trusted_source, metadata
    ) VALUES (
      'RIDE_COMPLETED', NEW.passenger_user_id, NEW.ride_id::text, NEW.match_id::text,
      NEW.status, coalesce(event_source, 'domain'), event_campaign, NEW.completed_at, NEW.request_id, NEW.offer_id,
      NEW.passenger_user_id, NEW.driver_user_id, true,
      jsonb_build_object('rideId', NEW.ride_id, 'matchId', NEW.match_id, 'profile', 'PASSAGEIRO')
    ) ON CONFLICT DO NOTHING;
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'IN_PROGRESS' THEN
    INSERT INTO public.product_events (
      event_name, user_id, ride_id, match_id, status, source, campaign, created_at, request_id,
      offer_id, passenger_user_id, driver_user_id, trusted_source, metadata
    ) VALUES (
      'RIDE_STARTED', NEW.driver_user_id, NEW.ride_id::text, NEW.match_id::text,
      NEW.status, coalesce(event_source, 'domain'), event_campaign, now(), NEW.request_id, NEW.offer_id,
      NEW.passenger_user_id, NEW.driver_user_id, true,
      jsonb_build_object('rideId', NEW.ride_id, 'matchId', NEW.match_id, 'profile', 'MOTORISTA')
    ) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_acquisition_funnel_metrics(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_event text DEFAULT NULL,
  p_profile text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reached bigint; v_started bigint; v_completed bigint; v_leads bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  SELECT
    count(DISTINCT CASE WHEN fe.event_name = 'landing_view' THEN
      CASE WHEN fe.user_id IS NOT NULL THEN 'user:' || fe.user_id::text
           WHEN fe.anonymous_session_id IS NOT NULL THEN 'session:' || fe.anonymous_session_id
           ELSE 'event:' || fe.event_id::text END END),
    count(DISTINCT CASE WHEN fe.event_name = 'form_started' THEN
      CASE WHEN fe.user_id IS NOT NULL THEN 'user:' || fe.user_id::text
           WHEN fe.anonymous_session_id IS NOT NULL THEN 'session:' || fe.anonymous_session_id
           ELSE 'event:' || fe.event_id::text END END),
    count(DISTINCT CASE WHEN fe.event_name = 'form_completed' THEN
      CASE WHEN fe.user_id IS NOT NULL THEN 'user:' || fe.user_id::text
           WHEN fe.anonymous_session_id IS NOT NULL THEN 'session:' || fe.anonymous_session_id
           ELSE 'event:' || fe.event_id::text END END),
    count(DISTINCT CASE WHEN fe.event_name = 'lead_created' THEN
      CASE WHEN fe.user_id IS NOT NULL THEN 'user:' || fe.user_id::text
           WHEN fe.anonymous_session_id IS NOT NULL THEN 'session:' || fe.anonymous_session_id
           ELSE 'event:' || fe.event_id::text END END)
  INTO v_reached, v_started, v_completed, v_leads
  FROM public.funnel_events fe
  WHERE fe.event_name IN ('landing_view', 'form_started', 'form_completed', 'lead_created')
    AND (p_period_start IS NULL OR fe.created_at >= p_period_start)
    AND (p_period_end IS NULL OR fe.created_at < p_period_end)
    AND (p_source IS NULL OR fe.source = p_source)
    AND (p_campaign IS NULL OR (fe.campaign = p_campaign OR (fe.campaign IS NULL AND p_campaign = 'direct')))
    AND (p_event IS NULL OR fe.campaign_event = p_event)
    AND (p_profile IS NULL OR fe.metadata ->> 'profile' = p_profile)
    AND (fe.event_name NOT IN ('form_completed', 'lead_created') OR fe.trusted_source);
  RETURN jsonb_build_object(
    'reached', v_reached, 'started', v_started, 'completed', v_completed, 'leads', v_leads,
    'rates', jsonb_build_object(
      'reachedToStarted', coalesce(round(100.0 * v_started / nullif(v_reached, 0), 2), 0),
      'startedToCompleted', coalesce(round(100.0 * v_completed / nullif(v_started, 0), 2), 0),
      'completedToLead', coalesce(round(100.0 * v_leads / nullif(v_completed, 0), 2), 0)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_main_funnel_metrics(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_event text DEFAULT NULL,
  p_profile text DEFAULT NULL,
  p_cohort_event text DEFAULT 'landing_view'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reached bigint; v_registered bigint; v_ride_created bigint; v_matched bigint;
  v_completed bigint; v_repeated bigint; v_stages jsonb; v_largest_drop jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF p_cohort_event NOT IN ('landing_view', 'user_registered') THEN
    RAISE EXCEPTION 'Unsupported cohort entry event' USING ERRCODE = '22023';
  END IF;

  WITH cohort AS (
    SELECT 'user:' || pe.user_id::text AS cohort_key, pe.user_id
    FROM public.product_events pe
    WHERE p_cohort_event = 'user_registered' AND pe.event_name = 'USER_REGISTERED' AND pe.trusted_source
      AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
      AND (p_period_end IS NULL OR pe.created_at < p_period_end)
      AND (p_source IS NULL OR pe.source = p_source)
      AND (p_campaign IS NULL OR (pe.campaign = p_campaign OR (pe.campaign IS NULL AND p_campaign = 'direct')))
      AND (p_profile IS NULL OR pe.metadata ->> 'profile' = p_profile)
    UNION
    SELECT DISTINCT coalesce('user:' || s.user_id::text, 'user:' || fe.user_id::text, 'session:' || fe.anonymous_session_id) AS cohort_key,
      coalesce(s.user_id, fe.user_id) AS user_id
    FROM public.funnel_events fe LEFT JOIN public.form_submissions s ON s.submission_id = fe.submission_id
    WHERE p_cohort_event = 'landing_view' AND fe.event_name = 'landing_view'
      AND (p_period_start IS NULL OR fe.created_at >= p_period_start)
      AND (p_period_end IS NULL OR fe.created_at < p_period_end)
      AND (p_source IS NULL OR fe.source = p_source)
      AND (p_campaign IS NULL OR (fe.campaign = p_campaign OR (fe.campaign IS NULL AND p_campaign = 'direct')))
      AND (p_event IS NULL OR fe.campaign_event = p_event)
      AND (p_profile IS NULL OR fe.metadata ->> 'profile' = p_profile)
  ), totals AS (
  SELECT
    count(DISTINCT cohort.cohort_key),
    count(DISTINCT pe.user_id) FILTER (WHERE pe.event_name = 'USER_REGISTERED'),
    count(DISTINCT pe.user_id) FILTER (WHERE pe.event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED')),
    count(DISTINCT pe.user_id) FILTER (WHERE pe.event_name = 'MATCH_CREATED'),
    count(DISTINCT pe.user_id) FILTER (WHERE pe.event_name = 'RIDE_COMPLETED' AND pe.ride_id IS NOT NULL),
    count(DISTINCT pe.user_id) FILTER (WHERE pe.event_name = 'RIDE_REPEATED')
    INTO v_reached, v_registered, v_ride_created, v_matched, v_completed, v_repeated
  FROM cohort LEFT JOIN public.product_events pe ON pe.user_id = cohort.user_id AND pe.trusted_source
    AND pe.event_name IN ('USER_REGISTERED', 'RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED', 'MATCH_CREATED', 'RIDE_COMPLETED', 'RIDE_REPEATED')
    AND (p_profile IS NULL OR pe.metadata ->> 'profile' = p_profile)
  ) SELECT v_reached, v_registered, v_ride_created, v_matched, v_completed, v_repeated FROM totals;

  WITH stage_rows AS (
    SELECT * FROM (VALUES
      (1, 'coorte adquirida', 'Coorte adquirida', v_reached, 100::numeric, 100::numeric, NULL::text),
      (2, 'cadastros', 'Cadastros', v_registered, coalesce(round(100.0 * v_registered / nullif(v_reached, 0), 2), 0), coalesce(round(100.0 * v_registered / nullif(v_reached, 0), 2), 0), NULL::text),
      (3, 'ofertas/solicitaÃ§Ãµes', 'Ofertas/SolicitaÃ§Ãµes', v_ride_created, coalesce(round(100.0 * v_ride_created / nullif(v_registered, 0), 2), 0), coalesce(round(100.0 * v_ride_created / nullif(v_reached, 0), 2), 0), NULL::text),
      (4, 'matches', 'Matches', v_matched, coalesce(round(100.0 * v_matched / nullif(v_ride_created, 0), 2), 0), coalesce(round(100.0 * v_matched / nullif(v_reached, 0), 2), 0), NULL::text),
      (5, 'caronas realizadas', 'Caronas realizadas', v_completed, coalesce(round(100.0 * v_completed / nullif(v_matched, 0), 2), 0), coalesce(round(100.0 * v_completed / nullif(v_reached, 0), 2), 0), NULL::text),
      (6, 'pagamentos', 'Pagamentos', NULL::bigint, NULL::numeric, NULL::numeric, 'IndisponÃ­vel: gateway de pagamento ainda nÃ£o integrado.'::text),
      (7, 'nova carona', 'Nova carona', v_repeated, NULL::numeric, coalesce(round(100.0 * v_repeated / nullif(v_reached, 0), 2), 0), NULL::text)
    ) AS stages(position, key, label, count, from_previous, from_start, unavailable_reason)
  ), serialized AS (
    SELECT position, jsonb_build_object(
      'key', key, 'label', label, 'count', count, 'fromPrevious', from_previous,
      'fromStart', from_start, 'unavailableReason', unavailable_reason
    ) AS stage, from_previous
    FROM stage_rows
  )
  SELECT jsonb_agg(stage ORDER BY position),
    (SELECT stage FROM serialized WHERE position > 1 AND from_previous IS NOT NULL ORDER BY from_previous, position LIMIT 1)
  INTO v_stages, v_largest_drop FROM serialized;

  RETURN jsonb_build_object('stages', coalesce(v_stages, '[]'::jsonb), 'largestDrop', v_largest_drop);
END;
$$;

-- Replace the historical six-argument overload so callers cannot accidentally keep using
-- the old independent-population funnel after this migration.
DROP FUNCTION IF EXISTS public.get_main_funnel_metrics(timestamptz,timestamptz,text,text,text,text);

CREATE OR REPLACE FUNCTION public.get_operational_metrics(
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL,
  p_profile text DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_destination text DEFAULT NULL,
  p_time_window text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  RETURN (
    WITH request_events AS (
      SELECT DISTINCT ON (rr.request_id) rr.request_id, rr.passenger_count, pe.created_at
      FROM public.product_events pe JOIN public.ride_requests rr
        ON rr.request_id = pe.request_id
      WHERE pe.event_name = 'RIDE_REQUEST_CREATED' AND pe.trusted_source
        AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
        AND (p_period_end IS NULL OR pe.created_at < p_period_end)
        AND (p_source IS NULL OR pe.source = p_source)
        AND (p_campaign IS NULL OR pe.campaign = p_campaign)
        AND (p_profile IS NULL OR pe.metadata ->> 'profile' = p_profile)
        AND (p_origin IS NULL OR lower(btrim(pe.metadata ->> 'origin')) = lower(btrim(p_origin)))
        AND (p_destination IS NULL OR lower(btrim(pe.metadata ->> 'destination')) = lower(btrim(p_destination)))
        AND (p_time_window IS NULL OR left(pe.metadata ->> 'timeWindow', 5) = left(p_time_window, 5))
      ORDER BY rr.request_id, pe.created_at
    ), offer_events AS (
      SELECT DISTINCT ON (ro.offer_id) ro.offer_id, ro.available_seats, pe.created_at
      FROM public.product_events pe JOIN public.ride_offers ro
        ON ro.offer_id = pe.offer_id
      WHERE pe.event_name = 'RIDE_OFFER_CREATED' AND pe.trusted_source
        AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
        AND (p_period_end IS NULL OR pe.created_at < p_period_end)
        AND (p_source IS NULL OR pe.source = p_source)
        AND (p_campaign IS NULL OR pe.campaign = p_campaign)
        AND (p_profile IS NULL OR pe.metadata ->> 'profile' = p_profile)
        AND (p_origin IS NULL OR lower(btrim(pe.metadata ->> 'origin')) = lower(btrim(p_origin)))
        AND (p_destination IS NULL OR lower(btrim(pe.metadata ->> 'destination')) = lower(btrim(p_destination)))
        AND (p_time_window IS NULL OR left(pe.metadata ->> 'timeWindow', 5) = left(p_time_window, 5))
      ORDER BY ro.offer_id, pe.created_at
    ), matches AS (
      SELECT DISTINCT ON (rm.match_id) rm.match_id, rm.request_id, rm.offer_id,
        rm.status AS match_status, pe.created_at, rr.passenger_count,
        rr.created_at AS request_created_at
      FROM public.product_events pe JOIN public.ride_matches rm ON rm.match_id::text = pe.match_id
      JOIN public.ride_requests rr ON rr.request_id = rm.request_id
      JOIN public.ride_offers ro ON ro.offer_id = rm.offer_id
      WHERE pe.event_name = 'MATCH_CREATED' AND pe.trusted_source
        AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
        AND (p_period_end IS NULL OR pe.created_at < p_period_end)
        AND (p_source IS NULL OR pe.source = p_source)
        AND (p_campaign IS NULL OR pe.campaign = p_campaign)
        AND (p_profile IS NULL OR pe.metadata ->> 'profile' = p_profile)
        AND (p_origin IS NULL OR lower(btrim(rr.origin)) = lower(btrim(p_origin)))
        AND (p_destination IS NULL OR lower(btrim(rr.destination)) = lower(btrim(p_destination)))
        AND (p_time_window IS NULL OR left(rr.departure_time::text, 5) = left(p_time_window, 5))
      ORDER BY rm.match_id, pe.created_at
    ), completed AS (
      SELECT DISTINCT pe.ride_id
      FROM public.product_events pe JOIN public.rides r ON r.ride_id::text = pe.ride_id
      JOIN public.ride_requests rr ON rr.request_id = r.request_id
      WHERE pe.event_name = 'RIDE_COMPLETED' AND pe.trusted_source AND pe.ride_id IS NOT NULL
        AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
        AND (p_period_end IS NULL OR pe.created_at < p_period_end)
        AND (p_source IS NULL OR pe.source = p_source)
        AND (p_campaign IS NULL OR pe.campaign = p_campaign)
        AND (p_profile IS NULL OR pe.metadata ->> 'profile' = p_profile)
        AND (p_origin IS NULL OR lower(btrim(rr.origin)) = lower(btrim(p_origin)))
        AND (p_destination IS NULL OR lower(btrim(rr.destination)) = lower(btrim(p_destination)))
        AND (p_time_window IS NULL OR left(rr.departure_time::text, 5) = left(p_time_window, 5))
    ), totals AS (
      SELECT
        (SELECT count(*) FROM request_events) AS eligible_requests,
        (SELECT count(DISTINCT m.request_id) FROM matches m WHERE EXISTS (SELECT 1 FROM request_events q WHERE q.request_id = m.request_id)) AS matched_requests,
        (SELECT count(*) FROM offer_events) AS eligible_offers,
        (SELECT count(DISTINCT m.offer_id) FROM matches m WHERE EXISTS (SELECT 1 FROM offer_events o WHERE o.offer_id = m.offer_id)) AS utilized_offers,
        (SELECT sum(available_seats) FROM offer_events) AS available_seats,
        (SELECT coalesce(sum(m.passenger_count), 0) FROM matches m WHERE EXISTS (SELECT 1 FROM offer_events o WHERE o.offer_id = m.offer_id)) AS occupied_seats,
        (SELECT count(*) FROM matches) AS match_total,
        (SELECT avg(extract(epoch FROM (m.created_at - q.created_at)) / 60.0) FROM matches m JOIN request_events q ON q.request_id = m.request_id) AS average_minutes,
        (SELECT count(*) FROM matches WHERE match_status = 'cancelled') AS cancelled_matches,
        (SELECT count(*) FROM completed) AS completed_rides
    )
    SELECT jsonb_build_object(
      'request', jsonb_build_object('eligibleRequests', eligible_requests, 'matchedRequests', matched_requests,
        'unmatchedRequests', eligible_requests - matched_requests,
        'requestMatchRate', coalesce(round(100.0 * matched_requests / nullif(eligible_requests, 0), 2), 0)),
      'offer', jsonb_build_object('eligibleOffers', eligible_offers, 'utilizedOffers', utilized_offers,
        'unmatchedOffers', eligible_offers - utilized_offers,
        'offerMatchRate', coalesce(round(100.0 * utilized_offers / nullif(eligible_offers, 0), 2), 0)),
      'seats', jsonb_build_object('availableSeats', CASE WHEN eligible_offers = 0 THEN NULL ELSE available_seats END,
        'occupiedSeats', CASE WHEN eligible_offers = 0 THEN NULL ELSE occupied_seats END,
        'seatFillRate', CASE WHEN eligible_offers = 0 THEN NULL ELSE coalesce(round(100.0 * occupied_seats / nullif(available_seats, 0), 2), 0) END),
      'match', jsonb_build_object('total', match_total, 'averageMinutesToMatch', round(average_minutes::numeric, 2),
        'cancelled', cancelled_matches, 'completed', completed_rides)
    ) FROM totals
  );
END;
$$;

-- Recurrence is based on unique ride identity, not event count.
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
    SELECT participant.user_id, pe.ride_id AS completed_ride_id, min(pe.created_at) AS completed_at
    FROM public.product_events pe CROSS JOIN authorized a
    CROSS JOIN LATERAL (VALUES (pe.passenger_user_id), (pe.driver_user_id)) AS participant(user_id)
    WHERE a.is_admin AND pe.event_name = 'RIDE_COMPLETED' AND pe.trusted_source
      AND pe.ride_id IS NOT NULL AND participant.user_id IS NOT NULL
      AND (p_period_start IS NULL OR pe.created_at >= p_period_start)
      AND (p_period_end IS NULL OR pe.created_at < p_period_end)
      AND (p_source IS NULL OR pe.source = p_source)
      AND (p_campaign IS NULL OR pe.campaign = p_campaign)
    GROUP BY participant.user_id, pe.ride_id
  ), roles AS (
    SELECT pe.user_id, bool_or(pe.event_name = 'RIDE_REQUEST_CREATED') AS is_passenger,
      bool_or(pe.event_name = 'RIDE_OFFER_CREATED') AS is_driver
    FROM public.product_events pe WHERE pe.trusted_source
      AND pe.event_name IN ('RIDE_REQUEST_CREATED', 'RIDE_OFFER_CREATED') GROUP BY pe.user_id
  ), per_user AS (
    SELECT c.user_id, count(DISTINCT c.completed_ride_id)::int AS ride_count,
      min(c.completed_at) AS first_completed_at,
      CASE WHEN coalesce(r.is_passenger, false) AND coalesce(r.is_driver, false) THEN 'AMBOS'::public.form_tipo_usuario
           WHEN coalesce(r.is_driver, false) THEN 'MOTORISTA'::public.form_tipo_usuario
           ELSE 'PASSAGEIRO'::public.form_tipo_usuario END AS profile
    FROM completed c LEFT JOIN roles r ON r.user_id = c.user_id
    GROUP BY c.user_id, r.is_passenger, r.is_driver
  ), users AS (
    SELECT pu.user_id, pu.ride_count, pu.first_completed_at, pu.profile,
      (SELECT min(c.completed_at) FROM completed c WHERE c.user_id = pu.user_id
        AND c.completed_at > pu.first_completed_at) AS second_completed_at
    FROM per_user pu
  ), scoped AS (
    SELECT * FROM users WHERE p_tipo_usuario IS NULL OR profile = p_tipo_usuario
  ), profile_distribution AS (
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
    'distribution', jsonb_build_object('one', count(*) FILTER (WHERE ride_count = 1),
      'two', count(*) FILTER (WHERE ride_count = 2), 'threeToFive', count(*) FILTER (WHERE ride_count BETWEEN 3 AND 5),
      'sixOrMore', count(*) FILTER (WHERE ride_count >= 6)),
    'byProfile', coalesce((SELECT jsonb_object_agg(profile, jsonb_build_object('one', one,
      'two', two, 'threeOrMore', "threeOrMore")) FROM profile_distribution), '{}'::jsonb)
  ) FROM scoped;
$$;

REVOKE ALL ON FUNCTION public.get_acquisition_funnel_metrics(timestamptz,timestamptz,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_main_funnel_metrics(timestamptz,timestamptz,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operational_metrics(timestamptz,timestamptz,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_retention_metrics(timestamptz,timestamptz,text,text,public.form_tipo_usuario) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_acquisition_funnel_metrics(timestamptz,timestamptz,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_main_funnel_metrics(timestamptz,timestamptz,text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_operational_metrics(timestamptz,timestamptz,text,text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_retention_metrics(timestamptz,timestamptz,text,text,public.form_tipo_usuario) TO authenticated, service_role;
