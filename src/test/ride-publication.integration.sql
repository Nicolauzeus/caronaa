\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END;
$$;

INSERT INTO auth.users(email) VALUES ('ride-publication-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES ('ride-publication-passenger@test.local') RETURNING id AS passenger \gset
SELECT (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date + 1 AS ride_day \gset

SELECT set_config('request.jwt.claim.sub', :'driver', true);
SELECT public.create_preferred_ride(
  'offer',
  jsonb_build_object(
    'origin','Publicação origem','destination','Publicação destino',
    'originLat',-3.73,'originLng',-38.52,'destinationLat',-3.75,'destinationLng',-38.50,
    'rideDate',:'ride_day','departureTime','16:30','availableSeats',2,
    'vehicleDescription','Honda Fit prata','meetingPoint','Praça Portugal',
    'meetingLat',-3.73,'meetingLng',-38.52,'notes','Levar bagagem pequena',
    'idempotencyKey','25d7c83a-637d-4ecb-8d80-689a7503f14a'
  )
) AS offer_id \gset
SELECT public.create_preferred_ride(
  'offer',
  jsonb_build_object(
    'origin','Outro texto','destination','Outro destino','rideDate',:'ride_day',
    'departureTime','16:30','availableSeats',2,
    'idempotencyKey','25d7c83a-637d-4ecb-8d80-689a7503f14a'
  )
) AS repeated_offer_id \gset
SELECT pg_temp.assert_true(:'offer_id' = :'repeated_offer_id','same publication key returns the same offer');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.ride_offers WHERE idempotency_key='25d7c83a-637d-4ecb-8d80-689a7503f14a'),'repeated clicks do not create another offer');
SELECT pg_temp.assert_true((SELECT vehicle_description='Honda Fit prata' AND meeting_point='Praça Portugal' AND meeting_lat=-3.73 AND meeting_lng=-38.52 AND notes='Levar bagagem pequena' FROM public.ride_offers WHERE offer_id=:'offer_id'),'offer details and coordinates survive a database reload');

SELECT set_config('request.jwt.claim.sub', :'passenger', true);
SELECT public.create_preferred_ride(
  'request',
  jsonb_build_object(
    'origin','Pedido origem','destination','Pedido destino',
    'originLat',-3.74,'originLng',-38.53,'destinationLat',-3.76,'destinationLng',-38.51,
    'rideDate',:'ride_day','departureTime','17:00','passengerCount',1,
    'meetingPoint','Entrada lateral','meetingLat',-3.74,'meetingLng',-38.53,
    'notes','Tenho uma mochila','idempotencyKey','b8a276f0-1922-41c6-a84c-9f7b04aa72db'
  )
) AS request_id \gset
SELECT pg_temp.assert_true((SELECT pickup_point='Entrada lateral' AND pickup_lat=-3.74 AND pickup_lng=-38.53 AND notes='Tenho uma mochila' FROM public.ride_requests WHERE request_id=:'request_id'),'request pickup, notes and coordinates survive a database reload');
ROLLBACK;
