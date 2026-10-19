-- 0097: Include regional campus research fields in institutional market intelligence.
-- Additive aggregate contract: preserves denominators, anonymous responses and permissions.
-- Does not create reservations, authorize transport professionals or rewrite existing answers.
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
    (f.key IN ('institutionId','campus','campaignType','templateKey','region','acquisitionSource') AND j.configuration_snapshot->>f.key IS DISTINCT FROM f.value)
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
    'REGIONAL_OFFER_VEHICLE','REGIONAL_PROFESSIONAL_ROLE','REGIONAL_PROFESSIONAL_INTEREST')
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
 SELECT 97;
$$;
REVOKE ALL ON FUNCTION public.get_research_schema_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_research_schema_version() TO authenticated;
