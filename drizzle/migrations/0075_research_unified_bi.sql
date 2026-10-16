-- Unified counts for historical and dynamic forms. No personally identifiable fields.
CREATE OR REPLACE FUNCTION public.get_research_unified_bi(
 p_form_id uuid DEFAULT NULL,p_nature text DEFAULT NULL,
 p_profile text DEFAULT NULL,p_occupation text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH source_rows AS (
 SELECT s.submission_id id,s.research_form_id form_id,f.nature,
 s.tipo_usuario::text profile,s.ocupacao,s.created_at,
 'LEGACY' source,CASE WHEN jsonb_typeof(s.raw_payload->'raw_payload')='object'
 THEN s.raw_payload->'raw_payload' ELSE s.raw_payload END payload
 FROM public.form_submissions s JOIN public.research_forms f ON f.id=s.research_form_id
 UNION ALL
 SELECT a.id,a.form_id,f.nature,NULL::text,a.answers->>'occupation',a.submitted_at,
 'DYNAMIC',a.answers FROM public.research_answers a JOIN public.research_forms f ON f.id=a.form_id
), e AS (
 SELECT * FROM source_rows
 WHERE public.has_role(auth.uid(),'admin')
 AND (p_form_id IS NULL OR form_id=p_form_id)
 AND (p_nature IS NULL OR nature=p_nature)
 AND (p_profile IS NULL OR profile=p_profile)
 AND (p_occupation IS NULL OR ocupacao=p_occupation)
), normalized AS (
 SELECT DISTINCT e.id,x.code FROM e CROSS JOIN LATERAL jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(e.payload->'passengerDifficulties')='array' THEN e.payload->'passengerDifficulties'
 WHEN jsonb_typeof(e.payload->'main_challenge')='array' THEN e.payload->'main_challenge'
 ELSE '[]'::jsonb END) x(code)
 WHERE x.code IN ('DOR_01','DOR_02','DOR_03','DOR_04','DOR_05','DOR_06')
 UNION
 SELECT e.id,p.codigo_dor::text FROM e JOIN public.form_submission_pain_points p ON p.submission_id=e.id AND p.selecionada
), pains AS (
 SELECT code,count(DISTINCT id) cnt FROM normalized GROUP BY code
), profiles AS (
 SELECT coalesce(profile,'NÃO INFORMADO') category,count(*) cnt FROM e GROUP BY profile
), occupations AS (
 SELECT coalesce(ocupacao,'NÃO INFORMADO') category,count(*) cnt FROM e GROUP BY ocupacao
), sources AS (
 SELECT source,count(*) cnt FROM e GROUP BY source
)
SELECT jsonb_build_object(
 'total',(SELECT count(*) FROM e),
 'painEligible',(SELECT count(*) FROM e WHERE jsonb_typeof(payload->'passengerDifficulties')='array' OR jsonb_typeof(payload->'main_challenge')='array'),
 'profiles',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',category,'total',cnt)),'[]'::jsonb) FROM profiles),
 'occupations',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',category,'total',cnt)),'[]'::jsonb) FROM occupations),
 'pains',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'selectedCount',cnt)),'[]'::jsonb) FROM pains),
 'sources',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',source,'total',cnt)),'[]'::jsonb) FROM sources)
) $$;
REVOKE ALL ON FUNCTION public.get_research_unified_bi(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_research_unified_bi(uuid,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
