-- 0130 | Optional hour/minute for the research response window and the CARONAA launch date.
-- Additive: new timestamptz columns complement the existing local calendar dates
-- (America/Fortaleza). Legacy rows keep day-level semantics through backfill.

ALTER TABLE public.research_forms
  ADD COLUMN IF NOT EXISTS survey_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS survey_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS caronaa_presence_at timestamptz;

-- Backfill: start of the first day, end of the last day (inclusive), launch at midnight.
UPDATE public.research_forms
   SET survey_starts_at = survey_starts_on::timestamp AT TIME ZONE 'America/Fortaleza'
 WHERE survey_starts_on IS NOT NULL AND survey_starts_at IS NULL;

UPDATE public.research_forms
   SET survey_ends_at = ((survey_ends_on + 1)::timestamp AT TIME ZONE 'America/Fortaleza') - interval '1 second'
 WHERE survey_ends_on IS NOT NULL AND survey_ends_at IS NULL;

UPDATE public.research_forms
   SET caronaa_presence_at = caronaa_presence_on::timestamp AT TIME ZONE 'America/Fortaleza'
 WHERE caronaa_presence_on IS NOT NULL AND caronaa_presence_at IS NULL;

ALTER TABLE public.research_forms
  ADD CONSTRAINT research_survey_window_time_order
  CHECK (
    (survey_starts_at IS NULL AND survey_ends_at IS NULL)
    OR (survey_starts_at IS NOT NULL AND survey_ends_at IS NOT NULL
        AND survey_ends_at > survey_starts_at)
  );

COMMENT ON COLUMN public.research_forms.survey_starts_at IS
  'Instant when the research starts accepting responses; complements survey_starts_on.';
COMMENT ON COLUMN public.research_forms.survey_ends_at IS
  'Instant when the research stops accepting responses; complements survey_ends_on.';
COMMENT ON COLUMN public.research_forms.caronaa_presence_at IS
  'Optional predicted CARONAA availability instant; informational, not an access grant.';

-- Helper: launch instant from settings launchDate (+ optional launchTime HH:MM)
-- in the configured timezone, falling back to America/Fortaleza.
CREATE OR REPLACE FUNCTION public.research_launch_instant(p_settings jsonb)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $launch_instant$
DECLARE raw text; tz text; day date; moment time;
BEGIN
  raw := p_settings->>'launchDate';
  IF raw IS NULL OR raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN NULL;
  END IF;
  day := raw::date;
  IF p_settings->>'launchTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    moment := (p_settings->>'launchTime')::time;
  ELSE
    moment := '00:00'::time;
  END IF;
  tz := COALESCE(
    (SELECT name FROM pg_timezone_names WHERE name = p_settings->>'timezone' LIMIT 1),
    'America/Fortaleza'
  );
  RETURN (day + moment) AT TIME ZONE tz;
END $launch_instant$;
REVOKE ALL ON FUNCTION public.research_launch_instant(jsonb) FROM PUBLIC, anon, authenticated;

