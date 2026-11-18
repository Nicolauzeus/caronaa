-- CARONAA: onboarding universal sem região/vínculo obrigatórios.
-- Aplicar em homologação e depois produção ANTES de habilitar o novo cadastro.
-- Não altera verificação de e-mail, autorização profissional, campanhas ou RLS.
BEGIN;
ALTER TABLE public.user_onboarding_progress
  ADD COLUMN IF NOT EXISTS tutorial_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tutorial_seen_at timestamptz;

-- Dados regionais e acadêmicos históricos permanecem intactos.
ALTER TABLE public.user_onboarding_progress
  DROP CONSTRAINT IF EXISTS onboarding_completed_requires_fields;
ALTER TABLE public.user_onboarding_progress
  ADD CONSTRAINT onboarding_completed_requires_fields CHECK (
    status <> 'BASIC_COMPLETED'
    OR (usage_role IN ('PASSAGEIRO','MOTORISTA','AMBOS')
      AND current_step = 'DONE' AND completed_at IS NOT NULL)
  );

-- Contas antigas concluidas mantêm tutorial_eligible=false, sem replay.
-- tutorial_seen_at é preferência visual do proprietário; não constitui autorização.
COMMENT ON COLUMN public.user_onboarding_progress.tutorial_eligible
  IS 'Apenas novas conclusões do onboarding recebem tutorial de primeiro acesso.';
COMMENT ON COLUMN public.user_onboarding_progress.tutorial_seen_at
  IS 'Marca o tutorial como visto/pulado; campo cosmético, sem efeito nos grants.';
COMMIT;
