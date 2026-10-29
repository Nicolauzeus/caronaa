CREATE OR REPLACE FUNCTION public.get_research_unified_bi(
 p_form_id uuid DEFAULT NULL,p_nature text DEFAULT NULL,
 p_profile text DEFAULT NULL,p_occupation text DEFAULT NULL,p_pain_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH qmap AS (
 SELECT v.id vid, qq->>'id' qid, qq->>'semanticCode' sc
 FROM public.research_form_versions v
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(v.schema_json->'sections','[]'::jsonb)) s
 CROSS JOIN LATERAL jsonb_array_elements(coalesce(s->'questions','[]'::jsonb)) qq
 WHERE qq->>'semanticCode' IN ('ACADEMIC_ROLE','RESEARCH_PARTICIPANT_ROLE','MOBILITY_PAINS','MOBILITY_PRIMARY_PAIN','URBAN_PRIMARY_PAIN')
), dyn AS (
 SELECT a.id,a.form_id,f.nature,
  coalesce(j.journey->>'profile',
   (SELECT a.answers->>q.qid FROM qmap q WHERE q.vid=a.version_id AND q.sc='RESEARCH_PARTICIPANT_ROLE' AND a.answers ? q.qid LIMIT 1)) profile,
  coalesce((SELECT a.answers->>q.qid FROM qmap q WHERE q.vid=a.version_id AND q.sc='ACADEMIC_ROLE' AND a.answers ? q.qid LIMIT 1), a.answers->>'occupation') ocupacao,
  coalesce((SELECT a.answers->q.qid FROM qmap q WHERE q.vid=a.version_id AND q.sc='MOBILITY_PAINS' AND jsonb_typeof(a.answers->q.qid)='array' LIMIT 1),'[]'::jsonb) pains_sel,
  (SELECT a.answers->>q.qid FROM qmap q WHERE q.vid=a.version_id AND q.sc IN ('MOBILITY_PRIMARY_PAIN','URBAN_PRIMARY_PAIN') AND jsonb_typeof(a.answers->q.qid)='string' LIMIT 1) pain_primary
 FROM public.research_answers a JOIN public.research_forms f ON f.id=a.form_id
 LEFT JOIN LATERAL (SELECT journey FROM public.research_journeys rj WHERE rj.answer_id=a.id ORDER BY created_at DESC LIMIT 1) j ON true
), source_rows AS (
 SELECT s.submission_id id,s.research_form_id form_id,f.nature,s.tipo_usuario::text profile,s.ocupacao,'LEGACY' source,
  coalesce((SELECT jsonb_agg(DISTINCT c) FROM (
    SELECT pp.codigo_dor::text c FROM public.form_submission_pain_points pp WHERE pp.submission_id=s.submission_id AND pp.selecionada
    UNION SELECT x FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(pl.p->'passengerDifficulties')='array' THEN pl.p->'passengerDifficulties' WHEN jsonb_typeof(pl.p->'main_challenge')='array' THEN pl.p->'main_challenge' ELSE '[]'::jsonb END) x
  ) u),'[]'::jsonb) pains,
  NULL::text pain_primary,
  (EXISTS (SELECT 1 FROM public.form_submission_pain_points pp WHERE pp.submission_id=s.submission_id AND pp.selecionada) OR jsonb_typeof(pl.p->'passengerDifficulties')='array' OR jsonb_typeof(pl.p->'main_challenge')='array') eligible
 FROM public.form_submissions s JOIN public.research_forms f ON f.id=s.research_form_id
 CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(s.raw_payload->'raw_payload')='object' THEN s.raw_payload->'raw_payload' ELSE s.raw_payload END p) pl
 UNION ALL
 SELECT id,form_id,nature,profile,ocupacao,'DYNAMIC',
  CASE WHEN pain_primary IS NOT NULL AND NOT pains_sel ? pain_primary THEN pains_sel||to_jsonb(pain_primary) ELSE pains_sel END,
  pain_primary, (jsonb_array_length(pains_sel)>0 OR pain_primary IS NOT NULL)
 FROM dyn
), e AS (
 SELECT * FROM source_rows
 WHERE public.has_role(auth.uid(),'admin')
 AND (p_form_id IS NULL OR form_id=p_form_id)
 AND (p_nature IS NULL OR nature=p_nature)
 AND (p_profile IS NULL OR profile=p_profile)
 AND (p_occupation IS NULL OR ocupacao=p_occupation)
 AND (p_pain_code IS NULL OR pains ? p_pain_code)
), normalized AS (
 SELECT e.id,x code,(e.pain_primary=x) is_primary FROM e CROSS JOIN LATERAL jsonb_array_elements_text(e.pains) x
 WHERE x IN ('DOR_01','DOR_02','DOR_03','DOR_04','DOR_05','DOR_06')
), pains AS (
 SELECT code,count(DISTINCT id) cnt,count(DISTINCT id) FILTER (WHERE is_primary) prim FROM normalized GROUP BY code
), profiles AS (SELECT coalesce(profile,'NÃO INFORMADO') category,count(*) cnt FROM e GROUP BY 1
), occupations AS (SELECT coalesce(ocupacao,'NÃO INFORMADO') category,count(*) cnt FROM e GROUP BY 1
), sources AS (SELECT source,count(*) cnt FROM e GROUP BY source)
SELECT jsonb_build_object(
 'total',(SELECT count(*) FROM e),
 'painEligible',(SELECT count(*) FROM e WHERE eligible),
 'profiles',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',category,'total',cnt) ORDER BY cnt DESC),'[]'::jsonb) FROM profiles),
 'occupations',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',category,'total',cnt) ORDER BY cnt DESC),'[]'::jsonb) FROM occupations),
 'pains',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'selectedCount',cnt,'principalCount',NULLIF(prim,0))),'[]'::jsonb) FROM pains),
 'sources',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',source,'total',cnt)),'[]'::jsonb) FROM sources)
) $$;
REVOKE ALL ON FUNCTION public.get_research_unified_bi(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_research_unified_bi(uuid,text,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';