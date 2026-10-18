-- Homologation first. Additive infrastructure; no published schemas or answers rewritten.
ALTER TABLE public.research_forms ADD COLUMN IF NOT EXISTS mobility_configured boolean NOT NULL DEFAULT false;
CREATE TABLE public.research_configurations (
 form_id uuid PRIMARY KEY REFERENCES public.research_forms(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), settings jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.research_configuration_history (
 form_id uuid NOT NULL REFERENCES public.research_forms(id) ON DELETE CASCADE,
 revision integer NOT NULL, settings jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(form_id,revision)
);
CREATE TABLE public.research_journeys (
 answer_id uuid PRIMARY KEY REFERENCES public.research_answers(id) ON DELETE RESTRICT,
 configuration_revision integer NOT NULL, configuration_snapshot jsonb NOT NULL,
 journey jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.research_interest_requests (
 answer_id uuid NOT NULL REFERENCES public.research_journeys(answer_id) ON DELETE RESTRICT,
 profile text NOT NULL CHECK(profile IN ('PASSAGEIRO','MOTORISTA')),
 status text NOT NULL CHECK(status IN ('INTERESSE_REGISTRADO','DISPONIBILIDADE_REGISTRADA')),
 journey jsonb NOT NULL,
 consent_accepted boolean NOT NULL CHECK(consent_accepted),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(answer_id,profile)
);
ALTER TABLE public.research_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_configuration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_interest_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_configurations,public.research_configuration_history,public.research_journeys,public.research_interest_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.research_configurations,public.research_configuration_history,public.research_journeys,public.research_interest_requests TO authenticated;
CREATE POLICY research_configuration_admin_read ON public.research_configurations FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY research_configuration_history_admin_read ON public.research_configuration_history FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY research_journey_admin_read ON public.research_journeys FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY research_interest_admin_read ON public.research_interest_requests FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.guard_research_configuration_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.mobility_configured IS DISTINCT FROM EXISTS(SELECT 1 FROM public.research_configurations WHERE form_id=NEW.id) THEN RAISE EXCEPTION 'Use a configuração institucional para alterar este estado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER research_configuration_flag BEFORE INSERT OR UPDATE OF mobility_configured ON public.research_forms FOR EACH ROW EXECUTE FUNCTION public.guard_research_configuration_flag();

CREATE FUNCTION public.validate_research_configuration(p jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; item jsonb; t text; schedule jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR pg_column_size(p)>16384 OR p->>'schemaVersion' IS DISTINCT FROM '1' THEN
  RAISE EXCEPTION 'Configuração inválida'; END IF;
 FOR k IN SELECT jsonb_object_keys(p) LOOP
  IF k NOT IN ('schemaVersion','templateKey','institutionId','institutionName','publicName','campus','region','address','latitude','longitude','campaignName','campaignType','acquisitionSource','launchDate','timezone','serviceState','days','outboundTimes','returnTimes','flexibilityMinutes','profiles','modes','usagePolicy','priceReference','institutionalContact','partnershipDescription','partnershipConfirmed','safeMeetingPoints','profileSchedules','accessPolicy','pricing') THEN RAISE EXCEPTION 'Campo de configuração não reconhecido'; END IF;
 END LOOP;
 FOR k IN SELECT unnest(ARRAY['campus','address','campaignName','acquisitionSource','priceReference','institutionalContact','partnershipDescription']) LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR length(p->>k)>1500 THEN RAISE EXCEPTION 'Texto de configuração inválido'; END IF;
 END LOOP;
 FOR k IN SELECT unnest(ARRAY['templateKey','institutionId','institutionName','publicName','region','timezone','usagePolicy']) LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR length(btrim(p->>k)) NOT BETWEEN 2 AND 1500 THEN RAISE EXCEPTION 'Confira o campo %',k; END IF;
 END LOOP;
 IF p->>'institutionId' !~ '^[A-Z0-9_-]{2,80}$'
  OR p->>'serviceState' NOT IN ('PLANEJADO','CONFIRMADO','EM_OPERACAO','ADIADO')
  OR p->>'serviceState' IS NULL
  OR p->>'campaignType' NOT IN ('INSTITUCIONAL','EVENTO','ORGANICO','OUTRO') OR p->>'campaignType' IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone')
 THEN RAISE EXCEPTION 'Identificação, campanha, situação ou fuso inválido'; END IF;
 IF p->>'launchDate' IS NOT NULL THEN
  IF p->>'launchDate' !~ '^\d{4}-\d{2}-\d{2}$' OR to_char((p->>'launchDate')::date,'YYYY-MM-DD')<>p->>'launchDate'
   THEN RAISE EXCEPTION 'Data inválida'; END IF;
 END IF;
 IF (p->>'latitude' IS NULL)<>(p->>'longitude' IS NULL) THEN RAISE EXCEPTION 'Coordenadas incompletas'; END IF;
 IF p->>'latitude' IS NOT NULL AND ((p->>'latitude')::numeric NOT BETWEEN -90 AND 90 OR (p->>'longitude')::numeric NOT BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Coordenadas inválidas'; END IF;
 IF jsonb_typeof(p->'flexibilityMinutes') IS DISTINCT FROM 'number' OR (p->>'flexibilityMinutes') !~ '^\d+$' OR (p->>'flexibilityMinutes')::int NOT BETWEEN 0 AND 120 THEN RAISE EXCEPTION 'Flexibilidade inválida'; END IF;
 FOR k IN SELECT unnest(ARRAY['days','outboundTimes','returnTimes','profiles','modes','safeMeetingPoints']) LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p->k)>48 THEN RAISE EXCEPTION 'Lista inválida: %',k; END IF;
  IF k NOT IN ('returnTimes','safeMeetingPoints') AND jsonb_array_length(p->k)=0 THEN RAISE EXCEPTION 'Lista vazia: %',k; END IF;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(p->k))<>jsonb_array_length(p->k) THEN RAISE EXCEPTION 'Itens repetidos: %',k; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->k) LOOP
   t:=item#>>'{}';
   IF k<>'days' AND jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Item inválido'; END IF;
   IF k='safeMeetingPoints' AND length(btrim(t)) NOT BETWEEN 2 AND 180 THEN RAISE EXCEPTION 'Ponto de embarque inválido'; END IF;
   IF k='days' AND (t !~ '^[1-7]$' OR jsonb_typeof(item)<>'number') THEN RAISE EXCEPTION 'Dia inválido'; END IF;
   IF k IN ('outboundTimes','returnTimes') AND t !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido'; END IF;
   IF k='profiles' AND t NOT IN ('PASSAGEIRO','MOTORISTA','AMBOS') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
   IF k='modes' AND t NOT IN ('CARONA','TRANSPORTE_PROFISSIONAL_INTERESSE') THEN RAISE EXCEPTION 'Modalidade inválida'; END IF;
  END LOOP;
 END LOOP;
 IF jsonb_typeof(p->'partnershipConfirmed') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Confirmação de parceria inválida'; END IF;
 IF coalesce(p->>'partnershipDescription','')<>'' AND p->>'partnershipConfirmed'<>'true' THEN RAISE EXCEPTION 'Parceria não confirmada'; END IF;
 IF p ? 'accessPolicy' AND coalesce(p->>'accessPolicy','') NOT IN ('PESQUISA_PUBLICA','MEMBROS_DA_INSTITUICAO','COLABORADORES_DA_EMPRESA') THEN RAISE EXCEPTION 'Política de público inválida'; END IF;
 IF p ? 'pricing' THEN
  IF jsonb_typeof(p->'pricing') IS DISTINCT FROM 'object' OR p#>>'{pricing,currency}' IS DISTINCT FROM 'BRL' THEN RAISE EXCEPTION 'Referência de preço inválida'; END IF;
  FOR k IN SELECT jsonb_object_keys(p->'pricing') LOOP IF k NOT IN ('currency','referencePerTrip','referenceSource') THEN RAISE EXCEPTION 'Campo de preço não reconhecido'; END IF; END LOOP;
  IF NOT(p->'pricing' ? 'referencePerTrip') OR jsonb_typeof(p#>'{pricing,referenceSource}') IS DISTINCT FROM 'string' OR length(p#>>'{pricing,referenceSource}')>500 THEN RAISE EXCEPTION 'Origem da referência inválida'; END IF;
  IF p#>>'{pricing,referencePerTrip}' IS NOT NULL AND (jsonb_typeof(p#>'{pricing,referencePerTrip}')<>'number' OR (p#>>'{pricing,referencePerTrip}')::numeric NOT BETWEEN 0 AND 10000 OR length(btrim(coalesce(p#>>'{pricing,referenceSource}','')))<3) THEN RAISE EXCEPTION 'Confira o valor e a origem da referência de preço'; END IF;
 END IF;
 IF p ? 'profileSchedules' THEN
  IF jsonb_typeof(p->'profileSchedules') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'profileSchedules')>3 THEN RAISE EXCEPTION 'Horários por perfil inválidos'; END IF;
  IF (SELECT count(DISTINCT value->>'profile') FROM jsonb_array_elements(p->'profileSchedules'))<>jsonb_array_length(p->'profileSchedules') THEN RAISE EXCEPTION 'Perfis de horário repetidos'; END IF;
  FOR schedule IN SELECT value FROM jsonb_array_elements(p->'profileSchedules') LOOP
   IF NOT(p->'profiles' ? coalesce(schedule->>'profile','')) THEN RAISE EXCEPTION 'Perfil não habilitado'; END IF;
   PERFORM public.validate_research_configuration((p-'profileSchedules')||schedule-'profile');
  END LOOP;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_research_configuration(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.save_research_configuration(p_form_id uuid,p_settings jsonb,p_expected_revision integer DEFAULT 0)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.research_forms WHERE id=p_form_id AND status<>'ENCERRADO' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa indisponível para configuração'; END IF;
 PERFORM public.validate_research_configuration(p_settings);
 SELECT revision INTO r FROM public.research_configurations WHERE form_id=p_form_id;
 IF coalesce(r,0)<>p_expected_revision THEN RAISE EXCEPTION 'Configuração alterada por outra pessoa. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
 r:=coalesce(r,0)+1;
 INSERT INTO public.research_configurations(form_id,revision,settings,updated_by) VALUES(p_form_id,r,p_settings,auth.uid())
 ON CONFLICT(form_id) DO UPDATE SET revision=excluded.revision,settings=excluded.settings,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.research_configuration_history(form_id,revision,settings,created_by) VALUES(p_form_id,r,p_settings,auth.uid());
 UPDATE public.research_forms SET mobility_configured=true WHERE id=p_form_id;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.save_research_configuration(uuid,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_research_configuration(uuid,jsonb,integer) TO authenticated;

CREATE FUNCTION public.create_configured_research_form(p_metadata jsonb,p_schema jsonb,p_settings jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE id uuid;
BEGIN
 id:=public.create_research_form_draft(p_metadata->>'title',p_metadata->>'code',p_metadata->>'nature',p_metadata->>'audience',p_metadata->>'municipality',p_schema);
 PERFORM public.save_research_configuration(id,p_settings,0);
 RETURN id;
END $$;
REVOKE ALL ON FUNCTION public.create_configured_research_form(jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_configured_research_form(jsonb,jsonb,jsonb) TO authenticated;

-- Re-identify draft copies, including conditional references, without altering sources.
CREATE OR REPLACE FUNCTION public.duplicate_research_form(p_form_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.research_forms%ROWTYPE; source_schema jsonb; result_schema jsonb; s jsonb;q jsonb;
 ids jsonb:='{}';sections jsonb:='[]';questions jsonb;new_id uuid;suffix text;cfg jsonb;lo numeric;hi numeric;ints boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 SELECT * INTO original FROM public.research_forms WHERE id=p_form_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
 SELECT schema_json INTO source_schema FROM public.research_form_versions WHERE form_id=p_form_id ORDER BY version_number DESC LIMIT 1;
 FOR s IN SELECT value FROM jsonb_array_elements(coalesce(source_schema->'sections','[]')) LOOP
  FOR q IN SELECT value FROM jsonb_array_elements(s->'questions') LOOP ids:=ids||jsonb_build_object(q->>'id',gen_random_uuid()::text); END LOOP;
 END LOOP;
 FOR s IN SELECT value FROM jsonb_array_elements(coalesce(source_schema->'sections','[]')) LOOP
  questions:='[]';
  FOR q IN SELECT value FROM jsonb_array_elements(s->'questions') LOOP
   IF q->>'type'='number' THEN
    lo:=0;hi:=1000000;ints:=false;
    IF lower(q->>'id') IN ('days','work_days','frequency') OR q->>'semanticCode' IN ('CAMPUS_DAYS','WORK_DAYS') THEN hi:=7;ints:=true;
    ELSIF lower(q->>'id') IN ('time','wait','wait_minutes') OR q->>'semanticCode' IN ('TRAVEL_TIME','WAIT_TIME') THEN hi:=1440;ints:=true;
    ELSIF lower(q->>'id')='cost' OR q->>'semanticCode'='COST_PER_TRIP' THEN hi:=10000;
    ELSIF lower(q->>'id')='seats' OR q->>'semanticCode'='SEATS_AVAILABLE' THEN hi:=8;ints:=true;
    ELSIF lower(q->>'id')='group' THEN lo:=1;hi:=50;ints:=true;
    ELSIF lower(q->>'id')='population' THEN hi:=100000000;ints:=true;END IF;
    q:=jsonb_build_object('minValue',lo,'maxValue',hi,'integerOnly',ints)||q;
   END IF;
   IF q ? 'showWhen' AND q->'showWhen'<>'null'::jsonb THEN q:=jsonb_set(q,'{showWhen,questionId}',ids->(q#>>'{showWhen,questionId}')); END IF;
   q:=jsonb_set(q,'{id}',ids->(q->>'id'));questions:=questions||jsonb_build_array(q);
  END LOOP;
  sections:=sections||jsonb_build_array(s||jsonb_build_object('id',gen_random_uuid(),'questions',questions));
 END LOOP;
 result_schema:=coalesce(source_schema,'{}')||jsonb_build_object('sections',sections);
 suffix:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 INSERT INTO public.research_forms(code,title,nature,audience,mobility_mode,status,municipality,is_enabled)
 VALUES(left(original.code,60)||'-C-'||suffix,left(original.title,168)||' (cópia)',original.nature,original.audience,original.mobility_mode,'RASCUNHO',original.municipality,false) RETURNING id INTO new_id;
 INSERT INTO public.research_form_versions(form_id,version_number,schema_json) VALUES(new_id,1,result_schema);
 SELECT settings INTO cfg FROM public.research_configurations WHERE form_id=p_form_id;
 IF cfg IS NOT NULL THEN
  -- A new institution must explicitly reconfirm branding and partnership authority.
  cfg:=cfg||jsonb_build_object('partnershipConfirmed',false,'partnershipDescription','','institutionalContact','','serviceState','PLANEJADO','launchDate',null);
  PERFORM public.save_research_configuration(new_id,cfg,0);
 END IF;
 RETURN new_id;
END $$;

CREATE FUNCTION public.get_public_research_configuration(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('revision',c.revision,'settings',c.settings-'institutionalContact')
 FROM public.research_configurations c JOIN public.research_forms f ON f.id=c.form_id
 WHERE lower(f.code)=lower(p_code) AND f.status='PUBLICADO' AND f.is_enabled
$$;
REVOKE ALL ON FUNCTION public.get_public_research_configuration(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_research_configuration(text) TO anon,authenticated;

-- Configured forms must use the transactional submission endpoint, not bare inserts.
DROP POLICY IF EXISTS anonymous_published_research_answer ON public.research_answers;
CREATE POLICY anonymous_published_research_answer ON public.research_answers FOR INSERT TO anon,authenticated
WITH CHECK(EXISTS(SELECT 1 FROM public.research_forms f JOIN public.research_form_versions v ON v.form_id=f.id
WHERE f.id=research_answers.form_id AND v.id=research_answers.version_id AND v.published_at IS NOT NULL AND f.status='PUBLICADO' AND f.is_enabled AND NOT f.mobility_configured));

CREATE FUNCTION public.validate_research_journey(p jsonb,c jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text;d jsonb;n numeric;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR pg_column_size(p)>8192 THEN RAISE EXCEPTION 'Trajeto inválido'; END IF;
 SELECT c||coalesce((SELECT value-'profile' FROM jsonb_array_elements(coalesce(c->'profileSchedules','[]')) WHERE value->>'profile'=p->>'profile' LIMIT 1),'{}') INTO c;
 IF p->>'direction'='VOLTA' AND jsonb_array_length(c->'returnTimes')>0 THEN c:=jsonb_set(c,'{outboundTimes}',c->'returnTimes'); END IF;
 IF NOT(c->'profiles' ? coalesce(p->>'profile','')) OR NOT(c->'modes' ? coalesce(p->>'mode',''))
  OR coalesce(p->>'direction','') NOT IN ('IDA','VOLTA','IDA_E_VOLTA') THEN RAISE EXCEPTION 'Perfil, sentido ou modalidade inválidos'; END IF;
 FOR k IN SELECT unnest(ARRAY['otherOutboundTime','otherReturnTime','marketingConsent','partnerSharingConsent']) LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Confirmação inválida: %',k; END IF;
 END LOOP;
 IF jsonb_typeof(p->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'days') NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'Escolha os dias'; END IF;
 IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(p->'days'))<>jsonb_array_length(p->'days') THEN RAISE EXCEPTION 'Dias repetidos'; END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(p->'days') LOOP
  IF NOT(c->'days' @> jsonb_build_array(d)) THEN RAISE EXCEPTION 'Dia indisponível'; END IF;
 END LOOP;
 IF coalesce(p->>'outboundTime','') !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido'; END IF;
 IF p->>'otherOutboundTime'='false' AND NOT(c->'outboundTimes' ? (p->>'outboundTime')) THEN RAISE EXCEPTION 'Horário não sugerido: escolha Outro horário'; END IF;
 IF p->>'direction'='IDA_E_VOLTA' AND coalesce(p->>'returnTime','')='' THEN RAISE EXCEPTION 'Informe o retorno'; END IF;
 IF coalesce(p->>'returnTime','')<>'' THEN
  IF p->>'returnTime' !~ '^([01]\d|2[0-3]):[0-5]\d$' OR (p->>'otherReturnTime'='false' AND NOT(c->'returnTimes' ? (p->>'returnTime'))) THEN RAISE EXCEPTION 'Horário de retorno inválido'; END IF;
 END IF;
 IF coalesce(p->>'flexibilityMinutes','') !~ '^\d+$' OR (p->>'flexibilityMinutes')::int NOT BETWEEN 0 AND (c->>'flexibilityMinutes')::int THEN RAISE EXCEPTION 'Flexibilidade inválida'; END IF;
 FOR k IN SELECT unnest(ARRAY['originArea','destinationArea']) LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR length(btrim(p->>k)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Informe a região aproximada'; END IF;
 END LOOP;
 FOR k IN SELECT unnest(ARRAY['originLat','originLng','destinationLat','destinationLng']) LOOP
  IF p->>k IS NOT NULL THEN
   IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Coordenada inválida'; END IF;
   n:=(p->>k)::numeric;
   IF n NOT BETWEEN -180 AND 180 OR (k LIKE '%Lat' AND n NOT BETWEEN -90 AND 90) THEN RAISE EXCEPTION 'Coordenada inválida'; END IF;
   p:=jsonb_set(p,ARRAY[k],to_jsonb(round(n,3)));
  END IF;
 END LOOP;
 IF (p->>'originLat' IS NULL)<>(p->>'originLng' IS NULL) OR (p->>'destinationLat' IS NULL)<>(p->>'destinationLng' IS NULL) THEN RAISE EXCEPTION 'Coordenadas incompletas'; END IF;
 -- Whitelist private payload fields: no arbitrary contact/address fields.
 SELECT jsonb_object_agg(key,value) INTO p FROM jsonb_each(p) WHERE key=ANY(ARRAY[
  'profile','mode','direction','days','outboundTime','returnTime','otherOutboundTime','otherReturnTime','flexibilityMinutes',
  'originArea','originLat','originLng','destinationArea','destinationLat','destinationLng','marketingConsent','partnerSharingConsent']);
 RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.validate_research_journey(jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.submit_configured_research_answer(p_form_id uuid,p_version_id uuid,p_submission_key uuid,p_answers jsonb,p_revision integer,p_journey jsonb,p_research_consent boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.research_configurations%ROWTYPE;a public.research_answers%ROWTYPE;j jsonb;existing public.research_journeys%ROWTYPE;
BEGIN
 IF p_research_consent IS DISTINCT FROM true OR p_submission_key IS NULL THEN RAISE EXCEPTION 'Consentimento obrigatório'; END IF;
 -- Lock the form first, in the same order as configuration, publication and removal.
 PERFORM 1 FROM public.research_forms WHERE id=p_form_id FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_form_id::text||p_submission_key::text,0));
 SELECT * INTO a FROM public.research_answers WHERE form_id=p_form_id AND client_submission_key=p_submission_key;
 IF FOUND THEN
  SELECT * INTO existing FROM public.research_journeys WHERE answer_id=a.id;
  IF NOT FOUND OR a.version_id<>p_version_id OR a.answers<>p_answers OR existing.configuration_revision<>p_revision
   OR existing.journey IS DISTINCT FROM public.validate_research_journey(p_journey,existing.configuration_snapshot)
  THEN RAISE EXCEPTION 'Recibo já utilizado para outra resposta' USING ERRCODE='23505'; END IF;
  RETURN true;
 END IF;
 SELECT * INTO c FROM public.research_configurations WHERE form_id=p_form_id FOR SHARE;
 IF NOT FOUND OR c.revision<>p_revision THEN RAISE EXCEPTION 'Configuração atualizada. Recarregue a pesquisa antes de enviar.' USING ERRCODE='40001'; END IF;
 j:=public.validate_research_journey(p_journey,c.settings);
 -- Existing triggers enforce enabled publication, version ownership and all 16 question types.
 INSERT INTO public.research_answers(form_id,version_id,client_submission_key,answers,consent_accepted)
 VALUES(p_form_id,p_version_id,p_submission_key,p_answers,true) RETURNING * INTO a;
 INSERT INTO public.research_journeys(answer_id,configuration_revision,configuration_snapshot,journey)
 VALUES(a.id,c.revision,c.settings,j);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.submit_configured_research_answer(uuid,uuid,uuid,jsonb,integer,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_configured_research_answer(uuid,uuid,uuid,jsonb,integer,jsonb,boolean) TO anon,authenticated;

CREATE FUNCTION public.register_research_interest(p_form_id uuid,p_submission_key uuid,p_profile text,p_consent boolean,p_journey jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid;j jsonb;s text;c jsonb;candidate jsonb;previous jsonb;original_schedule jsonb;
BEGIN
 IF p_consent IS DISTINCT FROM true OR p_profile IS NULL OR p_profile NOT IN ('PASSAGEIRO','MOTORISTA') THEN RAISE EXCEPTION 'Confirme separadamente o interesse neste perfil'; END IF;
 PERFORM 1 FROM public.research_forms WHERE id=p_form_id AND status='PUBLICADO' AND is_enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa indisponível para novos interesses' USING ERRCODE='42501'; END IF;
 SELECT ra.id,rj.journey,rj.configuration_snapshot INTO a,j,c FROM public.research_answers ra JOIN public.research_journeys rj ON rj.answer_id=ra.id
 WHERE ra.form_id=p_form_id AND ra.client_submission_key=p_submission_key AND ra.submitted_at>now()-interval '90 days' FOR UPDATE OF rj;
 IF NOT FOUND OR j->>'mode'<>'CARONA' OR j->>'profile' NOT IN (p_profile,'AMBOS') THEN RAISE EXCEPTION 'Recibo ou perfil indisponível' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'profileSchedules') x WHERE x->>'profile'=p_profile) THEN
  SELECT x INTO original_schedule FROM jsonb_array_elements(c->'profileSchedules') x WHERE x->>'profile'=j->>'profile';
  IF original_schedule IS NOT NULL THEN
   c:=jsonb_set(c,'{profileSchedules}',(c->'profileSchedules')||jsonb_build_array(original_schedule||jsonb_build_object('profile',p_profile)));
  END IF;
 END IF;
 c:=jsonb_set(c,'{profiles}',jsonb_build_array(p_profile));
 candidate:=public.validate_research_journey(coalesce(p_journey,j)||jsonb_build_object('profile',p_profile,'marketingConsent',j->'marketingConsent','partnerSharingConsent',j->'partnerSharingConsent'),c);
 IF candidate->>'mode'<>'CARONA' THEN RAISE EXCEPTION 'Modalidade profissional não habilitada para carona' USING ERRCODE='42501'; END IF;
 SELECT journey INTO previous FROM public.research_interest_requests WHERE answer_id=a AND profile=p_profile;
 IF FOUND AND previous IS DISTINCT FROM candidate THEN RAISE EXCEPTION 'Interesse já registrado com outro trajeto' USING ERRCODE='40001'; END IF;
 s:=CASE WHEN p_profile='MOTORISTA' THEN 'DISPONIBILIDADE_REGISTRADA' ELSE 'INTERESSE_REGISTRADO' END;
 INSERT INTO public.research_interest_requests(answer_id,profile,status,consent_accepted,journey) VALUES(a,p_profile,s,true,candidate) ON CONFLICT DO NOTHING;
 RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.register_research_interest(uuid,uuid,text,boolean,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_research_interest(uuid,uuid,text,boolean,jsonb) TO anon,authenticated;

-- New configured cohorts only. No STS, navigation events, receipts or exact locations.
CREATE FUNCTION public.get_configured_research_summary(p_filters jsonb DEFAULT '{}')
RETURNS TABLE(version_id uuid,version_number integer,semantic_code text,category text,eligible bigint,answered bigint,total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH base AS (
  SELECT a.id,a.version_id,a.answers,v.schema_json,j.journey,j.configuration_snapshot AS c
  FROM public.research_answers a JOIN public.research_journeys j ON j.answer_id=a.id
  JOIN public.research_form_versions v ON v.id=a.version_id AND v.form_id=a.form_id
  WHERE (p_filters->>'formId' IS NULL OR a.form_id=(p_filters->>'formId')::uuid)
   AND (p_filters->>'versionId' IS NULL OR a.version_id=(p_filters->>'versionId')::uuid)
   AND (p_filters->>'periodStart' IS NULL OR a.submitted_at>=(p_filters->>'periodStart')::timestamptz)
   AND (p_filters->>'periodEnd' IS NULL OR a.submitted_at<(p_filters->>'periodEnd')::timestamptz)
   AND NOT EXISTS(SELECT 1 FROM jsonb_each_text(p_filters) f WHERE
    (f.key IN ('institutionId','campus','campaignType','templateKey','region','acquisitionSource') AND j.configuration_snapshot->>f.key IS DISTINCT FROM f.value)
    OR (f.key IN ('profile','mode') AND j.journey->>f.key IS DISTINCT FROM f.value)
    OR (f.key='time' AND j.journey->>'outboundTime' IS DISTINCT FROM f.value))
 ), questions AS (
  SELECT b.id,b.version_id,b.answers,q.value AS q FROM base b
  CROSS JOIN LATERAL jsonb_array_elements(b.schema_json->'sections') s
  CROSS JOIN LATERAL jsonb_array_elements(s->'questions') q
  WHERE q.value->>'type' IN ('single_choice','multiple_choice','yes_no','rating_1_5','rating_0_10','rating_stars','money_range','number','time')
   AND q.value->>'semanticCode' IN ('TRANSPORT_MODE','COST_PER_TRIP','TRAVEL_TIME','MOBILITY_PAINS','PERCEIVED_SAFETY','ADOPTION_INTENT','TRUST_FACTORS',
    'RIDE_OFFER_INTENT','BOOKING_INTENT','MOBILITY_MODE','NORMALIZED_DEPARTURE_TIME','TRAVEL_FREQUENCY','ACCEPTABLE_FARE_RANGE','WILLINGNESS_TO_PAY','QUOTE_ACCEPTANCE_INTENT','ACQUISITION_SOURCE','LAUNCH_PARTICIPATION_INTENT')
   AND (q.value->'showWhen' IS NULL OR q.value->'showWhen'='null'::jsonb OR b.answers->>(q.value#>>'{showWhen,questionId}')=q.value#>>'{showWhen,equals}')
 ), denominators AS (
  SELECT q.version_id,q.q->>'semanticCode' AS code,count(DISTINCT q.id) AS eligible,
   count(DISTINCT q.id) FILTER(WHERE q.answers ? (q.q->>'id') AND q.answers->(q.q->>'id') NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb)) AS answered
  FROM questions q GROUP BY q.version_id,q.q->>'semanticCode'
 ), values_flat AS (
  SELECT q.version_id,q.q->>'semanticCode' AS code,val.value AS category,count(DISTINCT q.id) AS total FROM questions q
  CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(q.answers->(q.q->>'id'))='array' THEN q.answers->(q.q->>'id') ELSE jsonb_build_array(q.answers->(q.q->>'id')) END) val
  WHERE val.value IS NOT NULL AND val.value<>'' GROUP BY q.version_id,q.q->>'semanticCode',val.value
 )
 , journey_values AS (
  SELECT b.version_id,x.code,x.category,count(DISTINCT b.id) AS total FROM base b
  CROSS JOIN LATERAL (VALUES('JOURNEY_PROFILE',b.journey->>'profile'),('JOURNEY_MODE',b.journey->>'mode'),('JOURNEY_DEPARTURE_TIME',b.journey->>'outboundTime')) x(code,category)
  GROUP BY b.version_id,x.code,x.category
 ), interests AS (
  SELECT b.version_id,CASE WHEN i.profile='PASSAGEIRO' THEN 'PASSENGER_INTEREST_REGISTERED' ELSE 'DRIVER_AVAILABILITY_REGISTERED' END AS code,
   i.status AS category,count(DISTINCT b.id) AS total FROM base b JOIN public.research_interest_requests i ON i.answer_id=b.id GROUP BY b.version_id,i.profile,i.status
 ), combined AS (
  SELECT d.version_id,d.code,v.category,d.eligible,d.answered,coalesce(v.total,0) AS total FROM denominators d LEFT JOIN values_flat v ON v.version_id=d.version_id AND v.code=d.code
  UNION ALL
  SELECT x.version_id,x.code,x.category,(SELECT count(*) FROM base b WHERE b.version_id=x.version_id),
   (SELECT count(*) FROM base b WHERE b.version_id=x.version_id),x.total FROM journey_values x
  UNION ALL
  SELECT i.version_id,i.code,i.category,(SELECT count(*) FROM base b WHERE b.version_id=i.version_id AND b.journey->>'profile' IN (CASE WHEN i.code='PASSENGER_INTEREST_REGISTERED' THEN 'PASSAGEIRO' ELSE 'MOTORISTA' END,'AMBOS')),
   i.total,i.total FROM interests i
 )
 SELECT c.version_id,v.version_number,c.code,c.category,c.eligible,c.answered,c.total FROM combined c JOIN public.research_form_versions v ON v.id=c.version_id;
END $$;
REVOKE ALL ON FUNCTION public.get_configured_research_summary(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_configured_research_summary(jsonb) TO authenticated;

-- Enforce the new semantic meanings at publication, not only in the editor.
CREATE FUNCTION public.validate_research_semantic_publication()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q jsonb;expected text;types jsonb:='{"RIDE_OFFER_INTENT":"yes_no","BOOKING_INTENT":"yes_no","MOBILITY_MODE":"single_choice","NORMALIZED_DEPARTURE_TIME":"time","TRAVEL_FREQUENCY":"single_choice","ACCEPTABLE_FARE_RANGE":"money_range","WILLINGNESS_TO_PAY":"yes_no","QUOTE_ACCEPTANCE_INTENT":"yes_no","ACQUISITION_SOURCE":"single_choice","LAUNCH_PARTICIPATION_INTENT":"yes_no"}';
BEGIN
 IF NEW.published_at IS NULL THEN RETURN NEW; END IF;
 FOR q IN SELECT fields.question FROM jsonb_array_elements(NEW.schema_json->'sections') AS sections(section) CROSS JOIN LATERAL jsonb_array_elements(sections.section->'questions') AS fields(question) LOOP
  expected:=types->>(q->>'semanticCode');
  IF expected IS NOT NULL AND expected IS DISTINCT FROM q->>'type' THEN RAISE EXCEPTION 'Classificação analítica incompatível com o tipo da pergunta'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.research_configurations WHERE form_id=NEW.form_id) AND EXISTS(
  SELECT fields.question->>'semanticCode' FROM jsonb_array_elements(NEW.schema_json->'sections') AS sections(section) CROSS JOIN LATERAL jsonb_array_elements(sections.section->'questions') AS fields(question)
  WHERE coalesce(fields.question->>'semanticCode','')<>'' GROUP BY fields.question->>'semanticCode' HAVING count(*)>1
 ) THEN RAISE EXCEPTION 'Classificação analítica repetida nesta versão'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER research_semantic_publication BEFORE INSERT OR UPDATE ON public.research_form_versions
FOR EACH ROW EXECUTE FUNCTION public.validate_research_semantic_publication();

-- Keep the established answer-summary contract, without returning personal text.
CREATE OR REPLACE FUNCTION public.get_research_answer_summary(p_form_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH base AS (
 SELECT a.version_id,a.answers,v.schema_json FROM public.research_answers a
 JOIN public.research_form_versions v ON v.id=a.version_id AND v.form_id=a.form_id
 WHERE a.form_id=p_form_id AND public.has_role(auth.uid(),'admin')
), fields AS (
 SELECT b.version_id,q->>'id' AS question_id,b.answers->(q->>'id') AS response FROM base b
 CROSS JOIN LATERAL jsonb_array_elements(b.schema_json->'sections') s
 CROSS JOIN LATERAL jsonb_array_elements(s->'questions') q
 WHERE q->>'type' IN ('single_choice','multiple_choice','yes_no','rating_1_5','rating_0_10','rating_stars','money_range','ranking','matrix','number','time')
), values_flat AS (
 SELECT f.version_id,f.question_id,val.value AS answer FROM fields f CROSS JOIN LATERAL
 jsonb_array_elements_text(CASE WHEN jsonb_typeof(f.response)='array' THEN f.response ELSE jsonb_build_array(f.response) END) val
 WHERE val.value IS NOT NULL AND val.value<>''
), distribution AS (
 SELECT version_id,question_id,answer,count(*) AS quantity FROM values_flat GROUP BY version_id,question_id,answer
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM base),
 'versions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',version_id,'total',qty)),'[]'::jsonb) FROM (SELECT version_id,count(*) AS qty FROM base GROUP BY version_id) v),
 'distributions',coalesce((SELECT jsonb_agg(jsonb_build_object('versionId',version_id,'questionId',question_id,'answer',answer,'count',quantity)) FROM distribution),'[]'::jsonb))
$$;

NOTIFY pgrst,'reload schema';
