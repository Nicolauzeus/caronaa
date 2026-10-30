-- CARONAA progressive onboarding: additive, no research or launch mutations.
CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS','BASIC_COMPLETED')),
  current_step text NOT NULL DEFAULT 'REGION'
    CHECK (current_step IN ('REGION','AFFILIATION','ROLE','REVIEW','DONE')),
  region_code text CHECK (region_code IN ('FORTALEZA','MACICO_BATURITE','OTHER')),
  affiliation_type text CHECK (affiliation_type IN ('ESTUDANTE','PROFESSOR','COLABORADOR','COMUNIDADE')),
  institution_code text CHECK (institution_code IN ('UNIFOR','UNILAB')),
  usage_role text CHECK (usage_role IN ('PASSAGEIRO','MOTORISTA','AMBOS')),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_institution_region_check CHECK (
    institution_code IS NULL OR
    (institution_code = 'UNIFOR' AND region_code = 'FORTALEZA') OR
    (institution_code = 'UNILAB' AND region_code = 'MACICO_BATURITE')
  ),
  CONSTRAINT onboarding_completed_requires_fields CHECK (
    status <> 'BASIC_COMPLETED' OR
    (region_code IS NOT NULL AND affiliation_type IS NOT NULL AND usage_role IS NOT NULL
     AND (affiliation_type = 'COMUNIDADE' OR region_code = 'OTHER' OR institution_code IS NOT NULL)
     AND current_step = 'DONE' AND completed_at IS NOT NULL)
  )
);
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_onboarding_progress FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_onboarding_progress TO authenticated;
GRANT ALL ON public.user_onboarding_progress TO service_role;
CREATE POLICY "onboarding_select_own" ON public.user_onboarding_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "onboarding_insert_own" ON public.user_onboarding_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "onboarding_update_own" ON public.user_onboarding_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- This table does not confer roles, campaign release or university verification.
