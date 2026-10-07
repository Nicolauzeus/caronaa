\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END;
$$;
CREATE FUNCTION pg_temp.expect_error(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected in SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF;
    RAISE NOTICE 'PASS: rejected %',expected; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: expected rejection: %',expected;
END;
$$;
INSERT INTO auth.users(email) VALUES('routine-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES('routine-passenger@test.local') RETURNING id AS passenger \gset
INSERT INTO auth.users(email) VALUES('routine-outsider@test.local') RETURNING id AS outsider \gset
SELECT (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date AS today \gset
SELECT jsonb_build_object('kind','offer','origin','Aldeota','destination','UNIFOR','originLat',-3.735,'originLng',-38.5,'destinationLat',-3.77,'destinationLng',-38.48,'days',jsonb_build_array(1,3,5),'departureTime','07:30','startDate',:'today'::date-7,'endDate',NULL,'seats',2,'timeToleranceMinutes',15,'totalPrice',30,'active',true) AS definition \gset
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SET LOCAL ROLE authenticated;
SELECT public.create_ride_offer('Aldeota','UNIFOR',:'today'::date+1,'14:00'::time,2,15,NULL::double precision,NULL::double precision,NULL::double precision,NULL::double precision,30::numeric) AS point_offer \gset
SELECT pg_temp.assert_true((SELECT routine_id IS NULL FROM public.ride_offers WHERE offer_id=:'point_offer'),'point ride remains independent');
SELECT public.save_ride_routine(:'definition'::jsonb) AS routine \gset
SELECT pg_temp.assert_true(jsonb_array_length(public.get_my_ride_routines())=1,'routine created and visible to owner');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_offers WHERE routine_id=:'routine')=(SELECT count(*) FROM generate_series(:'today'::timestamp,(:'today'::date+27)::timestamp,interval '1 day') d WHERE extract(isodow FROM d) IN (1,3,5) AND (d::date+'07:30'::time) AT TIME ZONE 'America/Fortaleza'>clock_timestamp()),'multiple weekdays generated inside rolling window');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.ride_offers WHERE routine_id=:'routine' AND (extract(isodow FROM routine_date) NOT IN (1,3,5) OR (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza'<=clock_timestamp())),'past dates and unselected weekdays excluded');
SELECT pg_temp.assert_true((SELECT bool_and(available_seats=2 AND origin_lat=-3.735 AND destination_lng=-38.48) FROM public.ride_offers WHERE routine_id=:'routine'),'default seats and real coordinates persisted');
SELECT count(*) AS initial_count FROM public.ride_offers WHERE routine_id=:'routine' \gset
SELECT public.refresh_ride_routine_occurrences();
SELECT public.get_my_ride_routines();
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_offers WHERE routine_id=:'routine')=:'initial_count'::int,'repeated reads do not duplicate occurrences');
SELECT pg_temp.expect_error(format('SELECT public.save_ride_routine(%L::jsonb)',(:'definition'::jsonb||'{"days":[8]}')::text),'check constraint');
SELECT pg_temp.expect_error('SELECT public.materialize_ride_routine(gen_random_uuid())','permission denied');

SELECT offer_id AS occurrence,routine_date AS slot FROM public.ride_offers WHERE routine_id=:'routine' ORDER BY ride_date LIMIT 1 \gset
SELECT (:'definition'::jsonb||jsonb_build_object('origin','Meireles','originLat',-3.736,'originLng',-38.501,'rideDate',:'slot'::date+1,'departureTime','08:10','seats',3,'totalPrice',36)) AS changes \gset
SELECT ride_date AS occupied_date FROM public.ride_offers WHERE routine_id=:'routine' AND offer_id<>:'occurrence' ORDER BY ride_date LIMIT 1 \gset
SELECT pg_temp.expect_error(format('SELECT public.change_ride_routine_occurrence(%L,%L,false,%L::jsonb)','offer',:'occurrence',(:'changes'::jsonb||jsonb_build_object('rideDate',:'occupied_date','departureTime','07:30'))::text),'Already scheduled occurrence');
SELECT pg_temp.expect_error(format('SELECT public.change_ride_routine_occurrence(%L,%L,false,%L::jsonb)','offer',:'occurrence',(:'changes'::jsonb||'{"originLat":100}')::text),'check constraint');
SELECT public.change_ride_routine_occurrence('offer',:'occurrence',false,:'changes'::jsonb);
SELECT pg_temp.assert_true((SELECT origin='Meireles' AND ride_date=:'slot'::date+1 AND routine_date=:'slot'::date AND routine_override AND available_seats=3 FROM public.ride_offers WHERE offer_id=:'occurrence'),'single occurrence edited with stable original slot');
SELECT pg_temp.assert_true((SELECT bool_and(origin='Aldeota' AND departure_time='07:30') FROM public.ride_offers WHERE routine_id=:'routine' AND offer_id<>:'occurrence'),'single edit does not change other occurrences');
SELECT (:'definition'::jsonb||'{"departureTime":"07:45","seats":4,"totalPrice":42}'::jsonb) AS edited_definition \gset
SELECT public.save_ride_routine(:'edited_definition'::jsonb,:'routine');
SELECT pg_temp.assert_true((SELECT bool_and(departure_time='07:45' AND available_seats=4) FROM public.ride_offers WHERE routine_id=:'routine' AND NOT routine_override),'routine edit updates future unreserved departures');
SELECT pg_temp.assert_true((SELECT origin='Meireles' AND departure_time='08:10' AND available_seats=3 FROM public.ride_offers WHERE offer_id=:'occurrence'),'routine edit preserves individual override');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_offers WHERE routine_id=:'routine')=:'initial_count'::int,'routine edit does not duplicate slots');
SELECT offer_id AS cancelled FROM public.ride_offers WHERE routine_id=:'routine' AND offer_id<>:'occurrence' ORDER BY ride_date LIMIT 1 \gset
SELECT public.change_ride_routine_occurrence('offer',:'cancelled',true);
SELECT pg_temp.assert_true((SELECT status='cancelled' AND routine_override FROM public.ride_offers WHERE offer_id=:'cancelled'),'one occurrence cancelled');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_offers WHERE routine_id=:'routine' AND status='available')=:'initial_count'::int-1,'one cancellation preserves other dates');
SELECT public.save_ride_routine(:'edited_definition'::jsonb,:'routine');
SELECT pg_temp.assert_true((SELECT status='cancelled' FROM public.ride_offers WHERE offer_id=:'cancelled'),'cancelled slot not regenerated');
SELECT public.set_ride_routine_active(:'routine',false);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.ride_offers WHERE routine_id=:'routine' AND status='available'),'deactivation removes future offers');
SELECT pg_temp.assert_true((public.get_my_ride_routines()->0->>'active')::boolean=false,'deactivated routine retained');
SELECT pg_temp.assert_true((SELECT status='available' FROM public.ride_offers WHERE offer_id=:'point_offer'),'point offer unaffected by routine deactivation');
SELECT public.set_ride_routine_active(:'routine',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_offers WHERE routine_id=:'routine' AND status='available')=:'initial_count'::int-1,'reactivation restores departures without duplicates');
SELECT pg_temp.assert_true((SELECT origin='Meireles' AND departure_time='08:10' AND status='available' FROM public.ride_offers WHERE offer_id=:'occurrence'),'reactivation preserves edited occurrence');
SELECT pg_temp.assert_true((SELECT status='cancelled' FROM public.ride_offers WHERE offer_id=:'cancelled'),'reactivation preserves individual cancellation');
SELECT public.save_ride_routine(:'edited_definition'::jsonb||'{"days":[2,4]}',:'routine');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.ride_offers WHERE routine_id=:'routine' AND status='available' AND NOT routine_override AND extract(isodow FROM routine_date) NOT IN (2,4)),'weekday changes suppress removed weekdays');
SELECT public.save_ride_routine(:'edited_definition'::jsonb,:'routine');
SELECT pg_temp.assert_true((SELECT status='cancelled' FROM public.ride_offers WHERE offer_id=:'cancelled'),'weekday changes cannot resurrect manual cancellation');
RESET ROLE;
INSERT INTO public.ride_offers(user_id,origin,destination,ride_date,departure_time,available_seats,seats_remaining,routine_id,routine_date)
VALUES(:'driver','Past original','UNIFOR',:'today'::date-1,'07:30',1,1,:'routine',:'today'::date-1) RETURNING offer_id AS past_occurrence \gset
UPDATE public.ride_routines SET generated_on=NULL WHERE routine_id=:'routine';
SET LOCAL ROLE authenticated;
SELECT public.refresh_ride_routine_occurrences();
SELECT pg_temp.assert_true((SELECT origin='Past original' AND available_seats=1 FROM public.ride_offers WHERE offer_id=:'past_occurrence'),'historical departures not rewritten');
SELECT pg_temp.expect_error(format('SELECT public.change_ride_routine_occurrence(%L,%L,true)','offer',:'past_occurrence'),'Past occurrences');

