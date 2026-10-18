-- Executive governance foundation. Additive, no changes to historical STS.
CREATE TABLE IF NOT EXISTS public.executive_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('OKR','DECISION','RISK')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 180),
 description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANDAMENTO','CONCLUIDO','SUSPENSO')),
 priority text NOT NULL DEFAULT 'MEDIA' CHECK(priority IN ('BAIXA','MEDIA','ALTA','CRITICA')),
 owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 target_value numeric,
 actual_value numeric,
 unit text,
 due_date date,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(kind <> 'OKR' OR (target_value IS NULL OR target_value > 0))
);
CREATE INDEX IF NOT EXISTS executive_records_kind_status_idx ON public.executive_records(kind,status);
CREATE INDEX IF NOT EXISTS executive_records_due_idx ON public.executive_records(due_date);
CREATE TABLE IF NOT EXISTS public.executive_record_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 record_id uuid NOT NULL REFERENCES public.executive_records(id),
 actor_id uuid,
 action text NOT NULL CHECK(action IN ('CREATE','UPDATE','DELETE')),
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.executive_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_record_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS executive_records_admin_select ON public.executive_records;
CREATE POLICY executive_records_admin_select ON public.executive_records FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS executive_records_admin_insert ON public.executive_records;
CREATE POLICY executive_records_admin_insert ON public.executive_records FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin') AND created_by=auth.uid());
DROP POLICY IF EXISTS executive_records_admin_update ON public.executive_records;
CREATE POLICY executive_records_admin_update ON public.executive_records FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS executive_history_admin_select ON public.executive_record_history;
CREATE POLICY executive_history_admin_select ON public.executive_record_history FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.audit_executive_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.executive_record_history(record_id,actor_id,action,after_state)
  VALUES(NEW.id,auth.uid(),'CREATE',to_jsonb(NEW));
  RETURN NEW;
 ELSIF TG_OP='UPDATE' THEN
  NEW.updated_at=now();
  INSERT INTO public.executive_record_history(record_id,actor_id,action,before_state,after_state)
  VALUES(NEW.id,auth.uid(),'UPDATE',to_jsonb(OLD),to_jsonb(NEW));
  RETURN NEW;
 ELSE
  INSERT INTO public.executive_record_history(record_id,actor_id,action,before_state)
  VALUES(OLD.id,auth.uid(),'DELETE',to_jsonb(OLD));
  RETURN OLD;
 END IF;
END $$;
DROP TRIGGER IF EXISTS executive_record_audit_trigger ON public.executive_records;
CREATE TRIGGER executive_record_audit_trigger BEFORE INSERT OR UPDATE OR DELETE ON public.executive_records FOR EACH ROW EXECUTE FUNCTION public.audit_executive_record();
GRANT SELECT,INSERT,UPDATE ON public.executive_records TO authenticated;
GRANT SELECT ON public.executive_record_history TO authenticated;
NOTIFY pgrst,'reload schema';
