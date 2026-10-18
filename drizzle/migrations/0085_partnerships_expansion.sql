CREATE TABLE IF NOT EXISTS public.partner_organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 180),
 kind text NOT NULL CHECK(kind IN ('UNIVERSIDADE','PREFEITURA','EMPRESA','ASSOCIACAO','COOPERATIVA','OUTRO')),
 municipality text NOT NULL,
 contact_name text,
 contact_email text,
 status text NOT NULL DEFAULT 'PROSPECCAO' CHECK(status IN ('PROSPECCAO','CONTATO','NEGOCIACAO','ATIVA','SUSPENSA','ENCERRADA')),
 notes text NOT NULL DEFAULT '',
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.partner_pilots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 partner_id uuid NOT NULL REFERENCES public.partner_organizations(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 180),
 objective text NOT NULL DEFAULT '',
 municipality text NOT NULL,
 status text NOT NULL DEFAULT 'PLANEJAMENTO' CHECK(status IN ('PLANEJAMENTO','VALIDACAO','ATIVO','PAUSADO','CONCLUIDO','CANCELADO')),
 start_date date,
 end_date date,
 research_form_id uuid REFERENCES public.research_forms(id) ON DELETE SET NULL,
 success_criteria text NOT NULL DEFAULT '',
 outcomes text NOT NULL DEFAULT '',
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS partner_org_status_idx ON public.partner_organizations(status,municipality);
CREATE INDEX IF NOT EXISTS partner_pilots_org_idx ON public.partner_pilots(partner_id,status);
ALTER TABLE public.partner_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_pilots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_org_admin ON public.partner_organizations;
CREATE POLICY partner_org_admin ON public.partner_organizations FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS partner_pilots_admin ON public.partner_pilots;
CREATE POLICY partner_pilots_admin ON public.partner_pilots FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
GRANT SELECT,INSERT,UPDATE ON public.partner_organizations,public.partner_pilots TO authenticated;
NOTIFY pgrst,'reload schema';