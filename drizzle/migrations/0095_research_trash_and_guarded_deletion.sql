-- 0095: Reversible research trash and guarded, audited permanent deletion.
-- DEPLOY ONLY AFTER BACKUP, FIRST IN HOMOLOGATION. Does not delete existing data on migration.
-- A form with respondent badges, STS links, CRM leads, pilots or stored brand assets
-- cannot be hard-deleted. Its answers may be removed ONLY through a double-confirmed,
-- atomic administrator operation after moving the form to the trash.

ALTER TABLE public.research_forms
 ADD COLUMN IF NOT EXISTS trashed_at timestamptz,
 ADD COLUMN IF NOT EXISTS trashed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS trash_previous_status text;
CREATE INDEX IF NOT EXISTS research_forms_trashed_at_idx
 ON public.research_forms (trashed_at DESC) WHERE trashed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.research_form_lifecycle_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 form_id uuid NOT NULL,
 form_code text NOT NULL,
 action text NOT NULL CHECK (action IN ('TRASH','RESTORE','PERMANENT_DELETE')),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 answer_count bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_form_lifecycle_audit_form_idx
 ON public.research_form_lifecycle_audit (form_id,created_at DESC);
ALTER TABLE public.research_form_lifecycle_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_form_lifecycle_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.research_form_lifecycle_audit TO authenticated;
DROP POLICY IF EXISTS research_lifecycle_audit_admin_select ON public.research_form_lifecycle_audit;
CREATE POLICY research_lifecycle_audit_admin_select ON public.research_form_lifecycle_audit
 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Do not permit direct inserts to create tombstones without a lifecycle audit.
DROP POLICY IF EXISTS research_forms_admin_insert ON public.research_forms;
CREATE POLICY research_forms_admin_insert ON public.research_forms
 FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') AND trashed_at IS NULL
  AND trashed_by IS NULL AND trash_previous_status IS NULL
 );
DROP POLICY IF EXISTS research_versions_admin_insert ON public.research_form_versions;
CREATE POLICY research_versions_admin_insert ON public.research_form_versions
 FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  AND EXISTS (
    SELECT 1 FROM public.research_forms f
    WHERE f.id=form_id AND f.trashed_at IS NULL
  )
);

-- Direct client updates MUST NOT modify a trashed form or clear its tombstone.
-- SECURITY DEFINER lifecycle RPCs handle trash/restore explicitly and atomically.
DROP POLICY IF EXISTS research_forms_admin_update ON public.research_forms;
CREATE POLICY research_forms_admin_update ON public.research_forms
 FOR UPDATE TO authenticated
 USING (public.has_role(auth.uid(),'admin') AND trashed_at IS NULL)
 WITH CHECK (public.has_role(auth.uid(),'admin') AND trashed_at IS NULL);
DROP POLICY IF EXISTS research_versions_admin_draft_update ON public.research_form_versions;
CREATE POLICY research_versions_admin_draft_update ON public.research_form_versions
 FOR UPDATE TO authenticated
 USING (public.has_role(auth.uid(),'admin') AND published_at IS NULL AND
  EXISTS (SELECT 1 FROM public.research_forms f WHERE f.id=form_id AND f.trashed_at IS NULL))
 WITH CHECK (public.has_role(auth.uid(),'admin') AND published_at IS NULL AND
  EXISTS (SELECT 1 FROM public.research_forms f WHERE f.id=form_id AND f.trashed_at IS NULL));

