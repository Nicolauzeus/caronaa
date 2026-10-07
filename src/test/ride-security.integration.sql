\set ON_ERROR_STOP on
\pset tuples_only on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END;
$$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected in SQLERRM) = 0 THEN RAISE EXCEPTION 'Unexpected error: %', SQLERRM; END IF;
    RAISE NOTICE 'PASS: rejected %', expected; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: expected rejection: %', expected;
END;
$$;
INSERT INTO auth.users(email) VALUES('driver@safety.test') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES('passenger@safety.test') RETURNING id AS passenger \gset
INSERT INTO auth.users(email) VALUES('outsider@safety.test') RETURNING id AS outsider \gset
INSERT INTO public.ride_offers(user_id, origin, destination, ride_date, departure_time, available_seats, seats_remaining)
VALUES(:'driver', 'Aldeota', 'UNIFOR', current_date + 1, '08:00', 4, 4) RETURNING offer_id AS offer \gset
INSERT INTO public.ride_requests(user_id, origin, destination, ride_date, departure_time, passenger_count)
VALUES(:'passenger', 'Aldeota', 'UNIFOR', current_date + 1, '08:00', 1) RETURNING request_id AS request \gset
SELECT ride_id AS ride FROM public.rides WHERE request_id = :'request' \gset
INSERT INTO public.ride_requests(user_id, origin, destination, ride_date, departure_time, passenger_count)
VALUES(:'passenger', 'Aldeota', 'UNIFOR', current_date + 1, '08:00', 1) RETURNING request_id AS second_request \gset
SELECT ride_id AS second_ride FROM public.rides WHERE request_id = :'second_request' \gset

SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->>'pin') IS NULL, 'PIN hidden before confirmation');
SELECT pg_temp.expect_error(format('SELECT public.rate_ride(%L, 5)', :'ride'), 'Only completed rides');
SELECT public.transition_ride_status(:'ride', 'CONFIRMED');
SELECT public.get_ride_safety(:'ride')->>'pin' AS pin \gset
SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT pg_temp.expect_error(format('SELECT public.recalculate_ride_cost_split(%L)', :'offer'), 'permission denied');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_total_cost(%L, 40)', :'second_ride'), 'after confirmation');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_total_cost(%L, ''NaN''::numeric)', :'second_ride'), 'Invalid ride price');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_total_cost(%L, -1)', :'second_ride'), 'Invalid ride price');
SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SELECT public.transition_ride_status(:'second_ride', 'CONFIRMED');
SELECT public.get_ride_safety(:'second_ride')->>'pin' AS second_pin \gset
SELECT pg_temp.assert_true(:'pin' <> :'second_pin', 'codes unique across rides');
SELECT pg_temp.assert_true(:'pin' ~ '^[0-9]{8}$', 'PIN generated on confirmation');
SELECT public.transition_ride_status(:'ride', 'CONFIRMED');
SELECT pg_temp.assert_true(public.get_ride_safety(:'ride')->>'pin' = :'pin', 'confirmation preserves PIN');
SELECT pg_temp.expect_error('SELECT code FROM public.ride_boarding_codes', 'permission denied');
SELECT pg_temp.expect_error(format('SELECT public.validate_ride_boarding(%L, %L)', :'ride', :'pin'), 'Only the driver');
SELECT pg_temp.expect_error(format('SELECT public.transition_ride_status(%L, %L)', :'ride', 'IN_PROGRESS'), 'PIN');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_location(%L, -3.7, -38.5, 10, now())', :'ride'), 'in progress');

SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->>'pin') IS NULL, 'driver cannot read PIN');
SELECT pg_temp.assert_true(public.validate_ride_boarding(:'ride', 'invalid') = 'INVALID_PIN', 'invalid PIN rejected');
SELECT pg_temp.assert_true(public.get_ride_safety(:'ride')->>'status' = 'CONFIRMED', 'invalid PIN cannot start ride');
RESET ROLE;
SELECT pg_temp.expect_error(format('UPDATE public.rides SET status = %L WHERE ride_id = %L', 'IN_PROGRESS', :'ride'), 'PIN');
SET LOCAL ROLE authenticated;
SELECT public.validate_ride_boarding(:'ride', 'invalid');
SELECT public.validate_ride_boarding(:'ride', 'invalid');
SELECT public.validate_ride_boarding(:'ride', 'invalid');
SELECT pg_temp.assert_true(public.validate_ride_boarding(:'ride', 'invalid') = 'LOCKED', 'PIN attempts persist and rate limit');
SELECT pg_temp.assert_true(public.validate_ride_boarding(:'ride', :'pin') = 'LOCKED', 'correct PIN blocked during cooldown');
RESET ROLE;
UPDATE public.ride_boarding_codes SET locked_until = now() - interval '1 second' WHERE ride_id = :'ride';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.validate_ride_boarding(:'ride', :'pin') = 'IN_PROGRESS', 'correct PIN validates boarding and starts ride');
SELECT pg_temp.assert_true(public.get_ride_safety(:'ride')->>'boardedAt' IS NOT NULL, 'boarding timestamp recorded');
SELECT pg_temp.expect_error(format('SELECT public.validate_ride_boarding(%L, %L)', :'ride', :'pin'), 'confirmed ride');
SELECT public.update_ride_location(:'ride', -3.735, -38.5, 8, clock_timestamp());
SELECT pg_temp.assert_true(jsonb_array_length(public.get_ride_safety(:'ride')->'locations') = 1, 'real location persisted');
SELECT public.update_ride_location(:'ride', -3.8, -38.6, 8, clock_timestamp());
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->'locations'->0->>'latitude')::numeric = -3.735, 'updates rate limited without replacing fresh position');
SELECT pg_temp.expect_error('SELECT * FROM public.ride_locations', 'permission denied');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_location(%L, 100, -38.5, 8, now())', :'ride'), 'check constraint');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_location(%L, -3.7, -38.5, 8, now() - interval ''10 minutes'')', :'ride'), 'Stale');

