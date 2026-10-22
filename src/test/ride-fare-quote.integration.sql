\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
 IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF;
 RAISE NOTICE 'PASS: rejected %',expected; RETURN; END;
 RAISE EXCEPTION 'FAIL: expected %',expected;
END $$;
INSERT INTO auth.users(email) VALUES('fare-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES('fare-passenger@test.local') RETURNING id AS passenger \gset
INSERT INTO auth.users(email) VALUES('fare-outsider@test.local') RETURNING id AS outsider \gset
INSERT INTO public.ride_offers(user_id,origin,destination,ride_date,departure_time,available_seats,seats_remaining)
VALUES(:'driver','FARE TEST A','FARE TEST B',current_date+1,'09:00',4,4) RETURNING offer_id AS offer \gset
INSERT INTO public.ride_requests(user_id,origin,destination,ride_date,departure_time,passenger_count)
VALUES(:'passenger','FARE TEST A','FARE TEST B',current_date+1,'09:00',2) RETURNING request_id AS request \gset
SELECT ride_id AS ride FROM public.rides WHERE request_id=:'request' \gset
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('SELECT public.respond_to_ride_match(%L,''ACCEPT'')',:'ride'),'Calcule o preço');
SELECT pg_temp.expect_error(format('SELECT public.persist_ride_route_quote(%L,11,6,12,''caronaa-km-6-per-11-v1'')',:'ride'),'permission denied');
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.expect_error(format('SELECT public.persist_ride_route_quote(%L,11,600,1200,''caronaa-km-6-per-11-v1'')',:'ride'),'configured tariff');
SELECT pg_temp.expect_error(format('SELECT public.persist_ride_route_quote(%L,11,6,6,''caronaa-km-6-per-11-v1'')',:'ride'),'Group fare');
SELECT pg_temp.assert_true(public.persist_ride_route_quote(:'ride',11,6,12,'caronaa-km-6-per-11-v1'),'save trusted quote');
SELECT pg_temp.assert_true(NOT public.persist_ride_route_quote(:'ride',22,12,24,'caronaa-km-6-per-11-v1'),'duplicate quote preserves first winner');
SELECT pg_temp.assert_true((SELECT passenger_price=6 AND passenger_group_total=12 FROM public.rides WHERE ride_id=:'ride'),'saved fare reads back');
SELECT pg_temp.expect_error(format('UPDATE public.rides SET passenger_price=7 WHERE ride_id=%L',:'ride'),'immutable');
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride','ACCEPT')='AWAITING_OTHER_PARTICIPANT','first acceptance waits');
SELECT set_config('request.jwt.claim.sub',:'outsider',true);
SELECT pg_temp.expect_error(format('SELECT public.respond_to_ride_match(%L,''ACCEPT'')',:'ride'),'Ride not found');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride','ACCEPT')='CONFIRMED','second acceptance confirms');
SELECT public.save_my_pix_key('fare-driver@example.test');
SELECT pg_temp.expect_error(format('SELECT public.get_ride_pix(%L)',:'ride'),'conclusão');
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT pg_temp.expect_error(format('SELECT public.get_ride_pix(%L)',:'ride'),'Pix privado do motorista');
SELECT public.get_ride_safety(:'ride')->>'pin' AS pin \gset
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT pg_temp.assert_true(public.validate_ride_boarding(:'ride',:'pin')='IN_PROGRESS','PIN validates boarding');
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT pg_temp.assert_true(public.transition_ride_status(:'ride','COMPLETED')='AWAITING_OTHER_PARTICIPANT','first completion waits');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT pg_temp.assert_true(public.transition_ride_status(:'ride','COMPLETED')='COMPLETED','bilateral completion');
SELECT pg_temp.assert_true((public.get_ride_pix(:'ride')->>'amount')::numeric=12,'Driver Pix reflects completed group fare');
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT pg_temp.expect_error(format('SELECT public.get_ride_pix(%L)',:'ride'),'Pix privado do motorista');
SELECT set_config('request.jwt.claim.sub',:'outsider',true);
SELECT pg_temp.expect_error(format('SELECT public.get_ride_pix(%L)',:'ride'),'Pix privado do motorista');
RESET ROLE;
SELECT public.recalculate_ride_cost_split(:'offer');
SELECT pg_temp.assert_true((SELECT passenger_contribution=12 FROM public.rides WHERE ride_id=:'ride'),'legacy recalculation preserves completed fare');
ROLLBACK;