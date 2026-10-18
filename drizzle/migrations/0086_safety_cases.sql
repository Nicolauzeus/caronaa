CREATE TABLE IF NOT EXISTS public.safety_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 kind text NOT NULL CHECK(kind IN ('SUPORTE','RECLAMACAO','DENUNCIA','INCIDENTE','VERIFICACAO')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 180),
 description text NOT NULL DEFAULT '',
 priority text NOT NULL DEFAULT 'MEDIA' CHECK(priority IN ('BAIXA','MEDIA','ALTA','CRITICA')),
 status text NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_TRIAGEM','EM_ANALISE','AGUARDANDO','RESOLVIDO','ENCERRADO')),
 reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 due_at timestamptz,
 resolved_at timestamptz,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.safety_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES public.safety_cases(id),
 actor_id uuid,
 previous_status text,
 new_status text NOT NULL,
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_cases_status_idx ON public.safety_cases(status,priority,created_at DESC);
CREATE INDEX IF NOT EXISTS safety_cases_assignee_idx ON public.safety_cases(assigned_to,status);
ALTER TABLE public.safety_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_case_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS safety_cases_admin_read ON public.safety_cases;
CREATE POLICY safety_cases_admin_read ON public.safety_cases FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS safety_cases_admin_create ON public.safety_cases;
CREATE POLICY safety_cases_admin_create ON public.safety_cases FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin') AND created_by=auth.uid());
DROP POLICY IF EXISTS safety_cases_admin_update ON public.safety_cases;
CREATE POLICY safety_cases_admin_update ON public.safety_cases FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS safety_case_events_admin_read ON public.safety_case_events;
CREATE POLICY safety_case_events_admin_read ON public.safety_case_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.safety_case_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.safety_case_events(case_id,actor_id,new_status) VALUES(NEW.id,auth.uid(),NEW.status);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.safety_case_events(case_id,actor_id,previous_status,new_status) VALUES(NEW.id,auth.uid(),OLD.status,NEW.status);
 END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.safety_case_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at=now(); IF NEW.status IN ('RESOLVIDO','ENCERRADO') AND OLD.status NOT IN ('RESOLVIDO','ENCERRADO') THEN NEW.resolved_at=now(); ELSIF NEW.status NOT IN ('RESOLVIDO','ENCERRADO') THEN NEW.resolved_at=NULL; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS safety_cases_touch ON public.safety_cases;
CREATE TRIGGER safety_cases_touch BEFORE UPDATE ON public.safety_cases FOR EACH ROW EXECUTE FUNCTION public.safety_case_touch();
DROP TRIGGER IF EXISTS safety_cases_audit ON public.safety_cases;
CREATE TRIGGER safety_cases_audit AFTER INSERT OR UPDATE ON public.safety_cases FOR EACH ROW EXECUTE FUNCTION public.safety_case_audit();
GRANT SELECT,INSERT,UPDATE ON public.safety_cases TO authenticated;
GRANT SELECT ON public.safety_case_events TO authenticated;
NOTIFY pgrst,'reload schema';