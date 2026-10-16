-- MANUAL RUNBOOK: execute only after a verified Supabase backup and applying 0040.
-- The product owner confirmed all PRE-EXISTING survey submissions were collected at STS.
-- Never run this on an environment containing newer submissions from other campaigns.
BEGIN;
INSERT INTO public.research_forms (code,title,nature,audience,mobility_mode,status)
VALUES ('STS-2026','Siará Tech Summit 2026','EVENTO','GERAL','COMPARTILHADA','ENCERRADO')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.research_form_versions (form_id,version_number,schema_json,published_at)
SELECT id,1,'{"legacy":true,"sections":[]}'::jsonb,now()
FROM public.research_forms WHERE code='STS-2026'
ON CONFLICT (form_id,version_number) DO NOTHING;

-- Audit before change. Run during maintenance window before any new campaigns exist.
SELECT count(*) AS before_count FROM public.form_submissions;
SELECT count(*) AS before_pain_count FROM public.form_submission_pain_points;
UPDATE public.form_submissions s
SET research_form_id=f.id, research_version_id=v.id
FROM public.research_forms f JOIN public.research_form_versions v
 ON v.form_id=f.id AND v.version_number=1
WHERE f.code='STS-2026' AND s.research_form_id IS NULL AND s.research_version_id IS NULL;
SELECT count(*) AS after_count,
 count(*) FILTER (WHERE research_form_id IS NULL) AS unassigned
FROM public.form_submissions;
SELECT count(*) AS after_pain_count FROM public.form_submission_pain_points;
-- Compare before/after counts and inspect associations before COMMIT.
-- Replace ROLLBACK with COMMIT only after manual verification.
ROLLBACK;
