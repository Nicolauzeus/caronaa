-- 0121 | Same approved academic 5-step UX for existing university campaigns.
-- UNIFOR and UNILAB receive new immutable Express F01 V2 versions with
-- passenger/AMBOS mobility pains; MOTORISTA does not answer passenger pains.
-- Old versions, responses, CRM records and user journeys are NEVER rewritten.
-- Requires 0116 + 0119 server guard and compatible AcademicExpressForm frontend.
BEGIN;

DO $university_pains$
DECLARE
  item record;
  section_value jsonb;
  question_value jsonb;
  sections_out jsonb;
  questions_out jsonb;
  next_schema jsonb;
  previous_schema jsonb;
  role_id text;
  pain_id text;
  role_gate jsonb;
  retained_count integer;
  draft_id uuid;
  draft_version integer;
  draft_schema jsonb;
  settings_value jsonb;
  next_settings jsonb;
  cfg_revision integer;
  cfg_editor uuid;
  candidate_domain text;
  domains jsonb;
BEGIN
  IF to_regprocedure('public.guard_academic_f01_response()') IS NULL
     OR position(
       'IF role_value IN (''PASSAGEIRO'', ''AMBOS'') THEN'
       IN pg_get_functiondef(to_regprocedure('public.guard_academic_f01_response()'))
     ) = 0 THEN
    RAISE EXCEPTION 'Apply migrations 0116 and 0119 before academic F01 V2 rollout';
  END IF;

  FOR item IN
    SELECT f.id AS form_id, f.code, v.version_number, v.schema_json
    FROM public.research_forms f
    JOIN LATERAL (
      SELECT version_number, schema_json
      FROM public.research_form_versions
      WHERE form_id=f.id AND published_at IS NOT NULL
      ORDER BY version_number DESC LIMIT 1
    ) v ON true
    WHERE f.code IN ('0K9K09K', 'UNILAB-1')
      AND f.nature='EDUCACAO' AND f.status='PUBLICADO' AND f.is_enabled
    ORDER BY f.id
    FOR UPDATE OF f
  LOOP
    previous_schema := item.schema_json;
    IF previous_schema->>'experience' = 'ACADEMIC_EXPRESS_F01_V2' THEN
      -- Idempotent only if the active version still includes the passenger pain panel.
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(previous_schema->'sections') sec
        CROSS JOIN LATERAL jsonb_array_elements(sec.value->'questions') q
        WHERE q.value->>'semanticCode'='MOBILITY_PAINS'
          AND q.value->'condition' IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Active academic V2 without required pains: %', item.code;
      END IF;
      RAISE NOTICE 'Form % already uses passenger pains V2; no change', item.code;
      CONTINUE;
    END IF;
    IF previous_schema->>'experience' IS DISTINCT FROM 'ACADEMIC_EXPRESS_V1' THEN
      RAISE EXCEPTION 'Unexpected live experience for %', item.code;
    END IF;

    SELECT d.id, d.version_number, d.schema_json
      INTO draft_id, draft_version, draft_schema
    FROM public.research_form_versions d
    WHERE d.form_id=item.form_id AND d.published_at IS NULL
    ORDER BY d.version_number DESC LIMIT 1
    FOR UPDATE;

    -- The UNIFOR V4 draft is a byte-identical copy of published V3. Only such
    -- untouched drafts may safely be converted and published in this migration.
    IF draft_id IS NOT NULL AND (
      draft_version <> item.version_number + 1
      OR draft_schema IS DISTINCT FROM previous_schema
      OR (SELECT count(*) FROM public.research_form_versions d
          WHERE d.form_id=item.form_id AND d.published_at IS NULL) <> 1
    ) THEN
      RAISE EXCEPTION 'Custom unpublished draft exists for %. Review in Admin first', item.code;
    END IF;

    SELECT q.value->>'id' INTO role_id
    FROM jsonb_array_elements(previous_schema->'sections') sec
    CROSS JOIN LATERAL jsonb_array_elements(sec.value->'questions') q
    WHERE q.value->>'semanticCode'='RESEARCH_PARTICIPANT_ROLE'
    LIMIT 1;
    IF role_id IS NULL THEN RAISE EXCEPTION 'Role field missing in %', item.code; END IF;

    role_gate:=jsonb_build_object(
      'op','ANY','rules',jsonb_build_array(
        jsonb_build_object('questionId',role_id,'comparison','EQ','value','PASSAGEIRO'),
        jsonb_build_object('questionId',role_id,'comparison','EQ','value','AMBOS')
      )
    );
    pain_id:=gen_random_uuid()::text;
    retained_count:=0;
    sections_out:='[]'::jsonb;

    FOR section_value IN SELECT value FROM jsonb_array_elements(previous_schema->'sections')
    LOOP
      questions_out:='[]'::jsonb;
      FOR question_value IN SELECT value FROM jsonb_array_elements(section_value->'questions')
      LOOP
        IF question_value->>'semanticCode' IN (
          'COST_PER_TRIP','TRANSPORT_MODE','ACADEMIC_VEHICLE_MODEL','ACADEMIC_DRIVER_PRIORITY'
        ) THEN CONTINUE; END IF;
        IF question_value->>'semanticCode'='SEATS_AVAILABLE' THEN
          question_value:=jsonb_set(question_value,'{minValue}','1'::jsonb,true);
          question_value:=jsonb_set(question_value,'{maxValue}','4'::jsonb,true);
        END IF;
        questions_out:=questions_out||jsonb_build_array(question_value);
        retained_count:=retained_count+1;
      END LOOP;
      sections_out:=sections_out||jsonb_build_array(
        jsonb_set(section_value,'{questions}',questions_out,true)
      );
    END LOOP;

    IF retained_count <> 6 THEN
      RAISE EXCEPTION 'Unexpected essential academic question count in %: %',item.code,retained_count;
    END IF;

    sections_out:=sections_out||jsonb_build_array(
      jsonb_build_object(
        'id',gen_random_uuid()::text,
        'title','Seus desafios no deslocamento',
        'description','Uma pergunta para entender as dificuldades reais da comunidade.',
        'questions',jsonb_build_array(
          jsonb_build_object(
            'id',pain_id,'label','O que mais dificulta seu deslocamento?',
            'type','multiple_choice','required',true,
            'minValue',1,'maxValue',3,
            'options','["LOTACAO","PRECO_ALTO","ESPERA_LONGA","ATRASOS","INSEGURANCA_NO_TRAJETO","SEM_TRANSPORTE","DESCONFORTO","HORARIO_INCOMPATIVEL","OUTRA","SEM_DIFICULDADES"]'::jsonb,
            'semanticCode','MOBILITY_PAINS','condition',role_gate
          ),
          jsonb_build_object(
            'id',gen_random_uuid()::text,
            'label','Qual dessas dificuldades é a principal?',
            'type','single_choice','required',true,
            'options','["LOTACAO","PRECO_ALTO","ESPERA_LONGA","ATRASOS","INSEGURANCA_NO_TRAJETO","SEM_TRANSPORTE","DESCONFORTO","HORARIO_INCOMPATIVEL","OUTRA","SEM_DIFICULDADES"]'::jsonb,
            'semanticCode','MOBILITY_PRIMARY_PAIN','condition',role_gate
          ),
          jsonb_build_object(
            'id',gen_random_uuid()::text,
            'label','Descreva brevemente outra dificuldade',
            'type','short_text','required',true,'minLength',3,'maxLength',140,
            'options','[]'::jsonb,'semanticCode','MOBILITY_OTHER_PAIN',
            'condition',jsonb_build_object(
              'questionId',pain_id,'comparison','INCLUDES','value','OUTRA'
            )
          )
        )
      )
    );

    next_schema:=jsonb_set(
      jsonb_set(previous_schema,'{sections}',sections_out,true),
      '{experience}','"ACADEMIC_EXPRESS_F01_V2"'::jsonb,true
    );

    SELECT c.settings,c.revision,c.updated_by INTO settings_value,cfg_revision,cfg_editor
    FROM public.research_configurations c
    WHERE c.form_id=item.form_id
    FOR UPDATE;
    IF cfg_revision IS NULL OR settings_value->>'emailCaptureEnabled' IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Consent-based lead capture settings missing for %',item.code;
    END IF;

    next_settings:=settings_value;
    -- Institution-specific configuration belongs to the database, not frontend code.
    IF item.code='0K9K09K' THEN
      candidate_domain:='unifor.br';
      domains:=coalesce(next_settings->'institutionalEmailDomains','[]'::jsonb);
      IF jsonb_typeof(domains) IS DISTINCT FROM 'array' OR jsonb_array_length(domains)>8 THEN
        RAISE EXCEPTION 'Invalid domain configuration for %',item.code;
      END IF;
      IF NOT (domains ? candidate_domain) THEN
        IF jsonb_array_length(domains)=8 THEN
          RAISE EXCEPTION 'No space for an institutional domain for %',item.code;
        END IF;
        next_settings:=jsonb_set(next_settings,'{institutionalEmailDomains}',
          domains||jsonb_build_array(candidate_domain),true);
      END IF;
      IF coalesce(next_settings->>'campus','')='' THEN
        next_settings:=jsonb_set(next_settings,'{campus}',to_jsonb('Edson Queiroz'::text),true);
      END IF;
    END IF;

    IF next_settings IS DISTINCT FROM settings_value THEN
      UPDATE public.research_configurations
         SET settings=next_settings,revision=cfg_revision+1,updated_at=now()
       WHERE form_id=item.form_id;
      INSERT INTO public.research_configuration_history(
        form_id,revision,settings,created_by
      ) VALUES (item.form_id,cfg_revision+1,next_settings,cfg_editor)
      ON CONFLICT (form_id,revision) DO NOTHING;
    END IF;

    IF draft_id IS NULL THEN
      INSERT INTO public.research_form_versions(form_id,version_number,schema_json,published_at)
      VALUES(item.form_id,item.version_number+1,next_schema,now());
    ELSE
      UPDATE public.research_form_versions
         SET schema_json=next_schema,published_at=now()
       WHERE id=draft_id AND published_at IS NULL;
    END IF;
    RAISE NOTICE 'Published new unified academic F01 V2 for %, preserving prior answers',item.code;
    draft_id:=NULL; draft_version:=NULL; draft_schema:=NULL;
  END LOOP;

  IF (SELECT count(*) FROM public.research_forms
      WHERE code IN ('0K9K09K','UNILAB-1') AND status='PUBLICADO' AND is_enabled)<>2 THEN
    RAISE EXCEPTION 'Both published university campaigns are required for this guarded rollout';
  END IF;
END
$university_pains$;

COMMIT;
NOTIFY pgrst,'reload schema';