-- Avoid alternative legacy hard-delete RPCs bypassing lifecycle audit or tombstones.
REVOKE EXECUTE ON FUNCTION public.delete_unanswered_research_form(uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_empty_research_draft(uuid)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_research_form_removal_eligibility(p_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 v_form public.research_forms%ROWTYPE;
 v_answers bigint; v_submissions bigint; v_leads bigint;
 v_pilots bigint; v_badges bigint; v_assets bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
   RAISE EXCEPTION 'Apenas administradores globais podem gerenciar a exclusão'
     USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_form FROM public.research_forms WHERE id=p_form_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 SELECT count(*) INTO v_answers FROM public.research_answers WHERE form_id=p_form_id;
 SELECT count(*) INTO v_submissions FROM public.form_submissions
 WHERE research_form_id=p_form_id OR research_version_id IN
    (SELECT id FROM public.research_form_versions WHERE form_id=p_form_id);
 SELECT count(*) INTO v_leads FROM public.crm_leads WHERE source_form_id=p_form_id;
 SELECT count(*) INTO v_pilots FROM public.partner_pilots WHERE research_form_id=p_form_id;
 SELECT count(*) INTO v_badges FROM public.research_participation_badges
 WHERE form_id=p_form_id;
 SELECT count(*) INTO v_assets FROM storage.objects
 WHERE bucket_id='research-branding' AND name LIKE p_form_id::text || '/%';
 RETURN jsonb_build_object(
   'code',v_form.code,'status',v_form.status,
   'answers',v_answers,'legacy_submissions',v_submissions,
   'crm_leads',v_leads,'partner_pilots',v_pilots,
   'participation_badges',v_badges,'brand_assets',v_assets,
   'in_trash',v_form.trashed_at IS NOT NULL,
   'can_trash',v_form.status<>'ENCERRADO' AND v_form.trashed_at IS NULL,
   'can_restore',v_form.trashed_at IS NOT NULL,
   'can_delete',v_form.status<>'ENCERRADO' AND v_form.trashed_at IS NOT NULL
     AND v_submissions=0 AND v_leads=0 AND v_pilots=0
     AND v_badges=0 AND v_assets=0
 );
END $$;
REVOKE ALL ON FUNCTION public.get_research_form_removal_eligibility(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_research_form_removal_eligibility(uuid)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.trash_research_form(p_form_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_form public.research_forms%ROWTYPE; v_count bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Acesso administrativo necessário' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_form FROM public.research_forms WHERE id=p_form_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 IF v_form.status='ENCERRADO' THEN
  RAISE EXCEPTION 'Pesquisa histórica encerrada está protegida' USING ERRCODE='42501';
 END IF;
 IF v_form.trashed_at IS NOT NULL THEN
  RAISE EXCEPTION 'Esta pesquisa já está na lixeira';
 END IF;
 SELECT count(*) INTO v_count FROM public.research_answers WHERE form_id=p_form_id;
 UPDATE public.research_forms SET status='ARQUIVADO',is_enabled=false,
   trashed_at=now(),trashed_by=auth.uid(),trash_previous_status=v_form.status
 WHERE id=p_form_id;
 INSERT INTO public.research_form_lifecycle_audit(form_id,form_code,action,actor_id,answer_count)
 VALUES(p_form_id,v_form.code,'TRASH',auth.uid(),v_count);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.restore_trashed_research_form(p_form_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_form public.research_forms%ROWTYPE; v_count bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Acesso administrativo necessário' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_form FROM public.research_forms WHERE id=p_form_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 IF v_form.trashed_at IS NULL THEN RAISE EXCEPTION 'A pesquisa não está na lixeira'; END IF;
 IF v_form.trash_previous_status NOT IN ('RASCUNHO','PUBLICADO','ARQUIVADO') THEN
   RAISE EXCEPTION 'O estado anterior é inválido: peça uma revisão antes de restaurar';
 END IF;
 SELECT count(*) INTO v_count FROM public.research_answers WHERE form_id=p_form_id;
 UPDATE public.research_forms
 SET status=v_form.trash_previous_status,is_enabled=false,
     trashed_at=NULL,trashed_by=NULL,trash_previous_status=NULL
 WHERE id=p_form_id;
 INSERT INTO public.research_form_lifecycle_audit(form_id,form_code,action,actor_id,answer_count)
 VALUES(p_form_id,v_form.code,'RESTORE',auth.uid(),v_count);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.permanently_delete_trashed_research_form(
 p_form_id uuid, p_confirm_code text, p_confirm_phrase text, p_expected_answers bigint
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_form public.research_forms%ROWTYPE; v_count bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Acesso administrativo necessário' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_form FROM public.research_forms WHERE id=p_form_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 IF v_form.status='ENCERRADO' OR v_form.trashed_at IS NULL THEN
  RAISE EXCEPTION 'Somente pesquisas na lixeira, exceto históricas protegidas, podem ser eliminadas';
 END IF;
 IF p_confirm_code IS DISTINCT FROM v_form.code
    OR p_confirm_phrase IS DISTINCT FROM 'EXCLUIR DEFINITIVAMENTE' THEN
  RAISE EXCEPTION 'Confirmação de exclusão inválida' USING ERRCODE='22023';
 END IF;
 SELECT count(*) INTO v_count FROM public.research_answers WHERE form_id=p_form_id;
 IF p_expected_answers IS NULL OR p_expected_answers <> v_count THEN
  RAISE EXCEPTION 'A quantidade de respostas mudou. Atualize a verificação antes de excluir.'
    USING ERRCODE='40001';
 END IF;
 IF EXISTS (SELECT 1 FROM public.form_submissions s
      WHERE s.research_form_id=p_form_id OR s.research_version_id IN
        (SELECT id FROM public.research_form_versions WHERE form_id=p_form_id))
    OR EXISTS (SELECT 1 FROM public.crm_leads WHERE source_form_id=p_form_id)
    OR EXISTS (SELECT 1 FROM public.partner_pilots WHERE research_form_id=p_form_id)
    OR EXISTS (SELECT 1 FROM public.research_participation_badges WHERE form_id=p_form_id)
    OR EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='research-branding'
      AND name LIKE p_form_id::text || '/%')
 THEN
  RAISE EXCEPTION 'Existem vínculos, selos ou imagens: exclusão definitiva bloqueada. Preserve os dados na lixeira.'
    USING ERRCODE='23503';
 END IF;
 -- All deletes are in a single transaction. Unexpected foreign keys reject and roll back.
 -- Badge links are never cascaded or silently removed.
 DELETE FROM public.research_answers WHERE form_id=p_form_id;
 DELETE FROM public.research_form_versions WHERE form_id=p_form_id;
 DELETE FROM public.research_forms WHERE id=p_form_id;
 INSERT INTO public.research_form_lifecycle_audit(form_id,form_code,action,actor_id,answer_count)
 VALUES(p_form_id,v_form.code,'PERMANENT_DELETE',auth.uid(),v_count);
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.trash_research_form(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.restore_trashed_research_form(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.permanently_delete_trashed_research_form(uuid,text,text,bigint)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trash_research_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_trashed_research_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_trashed_research_form(uuid,text,text,bigint)
 TO authenticated;

-- Prevent new public responses or re-publication of trashed forms,
-- including RPCs that would otherwise update the status directly.
CREATE OR REPLACE FUNCTION public.enforce_research_trash_boundary()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
 IF OLD.trashed_at IS NOT NULL AND NEW.trashed_at IS NOT NULL
   AND (NEW.status <> 'ARQUIVADO' OR NEW.is_enabled) THEN
  RAISE EXCEPTION 'Pesquisa na lixeira não pode ser publicada nem habilitada';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_research_trash_boundary_trigger ON public.research_forms;
CREATE TRIGGER enforce_research_trash_boundary_trigger
 BEFORE UPDATE ON public.research_forms FOR EACH ROW
 EXECUTE FUNCTION public.enforce_research_trash_boundary();

NOTIFY pgrst, 'reload schema';
