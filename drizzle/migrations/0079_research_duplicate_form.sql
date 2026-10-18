-- Duplicate survey into a private draft with a new stable code.
CREATE OR REPLACE FUNCTION public.duplicate_research_form(p_form_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.research_forms%ROWTYPE; source_schema jsonb; new_id uuid; suffix text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO original FROM public.research_forms WHERE id=p_form_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original form not found'; END IF;
 SELECT schema_json INTO source_schema FROM public.research_form_versions WHERE form_id=p_form_id ORDER BY version_number DESC LIMIT 1;
 suffix:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 INSERT INTO public.research_forms(code,title,nature,audience,mobility_mode,status,municipality,is_enabled)
 VALUES(original.code||'-COPIA-'||suffix,original.title||' (cópia)',original.nature,original.audience,original.mobility_mode,'RASCUNHO',original.municipality,false)
 RETURNING id INTO new_id;
 INSERT INTO public.research_form_versions(form_id,version_number,schema_json)
 VALUES(new_id,1,coalesce(source_schema,'{"sections":[]}'::jsonb));
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.duplicate_research_form(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.duplicate_research_form(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