SELECT set_config('request.jwt.claim.sub',:'outsider',true);
SELECT pg_temp.assert_true(jsonb_array_length(public.get_my_ride_routines())=0,'other users cannot read routine details');
SELECT pg_temp.expect_error(format('SELECT public.save_ride_routine(%L::jsonb,%L)',:'definition',:'routine'),'Routine not found');
SELECT pg_temp.expect_error(format('SELECT public.set_ride_routine_active(%L,false)',:'routine'),'Routine not found');
SELECT pg_temp.expect_error(format('SELECT public.change_ride_routine_occurrence(%L,%L,true)','offer',:'occurrence'),'Occurrence not found');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT offer_id AS match_offer,ride_date AS match_date FROM public.ride_offers WHERE routine_id=:'routine' AND status='available' AND NOT routine_override AND (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza'>clock_timestamp() ORDER BY ride_date LIMIT 1 \gset
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT pg_temp.assert_true((SELECT is_recurring FROM public.get_offer_schedule_types(ARRAY[:'match_offer'::uuid])),'discovery identifies recurring offers without exposing routines');
SELECT pg_temp.assert_true(NOT (SELECT is_recurring FROM public.get_offer_schedule_types(ARRAY[:'point_offer'::uuid])),'discovery identifies point offers');
SELECT public.save_ride_routine(:'edited_definition'::jsonb||jsonb_build_object('kind','request','days',jsonb_build_array(extract(isodow FROM :'match_date'::date)::int),'startDate',:'match_date','endDate',:'match_date','seats',1)) AS passenger_routine \gset
SELECT pg_temp.assert_true(jsonb_array_length(public.get_my_ride_routines()->0->'occurrences')=1,'passenger routine with a one-day period');
SELECT request_id AS matched_request FROM public.ride_requests WHERE routine_id=:'passenger_routine' \gset
SELECT ride_id AS matched_ride FROM public.rides WHERE request_id=:'matched_request' \gset
SELECT pg_temp.assert_true((SELECT status='matched' FROM public.ride_requests WHERE request_id=:'matched_request'),'routine occurrences participate in existing matching');
SELECT public.transition_ride_status(:'matched_ride','CONFIRMED');
SELECT pg_temp.assert_true(public.get_ride_safety(:'matched_ride')->>'pin' IS NOT NULL,'recurring match retains PIN confirmation flow');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT pg_temp.expect_error(format('SELECT public.change_ride_routine_occurrence(%L,%L,false,%L::jsonb)','offer',:'match_offer',:'changes'),'Matched occurrences');
SELECT public.save_ride_routine(:'edited_definition'::jsonb||'{"departureTime":"09:00"}',:'routine');
SELECT pg_temp.assert_true((SELECT departure_time='07:45' FROM public.ride_offers WHERE offer_id=:'match_offer'),'routine edits preserve agreed matched departure');
SELECT public.set_ride_routine_active(:'routine',false);
SELECT pg_temp.assert_true((SELECT status='CONFIRMED' FROM public.rides WHERE ride_id=:'matched_ride'),'deactivation preserves confirmed ride');
SELECT public.set_ride_routine_active(:'routine',true);
SELECT public.change_ride_routine_occurrence('offer',:'match_offer',true);
SELECT pg_temp.assert_true((SELECT status='CANCELLED' FROM public.rides WHERE ride_id=:'matched_ride'),'single occurrence cancellation uses existing ride lifecycle');
SELECT pg_temp.assert_true((SELECT seats_remaining=available_seats FROM public.ride_offers WHERE offer_id=:'match_offer'),'cancellation releases reserved seats exactly once');
SELECT public.change_ride_routine_occurrence('offer',:'match_offer',true);
SELECT public.save_ride_routine(:'edited_definition'::jsonb,:'routine');
SELECT pg_temp.assert_true((SELECT status='cancelled' AND seats_remaining=available_seats FROM public.ride_offers WHERE offer_id=:'match_offer'),'cancelled matched slot never republished or overcredited');
SELECT pg_temp.assert_true((SELECT routine_id IS NULL AND status='available' FROM public.ride_offers WHERE offer_id=:'point_offer'),'point and recurring trips coexist throughout lifecycle');
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT routine_id,routine_date FROM public.ride_offers WHERE routine_id IS NOT NULL GROUP BY routine_id,routine_date HAVING count(*)>1),'global occurrence uniqueness');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT routine_id,ride_date,departure_time FROM public.ride_offers WHERE routine_id IS NOT NULL AND status<>'cancelled' GROUP BY routine_id,ride_date,departure_time HAVING count(*)>1),'no repeated active departure after individual rescheduling');
ROLLBACK;
