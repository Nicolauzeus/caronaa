-- 0094: Department-scoped administrative roles; existing 'admin' remains global.
-- This first tranche activates the departments whose backend sources can be
-- authorized independently. Executive, Operations and Research stay global-only.
-- Apply and verify in homologation before assigning staff.
CREATE TABLE IF NOT EXISTS public.admin_department_assignments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN
    ('technology','growth','partnerships','safety','finance','compliance')),
  can_write boolean NOT NULL DEFAULT false,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department)
);
CREATE INDEX IF NOT EXISTS admin_department_assignments_department_idx
  ON public.admin_department_assignments(department);

CREATE TABLE IF NOT EXISTS public.admin_department_assignment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  department text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('GRANT','CHANGE','REVOKE')),
  previous_can_write boolean,
  new_can_write boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_department_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_department_assignment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_department_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_department_assignment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_department_assignments TO authenticated;
GRANT SELECT ON public.admin_department_assignment_events TO authenticated;

DROP POLICY IF EXISTS admin_department_self_read ON public.admin_department_assignments;
CREATE POLICY admin_department_self_read ON public.admin_department_assignments
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
DROP POLICY IF EXISTS admin_department_audit_global_read ON public.admin_department_assignment_events;
CREATE POLICY admin_department_audit_global_read ON public.admin_department_assignment_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Always use auth.uid() inside the database, never a caller-supplied identity.
CREATE OR REPLACE FUNCTION public.has_admin_department_access(
  p_department text, p_write boolean DEFAULT false
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.admin_department_assignments a
      WHERE a.user_id = auth.uid()
        AND a.department = p_department
        AND (NOT p_write OR a.can_write)
    )
  )
$$;
REVOKE ALL ON FUNCTION public.has_admin_department_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_department_access(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_admin_scope()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'is_global_admin', COALESCE(public.has_role(auth.uid(), 'admin'), false),
    'departments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', a.department, 'can_write', a.can_write)
        ORDER BY a.department)
      FROM public.admin_department_assignments a WHERE a.user_id = auth.uid()
    ), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION public.get_my_admin_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_admin_scope() TO authenticated;

-- A non-admin cannot insert into the grants table or invoke the write function.
CREATE OR REPLACE FUNCTION public.set_admin_department_assignment(
  p_user_id uuid, p_department text, p_can_write boolean DEFAULT false,
  p_enabled boolean DEFAULT true
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE previous_write boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores globais podem atribuir departamentos'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_department IS NULL OR p_department NOT IN
    ('technology','growth','partnerships','safety','finance','compliance') THEN
    RAISE EXCEPTION 'Departamento não habilitado para atribuição' USING ERRCODE = '22023';
  END IF;

  SELECT can_write INTO previous_write FROM public.admin_department_assignments
    WHERE user_id = p_user_id AND department = p_department FOR UPDATE;

  IF p_enabled THEN
    INSERT INTO public.admin_department_assignments(user_id,department,can_write,assigned_by)
    VALUES(p_user_id,p_department,COALESCE(p_can_write,false),auth.uid())
    ON CONFLICT (user_id,department) DO UPDATE SET
      can_write = EXCLUDED.can_write,
      assigned_by = auth.uid(),
      updated_at = now();
    INSERT INTO public.admin_department_assignment_events
      (actor_id,user_id,department,operation,previous_can_write,new_can_write)
    VALUES (auth.uid(),p_user_id,p_department,
      CASE WHEN previous_write IS NULL THEN 'GRANT' ELSE 'CHANGE' END,
      previous_write,COALESCE(p_can_write,false));
  ELSE
    DELETE FROM public.admin_department_assignments
      WHERE user_id = p_user_id AND department = p_department;
    IF FOUND THEN
      INSERT INTO public.admin_department_assignment_events
        (actor_id,user_id,department,operation,previous_can_write,new_can_write)
      VALUES (auth.uid(),p_user_id,p_department,'REVOKE',previous_write,NULL);
    END IF;
  END IF;
  RETURN p_enabled;
END $$;
REVOKE ALL ON FUNCTION public.set_admin_department_assignment(uuid,text,boolean,boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_admin_department_assignment(uuid,text,boolean,boolean)
  TO authenticated;

-- Technology and product.
DROP POLICY IF EXISTS tech_items_select ON public.tech_work_items;
CREATE POLICY tech_items_select ON public.tech_work_items FOR SELECT TO authenticated
  USING (public.has_admin_department_access('technology'));
DROP POLICY IF EXISTS tech_items_insert ON public.tech_work_items;
CREATE POLICY tech_items_insert ON public.tech_work_items FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('technology',true) AND created_by = auth.uid());
DROP POLICY IF EXISTS tech_items_update ON public.tech_work_items;
CREATE POLICY tech_items_update ON public.tech_work_items FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('technology',true))
  WITH CHECK (public.has_admin_department_access('technology',true));
DROP POLICY IF EXISTS tech_events_select ON public.tech_work_item_events;
CREATE POLICY tech_events_select ON public.tech_work_item_events FOR SELECT TO authenticated
  USING (public.has_admin_department_access('technology'));

