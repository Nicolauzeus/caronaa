CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.form_tipo_usuario AS ENUM ('PASSAGEIRO', 'MOTORISTA', 'AMBOS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.form_custo_referencia AS ENUM ('TRECHO', 'DIA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.form_intencao AS ENUM (
    'HOJE',
    'PROVAVELMENTE',
    'TALVEZ',
    'PROVAVELMENTE_NAO',
    'NAO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.form_dor_codigo AS ENUM (
    'DOR_01',
    'DOR_02',
    'DOR_03',
    'DOR_04',
    'DOR_05',
    'DOR_06'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.form_submissions (
  submission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_session_id text,
  source text NOT NULL,
  campaign_event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  tipo_usuario public.form_tipo_usuario NOT NULL,
  ocupacao text,
  origem_trajeto text,
  destino_trajeto text NOT NULL,
  faixa_horario text,
  frequencia_semanal text,

  transporte_atual text,
  custo_atual_faixa text,
  custo_referencia public.form_custo_referencia,

  intencao_passageiro public.form_intencao,
  intencao_motorista public.form_intencao,

  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  consentimento boolean NOT NULL DEFAULT true,

  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT form_submissions_identity_check
    CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL),
  CONSTRAINT form_submissions_whatsapp_check
    CHECK (char_length(regexp_replace(whatsapp, '\D', '', 'g')) >= 10),
  CONSTRAINT form_submissions_email_check
    CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
  CONSTRAINT form_submissions_passenger_interest_check
    CHECK (tipo_usuario NOT IN ('PASSAGEIRO', 'AMBOS') OR intencao_passageiro IS NOT NULL),
  CONSTRAINT form_submissions_driver_interest_check
    CHECK (tipo_usuario NOT IN ('MOTORISTA', 'AMBOS') OR intencao_motorista IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.form_submission_pain_points (
  submission_id uuid NOT NULL REFERENCES public.form_submissions(submission_id) ON DELETE CASCADE,
  codigo_dor public.form_dor_codigo NOT NULL,
  selecionada boolean NOT NULL DEFAULT true,
  principal boolean NOT NULL DEFAULT false,
  intensidade integer,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (submission_id, codigo_dor),
  CONSTRAINT form_submission_pain_points_intensidade_check
    CHECK (intensidade IS NULL OR intensidade BETWEEN 1 AND 5),
  CONSTRAINT form_submission_pain_points_principal_selected_check
    CHECK (principal = false OR selecionada = true)
);

CREATE UNIQUE INDEX IF NOT EXISTS form_submission_one_main_pain_idx
ON public.form_submission_pain_points (submission_id)
WHERE principal;

CREATE INDEX IF NOT EXISTS form_submissions_created_at_idx
ON public.form_submissions (created_at);

CREATE INDEX IF NOT EXISTS form_submissions_tipo_usuario_idx
ON public.form_submissions (tipo_usuario);

CREATE INDEX IF NOT EXISTS form_submissions_source_idx
ON public.form_submissions (source);

CREATE INDEX IF NOT EXISTS form_submissions_campaign_event_idx
ON public.form_submissions (campaign_event);

CREATE INDEX IF NOT EXISTS form_submission_pain_points_codigo_dor_idx
ON public.form_submission_pain_points (codigo_dor);

CREATE INDEX IF NOT EXISTS form_submission_pain_points_principal_idx
ON public.form_submission_pain_points (principal);

GRANT INSERT ON public.form_submissions TO anon, authenticated;
GRANT SELECT ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;

GRANT INSERT ON public.form_submission_pain_points TO anon, authenticated;
GRANT SELECT ON public.form_submission_pain_points TO authenticated;
GRANT ALL ON public.form_submission_pain_points TO service_role;

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submission_pain_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit form responses" ON public.form_submissions;
CREATE POLICY "Anyone can submit form responses"
ON public.form_submissions FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read form responses" ON public.form_submissions;
CREATE POLICY "Admins can read form responses"
ON public.form_submissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can submit form response pain points" ON public.form_submission_pain_points;
CREATE POLICY "Anyone can submit form response pain points"
ON public.form_submission_pain_points FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read form response pain points" ON public.form_submission_pain_points;
CREATE POLICY "Admins can read form response pain points"
ON public.form_submission_pain_points FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
