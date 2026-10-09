\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'PASS: rejected %',SQLERRM; RETURN; END; RAISE EXCEPTION 'FAIL: expected rejection'; END $$;
INSERT INTO auth.users(email) VALUES('priced-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES('priced-passenger@test.local') RETURNING id AS passenger \gset
INSERT INTO public.offer_route_quotes(user_id,origin,destination,distance_km,passenger_price,tariff_reference)
VALUES(:'driver','PRICED A','PRICED B',11,6,'caronaa-km-6-per-11-v1') RETURNING quote_id AS quote \gset
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SET LOCAL ROLE authenticated;
SELECT public.publish_priced_offer(jsonb_build_object('origin','PRICED A','destination','PRICED B','rideDate',current_date+1,'departureTime','09:00','availableSeats',2,'totalPrice',0),:'quote') AS offer \gset
SELECT pg_temp.assert_true((SELECT accepts_quoted_fares AND passenger_price=6 AND route_distance_km=11 FROM public.ride_offers WHERE offer_id=:'offer'),'publication saves trusted price and driver consent');
SELECT pg_temp.expect_error(format('SELECT public.publish_priced_offer(jsonb_build_object(''origin'',''WRONG'',''destination'',''PRICED B'',''rideDate'',current_date+1,''departureTime'',''09:00''),%L)',:'quote'));
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT pg_temp.expect_error(format('SELECT public.publish_priced_offer(jsonb_build_object(''origin'',''PRICED A'',''destination'',''PRICED B'',''rideDate'',current_date+1,''departureTime'',''09:00''),%L)',:'quote'));
SELECT pg_temp.expect_error(format('INSERT INTO public.offer_route_quotes(user_id,origin,destination,distance_km,passenger_price,tariff_reference) VALUES(%L,''A'',''B'',1,0,''fake'')',:'passenger'));
RESET ROLE;
INSERT INTO public.ride_requests(user_id,origin,destination,ride_date,departure_time,passenger_count) VALUES(:'passenger','PRICED A','PRICED B',current_date+1,'09:00',1) RETURNING request_id AS request \gset
SELECT ride_id AS ride FROM public.rides WHERE request_id=:'request' \gset
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.persist_ride_route_quote(:'ride',5.5,3,3,'caronaa-km-6-per-11-v1');
SELECT pg_temp.assert_true((SELECT driver_accepted_at IS NOT NULL AND passenger_accepted_at IS NULL AND status='MATCHED' FROM public.rides WHERE ride_id=:'ride'),'quote records publication consent without confirming passenger');
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride','ACCEPT')='CONFIRMED','passenger acceptance alone confirms');
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride','ACCEPT')='CONFIRMED','repeated acceptance is idempotent');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT passenger_price=3 AND passenger_group_total=3 FROM public.rides WHERE ride_id=:'ride'),'passenger keeps own shorter segment fare');
ROLLBACK;