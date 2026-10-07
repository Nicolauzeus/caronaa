\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE role_name text; submission uuid; session_id text := gen_random_uuid()::text; response uuid; request jsonb; points jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('codigo_dor','DOR_0'||i,'selecionada',false,'principal',false,'intensidade',null)) INTO points FROM generate_series(1,6) i;
  FOREACH role_name IN ARRAY ARRAY['PASSAGEIRO','MOTORISTA','AMBOS'] LOOP
    submission := gen_random_uuid();
    request := jsonb_build_object('submissionId',submission,'source','sts-2026','campaignEvent','STS','intent',role_name,
      'occupation','ESTUDANTE','originNeighborhood','Aldeota','destinationNeighborhood','UNIFOR','departureWindow','19_20',
      'name','Participante','whatsapp','85999999999','passengerInterest',CASE WHEN role_name <> 'MOTORISTA' THEN 'HOJE' END,
      'driverInterest',CASE WHEN role_name <> 'PASSAGEIRO' THEN 'HOJE' END,
      'passengerTrustFactors',jsonb_build_array('MESMO_GENERO'),'driverTrustFactors',jsonb_build_array('MESMO_GENERO'),'driverComfortFactors',jsonb_build_array('MESMO_GENERO'));
    response := public.submit_form_response(request,points,session_id);
    IF response <> submission THEN RAISE EXCEPTION 'UUID changed during insert'; END IF;
    RAISE NOTICE 'PASS: % UUID preserved on submission',role_name;
    IF NOT EXISTS (SELECT 1 FROM public.form_submissions WHERE submission_id=submission AND raw_payload->'passengerTrustFactors' ? 'MESMO_GENERO' AND raw_payload->'driverTrustFactors' ? 'MESMO_GENERO') THEN RAISE EXCEPTION 'Trust factors lost'; END IF;
    RAISE NOTICE 'PASS: % MESMO_GENERO persisted in JSON without enum migration',role_name;
    IF (SELECT count(*) FROM public.form_submission_pain_points WHERE submission_id=submission) <> 6 THEN RAISE EXCEPTION 'Pain relations incorrect'; END IF;
    RAISE NOTICE 'PASS: % pain rows share submission UUID',role_name;
    IF (SELECT count(*) FROM public.funnel_events WHERE submission_id=submission AND trusted_source AND event_name IN ('form_completed','lead_created')) <> 2 THEN RAISE EXCEPTION 'Outcome relations incorrect'; END IF;
    RAISE NOTICE 'PASS: % completion and lead share submission UUID',role_name;
    response := public.submit_form_response(request,points,session_id);
    IF response <> submission OR (SELECT count(*) FROM public.funnel_events WHERE submission_id=submission AND trusted_source) <> 2 THEN RAISE EXCEPTION 'Retry duplicated submission outcomes'; END IF;
    RAISE NOTICE 'PASS: % retry is idempotent',role_name;
  END LOOP;
END;
$$;
ROLLBACK;
