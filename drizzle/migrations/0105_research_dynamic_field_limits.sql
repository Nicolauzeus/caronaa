-- 0105: Server-side validation for the UI's configurable text and multi-choice limits.
-- Leaves historic published versions and responses unchanged.
CREATE OR REPLACE FUNCTION public.enforce_research_dynamic_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_schema jsonb; v_section jsonb; v_question jsonb; v_value jsonb;
  v_kind text; v_key text; v_len integer; v_min integer; v_max integer;
  v_limit integer;
BEGIN
 SELECT v.schema_json INTO v_schema FROM public.research_form_versions v
 WHERE v.id=NEW.version_id AND v.form_id=NEW.form_id;
 IF v_schema IS NULL THEN
   RAISE EXCEPTION 'Versão de pesquisa não localizada' USING ERRCODE='23514';
 END IF;
 FOR v_section IN SELECT value FROM jsonb_array_elements(v_schema->'sections') LOOP
  FOR v_question IN SELECT value FROM jsonb_array_elements(v_section->'questions') LOOP
   v_kind:=v_question->>'type';v_key:=v_question->>'id';v_value:=NEW.answers->v_key;
   IF v_value IS NULL OR v_value IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb) THEN CONTINUE; END IF;
   IF v_kind IN ('short_text','long_text','location') AND jsonb_typeof(v_value)='string' THEN
    v_limit:=CASE WHEN v_kind='long_text' THEN 2000 ELSE 240 END;
    v_min:=coalesce((v_question->>'minLength')::integer,0);
    v_max:=coalesce((v_question->>'maxLength')::integer,v_limit);
    IF v_min<0 OR v_max<1 OR v_max>v_limit OR v_min>v_max THEN
      RAISE EXCEPTION 'Configuração de caracteres inválida: %',v_key USING ERRCODE='23514';
    END IF;
    v_len:=length(btrim(v_value #>> '{}'));
    IF v_len<v_min OR v_len>v_max THEN
      RAISE EXCEPTION 'Pergunta %: informe de % a % caracteres',v_key,v_min,v_max USING ERRCODE='23514';
    END IF;
   ELSIF v_kind='multiple_choice' AND jsonb_typeof(v_value)='array' THEN
    v_min:=coalesce((v_question->>'minValue')::integer,0);
    v_max:=coalesce((v_question->>'maxValue')::integer,jsonb_array_length(v_question->'options'));
    v_len:=jsonb_array_length(v_value);
    IF v_min<0 OR v_max<1 OR v_min>v_max OR v_len NOT BETWEEN v_min AND v_max THEN
      RAISE EXCEPTION 'Pergunta %: escolha entre % e % opções',v_key,v_min,v_max USING ERRCODE='23514';
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_research_dynamic_limits() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_research_dynamic_limits ON public.research_answers;
CREATE TRIGGER trg_research_dynamic_limits
BEFORE INSERT OR UPDATE OF answers ON public.research_answers
FOR EACH ROW EXECUTE FUNCTION public.enforce_research_dynamic_limits();
