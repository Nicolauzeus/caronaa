-- CARONAA Research: read-only release acceptance checks.
-- Run after migrations 0069..0076, with a verified backup.
SELECT to_regclass('public.research_forms') AS forms_table,
       to_regclass('public.research_form_versions') AS versions_table,
       to_regclass('public.research_answers') AS answers_table,
       to_regprocedure('public.get_research_unified_bi(uuid,text,text,text,text)') AS unified_bi,
       to_regprocedure('public.get_research_legacy_metrics(uuid,text,text,text,text)') AS historical_bi,
       to_regprocedure('public.get_research_mobility_dimensions(uuid,text,text,text,text)') AS mobility_bi,
       to_regprocedure('public.get_research_answer_summary(uuid)') AS new_answers_bi;
SELECT f.code,f.status,count(s.submission_id) as submissions,
       count(DISTINCT s.submission_id) FILTER(WHERE s.research_form_id IS NOT NULL) as classified
FROM public.research_forms f LEFT JOIN public.form_submissions s ON s.research_form_id=f.id
GROUP BY f.code,f.status ORDER BY f.code;
WITH base AS (
 SELECT s.submission_id,
 CASE WHEN jsonb_typeof(s.raw_payload->'raw_payload')='object' THEN s.raw_payload->'raw_payload' ELSE s.raw_payload END payload
 FROM public.form_submissions s
), pains AS (
 SELECT DISTINCT b.submission_id,p.value code FROM base b
 CROSS JOIN LATERAL jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(b.payload->'passengerDifficulties')='array' THEN b.payload->'passengerDifficulties' ELSE '[]'::jsonb END) p
 WHERE p.value IN ('DOR_01','DOR_02','DOR_03','DOR_04','DOR_05','DOR_06')
)
SELECT code,count(*) responses FROM pains GROUP BY code ORDER BY code;
SELECT count(*) AS answers_total, count(*) FILTER (WHERE NOT consent_accepted) AS missing_consent
FROM public.research_answers;
SELECT tablename,policyname FROM pg_policies
WHERE schemaname='public' AND tablename IN ('research_forms','research_form_versions','research_answers')
ORDER BY tablename,policyname;
