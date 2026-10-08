\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_sts(v boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END;
$$;
CREATE FUNCTION pg_temp.sts_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected in SQLERRM) = 0 THEN RAISE EXCEPTION 'Unexpected: %', SQLERRM; END IF;
    RAISE NOTICE 'PASS: rejected %', expected; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: expected %', expected;
END;
$$;
INSERT INTO auth.users(email) VALUES ('sts-passenger@test.local') RETURNING id AS passenger \gset
INSERT INTO auth.users(email) VALUES ('sts-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES ('sts-other@test.local') RETURNING id AS outsider \gset
INSERT INTO public.form_submissions(user_id,source,campaign_event,tipo_usuario,origem_trajeto,destino_trajeto,nome,whatsapp,intencao_passageiro)
VALUES (:'passenger','sts-2026','Siará Tech Summit 2026','PASSAGEIRO','CEC','Aldeota','Passageiro','85999999999','HOJE') RETURNING submission_id AS form \gset
INSERT INTO public.form_submissions(user_id,source,campaign_event,tipo_usuario,origem_trajeto,destino_trajeto,nome,whatsapp,intencao_motorista)
VALUES (:'driver','sts-2026','Siará Tech Summit 2026','MOTORISTA','UNIFOR','Meireles','Motorista','85999999998','HOJE') RETURNING submission_id AS driver_form \gset
INSERT INTO public.form_submission_account_links(submission_id,user_id,confirmed_at) VALUES(:'form',:'passenger',now()),(:'driver_form',:'driver',now());
SELECT set_config('request.jwt.claim.sub', :'outsider',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_sts(public.get_sts_ride_seed() IS NULL,'unlinked account cannot obtain another form');
SELECT pg_temp.sts_error(format('SELECT public.publish_sts_ride(%L,%L,%L)',:'form','request','{}'),'Form not linked');
SELECT set_config('request.jwt.claim.sub', :'passenger',true);
SELECT pg_temp.assert_sts(public.get_sts_ride_seed()->>'submissionId' = :'form','linked account recovers form');
SELECT pg_temp.sts_error(format('SELECT public.publish_sts_ride(%L,%L,%L)',:'form','request','{}'),'Incomplete publication');
SELECT pg_temp.sts_error(format('SELECT public.publish_sts_ride(%L,%L,%L)',:'form','request','{"origin":"CEC","destination":"Aldeota","rideDate":"2025-10-08","departureTime":"20:00","count":1,"price":10}'),'Expired STS');
SELECT pg_temp.sts_error(format('SELECT public.publish_sts_ride(%L,%L,%L)',:'form','wrong-role','{}'),'Invalid travel role');
-- Test publication independently of the date on which this suite is run.
-- The fixed STS window makes active publication deliberately impossible after October 9.
DO $$ BEGIN
  IF clock_timestamp() >= '2026-10-09T21:30:00-03:00'::timestamptz THEN
    RAISE NOTICE 'Historical STS window: future-publication checks skipped';
  ELSE
    PERFORM public.publish_sts_ride((public.get_sts_ride_seed()->>'submissionId')::uuid,'request',
      '{"origin":"CEC","destination":"Aldeota","rideDate":"2026-10-09","departureTime":"21:30","count":1,"price":10}');
    PERFORM public.publish_sts_ride((public.get_sts_ride_seed()->>'submissionId')::uuid,'request',
      '{"origin":"CEC","destination":"Aldeota","rideDate":"2026-10-09","departureTime":"21:30","count":1,"price":10}');
    PERFORM pg_temp.assert_sts((SELECT count(*) FROM public.form_ride_publications WHERE user_id=auth.uid())=1,'repeat login/publication is idempotent');
    PERFORM pg_temp.assert_sts((SELECT count(*) FROM public.ride_requests WHERE user_id=auth.uid())=1,'only one passenger request exists');
    PERFORM pg_temp.sts_error(format('SELECT public.publish_sts_ride(%L,%L,%L)',(public.get_sts_ride_seed()->>'submissionId'),'offer',
      '{"origin":"CEC","destination":"Aldeota","rideDate":"2026-10-09","departureTime":"21:30","count":2,"price":20,"audience":"ANY"}'),'already have an active');
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', :'driver',true);
DO $$ BEGIN
  IF clock_timestamp() < '2026-10-09T21:30:00-03:00'::timestamptz THEN
    PERFORM public.publish_sts_ride((public.get_sts_ride_seed()->>'submissionId')::uuid,'offer',
      '{"origin":"UNIFOR","destination":"Meireles","rideDate":"2026-10-09","departureTime":"21:30","count":2,"price":20,"audience":"ANY"}');
    PERFORM pg_temp.assert_sts((SELECT count(*) FROM public.ride_offers WHERE user_id=auth.uid())=1,'driver offer created through real matching RPC');
  END IF;
END $$;
RESET ROLE;
UPDATE public.ride_requests SET status='cancelled' WHERE user_id=:'passenger';
UPDATE public.ride_offers SET status='cancelled' WHERE user_id=:'driver';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'passenger',true);
DO $$ BEGIN
  IF clock_timestamp() < '2026-10-09T21:30:00-03:00'::timestamptz THEN
    PERFORM public.publish_sts_ride((public.get_sts_ride_seed()->>'submissionId')::uuid,'offer',
      '{"origin":"CEC","destination":"Aldeota","rideDate":"2026-10-09","departureTime":"21:30","count":2,"price":20,"audience":"ANY"}');
    PERFORM pg_temp.assert_sts((SELECT count(*) FROM public.form_ride_publications WHERE user_id=auth.uid())=2,'passenger can subsequently offer without permanent role');
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', :'driver',true);
DO $$ BEGIN
  IF clock_timestamp() < '2026-10-09T21:30:00-03:00'::timestamptz THEN
    PERFORM public.publish_sts_ride((public.get_sts_ride_seed()->>'submissionId')::uuid,'request',
      '{"origin":"UNIFOR","destination":"Meireles","rideDate":"2026-10-09","departureTime":"21:30","count":1,"price":10}');
    PERFORM pg_temp.assert_sts((SELECT count(*) FROM public.form_ride_publications WHERE user_id=auth.uid())=2,'driver can subsequently request without permanent role');
  END IF;
END $$;
RESET ROLE;
-- Cancellation invalidates the form itself, not just the client draft.
UPDATE public.form_submissions SET raw_payload = raw_payload || '{"cancelled":true}' WHERE submission_id=:'driver_form';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_sts(public.get_sts_ride_seed() IS NULL,'cancelled form is not activated');
SELECT pg_temp.sts_error(format('SELECT public.publish_sts_ride(%L,%L,%L)',:'driver_form','offer','{}'),'Invalid form');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.sts_error('SELECT public.get_sts_ride_seed()','Authentication required');
RESET ROLE;
ROLLBACK;