-- Growth CRM. Preserve global admin behavior; require ownership for department-created rows.
DROP POLICY IF EXISTS crm_campaigns_admin ON public.crm_campaigns;
DROP POLICY IF EXISTS crm_leads_admin ON public.crm_leads;
CREATE POLICY crm_campaigns_department_read ON public.crm_campaigns FOR SELECT TO authenticated
  USING (public.has_admin_department_access('growth'));
CREATE POLICY crm_campaigns_department_insert ON public.crm_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('growth',true)
    AND (created_by=auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY crm_campaigns_department_update ON public.crm_campaigns FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('growth',true))
  WITH CHECK (public.has_admin_department_access('growth',true));
CREATE POLICY crm_leads_department_read ON public.crm_leads FOR SELECT TO authenticated
  USING (public.has_admin_department_access('growth'));
CREATE POLICY crm_leads_department_insert ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('growth',true)
    AND (created_by=auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY crm_leads_department_update ON public.crm_leads FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('growth',true))
  WITH CHECK (public.has_admin_department_access('growth',true));

-- Partnerships and pilots.
DROP POLICY IF EXISTS partner_org_admin ON public.partner_organizations;
DROP POLICY IF EXISTS partner_pilots_admin ON public.partner_pilots;
CREATE POLICY partner_org_department_read ON public.partner_organizations FOR SELECT TO authenticated
  USING (public.has_admin_department_access('partnerships'));
CREATE POLICY partner_org_department_insert ON public.partner_organizations FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('partnerships',true)
    AND (created_by=auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY partner_org_department_update ON public.partner_organizations FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('partnerships',true))
  WITH CHECK (public.has_admin_department_access('partnerships',true));
CREATE POLICY partner_pilots_department_read ON public.partner_pilots FOR SELECT TO authenticated
  USING (public.has_admin_department_access('partnerships'));
CREATE POLICY partner_pilots_department_insert ON public.partner_pilots FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('partnerships',true)
    AND (created_by=auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY partner_pilots_department_update ON public.partner_pilots FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('partnerships',true))
  WITH CHECK (public.has_admin_department_access('partnerships',true));

-- Support and incident handling.
DROP POLICY IF EXISTS safety_cases_admin_read ON public.safety_cases;
CREATE POLICY safety_cases_admin_read ON public.safety_cases FOR SELECT TO authenticated
  USING (public.has_admin_department_access('safety'));
DROP POLICY IF EXISTS safety_cases_admin_create ON public.safety_cases;
CREATE POLICY safety_cases_admin_create ON public.safety_cases FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('safety',true) AND created_by = auth.uid());
DROP POLICY IF EXISTS safety_cases_admin_update ON public.safety_cases;
CREATE POLICY safety_cases_admin_update ON public.safety_cases FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('safety',true))
  WITH CHECK (public.has_admin_department_access('safety',true));
DROP POLICY IF EXISTS safety_case_events_admin_read ON public.safety_case_events;
CREATE POLICY safety_case_events_admin_read ON public.safety_case_events FOR SELECT TO authenticated
  USING (public.has_admin_department_access('safety'));

-- Compliance.
DROP POLICY IF EXISTS compliance_admin_read ON public.compliance_records;
CREATE POLICY compliance_admin_read ON public.compliance_records FOR SELECT TO authenticated
  USING (public.has_admin_department_access('compliance'));
DROP POLICY IF EXISTS compliance_admin_insert ON public.compliance_records;
CREATE POLICY compliance_admin_insert ON public.compliance_records FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_department_access('compliance',true) AND created_by = auth.uid());
DROP POLICY IF EXISTS compliance_admin_update ON public.compliance_records;
CREATE POLICY compliance_admin_update ON public.compliance_records FOR UPDATE TO authenticated
  USING (public.has_admin_department_access('compliance',true))
  WITH CHECK (public.has_admin_department_access('compliance',true));
DROP POLICY IF EXISTS compliance_events_admin_read ON public.compliance_record_events;
CREATE POLICY compliance_events_admin_read ON public.compliance_record_events FOR SELECT TO authenticated
  USING (public.has_admin_department_access('compliance'));

-- Finance remains read-only and is checked inside SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.get_admin_finance_summary(p_since timestamptz DEFAULT NULL)
RETURNS TABLE(currency text,provider text,payment_status text,transactions bigint,total_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_admin_department_access('finance') THEN
   RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT p.currency,p.provider,p.status::text,count(*)::bigint,
   coalesce(sum(p.amount),0)::numeric
 FROM public.payments p
 WHERE p_since IS NULL OR p.created_at>=p_since
 GROUP BY p.currency,p.provider,p.status::text
 ORDER BY p.currency,p.provider,p.status::text;
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_finance_recent(
 p_since timestamptz DEFAULT NULL,p_limit integer DEFAULT 50
)
RETURNS TABLE(payment_id uuid,created_at timestamptz,currency text,provider text,payment_status text,amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_admin_department_access('finance') THEN
   RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT p.payment_id,p.created_at,p.currency,p.provider,p.status::text,p.amount
 FROM public.payments p WHERE p_since IS NULL OR p.created_at>=p_since
 ORDER BY p.created_at DESC LIMIT LEAST(GREATEST(coalesce(p_limit,50),1),100);
END $$;
REVOKE ALL ON FUNCTION public.get_admin_finance_summary(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_finance_recent(timestamptz,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_recent(timestamptz,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
