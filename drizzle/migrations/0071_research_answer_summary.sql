-- Aggregate published research answer fields for administrators.
CREATE OR REPLACE FUNCTION public.get_research_answer_summary(p_form_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH base AS (
 SELECT a.answers FROM public.research_answers a
 WHERE a.form_id=p_form_id AND public.has_role(auth.uid(),'admin')
), fields AS (
 SELECT e.key AS question_id,e.value AS response FROM base b
 CROSS JOIN LATERAL jsonb_each(b.answers) e
), values_flat AS (
 SELECT question_id, jsonb_array_elements_text(response) AS answer FROM fields
 WHERE jsonb_typeof(response)='array'
 UNION ALL
 SELECT question_id, trim(both '"' from response::text) AS answer FROM fields
 WHERE jsonb_typeof(response) IN ('string','number','boolean')
), distribution AS (
 SELECT question_id,answer,count(*) quantity FROM values_flat GROUP BY question_id,answer
)
SELECT jsonb_build_object(
 'total',(SELECT count(*) FROM base),
 'distributions',coalesce((SELECT jsonb_agg(jsonb_build_object('questionId',question_id,'answer',answer,'count',quantity)) FROM distribution),'[]'::jsonb)
) $$;
REVOKE ALL ON FUNCTION public.get_research_answer_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_research_answer_summary(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
