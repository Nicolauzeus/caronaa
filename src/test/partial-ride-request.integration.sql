\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM) = 0 THEN RAISE EXCEPTION 'Unexpected error: %', SQLERRM; END IF;
    RAISE NOTICE 'PASS: rejected %', expected; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: expected %', expected;
END $$;

INSERT INTO auth.users(email) VALUES ('partial-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES ('partial-passenger@test.local') RETURNING id AS passenger \gset
INSERT INTO auth.users(email) VALUES ('partial-outsider@test.local') RETURNING id AS outsider \gset

INSERT INTO public.ride_offers (
  user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
  ride_date, departure_time, available_seats, seats_remaining
) VALUES (
  :'driver', 'Motorista - A', 'Motorista - D', -3.7500, -38.5500, -3.6500, -38.4500,
  current_date + 2, '09:00', 3, 3
) RETURNING offer_id AS offer \gset

-- Passenger coordinates describe only an intermediate A-to-B segment, not the
-- driver's complete route. R$ 3.65 is the trusted rounded fare for 6.7 road km.
INSERT INTO public.offer_route_quotes (
  user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
  distance_km, passenger_price, tariff_reference
) VALUES (
  :'passenger', 'Passageiro - A', 'Passageiro - B', -3.7300, -38.5300, -3.6700, -38.4700,
  6.7, 3.65, 'caronaa-km-6-per-11-v1'
) RETURNING quote_id AS quote \gset

INSERT INTO public.offer_route_quotes (
  user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
  distance_km, passenger_price, tariff_reference
) VALUES (
  :'outsider', 'Outro - A', 'Outro - B', -3.7300, -38.5300, -3.6700, -38.4700,
  6.7, 3.65, 'caronaa-km-6-per-11-v1'
) RETURNING quote_id AS outsider_quote \gset

INSERT INTO public.offer_route_quotes (
  user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
  distance_km, passenger_price, tariff_reference
) VALUES (
  :'passenger', 'Passageiro - C', 'Passageiro - D', -3.7200, -38.5200, -3.6800, -38.4800,
  11, 6, 'caronaa-km-6-per-11-v1'
) RETURNING quote_id AS open_quote \gset

SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format(
  'SELECT public.request_available_ride_segment(%L,%L,%L,%L,2,15)',
  :'offer', :'outsider_quote', current_date + 2, '09:10'
), 'Passenger route quote is invalid');

SELECT public.request_available_ride_segment(
  :'offer', :'quote', current_date + 2, '09:10', 2, 15
) AS request \gset
SELECT ride_id AS ride FROM public.rides WHERE request_id = :'request' \gset
SELECT pg_temp.assert_true((SELECT origin = 'Passageiro - A' AND destination = 'Passageiro - B'
  FROM public.ride_requests WHERE request_id = :'request'), 'request persists the passenger partial segment');
SELECT pg_temp.assert_true((SELECT route_quote_id = :'quote'::uuid AND route_distance_km = 6.7
  AND passenger_price = 3.65 AND passenger_group_total = 7.30
  FROM public.rides WHERE ride_id = :'ride'), 'proposal freezes the exact displayed group quote');
SELECT pg_temp.assert_true(public.request_available_ride_segment(
  :'offer', :'quote', current_date + 2, '09:10', 2, 15
) = :'request'::uuid, 'retries are idempotent');
SELECT pg_temp.expect_error(format('UPDATE public.ride_requests SET passenger_price=0 WHERE request_id=%L', :'request'),'permission denied');
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride', 'ACCEPT') = 'AWAITING_OTHER_PARTICIPANT', 'passenger accepts first');
SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT pg_temp.assert_true(public.respond_to_ride_match(:'ride', 'ACCEPT') = 'CONFIRMED', 'driver acceptance confirms the same quote');
SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SELECT public.create_priced_ride_request(:'open_quote', current_date + 2, '09:10', 1, 15, NULL) AS open_request \gset
SELECT ride_id AS open_ride FROM public.rides WHERE request_id = :'open_request' \gset
SELECT pg_temp.assert_true((SELECT target_offer_id IS NULL AND route_quote_id = :'open_quote'::uuid
  FROM public.ride_requests WHERE request_id = :'open_request'), 'open request keeps its own partial route and quote');
SELECT pg_temp.assert_true((SELECT status = 'MATCHED' AND passenger_price = 6
  FROM public.rides WHERE ride_id = :'open_ride'), 'allocator matches the open partial request and copies its fare');
SELECT pg_temp.assert_true(public.create_priced_ride_request(:'open_quote', current_date + 2, '09:10', 1, 15, NULL)
  = :'open_request'::uuid, 'open request retries remain idempotent');
RESET ROLE;
ROLLBACK;
