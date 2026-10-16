-- STS historical normalized analytics, original records remain unchanged.
CREATE OR REPLACE FUNCTION public.get_research_legacy_metrics(p_form_id uuid DEFAULT NULL,p_nature text DEFAULT NULL,p_profile text DEFAULT NULL,p_occupation text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH eligible AS (
 SELECT s.submission_id,
 CASE WHEN jsonb_typeof(s.raw_payload->'raw_payload')='object'
 THEN s.raw_payload->'raw_payload' ELSE s.raw_payload END AS payload
 FROM public.form_submissions s
 JOIN public.research_forms f ON f.id=s.research_form_id
 WHERE (p_form_id IS NULL OR s.research_form_id=p_form_id)
 AND (p_nature IS NULL OR f.nature=p_nature)
 AND (p_profile IS NULL OR s.tipo_usuario::text=p_profile)
 AND (p_occupation IS NULL OR s.ocupacao=p_occupation)
), pains AS (
 SELECT DISTINCT e.submission_id,d.code
 FROM eligible e CROSS JOIN LATERAL (
 SELECT value AS code FROM jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(e.payload->'passengerDifficulties')='array'
 THEN e.payload->'passengerDifficulties' ELSE '[]'::jsonb END) value
 WHERE value IN ('DOR_01','DOR_02','DOR_03','DOR_04','DOR_05','DOR_06')
 ) d
), barriers AS (
 SELECT DISTINCT e.submission_id,'PASSAGEIRO' AS role,value AS code
 FROM eligible e CROSS JOIN LATERAL jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(e.payload->'passengerBarriers')='array'
 THEN e.payload->'passengerBarriers' ELSE '[]'::jsonb END) value
 UNION
 SELECT DISTINCT e.submission_id,'MOTORISTA',value
 FROM eligible e CROSS JOIN LATERAL jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(e.payload->'driverBarriers')='array'
 THEN e.payload->'driverBarriers' ELSE '[]'::jsonb END) value
)
SELECT CASE WHEN public.has_role(auth.uid(),'admin') THEN jsonb_build_object(
 'pains',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'total',total)),'[]'::jsonb)
 FROM (SELECT code,count(*) total FROM pains GROUP BY code) x),
 'barriers',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',role,'code',code,'total',total)),'[]'::jsonb)
 FROM (SELECT role,code,count(*) total FROM barriers GROUP BY role,code) x),
 'covered',(SELECT count(DISTINCT submission_id) FROM pains),
 'questionEligibleCount',(SELECT count(*) FROM eligible WHERE jsonb_typeof(payload->'passengerDifficulties')='array')
) ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.get_research_legacy_metrics(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_research_legacy_metrics(uuid) TO authenticated;
