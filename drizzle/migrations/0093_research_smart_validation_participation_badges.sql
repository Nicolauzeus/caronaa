-- 0093: Stronger survey validation and consent-based participation attribution.
-- Run after backup. No historical answers are changed or granted badges retroactively.
-- "Pesquisa respondida" does NOT verify enrolment, affiliation or identity.

CREATE TABLE IF NOT EXISTS public.research_participation_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.research_forms(id) ON DELETE RESTRICT,
  answer_id uuid NOT NULL UNIQUE REFERENCES public.research_answers(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_participation_one_per_form UNIQUE(user_id,form_id)
);
CREATE INDEX IF NOT EXISTS research_participation_user_idx ON public.research_participation_badges(user_id);
ALTER TABLE public.research_participation_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_participation_badges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.research_participation_badges TO authenticated;
DROP POLICY IF EXISTS research_participation_owner_read ON public.research_participation_badges;
CREATE POLICY research_participation_owner_read ON public.research_participation_badges
 FOR SELECT TO authenticated USING (auth.uid()=user_id);

-- UUIDv4 submission receipt is a private bearer key, NEVER a form title or code.
-- The respondent explicitly opts into claiming it, and may claim only once.
CREATE OR REPLACE FUNCTION public.claim_research_participation(p_submission_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_auth auth.users%ROWTYPE;v_answer public.research_answers%ROWTYPE;v_claim public.research_participation_badges%ROWTYPE;
BEGIN
 SELECT * INTO v_auth FROM auth.users WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Inicie sessão para registrar a participação' USING ERRCODE='42501'; END IF;
 IF v_auth.email_confirmed_at IS NULL THEN
   RAISE EXCEPTION 'Confirme seu e-mail antes de vincular a pesquisa à conta' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_answer FROM public.research_answers
  WHERE client_submission_key=p_submission_key
  ORDER BY submitted_at DESC LIMIT 1;
 IF NOT FOUND OR v_answer.submitted_at < now()-interval '90 days'
  THEN RAISE EXCEPTION 'Recibo de participação inválido ou expirado' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_claim FROM public.research_participation_badges
  WHERE answer_id=v_answer.id OR (user_id=auth.uid() AND form_id=v_answer.form_id)
  FOR UPDATE;
 IF FOUND THEN
   IF v_claim.user_id<>auth.uid() THEN
     RAISE EXCEPTION 'Este recibo já foi vinculado a outra conta' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('status','already_linked','form_id',v_claim.form_id);
 END IF;
 INSERT INTO public.research_participation_badges(user_id,form_id,answer_id)
 VALUES(auth.uid(),v_answer.form_id,v_answer.id)
 ON CONFLICT DO NOTHING
 RETURNING * INTO v_claim;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Recibo já vinculado ou vínculo duplicado' USING ERRCODE='23505';
 END IF;
 RETURN jsonb_build_object('status','linked','form_id',v_claim.form_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_research_participation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_research_participation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_research_participation_badges()
RETURNS TABLE(form_id uuid,form_title text,form_code text,verified_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT b.form_id,f.title,f.code,b.verified_at
  FROM public.research_participation_badges b
  JOIN public.research_forms f ON f.id=b.form_id
  WHERE b.user_id=auth.uid() ORDER BY b.verified_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.get_my_research_participation_badges() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_research_participation_badges() TO authenticated;

-- Reuse the 0090 validation trigger; enforce realistic numeric bounds on both
-- new and ALREADY PUBLISHED schema without rewriting published form versions.
CREATE OR REPLACE FUNCTION public.validate_research_answer()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_schema jsonb;v_question jsonb;v_section jsonb;v_key text;v_value jsonb;v_parent_value jsonb;
 v_visible boolean;v_kind text;v_num numeric;v_min numeric;v_max numeric;v_integer boolean;
 v_semantic text;v_answer text;v_fallback_key text;
BEGIN
 IF NEW.consent_accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Consentimento obrigatório'; END IF;
 IF pg_column_size(NEW.answers)>32768 OR jsonb_typeof(NEW.answers) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'Respostas inválidas ou muito extensas'; END IF;
 SELECT v.schema_json INTO v_schema FROM public.research_form_versions v
 JOIN public.research_forms f ON f.id=v.form_id
 WHERE v.id=NEW.version_id AND v.form_id=NEW.form_id AND v.published_at IS NOT NULL
 AND f.status='PUBLICADO' AND f.is_enabled=true;
 IF v_schema IS NULL THEN RAISE EXCEPTION 'Pesquisa ou versão não disponível'; END IF;
 FOR v_section IN SELECT value FROM jsonb_array_elements(v_schema->'sections') LOOP
  FOR v_question IN SELECT value FROM jsonb_array_elements(v_section->'questions') LOOP
   v_key:=v_question->>'id';v_kind:=v_question->>'type';v_value:=NEW.answers->v_key;
   v_visible:=true;
   IF v_question ? 'showWhen' AND v_question->'showWhen'<>'null'::jsonb THEN
     v_parent_value:=NEW.answers->(v_question#>>'{showWhen,questionId}');
     v_visible:=v_parent_value IS NOT NULL
       AND v_parent_value #>> '{}'=v_question#>>'{showWhen,equals}';
   END IF;
   IF NOT v_visible THEN
     IF NEW.answers ? v_key THEN RAISE EXCEPTION 'Resposta para pergunta oculta: %',v_key; END IF;
     CONTINUE;
   END IF;
   IF coalesce((v_question->>'required')::boolean,false)
    AND (v_value IS NULL OR v_value='null'::jsonb OR v_value='""'::jsonb OR v_value='[]'::jsonb)
    THEN RAISE EXCEPTION 'Pergunta obrigatória sem resposta: %',v_key; END IF;
   IF v_value IS NULL OR v_value='null'::jsonb THEN CONTINUE; END IF;
   IF v_kind IN ('short_text','long_text','location','contact','date','time','yes_no',
                'rating_1_5','rating_0_10','rating_stars','money_range')
       AND jsonb_typeof(v_value)<>'string'
     THEN RAISE EXCEPTION 'Texto inválido na pergunta: %',v_key; END IF;
   IF v_kind IN ('short_text','location','contact') AND length(v_value#>>'{}')>240
    THEN RAISE EXCEPTION 'Texto excede limite na pergunta: %',v_key; END IF;
   IF v_kind='long_text' AND length(v_value#>>'{}')>2000
    THEN RAISE EXCEPTION 'Resposta longa excede limite na pergunta: %',v_key; END IF;
   IF v_kind='contact' AND v_value#>>'{}' !~ '^[^ @]+@[^ @]+\.[^ @]+$'
    THEN RAISE EXCEPTION 'E-mail inválido na pergunta: %',v_key; END IF;
   IF v_kind='date' AND v_value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN RAISE EXCEPTION 'Data inválida na pergunta: %',v_key; END IF;
   IF v_kind='time' AND v_value#>>'{}' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    THEN RAISE EXCEPTION 'Horário inválido na pergunta: %',v_key; END IF;
   IF v_kind IN ('rating_1_5','rating_stars') AND v_value#>>'{}' !~ '^[1-5]$'
    THEN RAISE EXCEPTION 'Escala 1-5 inválida na pergunta: %',v_key; END IF;
   IF v_kind='rating_0_10' AND v_value#>>'{}' !~ '^(10|[0-9])$'
    THEN RAISE EXCEPTION 'Escala 0-10 inválida na pergunta: %',v_key; END IF;
   IF v_kind='yes_no' AND v_value#>>'{}' NOT IN ('SIM','NAO')
    THEN RAISE EXCEPTION 'Resposta sim/não inválida na pergunta: %',v_key; END IF;
   IF v_kind IN ('single_choice','money_range') AND NOT (v_question->'options' ? v_value#>>'{}')
    THEN RAISE EXCEPTION 'Alternativa inválida na pergunta: %',v_key; END IF;
   IF v_kind='multiple_choice' THEN
     IF jsonb_typeof(v_value)<>'array' THEN RAISE EXCEPTION 'Seleção múltipla inválida: %',v_key; END IF;
     IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_value) x
      WHERE NOT (v_question->'options' ? x.value)) THEN RAISE EXCEPTION 'Alternativa inválida: %',v_key; END IF;
   END IF;
   IF v_kind='number' THEN
     v_answer:=v_value#>>'{}';
     IF jsonb_typeof(v_value) NOT IN ('string','number') OR v_answer !~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN RAISE EXCEPTION 'Número inválido: %',v_key; END IF;
     v_num:=v_answer::numeric;
     v_semantic:=coalesce(v_question->>'semanticCode','');
     v_fallback_key:=lower(v_key);
     v_min:=0;v_max:=1000000;v_integer:=false;
     IF v_fallback_key IN ('days','work_days','frequency') OR v_semantic IN ('CAMPUS_DAYS','WORK_DAYS')
      THEN v_max:=7;v_integer:=true;
     ELSIF v_fallback_key IN ('time','wait','wait_minutes') OR v_semantic IN ('TRAVEL_TIME','WAIT_TIME')
      THEN v_max:=1440;v_integer:=true;
     ELSIF v_fallback_key='cost' OR v_semantic='COST_PER_TRIP' THEN v_max:=10000;
     ELSIF v_fallback_key='seats' OR v_semantic='SEATS_AVAILABLE' THEN v_max:=8;v_integer:=true;
     ELSIF v_fallback_key='group' THEN v_min:=1;v_max:=50;v_integer:=true;
     ELSIF v_fallback_key='population' THEN v_max:=100000000;v_integer:=true;
     END IF;
     IF v_question ? 'minValue' THEN v_min:=(v_question->>'minValue')::numeric; END IF;
     IF v_question ? 'maxValue' THEN v_max:=(v_question->>'maxValue')::numeric; END IF;
     IF v_question ? 'integerOnly' THEN v_integer:=(v_question->>'integerOnly')::boolean; END IF;
     IF v_num<v_min OR v_num>v_max OR (v_integer AND trunc(v_num)<>v_num)
      THEN RAISE EXCEPTION 'Pergunta %: valor permitido entre % e % %',v_key,v_min,v_max,
       CASE WHEN v_integer THEN ' (inteiro)' ELSE '' END; END IF;
   END IF;
   IF v_kind IN ('matrix','ranking') THEN
     IF jsonb_typeof(v_value)<>'array' THEN RAISE EXCEPTION 'Lista inválida: %',v_key; END IF;
     IF v_kind='ranking' AND (jsonb_array_length(v_value)<>jsonb_array_length(v_question->'options')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_value) x WHERE NOT(v_question->'options' ? x.value))
      OR (SELECT count(DISTINCT x.value) FROM jsonb_array_elements_text(v_value) x)<>jsonb_array_length(v_value))
       THEN RAISE EXCEPTION 'Ordenação inválida: %',v_key; END IF;
     IF v_kind='matrix' AND (jsonb_array_length(v_value)<>jsonb_array_length(v_question->'rows')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_value) x WHERE
       NOT (v_question->'rows' ? split_part(x.value,'::',1))
       OR NOT (v_question->'options' ? split_part(x.value,'::',2)))
      OR (SELECT count(DISTINCT split_part(x.value,'::',1)) FROM jsonb_array_elements_text(v_value) x)<>jsonb_array_length(v_value))
       THEN RAISE EXCEPTION 'Matriz inválida: %',v_key; END IF;
   END IF;
  END LOOP;
 END LOOP;
 FOR v_key IN SELECT jsonb_object_keys(NEW.answers) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_schema->'sections') sec
    CROSS JOIN LATERAL jsonb_array_elements(sec->'questions') q WHERE q->>'id'=v_key)
  THEN RAISE EXCEPTION 'Resposta inesperada: %',v_key; END IF;
 END LOOP;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
