\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF;
    RAISE NOTICE 'PASS: rejected %',expected; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: expected %',expected;
END $$;
INSERT INTO auth.users(email) VALUES('intelligent-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES('intelligent-passenger@test.local') RETURNING id AS passenger \gset
INSERT INTO auth.users(email) VALUES('intelligent-outsider@test.local') RETURNING id AS outsider \gset

-- A bent road; its middle point is >2km from the straight A->C chord.
INSERT INTO public.ride_offers(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,
  ride_date,departure_time,available_seats,seats_remaining)
VALUES(:'driver','A','C',-3.7,-38.5,-3.6,-38.4,current_date+2,'07:00',3,3) RETURNING offer_id AS offer \gset
-- Legacy rows can receive geometry only via the trusted quote on publication.
-- The pure evaluator is exercised with a row value, without modifying stored geometry.
CREATE TEMP TABLE fixture AS SELECT o.*,jsonb_build_object('user_id',:'passenger','origin','B','destination','C',
  'origin_lat',-3.7,'origin_lng',-38.4,'destination_lat',-3.6,'destination_lng',-38.4,
  'ride_date',current_date+2,'departure_time','07:45','passenger_count',1,'time_tolerance_minutes',5,
  'travel_preferences','{}'::jsonb) q FROM public.ride_offers o WHERE offer_id=:'offer';
CREATE FUNCTION pg_temp.offer_value() RETURNS public.ride_offers LANGUAGE sql AS $$
  SELECT jsonb_populate_record(NULL::public.ride_offers,to_jsonb(f)-'q'||jsonb_build_object(
    'route_path',jsonb_build_array(jsonb_build_object('lat',-3.7,'lng',-38.5),jsonb_build_object('lat',-3.7,'lng',-38.4),jsonb_build_object('lat',-3.6,'lng',-38.4)),
    'route_duration_minutes',90)) FROM fixture f
$$;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q,pg_temp.offer_value())->>'classification'='compatible',
  'pickup ETA makes 07h departure compatible with 07h45 intermediate boarding on bent road') FROM fixture;
SELECT pg_temp.assert_true((public.evaluate_ride_candidate(q,pg_temp.offer_value())->>'score')::integer>=90,
  'intermediate on-route segment is not penalized for distance from endpoints') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||'{"origin_lat":-3.6,"destination_lat":-3.7}',pg_temp.offer_value()) IS NULL,
  'reverse segment rejected') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||jsonb_build_object('departure_time',(((public.evaluate_ride_candidate(q,pg_temp.offer_value())->>'pickupAt')::timestamptz+interval '60 minutes') AT TIME ZONE 'America/Fortaleza')::time),pg_temp.offer_value())->>'classification'='opportunity',
  'exact 60 minute pickup difference is an opportunity') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||jsonb_build_object('departure_time',(((public.evaluate_ride_candidate(q,pg_temp.offer_value())->>'pickupAt')::timestamptz+interval '60 minutes 2 seconds') AT TIME ZONE 'America/Fortaleza')::time),pg_temp.offer_value()) IS NULL,
  'over one hour excluded without rounding into allowed window') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||'{"departure_time":"08:05"}',pg_temp.offer_value())->>'classification'='approximate',
  '20 minute difference outside declared tolerance is approximate') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||'{"passenger_count":4}',pg_temp.offer_value()) IS NULL,
  'insufficient capacity rejected') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||jsonb_build_object('user_id',:'driver'),pg_temp.offer_value()) IS NULL,
  'self match rejected') FROM fixture;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(q||'{"travel_preferences":{"pets":"yes"}}',pg_temp.offer_value()) IS NULL,
  'mandatory preferences cannot be relaxed by opportunity discovery') FROM fixture;

-- Same endpoints permit testing real discovery, explicit consent and allocation.
INSERT INTO public.offer_route_quotes(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,
 distance_km,passenger_price,tariff_reference)
