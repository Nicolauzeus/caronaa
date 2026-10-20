-- 0103: Private contact capture for opt-in survey leads, no auto-claim by email.
-- Apply only after 0094, 0095 and 0099. Production execution requires approval.
-- A respondent's typed email is NOT identity proof and never grants a badge.
CREATE TABLE IF NOT EXISTS public.research_lead_contacts (
  answer_id uuid PRIMARY KEY REFERENCES public.research_answers(id) ON DELETE RESTRICT,
  form_id uuid NOT NULL REFERENCES public.research_forms(id) ON DELETE RESTRICT,
  normalized_email text NOT NULL CHECK (length(normalized_email) BETWEEN 6 AND 180),
  linkage_consent boolean NOT NULL CHECK (linkage_consent),
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'research-contact-v1',
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_lead_contacts_email_idx
  ON public.research_lead_contacts(normalized_email,captured_at DESC);
CREATE INDEX IF NOT EXISTS research_lead_contacts_form_idx
  ON public.research_lead_contacts(form_id,captured_at DESC);
ALTER TABLE public.research_lead_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.research_lead_contacts FROM PUBLIC,anon,authenticated;
-- All contact reads pass through authorized aggregate or paginated RPCs.

CREATE OR REPLACE FUNCTION public.research_contact_capture_enabled(p_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $
 SELECT EXISTS (SELECT 1 FROM public.research_configurations c
   WHERE c.form_id=p_form_id AND c.settings->>'emailCaptureEnabled'='true')
$;
REVOKE ALL ON FUNCTION public.research_contact_capture_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.research_contact_capture_enabled(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.capture_research_lead(
  p_form_id uuid,p_submission_key uuid,p_email text,
  p_linkage_consent boolean,p_marketing_consent boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_answer public.research_answers%ROWTYPE;
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_stored text;
BEGIN
  IF p_linkage_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'É necessário autorizar o registro do e-mail para reconhecimento'
      USING ERRCODE='22023';
  END IF;
  IF length(v_email) NOT BETWEEN 6 AND 180 OR
     v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido' USING ERRCODE='22023';
  END IF;
  IF p_form_id IS NULL OR p_submission_key IS NULL OR
     NOT public.research_contact_capture_enabled(p_form_id) THEN
    RAISE EXCEPTION 'Captação não habilitada nesta pesquisa' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_answer FROM public.research_answers
  WHERE form_id=p_form_id AND client_submission_key=p_submission_key
    AND consent_accepted IS TRUE AND submitted_at > now() - interval '24 hours';
  IF NOT FOUND THEN RAISE EXCEPTION 'Resposta não localizada para esta participação'
    USING ERRCODE='42501'; END IF;
  SELECT normalized_email INTO v_stored FROM public.research_lead_contacts
  WHERE answer_id=v_answer.id FOR UPDATE;
  IF FOUND THEN
    IF v_stored<>v_email THEN RAISE EXCEPTION
      'O e-mail já foi registrado nesta participação' USING ERRCODE='23505'; END IF;
    RETURN 'already_captured';
  END IF;
  INSERT INTO public.research_lead_contacts
    (answer_id,form_id,normalized_email,linkage_consent,marketing_consent)
  VALUES (v_answer.id,v_answer.form_id,v_email,true,coalesce(p_marketing_consent,false))
  ON CONFLICT (answer_id) DO NOTHING;
  IF NOT FOUND THEN RETURN 'already_captured'; END IF;
  RETURN 'captured';
END $$;
REVOKE ALL ON FUNCTION public.capture_research_lead(uuid,uuid,text,boolean,boolean)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_research_lead(uuid,uuid,text,boolean,boolean)
  TO anon,authenticated;

-- Privileged CRM only. A form response and typed email do not assign a user badge.
-- Auth status is queried live, never computed from the first 300 displayed records.
CREATE OR REPLACE FUNCTION public.get_admin_research_leads(
  p_limit integer DEFAULT 40,p_offset integer DEFAULT 0,
  p_status text DEFAULT 'ALL',p_form_id uuid DEFAULT NULL,
  p_marketing_only boolean DEFAULT false)
RETURNS TABLE (
  email text,form_id uuid,form_title text,source_code text,
  captured_at timestamptz,marketing_consent boolean,
  registration_status text,total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_admin_department_access('growth') THEN
    RAISE EXCEPTION 'Acesso restrito ao CRM' USING ERRCODE='42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 OR
     p_status NOT IN ('ALL','SEM_CADASTRO','CADASTRO_NAO_CONFIRMADO','CONTA_CONFIRMADA') THEN
    RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023';
  END IF;
  RETURN QUERY WITH dedup AS (
    SELECT DISTINCT ON (c.normalized_email)
      c.normalized_email,c.form_id,c.captured_at,c.marketing_consent
    FROM public.research_lead_contacts c
    WHERE (p_form_id IS NULL OR c.form_id=p_form_id)
      AND (NOT p_marketing_only OR c.marketing_consent)
    ORDER BY c.normalized_email,c.captured_at DESC,c.answer_id DESC
  ), identified AS (
    SELECT d.*,f.title AS form_title,f.code AS source_code,
      CASE WHEN u.id IS NULL THEN 'SEM_CADASTRO'
        WHEN u.email_confirmed_at IS NULL THEN 'CADASTRO_NAO_CONFIRMADO'
        ELSE 'CONTA_CONFIRMADA' END AS registration_status
    FROM dedup d
    JOIN public.research_forms f ON f.id=d.form_id
    LEFT JOIN LATERAL (
      SELECT id,email_confirmed_at FROM auth.users
      WHERE lower(btrim(email))=d.normalized_email
      ORDER BY created_at DESC LIMIT 1
    ) u ON true
  )
  SELECT i.normalized_email,i.form_id,i.form_title,i.source_code,
    i.captured_at,i.marketing_consent,i.registration_status,count(*) OVER ()
  FROM identified i
  WHERE p_status='ALL' OR i.registration_status=p_status
  ORDER BY i.captured_at DESC,i.normalized_email
  LIMIT p_limit OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_research_leads(integer,integer,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_research_leads(integer,integer,text,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_research_lead_metrics(p_form_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.has_admin_department_access('growth') THEN
   RAISE EXCEPTION 'Acesso restrito ao CRM' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object(
  'contacts',count(*),
  'withoutAccount',count(*) FILTER (WHERE u.id IS NULL),
  'pendingConfirmation',count(*) FILTER (WHERE u.id IS NOT NULL AND u.email_confirmed_at IS NULL),
  'confirmedAccounts',count(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL),
  'marketingOptIn',count(*) FILTER (WHERE c.marketing_consent)
 ) INTO result
 FROM (
  SELECT DISTINCT ON (normalized_email) normalized_email,marketing_consent
  FROM public.research_lead_contacts
  WHERE p_form_id IS NULL OR form_id=p_form_id
  ORDER BY normalized_email,captured_at DESC,answer_id DESC
 ) c LEFT JOIN LATERAL (
   SELECT id,email_confirmed_at FROM auth.users
   WHERE lower(btrim(email))=c.normalized_email
   ORDER BY created_at DESC LIMIT 1
 ) u ON true;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_research_lead_metrics(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_research_lead_metrics(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_admin_research_lead_sources()
RETURNS TABLE(form_id uuid,form_title text,source_code text,contact_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $
BEGIN
  IF NOT public.has_admin_department_access('growth') THEN
    RAISE EXCEPTION 'Acesso restrito ao CRM' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT f.id,f.title,f.code,count(DISTINCT c.normalized_email)
    FROM public.research_lead_contacts c
    JOIN public.research_forms f ON f.id=c.form_id
    GROUP BY f.id,f.title,f.code ORDER BY f.title;
END $;
REVOKE ALL ON FUNCTION public.get_admin_research_lead_sources() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_research_lead_sources() TO authenticated;
NOTIFY pgrst,'reload schema';
