-- 0116 | New academic F01 express. Additive only: published versions and answers are immutable.
-- Domain recognition is a UI/CRM hint, never enrollment verification or an access grant.
ALTER TABLE public.research_lead_contacts
  ADD COLUMN IF NOT EXISTS institutional_domain_recognized boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_research_lead_domain_hint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $domain$
DECLARE domains jsonb; supplied_domain text;
BEGIN
  SELECT c.settings->'institutionalEmailDomains' INTO domains
  FROM public.research_configurations c WHERE c.form_id = NEW.form_id;
  supplied_domain := lower(split_part(NEW.normalized_email, '@', 2));
  NEW.institutional_domain_recognized :=
    supplied_domain <> '' AND jsonb_typeof(domains) = 'array'
    AND domains ? supplied_domain;
  RETURN NEW;
END $domain$;
REVOKE ALL ON FUNCTION public.mark_research_lead_domain_hint() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS research_lead_domain_hint_on_insert ON public.research_lead_contacts;
CREATE TRIGGER research_lead_domain_hint_on_insert
BEFORE INSERT ON public.research_lead_contacts
FOR EACH ROW EXECUTE FUNCTION public.mark_research_lead_domain_hint();

-- The V1 guard from 0113 continues unchanged; this trigger protects new F01 V2 answers.
CREATE OR REPLACE FUNCTION public.guard_academic_f01_response()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $f01$
DECLARE schema_value jsonb;
  role_id text; name_id text; vehicle_id text; seats_id text;
  pains_id text; primary_id text; other_id text; role_value text;
  n integer; unique_n integer; none_count integer;
BEGIN
  SELECT v.schema_json INTO schema_value
  FROM public.research_form_versions v WHERE v.id = NEW.version_id;
  IF schema_value->>'experience' IS DISTINCT FROM 'ACADEMIC_EXPRESS_F01_V2' THEN
    RETURN NEW;
  END IF;

  SELECT q.value->>'id' INTO role_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='RESEARCH_PARTICIPANT_ROLE' LIMIT 1;
  SELECT q.value->>'id' INTO name_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='ACADEMIC_PARTICIPANT_NAME' LIMIT 1;
  SELECT q.value->>'id' INTO vehicle_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='URBAN_OFFER_VEHICLE' LIMIT 1;
  SELECT q.value->>'id' INTO seats_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='SEATS_AVAILABLE' LIMIT 1;
  SELECT q.value->>'id' INTO pains_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='MOBILITY_PAINS' LIMIT 1;
  SELECT q.value->>'id' INTO primary_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='MOBILITY_PRIMARY_PAIN' LIMIT 1;
  SELECT q.value->>'id' INTO other_id
    FROM jsonb_array_elements(schema_value->'sections') s,
         LATERAL jsonb_array_elements(s.value->'questions') q
    WHERE q.value->>'semanticCode'='MOBILITY_OTHER_PAIN' LIMIT 1;

  IF role_id IS NULL OR name_id IS NULL OR vehicle_id IS NULL
     OR seats_id IS NULL OR pains_id IS NULL OR primary_id IS NULL OR other_id IS NULL
  THEN RAISE EXCEPTION 'Estrutura acadêmica F01 incompleta' USING ERRCODE='22023'; END IF;
  IF char_length(btrim(coalesce(NEW.answers->>name_id, ''))) NOT BETWEEN 2 AND 80
  THEN RAISE EXCEPTION 'Nome acadêmico inválido' USING ERRCODE='22023'; END IF;
  role_value := NEW.answers->>role_id;
  IF role_value NOT IN ('PASSAGEIRO','MOTORISTA','AMBOS') OR role_value IS NULL
  THEN RAISE EXCEPTION 'Perfil acadêmico inválido' USING ERRCODE='22023'; END IF;

  IF jsonb_typeof(NEW.answers->pains_id) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Selecione as dificuldades de deslocamento' USING ERRCODE='22023'; END IF;
  SELECT count(*), count(DISTINCT value), count(*) FILTER (WHERE value='SEM_DIFICULDADES')
    INTO n, unique_n, none_count
  FROM jsonb_array_elements_text(NEW.answers->pains_id) p(value);
  IF n NOT BETWEEN 1 AND 3 OR n <> unique_n OR (none_count > 0 AND n <> 1)
     OR NOT (NEW.answers->pains_id ? coalesce(NEW.answers->>primary_id, ''))
  THEN RAISE EXCEPTION 'Dificuldades ou prioridade inválidas' USING ERRCODE='22023'; END IF;
  IF NEW.answers->pains_id ? 'OUTRA'
     AND char_length(btrim(coalesce(NEW.answers->>other_id, ''))) < 3
  THEN RAISE EXCEPTION 'Informe brevemente a outra dificuldade' USING ERRCODE='22023'; END IF;

  IF role_value IN ('MOTORISTA','AMBOS') THEN
    IF coalesce(NEW.answers->>seats_id,'') NOT IN ('1','2','3','4')
    THEN RAISE EXCEPTION 'Escolha de 1 a 4 vagas livres' USING ERRCODE='22023'; END IF;
    IF NEW.answers->>vehicle_id = 'MOTO' AND NEW.answers->>seats_id <> '1'
    THEN RAISE EXCEPTION 'Motocicleta admite apenas uma vaga' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN NEW;
END $f01$;
REVOKE ALL ON FUNCTION public.guard_academic_f01_response() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS research_academic_f01_response_guard ON public.research_answers;
CREATE TRIGGER research_academic_f01_response_guard
BEFORE INSERT ON public.research_answers
FOR EACH ROW EXECUTE FUNCTION public.guard_academic_f01_response();

COMMENT ON COLUMN public.research_lead_contacts.institutional_domain_recognized IS
  'Exact configured email domain at capture time; not identity, enrollment or access verification.';
NOTIFY pgrst, 'reload schema';