VALUES(:'passenger','A','C',-3.7,-38.5,-3.6,-38.4,22,12,'caronaa-km-6-per-11-v1') RETURNING quote_id AS quote \gset
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(jsonb_array_length(public.discover_ride_opportunities(jsonb_build_object(
 'origin','A','destination','C','origin_lat',-3.7,'origin_lng',-38.5,'destination_lat',-3.6,'destination_lng',-38.4,
 'ride_date',current_date+2,'departure_time','07:40','time_tolerance_minutes',5)))=1,'discover opportunity outside both tolerances');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_matches)=0,'discovery creates no matches');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.search_available_ride_offers('A','C',current_date+2,'07:40',1,30,5,-3.7,-38.5,-3.6,-38.4))=0,
 'legacy discovery remains strict');
SELECT pg_temp.expect_error(format('SELECT public.request_intelligent_ride_segment(%L,%L,%L,%L,1,5,false,NULL)',
 :'offer',:'quote',current_date+2,'07:40'),'Confirme explicitamente');
SELECT pg_temp.expect_error(format('SELECT public.request_intelligent_ride_segment(%L,%L,%L,%L,1,5,true,%L)',
 :'offer',:'quote',current_date+2,'07:40',(current_date+2+'07:05'::time) AT TIME ZONE 'America/Fortaleza'),'horário de embarque mudou');
