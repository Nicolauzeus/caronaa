-- 0119 | Driver-only participation does not answer passenger pains.
-- Additive: published versions and their historical answers remain unchanged.
-- Run after 0116. Explicitly publishes a NEW version of eligible Express V2 forms.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_academic_f01_response()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f01$
DECLARE
  schema_value jsonb;
  role_id text;
  name_id text;
  vehicle_id text;
  seats_id text;
  pains_id text;
  primary_id text;
  other_id text;
  role_value text;
  chosen_pains integer;
  distinct_pains integer;
  none_count integer;
BEGIN
  SELECT v.schema_json INTO schema_value
  FROM public.research_form_versions AS v
  WHERE v.id = NEW.version_id AND v.form_id = NEW.form_id;

  IF schema_value->>'experience' IS DISTINCT FROM 'ACADEMIC_EXPRESS_F01_V2' THEN
    RETURN NEW;
  END IF;

  SELECT
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'RESEARCH_PARTICIPANT_ROLE'),
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'ACADEMIC_PARTICIPANT_NAME'),
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'URBAN_OFFER_VEHICLE'),
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'SEATS_AVAILABLE'),
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'MOBILITY_PAINS'),
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'MOBILITY_PRIMARY_PAIN'),
    max(q.value->>'id') FILTER (WHERE q.value->>'semanticCode' = 'MOBILITY_OTHER_PAIN')
  INTO role_id, name_id, vehicle_id, seats_id, pains_id, primary_id, other_id
  FROM jsonb_array_elements(schema_value->'sections') AS s(value)
  CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') AS q(value);

  IF role_id IS NULL OR name_id IS NULL OR vehicle_id IS NULL
     OR seats_id IS NULL OR pains_id IS NULL OR primary_id IS NULL
     OR other_id IS NULL THEN
    RAISE EXCEPTION 'Estrutura academica F01 V2 incompleta' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(coalesce(NEW.answers->>name_id, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Nome do participante invalido' USING ERRCODE = '22023';
  END IF;

  role_value := NEW.answers->>role_id;
  IF role_value IS NULL OR role_value NOT IN ('PASSAGEIRO', 'MOTORISTA', 'AMBOS') THEN
    RAISE EXCEPTION 'Perfil academico invalido' USING ERRCODE = '22023';
  END IF;

  -- Only people who also intend to travel as passengers answer these pains.
  IF role_value IN ('PASSAGEIRO', 'AMBOS') THEN
  IF jsonb_typeof(NEW.answers->pains_id) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Selecione dificuldades de deslocamento' USING ERRCODE = '22023';
  END IF;

  SELECT
    count(*),
    count(DISTINCT p.value),
    count(*) FILTER (WHERE p.value = 'SEM_DIFICULDADES')
  INTO chosen_pains, distinct_pains, none_count
  FROM jsonb_array_elements_text(NEW.answers->pains_id) AS p(value);

  IF chosen_pains NOT BETWEEN 1 AND 3
     OR chosen_pains <> distinct_pains
     OR (none_count > 0 AND chosen_pains <> 1)
     OR NOT (NEW.answers->pains_id ? coalesce(NEW.answers->>primary_id, '')) THEN
    RAISE EXCEPTION 'Dificuldades ou prioridade invalidas' USING ERRCODE = '22023';
  END IF;

  IF NEW.answers->pains_id ? 'OUTRA'
     AND char_length(btrim(coalesce(NEW.answers->>other_id, ''))) NOT BETWEEN 3 AND 140 THEN
    RAISE EXCEPTION 'Descreva a outra dificuldade em ate 140 caracteres'
      USING ERRCODE = '22023';
  END IF;

  ELSE
    -- A driver-only participation must not carry passenger pain answers.
    IF NEW.answers ? pains_id OR NEW.answers ? primary_id OR NEW.answers ? other_id THEN
      RAISE EXCEPTION 'Perguntas de passageiros nao se aplicam ao motorista'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF role_value IN ('MOTORISTA', 'AMBOS') THEN
    IF coalesce(NEW.answers->>vehicle_id, '') NOT IN ('CARRO', 'MOTO') THEN
      RAISE EXCEPTION 'Veiculo invalido' USING ERRCODE = '22023';
    END IF;
    IF coalesce(NEW.answers->>seats_id, '') NOT IN ('1', '2', '3', '4') THEN
      RAISE EXCEPTION 'Informe de uma a quatro vagas' USING ERRCODE = '22023';
    END IF;
    IF NEW.answers->>vehicle_id = 'MOTO'
       AND NEW.answers->>seats_id <> '1' THEN
      RAISE EXCEPTION 'Motocicleta admite somente uma vaga'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END
$f01$;

DO $driver_rollout$
DECLARE
  item record;
  section_value jsonb;
  question_value jsonb;
  role_id text;
  pains_id text;
  role_gate jsonb;
  sections_out jsonb;
  questions_out jsonb;
  changed boolean;
BEGIN
  IF to_regprocedure('public.guard_academic_f01_response()') IS NULL THEN
    RAISE EXCEPTION 'Migration 0116 is a prerequisite';
  END IF;

  FOR item IN
    SELECT f.id AS form_id, f.code, v.version_number, v.schema_json
    FROM public.research_forms f
    CROSS JOIN LATERAL (
      SELECT version_number, schema_json
      FROM public.research_form_versions
      WHERE form_id=f.id AND published_at IS NOT NULL
      ORDER BY version_number DESC LIMIT 1
    ) v
    WHERE f.status='PUBLICADO'
      AND f.is_enabled
      AND v.schema_json->>'experience'='ACADEMIC_EXPRESS_F01_V2'
    ORDER BY f.id
    FOR UPDATE OF f
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.research_form_versions
      WHERE form_id=item.form_id AND published_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Form % has an unpublished draft; review before rollout', item.code;
    END IF;

    SELECT q.value->>'id' INTO role_id
    FROM jsonb_array_elements(item.schema_json->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='RESEARCH_PARTICIPANT_ROLE'
    LIMIT 1;
    SELECT q.value->>'id' INTO pains_id
    FROM jsonb_array_elements(item.schema_json->'sections') s
    CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='MOBILITY_PAINS'
    LIMIT 1;
    IF role_id IS NULL OR pains_id IS NULL THEN
      RAISE EXCEPTION 'Missing role/pain semantics in %',item.code;
    END IF;

    role_gate:=jsonb_build_object('op','ANY','rules',jsonb_build_array(
      jsonb_build_object('questionId',role_id,'comparison','EQ','value','PASSAGEIRO'),
      jsonb_build_object('questionId',role_id,'comparison','EQ','value','AMBOS')
    ));

    sections_out:='[]'::jsonb;
    changed:=false;
    FOR section_value IN SELECT value FROM jsonb_array_elements(item.schema_json->'sections') LOOP
      questions_out:='[]'::jsonb;
      FOR question_value IN SELECT value FROM jsonb_array_elements(section_value->'questions') LOOP
        IF question_value->>'semanticCode' IN ('MOBILITY_PAINS','MOBILITY_PRIMARY_PAIN')
           AND question_value->'condition' IS DISTINCT FROM role_gate THEN
          question_value:=jsonb_set(question_value,'{condition}',role_gate,true);
          changed:=true;
        END IF;
        questions_out:=questions_out||jsonb_build_array(question_value);
      END LOOP;
      sections_out:=sections_out||jsonb_build_array(
        jsonb_set(section_value,'{questions}',questions_out,true)
      );
    END LOOP;

    IF changed THEN
      INSERT INTO public.research_form_versions(
        form_id,version_number,schema_json,published_at
      ) VALUES(
        item.form_id,item.version_number+1,
        jsonb_set(item.schema_json,'{sections}',sections_out,true),now()
      );
      RAISE NOTICE 'Created driver-safe Express version % for %',
        item.version_number+1,item.code;
    END IF;
  END LOOP;
END
$driver_rollout$;

COMMIT;
NOTIFY pgrst, 'reload schema';
