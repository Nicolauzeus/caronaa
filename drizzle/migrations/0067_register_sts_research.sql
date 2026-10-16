-- Register STS as the original research without touching historical response data.
INSERT INTO public.research_forms(code,title,nature,audience,mobility_mode,status)
VALUES ('STS-2026','Siará Tech Summit 2026','EVENTO','GERAL','COMPARTILHADA','ENCERRADO')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.research_form_versions(form_id,version_number,schema_json,published_at)
SELECT id,1,'{"legacy":true,"sections":[]}'::jsonb,now()
FROM public.research_forms WHERE code='STS-2026'
ON CONFLICT(form_id,version_number) DO NOTHING;