SELECT pg_temp.expect_error(format('SELECT public.request_intelligent_ride_segment(%L,%L,%L,%L,1,5,true,%L)',
 :'offer',:'quote',current_date+2,'07:40',(current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza'),'Recalcule o trajeto');
SELECT pg_temp.expect_error('INSERT INTO public.ride_road_assessments(user_id,offer_id,quote_id,inventory_version,added_duration_minutes) VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),''fake'',0)','permission denied');
RESET ROLE;
INSERT INTO public.ride_road_assessments(user_id,offer_id,quote_id,inventory_version,added_duration_minutes)
 VALUES(:'passenger',:'offer',:'quote',public.ride_route_inventory_version(:'offer'),0);
SET LOCAL ROLE authenticated;
SELECT public.request_intelligent_ride_segment(:'offer',:'quote',current_date+2,'07:40',1,5,true,
 (current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza') AS request \gset
SELECT pg_temp.assert_true((SELECT departure_time='07:00' AND original_requested_at=(current_date+2+'07:40'::time) AT TIME ZONE 'America/Fortaleza'
 FROM public.ride_requests WHERE request_id=:'request'),'explicit adjustment preserves original passenger time');
SELECT pg_temp.assert_true(public.request_intelligent_ride_segment(:'offer',:'quote',current_date+2,'07:40',1,5,true,
 (current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza')=:'request'::uuid,'explicit request retry is idempotent');
SELECT ride_id AS ride FROM public.rides WHERE request_id=:'request' \gset
SELECT pg_temp.assert_true((SELECT passenger_accepted_at IS NULL AND driver_accepted_at IS NULL AND status='MATCHED'
 AND response_expires_at<=clock_timestamp()+interval '15 minutes' AND pickup_estimated_at IS NOT NULL
 FROM public.rides WHERE ride_id=:'ride'),'proposal has bounded reservation and no implicit acceptance');
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride','ACCEPT')='AWAITING_OTHER_PARTICIPANT','passenger accepts first');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride','ACCEPT')='CONFIRMED','driver explicitly accepts');
SELECT set_config('request.jwt.claim.sub',:'outsider',true);
SELECT pg_temp.expect_error(format('SELECT public.get_my_ride_opportunities(%L)',:'offer'),'Offer not found');
SELECT pg_temp.expect_error(format('SELECT public.choose_ride_opportunity(%L,%L,now())',:'request',:'offer'),'Request not found');
RESET ROLE;
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(
  (SELECT q FROM fixture)||jsonb_build_object('origin_lat',-3.7,'origin_lng',-38.5,'ride_date',current_date+1,'departure_time','23:40','time_tolerance_minutes',30),
  jsonb_populate_record(NULL::public.ride_offers,to_jsonb(pg_temp.offer_value())||jsonb_build_object('ride_date',current_date+2,'departure_time','00:10','time_tolerance_minutes',30))
)->>'classification'='compatible','full timestamps allow a 30 minute match across midnight');
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(
  (SELECT q FROM fixture)||'{"gender":"MASCULINO"}',
  jsonb_populate_record(NULL::public.ride_offers,to_jsonb(pg_temp.offer_value())||'{"passenger_gender_preference":"FEMININO"}')
) IS NULL,'opportunities respect the driver audience');
SELECT pg_temp.assert_true(public.evaluate_ride_candidate(
  (SELECT q FROM fixture)||jsonb_build_object('target_offer_id',gen_random_uuid()),pg_temp.offer_value()
) IS NULL,'targeted requests cannot drift to a different offer');
INSERT INTO public.offer_route_quotes(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,
 distance_km,passenger_price,tariff_reference)
VALUES(:'passenger','A','C',-3.7,-38.5,-3.6,-38.4,22,12,'caronaa-km-6-per-11-v1') RETURNING quote_id AS open_quote \gset
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SET LOCAL ROLE authenticated;
SELECT public.create_priced_ride_request(:'open_quote',current_date+2,'08:00',1,5,NULL) AS open_request \gset
SELECT public.get_my_ride_opportunities() AS live \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'live'::jsonb)=1,'passenger can see opportunities for an existing open request');
SELECT public.sync_my_ride_opportunity_alerts() AS alerts \gset
SELECT pg_temp.assert_true(jsonb_array_length(:'alerts'::jsonb)=1,'passenger receives a persistent opportunity alert');
SELECT pg_temp.assert_true(public.sync_my_ride_opportunity_alerts()->0->>'alert_id'=:'alerts'::jsonb->0->>'alert_id','alerts are deduplicated across refreshes');
SELECT pg_temp.assert_true(public.set_ride_opportunity_alerts(false)=false AND public.sync_my_ride_opportunity_alerts()='[]'::jsonb,'opportunity alerts can be disabled');
SELECT public.set_ride_opportunity_alerts(true);
SELECT public.mark_ride_opportunity_alerts_read(ARRAY[(:'alerts'::jsonb->0->>'alert_id')::uuid]);
SELECT pg_temp.assert_true(public.sync_my_ride_opportunity_alerts()->0->>'read_at' IS NOT NULL,'opportunity read state is persisted');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT pg_temp.assert_true(public.get_my_ride_opportunities(:'offer')->0->>'role'='driver'
 AND public.get_my_ride_opportunities(:'offer')->0->>'origin' IS NULL,'driver sees the opportunity without private passenger addresses');
SELECT pg_temp.assert_true(jsonb_array_length(public.sync_my_ride_opportunity_alerts())=1,'driver receives an opportunity alert too');
SELECT set_config('request.jwt.claim.sub',:'outsider',true);
SELECT pg_temp.assert_true(jsonb_array_length(public.get_my_ride_opportunities())=0,'outsiders cannot inspect other users opportunities');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_opportunity_alerts)=0,'alert RLS isolates other users');
SELECT pg_temp.expect_error(format('INSERT INTO public.ride_opportunity_alerts(user_id,request_id,offer_id) VALUES(%L,%L,%L)',:'outsider',:'open_request',:'offer'),'permission denied');
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT pg_temp.expect_error(format('SELECT public.choose_ride_opportunity(%L,%L,%L)',:'open_request',:'offer',(current_date+2+'07:01'::time) AT TIME ZONE 'America/Fortaleza'),'oportunidade mudou');
SELECT pg_temp.expect_error(format('SELECT public.choose_ride_opportunity(%L,%L,%L)',:'open_request',:'offer',(current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza'),'Recalcule o trajeto');
RESET ROLE;
INSERT INTO public.ride_road_assessments(user_id,offer_id,request_id,inventory_version,added_duration_minutes)
 VALUES(:'passenger',:'offer',:'open_request','obsolete',0);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('SELECT public.choose_ride_opportunity(%L,%L,%L)',:'open_request',:'offer',(current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza'),'Recalcule o trajeto');
RESET ROLE;
INSERT INTO public.ride_road_assessments(user_id,offer_id,request_id,inventory_version,added_duration_minutes)
 VALUES(:'passenger',:'offer',:'open_request',public.ride_route_inventory_version(:'offer'),0);
SET LOCAL ROLE authenticated;
SELECT public.choose_ride_opportunity(:'open_request',:'offer',(current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza') AS chosen \gset
SELECT pg_temp.assert_true(public.choose_ride_opportunity(:'open_request',:'offer',(current_date+2+'07:00'::time) AT TIME ZONE 'America/Fortaleza')=:'chosen'::uuid,'choosing an existing opportunity is idempotent');
SELECT pg_temp.assert_true(public.sync_my_ride_opportunity_alerts()='[]'::jsonb,'unavailable opportunities disappear from alert inbox');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_matches WHERE request_id=:'open_request')=1,'opportunity choice reserves exactly once');
SELECT pg_temp.assert_true((SELECT seats_remaining=1 FROM public.ride_offers WHERE offer_id=:'offer'),'exactly two distinct requests reserved seats');
-- Expiration releases pending inventory; accepted historical rides remain intact.
UPDATE public.rides SET response_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=:'open_request';
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.expire_ride_match_proposals()=1,'expired proposal is cancelled without a user acceptance');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT seats_remaining=2 FROM public.ride_offers WHERE offer_id=:'offer'),'expiration releases the reserved seat');
SELECT pg_temp.assert_true((SELECT status='CONFIRMED' FROM public.rides WHERE ride_id=:'ride'),'expiration leaves confirmed rides intact');
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT public.discover_ride_opportunities()','permission denied');
SELECT pg_temp.expect_error('SELECT public.get_my_ride_opportunities()','permission denied');
RESET ROLE;
ROLLBACK;
CREATE FUNCTION pg_temp.assert_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;

-- Two simultaneous connections compete for the last seat using real RPCs.
CREATE EXTENSION IF NOT EXISTS dblink;
INSERT INTO auth.users(email) VALUES('concurrent-driver@test.local') RETURNING id AS concurrent_driver \gset
INSERT INTO auth.users(email) VALUES('concurrent-p1@test.local') RETURNING id AS concurrent_p1 \gset
INSERT INTO auth.users(email) VALUES('concurrent-p2@test.local') RETURNING id AS concurrent_p2 \gset
INSERT INTO public.ride_offers(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,
 ride_date,departure_time,available_seats,seats_remaining)
VALUES(:'concurrent_driver','Concurrency A','Concurrency C',-4,-39,-4.1,-39,current_date+10,'09:00',1,1) RETURNING offer_id AS concurrent_offer \gset
INSERT INTO public.offer_route_quotes(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,passenger_price,tariff_reference)
VALUES(:'concurrent_p1','Concurrency A','Concurrency C',-4,-39,-4.1,-39,11,6,'caronaa-km-6-per-11-v1') RETURNING quote_id AS concurrent_q1 \gset
INSERT INTO public.offer_route_quotes(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,passenger_price,tariff_reference)
VALUES(:'concurrent_p2','Concurrency A','Concurrency C',-4,-39,-4.1,-39,11,6,'caronaa-km-6-per-11-v1') RETURNING quote_id AS concurrent_q2 \gset
SELECT dblink_connect('first',format('dbname=%s host=%s port=%s',current_database(),current_setting('unix_socket_directories'),current_setting('port')));
SELECT dblink_connect('second',format('dbname=%s host=%s port=%s',current_database(),current_setting('unix_socket_directories'),current_setting('port')));
SELECT dblink_send_query('first',format('DO $remote$ BEGIN PERFORM set_config(''request.jwt.claim.sub'',%L,true); PERFORM pg_sleep(0.1); PERFORM public.create_priced_ride_request(%L,current_date+10,''09:00'',1,15,NULL); END $remote$',:'concurrent_p1',:'concurrent_q1'));
SELECT dblink_send_query('second',format('DO $remote$ BEGIN PERFORM set_config(''request.jwt.claim.sub'',%L,true); PERFORM pg_sleep(0.1); PERFORM public.create_priced_ride_request(%L,current_date+10,''09:00'',1,15,NULL); END $remote$',:'concurrent_p2',:'concurrent_q2'));
SELECT * FROM dblink_get_result('first') AS result(status text);
SELECT * FROM dblink_get_result('second') AS result(status text);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_matches WHERE offer_id=:'concurrent_offer')=1,'concurrent allocators never double-book the last seat');
SELECT pg_temp.assert_true((SELECT seats_remaining=0 FROM public.ride_offers WHERE offer_id=:'concurrent_offer'),'concurrent allocation preserves nonnegative inventory');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_requests WHERE user_id IN (:'concurrent_p1',:'concurrent_p2') AND status='open')=1,'losing concurrent request remains open');
SELECT dblink_disconnect('first'); SELECT dblink_disconnect('second');
