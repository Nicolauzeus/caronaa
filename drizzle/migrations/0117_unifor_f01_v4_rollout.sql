-- 0117 | UNIFOR versioned rollout to F01 express V2.
-- Run only AFTER the compatible frontend AND 0116 have been deployed/validated.
-- Does not mutate V1/V2/V3 versions, historical answers, receipts, badges or rides.
DO $academic_f01_unifor_rollout$
DECLARE
  target uuid;
  previous jsonb;
  latest integer;
  item jsonb;
  question jsonb;
  questions jsonb;
  sections jsonb := '[]'::jsonb;
  role_id text;
  pain_id text := gen_random_uuid()::text;
  primary_id text := gen_random_uuid()::text;
  other_id text := gen_random_uuid()::text;
  kept_count integer := 0;
  domain_list jsonb;
  cfg_revision integer;
  cfg_editor uuid;
  next_settings jsonb;
BEGIN
  IF to_regprocedure('public.guard_academic_f01_response()') IS NULL THEN
    RAISE EXCEPTION 'Apply migration 0116 before the UNIFOR V2 rollout';
  END IF;
  SELECT id INTO target
  FROM public.research_forms
  WHERE code = '0K9K09K' AND status = 'PUBLICADO' AND is_enabled = true
  FOR UPDATE;
  IF target IS NULL THEN RAISE EXCEPTION 'UNIFOR published campaign 0K9K09K not found'; END IF;

  SELECT version_number, schema_json INTO latest, previous
  FROM public.research_form_versions
  WHERE form_id = target AND published_at IS NOT NULL
  ORDER BY version_number DESC LIMIT 1;
  IF previous->>'experience' = 'ACADEMIC_EXPRESS_F01_V2' THEN RETURN; END IF;
  IF latest IS DISTINCT FROM 3 OR previous->>'experience' IS DISTINCT FROM 'ACADEMIC_EXPRESS_V1' THEN
    RAISE EXCEPTION 'Unexpected active UNIFOR version %. Expected V3 academic express.', latest;
  END IF;
  IF EXISTS (SELECT 1 FROM public.research_form_versions
             WHERE form_id = target AND published_at IS NULL) THEN
    RAISE EXCEPTION 'Resolve existing unpublished draft before UNIFOR upgrade';
  END IF;
  SELECT q.value->>'id' INTO role_id
  FROM jsonb_array_elements(previous->'sections') s,
       LATERAL jsonb_array_elements(s.value->'questions') q
  WHERE q.value->>'semanticCode'='RESEARCH_PARTICIPANT_ROLE' LIMIT 1;
  IF role_id IS NULL THEN RAISE EXCEPTION 'V3 role question not found'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(previous->'sections') LOOP
    questions := '[]'::jsonb;
    FOR question IN SELECT value FROM jsonb_array_elements(item->'questions') LOOP
      IF question->>'semanticCode' = 'COST_PER_TRIP' THEN CONTINUE; END IF;
      IF question->>'semanticCode' = 'ACADEMIC_PARTICIPANT_NAME' THEN
        question := jsonb_set(question, '{label}', to_jsonb('Nome completo'::text), true);
      ELSIF question->>'semanticCode' = 'ACADEMIC_ROLE' THEN
        question := jsonb_set(question, '{options}', '["ESTUDANTE","PROFESSOR","COLABORADOR","OUTRO"]'::jsonb, true);
      ELSIF question->>'semanticCode' = 'TRANSPORT_MODE' THEN
        question := jsonb_set(question, '{condition}',
          jsonb_build_object('op','ANY','rules',jsonb_build_array(
            jsonb_build_object('questionId',role_id,'comparison','EQ','value','PASSAGEIRO')
          )), true);
      ELSIF question->>'semanticCode' = 'ACADEMIC_DRIVER_PRIORITY' THEN
        question := jsonb_set(question, '{required}', 'false'::jsonb, true);
      END IF;
      questions := questions || jsonb_build_array(question);
      kept_count := kept_count + 1;
    END LOOP;
    sections := sections || jsonb_build_array(jsonb_set(item, '{questions}', questions, true));
  END LOOP;
  IF kept_count <> 9 THEN
    RAISE EXCEPTION 'Unexpected V3 question count after removing COST_PER_TRIP: %', kept_count;
  END IF;

  sections := sections || jsonb_build_array(
    jsonb_build_object(
      'id',gen_random_uuid()::text,
      'title','Seus desafios no deslocamento',
      'description','Uma única pergunta para entender as dificuldades reais da sua comunidade.',
      'questions',jsonb_build_array(
        jsonb_build_object(
          'id',pain_id,'label','O que mais dificulta seu deslocamento?',
          'type','multiple_choice','required',true,
          'options',to_jsonb(ARRAY[
            'LOTACAO','PRECO_ALTO','ESPERA_LONGA','ATRASOS','INSEGURANCA_NO_TRAJETO',
            'SEM_TRANSPORTE','DESCONFORTO','HORARIO_INCOMPATIVEL','OUTRA','SEM_DIFICULDADES'
          ]::text[]),
          'minValue',1,'maxValue',3,'semanticCode','MOBILITY_PAINS'
        ),
        jsonb_build_object(
          'id',primary_id,'label','Qual dificuldade é a principal?',
          'type','single_choice','required',true,
          'options',to_jsonb(ARRAY[
            'LOTACAO','PRECO_ALTO','ESPERA_LONGA','ATRASOS','INSEGURANCA_NO_TRAJETO',
            'SEM_TRANSPORTE','DESCONFORTO','HORARIO_INCOMPATIVEL','OUTRA','SEM_DIFICULDADES'
          ]::text[]),
          'semanticCode','MOBILITY_PRIMARY_PAIN'
        ),
        jsonb_build_object(
          'id',other_id,'label','Descreva brevemente a outra dificuldade',
          'type','short_text','required',true,'minLength',3,'maxLength',140,
          'options','[]'::jsonb,
          'semanticCode','MOBILITY_OTHER_PAIN',
          'condition',jsonb_build_object('questionId',pain_id,'comparison','INCLUDES','value','OUTRA')
        )
      )
    )
  );

  SELECT revision,updated_by,settings INTO cfg_revision,cfg_editor,next_settings
  FROM public.research_configurations WHERE form_id = target FOR UPDATE;
  IF cfg_revision IS NULL THEN RAISE EXCEPTION 'UNIFOR settings missing'; END IF;
  domain_list := coalesce(next_settings->'institutionalEmailDomains','[]'::jsonb);
  IF jsonb_typeof(domain_list) IS DISTINCT FROM 'array' OR
     jsonb_array_length(domain_list) > 8 THEN RAISE EXCEPTION 'Invalid institutional email domains'; END IF;
  IF NOT (domain_list ? 'unifor.br') THEN
    IF jsonb_array_length(domain_list) = 8 THEN RAISE EXCEPTION 'No space for UNIFOR email domain'; END IF;
    next_settings := jsonb_set(next_settings,'{institutionalEmailDomains}',
      domain_list || '["unifor.br"]'::jsonb,true);
    UPDATE public.research_configurations
       SET settings=next_settings, revision=cfg_revision+1, updated_at=now()
     WHERE form_id=target;
    INSERT INTO public.research_configuration_history(form_id,revision,settings,created_by)
    VALUES(target,cfg_revision+1,next_settings,cfg_editor)
    ON CONFLICT (form_id,revision) DO NOTHING;
  END IF;

  INSERT INTO public.research_form_versions(form_id,version_number,schema_json,published_at)
  VALUES(target,latest+1,
    previous || jsonb_build_object('experience','ACADEMIC_EXPRESS_F01_V2','sections',sections),
    now());
END $academic_f01_unifor_rollout$;
NOTIFY pgrst, 'reload schema';
