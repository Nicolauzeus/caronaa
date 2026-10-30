-- Append-only onboarding metrics scoped to account; no marketing consent implied.
CREATE TABLE IF NOT EXISTS public.user_onboarding_events (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN ('STEP','COMPLETED')),
  step text NOT NULL CHECK(step IN ('REGION','AFFILIATION','ROLE','DONE')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,event_type,step)
);
ALTER TABLE public.user_onboarding_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_onboarding_events FROM PUBLIC,anon;
GRANT INSERT, SELECT ON public.user_onboarding_events TO authenticated;
GRANT ALL ON public.user_onboarding_events TO service_role;
CREATE POLICY onboarding_events_select_own ON public.user_onboarding_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY onboarding_events_insert_own ON public.user_onboarding_events FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY onboarding_events_update_own ON public.user_onboarding_events FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT UPDATE ON public.user_onboarding_events TO authenticated;
