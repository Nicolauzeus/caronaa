-- 0118 | Upgrade ONLY the currently published UNILAB-1 questionnaire to Academic Express F01 V2.
-- Historical V1-V4 versions, 24+ existing responses, claims and launch cohorts stay untouched.
-- This is a versioned public rollout: deploy compatible frontend and apply migration 0116 first.
DO $unilab_express$
DECLARE
  target uuid;
  latest integer;
  previous jsonb;
  next_schema jsonb;
  role_question jsonb;
  affiliation_question jsonb;
  vehicle_question jsonb;
  seats_question jsonb;
  role_id text;
  pcond jsonb;
  dcond jsonb;
  p_values jsonb := '["LOTACAO","PRECO_ALTO","ESPERA_LONGA","ATRASOS","INSEGURANCA_NO_TRAJETO","SEM_TRANSPORTE","DESCONFORTO","HORARIO_INCOMPATIVEL","OUTRA","SEM_DIFICULDADES"]'::jsonb;
  pains_id text := gen_random_uuid()::text;
  primary_id text := gen_random_uuid()::text;
  config_revision integer;
  config_settings jsonb;
  editor_id uuid;
  saved_domains jsonb;
BEGIN
  IF to_regprocedure('public.guard_academic_f01_response()') IS NULL THEN
    RAISE EXCEPTION 'Migration 0116 is required before enabling Express F01 V2';
  END IF;
  SELECT f.id INTO target
    FROM public.research_forms f
    WHERE f.code='UNILAB-1' AND f.nature='EDUCACAO'
      AND f.status='PUBLICADO' AND f.is_enabled = true
    FOR UPDATE;
  IF target IS NULL THEN RAISE EXCEPTION 'UNILAB-1 published form not found'; END IF;
  SELECT v.version_number, v.schema_json INTO latest,previous
    FROM public.research_form_versions v
    WHERE v.form_id=target AND v.published_at IS NOT NULL
    ORDER BY v.version_number DESC LIMIT 1;
  -- Safe to apply repeatedly.
  IF previous->>'experience'='ACADEMIC_EXPRESS_F01_V2' THEN RETURN; END IF;
  IF latest IS DISTINCT FROM 4 OR previous->>'experience' IS NOT NULL THEN
    RAISE EXCEPTION 'UNILAB-1 version changed (expected published V4 legacy); aborting';
  END IF;
  IF EXISTS(SELECT 1 FROM public.research_form_versions
            WHERE form_id=target AND published_at IS NULL) THEN
    RAISE EXCEPTION 'UNILAB-1 has an unpublished version; resolve it first';
  END IF;

  -- Read the actual V4 question identifiers; no assumed UUID or new answers written.
  SELECT q.value INTO role_question
    FROM jsonb_array_elements(previous->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='RESEARCH_PARTICIPANT_ROLE' LIMIT 1;
  SELECT q.value INTO affiliation_question
    FROM jsonb_array_elements(previous->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='ACADEMIC_ROLE' LIMIT 1;
  SELECT q.value INTO vehicle_question
    FROM jsonb_array_elements(previous->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='REGIONAL_OFFER_VEHICLE' LIMIT 1;
  SELECT q.value INTO seats_question
    FROM jsonb_array_elements(previous->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='SEATS_AVAILABLE' LIMIT 1;
  IF role_question IS NULL OR affiliation_question IS NULL
     OR vehicle_question IS NULL OR seats_question IS NULL THEN
    RAISE EXCEPTION 'Required legacy UNILAB role/affiliation/vehicle/seats questions missing';
  END IF;
  role_id:=role_question->>'id';
  pcond:=jsonb_build_object('op','ANY','rules',jsonb_build_array(
    jsonb_build_object('questionId',role_id,'comparison','EQ','value','PASSAGEIRO'),
    jsonb_build_object('questionId',role_id,'comparison','EQ','value','AMBOS')));
  dcond:=jsonb_build_object('op','ANY','rules',jsonb_build_array(
    jsonb_build_object('questionId',role_id,'comparison','EQ','value','MOTORISTA'),
    jsonb_build_object('questionId',role_id,'comparison','EQ','value','AMBOS')));

  next_schema:=jsonb_build_object(
    'experience','ACADEMIC_EXPRESS_F01_V2',
    'sections',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid()::text,'title','Sua comunidade',
        'questions',jsonb_build_array(
          jsonb_build_object('id',gen_random_uuid()::text,'label','Nome completo',
            'type','short_text','required',true,'minLength',2,'maxLength',80,
            'options','[]'::jsonb,'semanticCode','ACADEMIC_PARTICIPANT_NAME'),
          affiliation_question || jsonb_build_object(
            'label','Qual é seu vínculo com a instituição?',
            'options','["ESTUDANTE","PROFESSOR","COLABORADOR","OUTRO"]'::jsonb),
          role_question || jsonb_build_object(
            'label','Como pretende participar?',
            'options','["PASSAGEIRO","MOTORISTA","AMBOS"]'::jsonb)
        )),
      jsonb_build_object('id',gen_random_uuid()::text,'title','Como prefere viajar?',
        'questions',jsonb_build_array(
          jsonb_build_object('id',gen_random_uuid()::text,
            'label','O que mais valoriza em uma carona?',
            'type','single_choice','required',true,'semanticCode','ACADEMIC_PASSENGER_PRIORITY',
            'options','["PERFIL_VERIFICADO","PONTO_NO_CAMPUS","ECONOMIA","PREFERENCIA_MULHERES"]'::jsonb,
            'condition',pcond)
        )),
      jsonb_build_object('id',gen_random_uuid()::text,'title','Seu veículo',
        'questions',jsonb_build_array(
          vehicle_question || jsonb_build_object(
            'label','Qual veículo usaria para oferecer carona?',
            'semanticCode','URBAN_OFFER_VEHICLE','options','["CARRO","MOTO"]'::jsonb,
            'condition',dcond),
          seats_question || jsonb_build_object(
            'label','Quantas vagas livres para passageiros?',
            'type','number','required',true,'minValue',1,'maxValue',4,
            'integerOnly',true,'condition',dcond)
        )),
      jsonb_build_object('id',gen_random_uuid()::text,
        'title','Seus desafios no deslocamento',
        'description','Escolha até três dificuldades e indique a principal.',
        'questions',jsonb_build_array(
          jsonb_build_object('id',pains_id,'label','O que mais dificulta seu deslocamento?',
            'type','multiple_choice','required',true,'options',p_values,
            'minValue',1,'maxValue',3,'semanticCode','MOBILITY_PAINS'),
          jsonb_build_object('id',primary_id,'label','Qual dessas é a principal?',
            'type','single_choice','required',true,'options',p_values,
            'semanticCode','MOBILITY_PRIMARY_PAIN'),
          jsonb_build_object('id',gen_random_uuid()::text,'label','Descreva a outra dificuldade',
            'type','short_text','required',true,'minLength',3,'maxLength',140,
            'options','[]'::jsonb,'semanticCode','MOBILITY_OTHER_PAIN',
            'condition',jsonb_build_object(
              'questionId',pains_id,'comparison','INCLUDES','value','OUTRA'))
        ))
    )
  );

  -- Do not reset the institution's launch date (it is currently in the past).
  -- Institutional email domains are recognition hints only, never auth/eligibility.
  SELECT c.revision,c.settings,c.updated_by
    INTO config_revision,config_settings,editor_id
  FROM public.research_configurations c WHERE c.form_id=target FOR UPDATE;
  IF config_revision IS NULL OR config_settings->>'emailCaptureEnabled' <> 'true' THEN
    RAISE EXCEPTION 'Configure UNILAB-1 and consented email capture before rollout';
  END IF;
  saved_domains:=coalesce(config_settings->'institutionalEmailDomains','[]'::jsonb);
  IF jsonb_typeof(saved_domains) IS DISTINCT FROM 'array' OR
     jsonb_array_length(saved_domains)>8 THEN
    RAISE EXCEPTION 'Invalid institution domain configuration';
  END IF;
  IF NOT (saved_domains ? 'unilab.edu.br') THEN
    IF jsonb_array_length(saved_domains)=8 THEN RAISE EXCEPTION 'Domain limit reached'; END IF;
    config_settings:=jsonb_set(config_settings,'{institutionalEmailDomains}',
      saved_domains || '["unilab.edu.br"]'::jsonb,true);
    UPDATE public.research_configurations SET settings=config_settings,
      revision=config_revision+1,updated_at=now() WHERE form_id=target;
    INSERT INTO public.research_configuration_history(form_id,revision,settings,created_by)
    VALUES(target,config_revision+1,config_settings,editor_id);
  END IF;
  INSERT INTO public.research_form_versions(form_id,version_number,schema_json,published_at)
    VALUES(target,latest+1,next_schema,now());
END $unilab_express$;
NOTIFY pgrst,'reload schema';
