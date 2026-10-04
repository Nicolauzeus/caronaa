-- Privacy-preserving funnel events: no contact data, URL, IP address, or user agent is stored.
CREATE TABLE IF NOT EXISTS public.form_funnel_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK (event_name IN ('landing_view', 'form_started', 'form_step_completed', 'form_completed', 'lead_created')),
  event_step text,
  anonymous_session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL,
  campaign text,
  campaign_event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS form_funnel_events_filters_idx
ON public.form_funnel_events (created_at, source, campaign, campaign_event, event_name);

GRANT INSERT ON public.form_funnel_events TO anon, authenticated;
GRANT SELECT ON public.form_funnel_events TO authenticated;
GRANT ALL ON public.form_funnel_events TO service_role;
ALTER TABLE public.form_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register privacy-safe funnel events"
ON public.form_funnel_events FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Admins can read funnel events"
ON public.form_funnel_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS campaign text;

CREATE OR REPLACE FUNCTION public.get_form_funnel_metrics(
  p_period_start timestamptz DEFAULT NULL, p_period_end timestamptz DEFAULT NULL,
  p_source text DEFAULT NULL, p_campaign text DEFAULT NULL, p_event text DEFAULT NULL,
  p_tipo_usuario public.form_tipo_usuario DEFAULT NULL, p_ocupacao text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH authorized AS (SELECT public.has_role(auth.uid(), 'admin') AS is_admin),
  filtered_events AS (
    SELECT DISTINCT ON (fe.event_name, fe.anonymous_session_id, COALESCE(fe.event_step, '')) fe.*
    FROM public.form_funnel_events fe CROSS JOIN authorized
    WHERE authorized.is_admin AND (p_period_start IS NULL OR fe.created_at >= p_period_start)
      AND (p_period_end IS NULL OR fe.created_at < p_period_end) AND (p_source IS NULL OR fe.source = p_source)
      AND (p_campaign IS NULL OR fe.campaign = p_campaign) AND (p_event IS NULL OR fe.campaign_event = p_event)
    ORDER BY fe.event_name, fe.anonymous_session_id, COALESCE(fe.event_step, ''), fe.created_at
  ),
  totals AS (
    SELECT count(*) FILTER (WHERE event_name = 'landing_view') AS reached,
      count(*) FILTER (WHERE event_name = 'form_started') AS started,
      count(*) FILTER (WHERE event_name = 'form_completed') AS completed,
      count(*) FILTER (WHERE event_name = 'lead_created') AS leads FROM filtered_events
  )
  SELECT jsonb_build_object(
    'filters', jsonb_build_object('periodStart', p_period_start, 'periodEnd', p_period_end, 'source', p_source, 'campaign', p_campaign, 'event', p_event, 'tipoUsuario', p_tipo_usuario, 'ocupacao', p_ocupacao),
    'totals', (SELECT jsonb_build_object('reached', reached, 'started', started, 'completed', completed, 'leads', leads,
      'startRate', CASE WHEN reached = 0 THEN 0 ELSE round(started::numeric / reached * 100, 2) END,
      'completionRate', CASE WHEN started = 0 THEN 0 ELSE round(completed::numeric / started * 100, 2) END,
      'leadRate', CASE WHEN completed = 0 THEN 0 ELSE round(leads::numeric / completed * 100, 2) END
    ) FROM totals);
$$;

REVOKE ALL ON FUNCTION public.get_form_funnel_metrics(timestamptz, timestamptz, text, text, text, public.form_tipo_usuario, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_form_funnel_metrics(timestamptz, timestamptz, text, text, text, public.form_tipo_usuario, text) TO authenticated, service_role;
