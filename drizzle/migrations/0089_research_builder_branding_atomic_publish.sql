-- 0089: brand-safe survey presentation, opt-in public media and atomic publishing.
-- Review and apply individually after backup; no change to historical submissions.
ALTER TABLE public.research_forms ADD COLUMN IF NOT EXISTS brand_image_path text;
ALTER TABLE public.research_forms ADD COLUMN IF NOT EXISTS brand_image_alt text;
ALTER TABLE public.research_forms ADD COLUMN IF NOT EXISTS brand_display_name text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='research_brand_path_safe') THEN
  ALTER TABLE public.research_forms ADD CONSTRAINT research_brand_path_safe CHECK (
   brand_image_path IS NULL OR brand_image_path ~ '^[0-9a-f-]{36}/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$'
  );
 END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('research-branding','research-branding',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=2097152,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS research_branding_public_read ON storage.objects;
CREATE POLICY research_branding_public_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='research-branding');
DROP POLICY IF EXISTS research_branding_admin_create ON storage.objects;
CREATE POLICY research_branding_admin_create ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='research-branding' AND public.has_role(auth.uid(),'admin')
 AND EXISTS(SELECT 1 FROM public.research_forms f WHERE f.id::text=split_part(name,'/',1)));
DROP POLICY IF EXISTS research_branding_admin_update ON storage.objects;
CREATE POLICY research_branding_admin_update ON storage.objects FOR UPDATE TO authenticated
 USING(bucket_id='research-branding' AND public.has_role(auth.uid(),'admin'))
 WITH CHECK(bucket_id='research-branding' AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS research_branding_admin_delete ON storage.objects;
CREATE POLICY research_branding_admin_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='research-branding' AND public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.publish_research_form(
 p_form_id uuid,p_version_id uuid,p_schema jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_version public.research_form_versions%ROWTYPE;
 v_status text; v_section jsonb; v_question jsonb; v_questions jsonb := '[]'::jsonb;
 v_count integer:=0; v_id text; v_parent jsonb; v_order integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 SELECT status INTO v_status FROM public.research_forms WHERE id=p_form_id FOR UPDATE;
 IF NOT FOUND OR v_status IN ('ENCERRADO','ARQUIVADO') THEN RAISE EXCEPTION 'Form is not editable'; END IF;
 SELECT * INTO v_version FROM public.research_form_versions WHERE id=p_version_id AND form_id=p_form_id FOR UPDATE;
 IF NOT FOUND OR v_version.published_at IS NOT NULL THEN RAISE EXCEPTION 'Version is not editable'; END IF;
 IF jsonb_typeof(p_schema) <> 'object' OR jsonb_typeof(p_schema->'sections') <> 'array' THEN RAISE EXCEPTION 'Invalid sections'; END IF;
 IF jsonb_array_length(p_schema->'sections') NOT BETWEEN 1 AND 30 OR pg_column_size(p_schema)>262144 THEN RAISE EXCEPTION 'Invalid section count or payload'; END IF;
 FOR v_section IN SELECT value FROM jsonb_array_elements(p_schema->'sections') LOOP
   IF length(btrim(coalesce(v_section->>'title',''))) NOT BETWEEN 2 AND 180 THEN RAISE EXCEPTION 'Invalid section title'; END IF;
   IF jsonb_typeof(v_section->'questions') <> 'array' THEN RAISE EXCEPTION 'Invalid questions array'; END IF;
   FOR v_question IN SELECT value FROM jsonb_array_elements(v_section->'questions') LOOP
     v_id:=v_question->>'id';
     IF length(coalesce(v_id,'')) NOT BETWEEN 1 AND 100 OR length(btrim(coalesce(v_question->>'label',''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Invalid question identifier or label'; END IF;
     IF v_question->>'type' NOT IN ('short_text','long_text','single_choice','multiple_choice','number','rating_1_5','rating_0_10','date','time','yes_no','rating_stars','money_range','location','ranking','matrix','contact') THEN RAISE EXCEPTION 'Unsupported question type'; END IF;
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_questions) previous WHERE previous->>'id'=v_id) THEN RAISE EXCEPTION 'Duplicate question identifier'; END IF;
     IF v_question->>'type' IN ('single_choice','multiple_choice','ranking','matrix','money_range') AND (
       jsonb_typeof(v_question->'options') IS DISTINCT FROM 'array' OR
       (CASE WHEN jsonb_typeof(v_question->'options')='array' THEN jsonb_array_length(v_question->'options') < 2 ELSE true END)
     ) THEN RAISE EXCEPTION 'Structured question requires at least two choices'; END IF;
     IF v_question->>'type'='matrix' AND (
       jsonb_typeof(v_question->'rows') IS DISTINCT FROM 'array' OR
       (CASE WHEN jsonb_typeof(v_question->'rows')='array' THEN jsonb_array_length(v_question->'rows') < 1 ELSE true END)
     ) THEN RAISE EXCEPTION 'Matrix requires at least one row'; END IF;
     IF v_question ? 'showWhen' AND v_question->'showWhen' <> 'null'::jsonb THEN
       SELECT prior INTO v_parent FROM jsonb_array_elements(v_questions) prior WHERE prior->>'id'=v_question#>>'{showWhen,questionId}' LIMIT 1;
       IF v_parent IS NULL OR v_parent->>'type' <> 'single_choice' OR NOT (v_parent->'options' ? (v_question#>>'{showWhen,equals}'))
       THEN RAISE EXCEPTION 'Conditional question must depend on an earlier single-choice question'; END IF;
     END IF;
     v_questions:=v_questions||jsonb_build_array(v_question);
     v_count:=v_count+1;
     IF v_count>200 THEN RAISE EXCEPTION 'Too many questions'; END IF;
   END LOOP;
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'Form needs at least one question'; END IF;
 UPDATE public.research_form_versions SET schema_json=p_schema,published_at=now() WHERE id=p_version_id;
 UPDATE public.research_forms SET status='PUBLICADO',is_enabled=true WHERE id=p_form_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.publish_research_form(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_research_form(uuid,uuid,jsonb) TO authenticated;

-- Create metadata and its initial version in one transaction.
CREATE OR REPLACE FUNCTION public.create_research_form_draft(
 p_title text,p_code text,p_nature text,p_audience text,p_municipality text,p_schema jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF length(btrim(p_title)) NOT BETWEEN 2 AND 180 OR p_code !~ '^[A-Z0-9][A-Z0-9_-]{1,79}$'
 THEN RAISE EXCEPTION 'Invalid title or code'; END IF;
 IF p_nature NOT IN ('EVENTO','EDUCACAO','EMPRESA','MOBILIDADE_LOCAL','OUTRA') THEN RAISE EXCEPTION 'Invalid research nature'; END IF;
 IF jsonb_typeof(p_schema->'sections') <> 'array' OR pg_column_size(p_schema)>262144 THEN RAISE EXCEPTION 'Invalid draft'; END IF;
 INSERT INTO public.research_forms(title,code,nature,audience,municipality,mobility_mode,status,is_enabled)
 VALUES(btrim(p_title),p_code,p_nature,p_audience,nullif(btrim(p_municipality),''),CASE WHEN p_nature='MOBILIDADE_LOCAL' THEN 'PROFISSIONAL_SOB_DEMANDA' ELSE 'COMPARTILHADA' END,'RASCUNHO',false)
 RETURNING id INTO v_id;
 INSERT INTO public.research_form_versions(form_id,version_number,schema_json) VALUES(v_id,1,p_schema);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_research_form_draft(text,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_research_form_draft(text,text,text,text,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
