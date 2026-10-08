\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END;
$$;
INSERT INTO auth.users(email) VALUES('preferences-driver@test.local') RETURNING id AS driver \gset
INSERT INTO auth.users(email) VALUES('preferences-passenger@test.local') RETURNING id AS passenger \gset
SELECT (clock_timestamp() AT TIME ZONE 'America/Fortaleza')::date+1 AS tomorrow \gset
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT public.save_my_travel_preferences('{"conversation":"quiet","music":"off","smoking":"no","pets":"yes","luggage":2}',true);
SELECT public.create_preferred_ride('offer',jsonb_build_object('origin','Pref A','destination','Pref B','rideDate',:'tomorrow','departureTime','14:00','availableSeats',3)) AS offer \gset
SELECT pg_temp.assert_true((SELECT travel_preferences->>'conversation'='quiet' FROM public.ride_offers WHERE offer_id=:'offer'),'profile defaults copied to offer');
SELECT public.save_my_travel_preferences('{"conversation":"chat"}',true);
SELECT pg_temp.assert_true((SELECT travel_preferences->>'conversation'='quiet' FROM public.ride_offers WHERE offer_id=:'offer'),'snapshot unaffected by profile changes');
SELECT set_config('request.jwt.claim.sub',:'passenger',true);
SELECT public.save_my_travel_preferences('{"smoking":"no","pets":"yes","luggage":3}',true);
SELECT public.create_preferred_ride('request',jsonb_build_object('origin','Pref A','destination','Pref B','rideDate',:'tomorrow','departureTime','14:00','passengerCount',1)) AS blocked \gset
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.ride_matches WHERE request_id=:'blocked'),'insufficient luggage blocks allocation');
SELECT pg_temp.assert_true(public.ride_preferences_compatible('{"smoking":"no"}','{"smoking":"yes"}')=false,'smoking incompatibility enforced');
SELECT pg_temp.assert_true(public.ride_preferences_compatible('{"pets":"yes"}','{}')=false,'pet needs explicit acceptance');
SELECT public.create_preferred_ride('request',jsonb_build_object('origin','Pref A','destination','Pref B','rideDate',:'tomorrow','departureTime','14:00','passengerCount',1),'{"conversation":"quiet","music":"off","smoking":"no","pets":"yes","luggage":1}') AS matched \gset
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM public.ride_matches WHERE request_id=:'matched' AND offer_id=:'offer'),'per-trip override applied before matching');
SELECT pg_temp.assert_true(public.travel_preference_bonus('{"conversation":"quiet","music":"off"}','{"conversation":"quiet","music":"off"}')=6,'soft preferences provide ranking bonus');
SELECT set_config('request.jwt.claim.sub',:'driver',true);
SELECT public.save_ride_routine(jsonb_build_object('kind','offer','origin','Routine pref A','destination','Routine pref B','days',jsonb_build_array(extract(isodow FROM :'tomorrow'::date)::int),'departureTime','16:00','startDate',:'tomorrow','endDate',:'tomorrow','seats',2,'active',true,'preferences','{"music":"off","luggage":2}'::jsonb)) AS routine \gset
SELECT pg_temp.assert_true((SELECT bool_and(travel_preferences->>'music'='off') FROM public.ride_offers WHERE routine_id=:'routine'),'routine preferences copied to occurrences');
SELECT public.refresh_ride_routine_occurrences();
SELECT public.refresh_ride_routine_occurrences();
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.ride_offers WHERE routine_id=:'routine'),'routine refresh remains idempotent');
SELECT public.set_ride_routine_active(:'routine',false);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.ride_offers WHERE routine_id=:'routine' AND status='available'),'inactive routine unavailable');
SELECT public.save_my_travel_preferences('{}',false);
SELECT pg_temp.assert_true((SELECT travel_preferences_consented_at IS NULL AND travel_preferences='{}'::jsonb FROM public.profiles WHERE id=:'driver'),'consent revocation clears defaults');
ROLLBACK;