-- Legacy 6-arg creator now also maintains the instant columns derived from the dates.
CREATE OR REPLACE FUNCTION public.create_scheduled_research_form(
  p_metadata jsonb, p_schema jsonb, p_settings jsonb,
  p_starts_on date, p_ends_on date, p_caronaa_on date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $scheduled$
DECLARE result_id uuid;
BEGIN
  IF p_starts_on IS NULL OR p_ends_on IS NULL
     OR p_ends_on < p_starts_on
  THEN
    RAISE EXCEPTION 'Informe datas de início e encerramento válidas para a pesquisa'
      USING ERRCODE='22023';
  END IF;
  IF p_settings IS NULL THEN
    result_id := public.create_research_form_draft(
      p_metadata->>'title', p_metadata->>'code', p_metadata->>'nature',
      p_metadata->>'audience', p_metadata->>'municipality', p_schema);
  ELSE
    result_id := public.create_configured_research_form(
      p_metadata, p_schema, p_settings);
  END IF;
  UPDATE public.research_forms
     SET survey_starts_on = p_starts_on,
         survey_ends_on = p_ends_on,
         caronaa_presence_on = p_caronaa_on,
         survey_starts_at = p_starts_on::timestamp AT TIME ZONE 'America/Fortaleza',
         survey_ends_at = ((p_ends_on + 1)::timestamp AT TIME ZONE 'America/Fortaleza') - interval '1 second',
         caronaa_presence_at = CASE WHEN p_caronaa_on IS NULL THEN NULL
           ELSE p_caronaa_on::timestamp AT TIME ZONE 'America/Fortaleza' END
   WHERE id = result_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'A pesquisa não foi criada'; END IF;
  RETURN result_id;
END $scheduled$;
REVOKE ALL ON FUNCTION public.create_scheduled_research_form(jsonb,jsonb,jsonb,date,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_scheduled_research_form(jsonb,jsonb,jsonb,date,date,date) TO authenticated;

-- New overload accepting explicit instants (hour/minute) for window and launch.
CREATE OR REPLACE FUNCTION public.create_scheduled_research_form(
  p_metadata jsonb, p_schema jsonb, p_settings jsonb,
  p_starts_on date, p_ends_on date, p_caronaa_on date,
  p_starts_at timestamptz, p_ends_at timestamptz, p_caronaa_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $scheduled_time$
DECLARE result_id uuid;
BEGIN
  IF p_starts_on IS NULL OR p_ends_on IS NULL
     OR p_ends_on < p_starts_on
  THEN
    RAISE EXCEPTION 'Informe datas de início e encerramento válidas para a pesquisa'
      USING ERRCODE='22023';
  END IF;
  IF (p_starts_at IS NULL) <> (p_ends_at IS NULL)
     OR (p_starts_at IS NOT NULL AND p_ends_at <= p_starts_at)
  THEN
    RAISE EXCEPTION 'Informe horários de início e encerramento válidos para a pesquisa'
      USING ERRCODE='22023';
  END IF;
  IF p_settings IS NULL THEN
    result_id := public.create_research_form_draft(
      p_metadata->>'title', p_metadata->>'code', p_metadata->>'nature',
      p_metadata->>'audience', p_metadata->>'municipality', p_schema);
  ELSE
    result_id := public.create_configured_research_form(
      p_metadata, p_schema, p_settings);
  END IF;
  UPDATE public.research_forms
     SET survey_starts_on = p_starts_on,
         survey_ends_on = p_ends_on,
         caronaa_presence_on = p_caronaa_on,
         survey_starts_at = COALESCE(p_starts_at,
           p_starts_on::timestamp AT TIME ZONE 'America/Fortaleza'),
         survey_ends_at = COALESCE(p_ends_at,
           ((p_ends_on + 1)::timestamp AT TIME ZONE 'America/Fortaleza') - interval '1 second'),
         caronaa_presence_at = CASE
           WHEN p_caronaa_at IS NOT NULL THEN p_caronaa_at
           WHEN p_caronaa_on IS NOT NULL THEN p_caronaa_on::timestamp AT TIME ZONE 'America/Fortaleza'
           ELSE NULL END
   WHERE id = result_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'A pesquisa não foi criada'; END IF;
  RETURN result_id;
END $scheduled_time$;
REVOKE ALL ON FUNCTION public.create_scheduled_research_form(jsonb,jsonb,jsonb,date,date,date,timestamptz,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_scheduled_research_form(jsonb,jsonb,jsonb,date,date,date,timestamptz,timestamptz,timestamptz) TO authenticated;

-- Answer window enforcement prefers exact instants when present.
CREATE OR REPLACE FUNCTION public.enforce_research_answer_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $window$
DECLARE started date; finished date;
  opens_at timestamptz; closes_at timestamptz;
  local_today date := (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
  SELECT f.survey_starts_on, f.survey_ends_on, f.survey_starts_at, f.survey_ends_at
    INTO started, finished, opens_at, closes_at
  FROM public.research_forms f WHERE f.id = NEW.form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesquisa não encontrada' USING ERRCODE='23503';
  END IF;
  IF opens_at IS NOT NULL AND clock_timestamp() < opens_at THEN
    RAISE EXCEPTION 'Esta pesquisa ainda não começou. Consulte a data de abertura.'
      USING ERRCODE='22023';
  END IF;
  IF opens_at IS NULL AND started IS NOT NULL AND local_today < started THEN
    RAISE EXCEPTION 'Esta pesquisa ainda não começou. Consulte a data de abertura.'
      USING ERRCODE='22023';
  END IF;
  IF closes_at IS NOT NULL AND clock_timestamp() > closes_at THEN
    RAISE EXCEPTION 'O período de respostas desta pesquisa foi encerrado.'
      USING ERRCODE='22023';
  END IF;
  IF closes_at IS NULL AND finished IS NOT NULL AND local_today > finished THEN
    RAISE EXCEPTION 'O período de respostas desta pesquisa foi encerrado.'
      USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $window$;
REVOKE ALL ON FUNCTION public.enforce_research_answer_window() FROM PUBLIC, anon, authenticated;

-- Public window state now exposes the exact instants and evaluates them when present.
CREATE OR REPLACE FUNCTION public.get_research_window_state(p_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $window_state$
  SELECT jsonb_build_object(
    'startsOn', f.survey_starts_on,
    'endsOn', f.survey_ends_on,
    'caronaaPresenceOn', f.caronaa_presence_on,
    'startsAt', to_char(f.survey_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'endsAt', to_char(f.survey_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'state', CASE
      WHEN f.survey_starts_at IS NOT NULL AND clock_timestamp() < f.survey_starts_at
        THEN 'AGENDADO'
      WHEN f.survey_starts_at IS NULL AND f.survey_starts_on IS NOT NULL AND
        (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date < f.survey_starts_on
        THEN 'AGENDADO'
      WHEN f.survey_ends_at IS NOT NULL AND clock_timestamp() > f.survey_ends_at
        THEN 'ENCERRADO'
      WHEN f.survey_ends_at IS NULL AND f.survey_ends_on IS NOT NULL AND
        (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date > f.survey_ends_on
        THEN 'ENCERRADO'
      ELSE 'ABERTO' END
  ) FROM public.research_forms f
  WHERE f.code = upper(btrim(p_code))
    AND f.status = 'PUBLICADO' AND f.is_enabled AND f.trashed_at IS NULL
  LIMIT 1;
$window_state$;
REVOKE ALL ON FUNCTION public.get_research_window_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_research_window_state(text) TO anon, authenticated;

-- Launch lock respects the optional hour/minute stored in settings.launchTime.
CREATE OR REPLACE FUNCTION public.is_research_launch_locked(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $locked$
BEGIN
  IF p_user IS NULL THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user AND r.role = 'admin') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.research_configurations c
    JOIN public.research_forms f ON f.id = c.form_id
    LEFT JOIN public.research_launch_releases release ON release.form_id = f.id
    WHERE public.research_launch_instant(c.settings) IS NOT NULL
      AND now() < public.research_launch_instant(c.settings)
      AND release.released_at IS NULL
      AND public.research_launch_wait_eligible(f.id, p_user)
  );
END $locked$;

-- Launch waiting state uses the exact launch instant (date + optional time).
CREATE OR REPLACE FUNCTION public.get_my_research_launch_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $launch_state$
DECLARE
  u uuid := auth.uid(); candidate record; launch_time timestamptz;
  j jsonb; role text; prev jsonb; s public.form_submissions%ROWTYPE;
  campaigns jsonb := '[]'::jsonb; item jsonb; is_locked boolean;
BEGIN
  IF u IS NULL THEN RETURN jsonb_build_object('locked', false, 'launches', '[]'::jsonb); END IF;
  is_locked := public.is_research_launch_locked(u);

  FOR candidate IN
    SELECT f.id AS form_id, f.code, f.title, f.nature, c.settings,
           (c.settings->>'launchDate')::date AS launch_day,
           public.research_launch_instant(c.settings) AS launch_instant
    FROM public.research_configurations c
    JOIN public.research_forms f ON f.id = c.form_id
    LEFT JOIN public.research_launch_releases release ON release.form_id = f.id
    WHERE public.research_launch_instant(c.settings) IS NOT NULL
      AND now() < public.research_launch_instant(c.settings)
      AND release.released_at IS NULL
      AND public.research_launch_participant(f.id, u)
    ORDER BY launch_day ASC, f.id
  LOOP
    launch_time := candidate.launch_instant;
    prev := NULL;
    j := NULL;
    SELECT rj.journey INTO j
    FROM public.research_participation_badges b
    JOIN public.research_journeys rj ON rj.answer_id = b.answer_id
    WHERE b.user_id = u AND b.form_id = candidate.form_id
    ORDER BY b.verified_at DESC LIMIT 1;

    IF j IS NOT NULL THEN
      role := j->>'profile';
      IF role IN ('PASSAGEIRO','MOTORISTA','AMBOS') THEN
        prev := jsonb_build_object(
          'kind', CASE role WHEN 'PASSAGEIRO' THEN 'PEDIDO' WHEN 'MOTORISTA' THEN 'OFERTA' ELSE 'AMBOS' END,
          'origin', nullif(j->>'originArea',''),
          'destination', nullif(j->>'destinationArea',''),
          'departureTime', nullif(j->>'outboundTime',''),
          'scheduledDate', candidate.launch_day, 'status', 'VISUALIZACAO'
        );
      END IF;
    ELSE
      SELECT fs.* INTO s
      FROM public.form_submissions fs
      JOIN public.form_submission_account_links link ON link.submission_id = fs.submission_id
      WHERE fs.user_id = u AND fs.research_form_id = candidate.form_id
        AND link.user_id = u AND link.confirmed_at IS NOT NULL
      ORDER BY fs.created_at DESC LIMIT 1;
      IF FOUND THEN
        role := s.tipo_usuario::text;
        IF role IN ('PASSAGEIRO','MOTORISTA','AMBOS') THEN
          prev := jsonb_build_object(
            'kind', CASE role WHEN 'PASSAGEIRO' THEN 'PEDIDO' WHEN 'MOTORISTA' THEN 'OFERTA' ELSE 'AMBOS' END,
            'origin', nullif(s.origem_trajeto,''), 'destination', nullif(s.destino_trajeto,''),
            'departureTime', nullif(s.faixa_horario,''), 'scheduledDate', candidate.launch_day, 'status', 'VISUALIZACAO'
          );
        END IF;
      END IF;
    END IF;

    item := jsonb_build_object(
      'formId', candidate.form_id,
      'formCode', candidate.code,
      'title', candidate.title,
      'institution', coalesce(nullif(candidate.settings->>'publicName',''), nullif(candidate.settings->>'institutionName',''), candidate.title),
      'nature', candidate.nature,
      'launchAt', to_char(launch_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'preview', coalesce(prev, 'null'::jsonb)
    );
    campaigns := campaigns || jsonb_build_array(item);
  END LOOP;

  IF jsonb_array_length(campaigns) = 0 THEN
    RETURN jsonb_build_object('locked', is_locked, 'launches', '[]'::jsonb);
  END IF;

  item := campaigns->0;
  RETURN jsonb_build_object(
    'locked', is_locked,
    'formId', item->'formId', 'formCode', item->'formCode',
    'title', item->'title',
    'institution', item->'institution', 'nature', item->'nature',
    'launchAt', item->'launchAt', 'preview', item->'preview',
    'launches', campaigns
  );
END $launch_state$;

NOTIFY pgrst, 'reload schema';