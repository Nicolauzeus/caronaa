-- 0096: reusable urban university validation/pilot model.
-- Additive only. Apply AFTER 0095 if the trash PR is deployed first.
-- IMPORTANT: Back up and validate with real auth sessions in homologation.
CREATE TABLE IF NOT EXISTS public.research_urban_university_configs (
  form_id uuid PRIMARY KEY REFERENCES public.research_forms(id) ON DELETE RESTRICT,
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_urban_university_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_urban_university_configs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.research_urban_university_configs TO anon,authenticated;
DROP POLICY IF EXISTS urban_university_config_read ON public.research_urban_university_configs;
CREATE POLICY urban_university_config_read ON public.research_urban_university_configs
  FOR SELECT TO anon,authenticated USING (
    public.has_role(auth.uid(),'admin') OR EXISTS (
      SELECT 1 FROM public.research_forms f WHERE f.id=form_id
        AND f.status='PUBLICADO' AND f.is_enabled=true
    )
  );

-- Non-PII pilot intent and optional explicit contact permission. Never a booked ride.
CREATE TABLE IF NOT EXISTS public.research_urban_university_interests (
  answer_id uuid PRIMARY KEY REFERENCES public.research_answers(id) ON DELETE RESTRICT,
  form_id uuid NOT NULL REFERENCES public.research_forms(id) ON DELETE RESTRICT,
  wants_preparation boolean NOT NULL DEFAULT false,
  contact_consent boolean NOT NULL DEFAULT false,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_email IS NULL OR
    (contact_consent AND length(contact_email) <= 180
      AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'))
);
CREATE INDEX IF NOT EXISTS urban_university_interests_form_idx
 ON public.research_urban_university_interests(form_id);
ALTER TABLE public.research_urban_university_interests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_urban_university_interests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_urban_university_research(
 p_code text, p_config jsonb, p_schema jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid; v_university text; v_campus text; v_times jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
   RAISE EXCEPTION 'Somente o administrador global pode criar pesquisas institucionais'
     USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_config) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Configuração institucional inválida';
 END IF;
 v_university:=btrim(coalesce(p_config->>'university',''));
 v_campus:=btrim(coalesce(p_config->>'campus',''));
 v_times:=p_config->'times';
 IF length(v_university) NOT BETWEEN 2 AND 100 OR length(v_campus) NOT BETWEEN 2 AND 100
   OR length(btrim(coalesce(p_config->>'address',''))) NOT BETWEEN 5 AND 240
   OR length(btrim(coalesce(p_config->>'city',''))) NOT BETWEEN 2 AND 100
   OR jsonb_typeof(v_times) <> 'array'
   OR jsonb_array_length(v_times) NOT BETWEEN 2 AND 24
   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_times) t
              WHERE t.value !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
   OR coalesce(p_config->>'launch_status','') NOT IN ('PLANEJADO','CONFIRMADO','ATIVO','ADIADO')
   OR (p_config->>'launch_date' IS NOT NULL
       AND (p_config->>'launch_date') !~ '^\\d{4}-\\d{2}-\\d{2}$')
   OR p_config->>'model' IS DISTINCT FROM 'UNIVERSIDADE_URBANA_CARONAA'
 THEN RAISE EXCEPTION 'Preencha instituição, campus, endereço, cidade, horários e situação do lançamento';
 END IF;
 IF jsonb_typeof(p_schema->'sections') <> 'array'
    OR p_schema->>'model' IS DISTINCT FROM 'UNIVERSIDADE_URBANA_CARONAA'
    OR pg_column_size(p_schema)>262144 THEN RAISE EXCEPTION 'Questionário de universidade inválido'; END IF;
 -- Existing audited draft RPC owns base metadata and version in same transaction.
 v_id:=public.create_research_form_draft(
   'Mobilidade em ' || v_university,p_code,'EDUCACAO','GERAL',
   coalesce(p_config->>'city',''),p_schema
 );
 INSERT INTO public.research_urban_university_configs(form_id,settings) VALUES(v_id,p_config);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_urban_university_research(text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_urban_university_research(text,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_urban_university_interest(
 p_receipt uuid, p_wants_preparation boolean, p_contact_consent boolean,
 p_contact_email text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_answer public.research_answers%ROWTYPE;
 v_email text; v_role text;
BEGIN
 SELECT * INTO v_answer FROM public.research_answers a
   JOIN public.research_urban_university_configs c ON c.form_id=a.form_id
 WHERE a.client_submission_key=p_receipt
 ORDER BY a.submitted_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recibo da pesquisa inválido' USING ERRCODE='42501'; END IF;
 IF v_answer.submitted_at < now()-interval '30 days' THEN
  RAISE EXCEPTION 'Recibo expirado. Procure a equipe CARONAA.' USING ERRCODE='42501';
 END IF;
 v_role:=coalesce(v_answer.answers->>'urban_role','');
 IF v_role NOT IN ('PEGAR','OFERECER','AMBOS','CONHECER') THEN
  RAISE EXCEPTION 'Perfil do questionário inválido';
 END IF;
 IF coalesce(p_wants_preparation,false) AND
   (v_role='CONHECER' OR v_answer.answers->>'urban_prepare' IS DISTINCT FROM 'SIM') THEN
   RAISE EXCEPTION 'A preparação precisa ser autorizada no questionário';
 END IF;
 v_email:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
 IF p_contact_consent IS DISTINCT FROM true THEN v_email:=NULL; END IF;
 IF coalesce(p_contact_consent,false) AND (v_email IS NULL
   OR length(v_email)>180
   OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$') THEN
   RAISE EXCEPTION 'Informe um e-mail válido para receber avisos';
 END IF;
 INSERT INTO public.research_urban_university_interests
   (answer_id,form_id,wants_preparation,contact_consent,contact_email)
 VALUES(v_answer.id,v_answer.form_id,coalesce(p_wants_preparation,false),
   coalesce(p_contact_consent,false),v_email)
 ON CONFLICT(answer_id) DO UPDATE SET
  wants_preparation=excluded.wants_preparation,
  contact_consent=excluded.contact_consent,
  contact_email=excluded.contact_email;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.register_urban_university_interest(uuid,boolean,boolean,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_urban_university_interest(uuid,boolean,boolean,text)
 TO anon,authenticated;

-- Real administrative aggregation. No raw responses, emails or residential origin.
CREATE OR REPLACE FUNCTION public.get_urban_university_market_summary(p_form_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
   RAISE EXCEPTION 'Relatório restrito a administradores globais' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.research_urban_university_configs WHERE form_id=p_form_id)
 THEN RAISE EXCEPTION 'Modelo institucional não encontrado'; END IF;
 WITH base AS (
   SELECT answers FROM public.research_answers WHERE form_id=p_form_id
 ), intents AS (
   SELECT count(*) FILTER (WHERE wants_preparation)::bigint AS prepared,
          count(*) FILTER (WHERE contact_consent)::bigint AS notified
   FROM public.research_urban_university_interests WHERE form_id=p_form_id
 ), cost AS (
   SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (answers->>'urban_cost')::numeric) AS median_cost
   FROM base WHERE (answers->>'urban_cost') ~ '^([0-9]{1,5})(\\.[0-9]{1,2})?$'
 ), choices AS (
   SELECT 'transport' AS metric, mode AS value,count(*)::bigint AS total
   FROM base CROSS JOIN LATERAL jsonb_array_elements_text(
     CASE WHEN jsonb_typeof(answers->'urban_transport')='array' THEN answers->'urban_transport'
     ELSE '[]'::jsonb END) j(mode) GROUP BY mode
   UNION ALL SELECT 'role',answers->>'urban_role',count(*) FROM base
      WHERE answers ? 'urban_role' GROUP BY answers->>'urban_role'
   UNION ALL SELECT 'departure',answers->>'urban_departure',count(*) FROM base
      WHERE answers ? 'urban_departure' GROUP BY answers->>'urban_departure'
   UNION ALL SELECT 'intent',answers->>'urban_intent',count(*) FROM base
      WHERE answers ? 'urban_intent' GROUP BY answers->>'urban_intent'
   UNION ALL SELECT 'pain',answers->>'urban_main_pain',count(*) FROM base
      WHERE answers ? 'urban_main_pain' GROUP BY answers->>'urban_main_pain'
   UNION ALL SELECT 'price_budget',answers->>'urban_budget',count(*) FROM base
      WHERE answers ? 'urban_budget' GROUP BY answers->>'urban_budget'
 )
 SELECT jsonb_build_object(
    'responses',(SELECT count(*) FROM base),
    'median_cost_per_trip',(SELECT median_cost FROM cost),
    'preparation_opt_ins',(SELECT prepared FROM intents),
    'notification_opt_ins',(SELECT notified FROM intents),
    'distributions',coalesce((
       SELECT jsonb_agg(jsonb_build_object('metric',metric,'value',value,'count',total)
         ORDER BY metric,total DESC,value) FROM choices
    ),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.get_urban_university_market_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_urban_university_market_summary(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