SELECT set_config('request.jwt.claim.sub', :'outsider', true);
SELECT pg_temp.expect_error(format('SELECT public.get_ride_safety(%L)', :'ride'), 'Ride not found');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_location(%L, -3.7, -38.5, 8, now())', :'ride'), 'Ride not found');
SELECT pg_temp.expect_error(format('SELECT public.rate_ride(%L, 5)', :'ride'), 'Ride not found');
SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->>'pin') IS NULL, 'PIN hidden after boarding');
SELECT public.update_ride_location(:'ride', -3.736, -38.501, 12, clock_timestamp());
SELECT pg_temp.assert_true(jsonb_array_length(public.get_ride_safety(:'ride')->'locations') = 2, 'both participants can update their own position');
SELECT pg_temp.assert_true(public.transition_ride_status(:'ride', 'COMPLETED') = 'AWAITING_OTHER_PARTICIPANT', 'one confirmation cannot complete ride');
SELECT pg_temp.assert_true(public.transition_ride_status(:'ride', 'COMPLETED') = 'AWAITING_OTHER_PARTICIPANT', 'duplicate confirmation cannot replace other participant');
SELECT pg_temp.expect_error(format('SELECT public.rate_ride(%L, 5)', :'ride'), 'Only completed rides');
SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT pg_temp.assert_true(public.transition_ride_status(:'ride', 'COMPLETED') = 'COMPLETED', 'both confirmations complete ride');
SELECT pg_temp.expect_error(format('SELECT public.transition_ride_status(%L, %L)', :'ride', 'COMPLETED'), 'Invalid ride transition');
SELECT pg_temp.assert_true(jsonb_array_length(public.get_ride_safety(:'ride')->'locations') = 0, 'location removed on completion');
SELECT pg_temp.expect_error(format('SELECT public.transition_ride_status(%L, %L)', :'ride', 'CONFIRMED'), 'Invalid ride transition');
SELECT pg_temp.expect_error(format('SELECT public.update_ride_location(%L, -3.7, -38.5, 8, now())', :'ride'), 'in progress');
SELECT public.rate_ride(:'ride', 4, 'Passageiro pontual');
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->'otherUserRating'->>'average')::numeric = 4, 'driver rates passenger and average is consistent');
SELECT pg_temp.expect_error(format('SELECT public.rate_ride(%L, 3)', :'ride'), 'duplicate key');
SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SELECT public.rate_ride(:'ride', 5, 'Motorista cuidadoso');
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->'otherUserRating'->>'average')::numeric = 5, 'passenger rates driver');
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->'myUserRating'->>'average')::numeric = 4, 'received average agrees with other participant');
SELECT pg_temp.expect_error(format('SELECT public.rate_ride(%L, 6)', :'ride'), 'check constraint');
SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT pg_temp.assert_true(public.validate_ride_boarding(:'second_ride', :'pin') = 'INVALID_PIN', 'code from another ride cannot validate boarding');
SELECT public.validate_ride_boarding(:'second_ride', :'second_pin');
SELECT public.transition_ride_status(:'second_ride', 'COMPLETED');
SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SELECT public.transition_ride_status(:'second_ride', 'COMPLETED');
SELECT public.rate_ride(:'second_ride', 3);
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->'otherUserRating'->>'average')::numeric = 4, 'driver average aggregates multiple rides');
SELECT pg_temp.assert_true((public.get_ride_safety(:'second_ride')->'otherUserRating'->>'count')::int = 2, 'average sample count consistent across rides');
SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT public.rate_ride(:'second_ride', 2);
SELECT pg_temp.assert_true((public.get_ride_safety(:'ride')->'otherUserRating'->>'average')::numeric = 3, 'passenger average aggregates multiple rides');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.expect_error(format('SELECT public.get_ride_safety(%L)', :'ride'), 'Authentication required');
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('SELECT public.get_ride_safety(%L)', :'ride'), 'permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.ride_ratings WHERE ride_id = :'ride' AND ((reviewer_user_id = :'driver' AND rated_user_id = :'passenger') OR (reviewer_user_id = :'passenger' AND rated_user_id = :'driver'))) = 2, 'ratings associated with correct ride and rated user');
SELECT pg_temp.expect_error(format('UPDATE public.rides SET status = %L WHERE ride_id = %L', 'IN_PROGRESS', :'ride'), 'Invalid ride transition');
SELECT pg_temp.expect_error(format('UPDATE public.rides SET boarded_at = now() WHERE ride_id = %L', :'ride'), 'immutable');
SELECT pg_temp.assert_true((SELECT consumed_at IS NOT NULL FROM public.ride_boarding_codes WHERE ride_id = :'ride'), 'boarding code remains consumed');
ROLLBACK;
\echo 'Ride security integration assertions passed.'
