-- Additive schema only. Do not apply before production backup.
CREATE TABLE IF NOT EXISTS public.research_forms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE,
 title text NOT NULL,
 nature text NOT NULL CHECK (nature IN ('EVENTO','EDUCACAO','EMPRESA','MOBILIDADE_LOCAL','OUTRA')),
 audience text NOT NULL DEFAULT 'GERAL',
 mobility_mode text NOT NULL DEFAULT 'COMPARTILHADA',
 status text NOT NULL DEFAULT 'RASCUNHO',
 municipality text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.research_form_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 form_id uuid NOT NULL REFERENCES public.research_forms(id),
 version_number integer NOT NULL,
 schema_json jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
 published_at timestamptz,
 UNIQUE(form_id,version_number)
);
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS research_form_id uuid REFERENCES public.research_forms(id);
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS research_version_id uuid REFERENCES public.research_form_versions(id);
CREATE INDEX IF NOT EXISTS form_submissions_research_id_idx ON public.form_submissions(research_form_id);
ALTER TABLE public.research_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_form_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_forms_admin_select ON public.research_forms FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY research_forms_admin_insert ON public.research_forms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY research_forms_admin_update ON public.research_forms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY research_versions_admin_select ON public.research_form_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY research_versions_admin_insert ON public.research_form_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT SELECT,INSERT,UPDATE ON public.research_forms TO authenticated;
GRANT SELECT,INSERT ON public.research_form_versions TO authenticated;
