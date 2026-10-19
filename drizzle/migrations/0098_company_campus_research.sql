-- 0098: Company employees near campus — explicit adjacent institution and grouped BI.
-- Prerequisites: 0095 and 0097 (regional BI). Follow previous migration order.
-- No historical answers are rewritten; no new public access or employment attestation.
CREATE OR REPLACE FUNCTION public.validate_research_configuration(p jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; item jsonb; t text; schedule jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR pg_column_size(p)>16384 OR p->>'schemaVersion' IS DISTINCT FROM '1' THEN
  RAISE EXCEPTION 'Configuração inválida'; END IF;
 FOR k IN SELECT jsonb_object_keys(p) LOOP
  IF k NOT IN ('schemaVersion','templateKey','institutionId','institutionName','publicName','campus','nearbyUniversity','region','address','latitude','longitude','campaignName','campaignType','acquisitionSource','launchDate','timezone','serviceState','days','outboundTimes','returnTimes','flexibilityMinutes','profiles','modes','usagePolicy','priceReference','institutionalContact','partnershipDescription','partnershipConfirmed','safeMeetingPoints','profileSchedules','accessPolicy','pricing') THEN RAISE EXCEPTION 'Campo de configuração não reconhecido'; END IF;
 END LOOP;
 FOR k IN SELECT unnest(ARRAY['campus','address','campaignName','acquisitionSource','priceReference','institutionalContact','partnershipDescription']) LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' OR length(p->>k)>1500 THEN RAISE EXCEPTION 'Texto de configuração inválido'; END IF;
 END LOOP;
 IF p ? 'nearbyUniversity' THEN
  IF jsonb_typeof(p->'nearbyUniversity') IS DISTINCT FROM 'string'
    OR length(p->>'nearbyUniversity')>180
  THEN RAISE EXCEPTION 'Instituição de ensino próxima inválida'; END IF;
 END IF;
 IF p->>'templateKey'='EMPRESA_CARONA_CAMPUS' THEN
  IF length(btrim(coalesce(p->>'nearbyUniversity',''))) NOT BETWEEN 2 AND 180
    OR length(btrim(coalesce(p->>'campus','')))<2
    OR length(btrim(coalesce(p->>'address','')))<5
  THEN RAISE EXCEPTION 'Informe a empresa, a unidade, o endereço e a universidade próxima'; END IF;
 END IF;
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

CREATE OR REPLACE FUNCTION public.get_configured_research_summary(p_filters jsonb DEFAULT '{}')
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
    (f.key IN ('institutionId','campus','campaignType','templateKey','region','acquisitionSource','nearbyUniversity') AND j.configuration_snapshot->>f.key IS DISTINCT FROM f.value)
    OR (f.key IN ('profile','mode') AND j.journey->>f.key IS DISTINCT FROM f.value)
    OR (f.key='time' AND j.journey->>'outboundTime' IS DISTINCT FROM f.value))
 ), questions AS (
  SELECT b.id,b.version_id,b.answers,q.value AS q FROM base b
  CROSS JOIN LATERAL jsonb_array_elements(b.schema_json->'sections') s
  CROSS JOIN LATERAL jsonb_array_elements(s->'questions') q
  WHERE q.value->>'type' IN ('single_choice','multiple_choice','yes_no','rating_1_5','rating_0_10','rating_stars','money_range','number','time')
   AND q.value->>'semanticCode' IN ('TRANSPORT_MODE','COST_PER_TRIP','TRAVEL_TIME','WAIT_TIME','ACADEMIC_ROLE','SEATS_AVAILABLE','MOBILITY_PAINS','PERCEIVED_SAFETY','ADOPTION_INTENT','TRUST_FACTORS',
    'RIDE_OFFER_INTENT','BOOKING_INTENT','MOBILITY_MODE','NORMALIZED_DEPARTURE_TIME','TRAVEL_FREQUENCY','ACCEPTABLE_FARE_RANGE','WILLINGNESS_TO_PAY','QUOTE_ACCEPTANCE_INTENT','ACQUISITION_SOURCE','LAUNCH_PARTICIPATION_INTENT',
    'REGIONAL_SERVICE_PREFERENCE','REGIONAL_PRIMARY_PAIN','REGIONAL_BARRIER','REGIONAL_OFFER_POSSIBLE',
    'REGIONAL_OFFER_VEHICLE','REGIONAL_PROFESSIONAL_ROLE','REGIONAL_PROFESSIONAL_INTEREST',
    'COMPANY_DRIVES_CAR','COMPANY_DRIVING_FREQUENCY','COMPANY_MAX_DETOUR')
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



NOTIFY pgrst, 'reload schema';

-- Schema readiness probe for the admin catalog; no personal data is returned.
CREATE OR REPLACE FUNCTION public.get_research_schema_version()
RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT 98;
$$;
REVOKE ALL ON FUNCTION public.get_research_schema_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_research_schema_version() TO authenticated;
