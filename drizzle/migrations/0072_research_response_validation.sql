-- Protect new public survey submissions with consent and schema validation.
ALTER TABLE public.research_answers ADD COLUMN IF NOT EXISTS consent_accepted boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.validate_research_answer()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_schema jsonb; v_question jsonb; v_section jsonb; v_key text; v_value jsonb; v_parent_value jsonb; v_valid boolean;
BEGIN
 IF NEW.consent_accepted IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Research consent required';
 END IF;
 IF pg_column_size(NEW.answers)>32768 THEN RAISE EXCEPTION 'Survey response too large'; END IF;
 SELECT v.schema_json INTO v_schema FROM public.research_form_versions v
 JOIN public.research_forms f ON f.id=v.form_id
 WHERE v.id=NEW.version_id AND v.form_id=NEW.form_id AND v.published_at IS NOT NULL AND f.status='PUBLICADO';
 IF v_schema IS NULL THEN RAISE EXCEPTION 'Form is not published'; END IF;
 IF jsonb_typeof(NEW.answers)<>'object' THEN RAISE EXCEPTION 'Invalid response object'; END IF;
 FOR v_section IN SELECT value FROM jsonb_array_elements(v_schema->'sections') LOOP
  FOR v_question IN SELECT value FROM jsonb_array_elements(v_section->'questions') LOOP
   v_key:=v_question->>'id'; v_value:=NEW.answers->v_key;
   v_valid:=true;
   IF v_question ? 'showWhen' AND v_question->'showWhen' IS NOT NULL THEN
    v_parent_value:=NEW.answers->(v_question#>>'{showWhen,questionId}');
    v_valid:=v_parent_value IS NOT NULL AND trim(both '"' from v_parent_value::text)=v_question#>>'{showWhen,equals}';
   END IF;
   IF NOT v_valid THEN
    IF NEW.answers ? v_key THEN RAISE EXCEPTION 'Hidden question answered'; END IF;
    CONTINUE;
   END IF;
   IF coalesce((v_question->>'required')::boolean,false)
     AND (v_value IS NULL OR v_value='null'::jsonb OR v_value='""'::jsonb OR v_value='[]'::jsonb)
   THEN RAISE EXCEPTION 'Required question missing'; END IF;
   IF v_value IS NOT NULL AND v_value<>'null'::jsonb THEN
    IF v_question->>'type'='number' AND (jsonb_typeof(v_value) NOT IN ('number','string') OR (trim(both '"' from v_value::text) !~ '^-?[0-9]+(\.[0-9]+)?$')) THEN RAISE EXCEPTION 'Invalid number'; END IF;
    IF v_question->>'type'='multiple_choice' AND jsonb_typeof(v_value)<>'array' THEN RAISE EXCEPTION 'Invalid multiple choice'; END IF;
    IF v_question->>'type'='multiple_choice' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_value) choice WHERE NOT (v_question->'options' ? choice)) THEN RAISE EXCEPTION 'Invalid multiple choice option'; END IF;
    IF v_question->>'type'='single_choice' AND NOT (v_question->'options' ? (trim(both '"' from v_value::text))) THEN RAISE EXCEPTION 'Invalid choice'; END IF;
   END IF;
  END LOOP;
 END LOOP;
 FOR v_key IN SELECT jsonb_object_keys(NEW.answers) LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_schema->'sections') sec CROSS JOIN LATERAL jsonb_array_elements(sec->'questions') q WHERE q->>'id'=v_key) THEN
    RAISE EXCEPTION 'Unexpected question key';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS research_answer_validity ON public.research_answers;
CREATE TRIGGER research_answer_validity BEFORE INSERT ON public.research_answers
FOR EACH ROW EXECUTE FUNCTION public.validate_research_answer();
