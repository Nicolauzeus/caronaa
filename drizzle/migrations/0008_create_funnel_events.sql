DO $$
BEGIN
  CREATE TYPE public.funnel_event_name AS ENUM (
    'landing_view',
    'form_started',
    'form_step_completed',
    'form_completed',
    'lead_created'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.funnel_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name public.funnel_event_name NOT NULL,
  anonymous_session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL,
  campaign text,
  campaign_event text NOT NULL,
  form_step text,
  submission_id uuid REFERENCES public.form_submissions(submission_id) ON DELETE SET NULL,
  device_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT funnel_events_identity_check
    CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL),
  CONSTRAINT funnel_events_device_category_check
    CHECK (device_category IS NULL OR device_category IN ('mobile', 'tablet', 'desktop'))
);

CREATE INDEX IF NOT EXISTS funnel_events_created_at_idx
ON public.funnel_events (created_at);

CREATE INDEX IF NOT EXISTS funnel_events_event_name_idx
ON public.funnel_events (event_name);

CREATE INDEX IF NOT EXISTS funnel_events_source_idx
ON public.funnel_events (source);

CREATE INDEX IF NOT EXISTS funnel_events_campaign_idx
ON public.funnel_events (campaign);

CREATE INDEX IF NOT EXISTS funnel_events_campaign_event_idx
ON public.funnel_events (campaign_event);

CREATE INDEX IF NOT EXISTS funnel_events_anonymous_session_idx
ON public.funnel_events (anonymous_session_id);

CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_unique_session_landing_idx
ON public.funnel_events (anonymous_session_id, source, campaign, campaign_event, event_name)
WHERE event_name = 'landing_view' AND anonymous_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_unique_user_landing_idx
ON public.funnel_events (user_id, source, campaign, campaign_event, event_name)
WHERE event_name = 'landing_view' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_unique_form_started_session_idx
ON public.funnel_events (anonymous_session_id, source, campaign, campaign_event, event_name)
WHERE event_name = 'form_started' AND anonymous_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_unique_form_started_user_idx
ON public.funnel_events (user_id, source, campaign, campaign_event, event_name)
WHERE event_name = 'form_started' AND user_id IS NOT NULL;

GRANT INSERT ON public.funnel_events TO anon, authenticated;
GRANT SELECT ON public.funnel_events TO authenticated;
GRANT ALL ON public.funnel_events TO service_role;

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can register funnel events" ON public.funnel_events;
CREATE POLICY "Anyone can register funnel events"
ON public.funnel_events FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read funnel events" ON public.funnel_events;
CREATE POLICY "Admins can read funnel events"
ON public.funnel_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
