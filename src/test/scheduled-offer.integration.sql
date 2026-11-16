-- Run only in an isolated PostgreSQL/Supabase test database after migration 0159.
-- These synthetic accounts/routes are test fixtures, never production data.
-- The entire scenario rolls back. No PGlite or other runtime dependency required.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(value boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END;
$$;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(statement text, expected text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE expected || '%' THEN
      RAISE NOTICE 'PASS: rejected %', expected;
      RETURN;
    END IF;
    RAISE EXCEPTION 'FAIL: expected %, got %', expected, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL: expected rejection %', expected;
END;
$$;

CREATE TEMP TABLE scheduled_test_quotes (
  scenario text PRIMARY KEY, quote_id uuid NOT NULL DEFAULT gen_random_uuid(), offer_id uuid
);
GRANT SELECT, UPDATE ON scheduled_test_quotes TO authenticated;
INSERT INTO scheduled_test_quotes(scenario)
  VALUES ('valid'), ('expired'), ('foreign'), ('bad_price'), ('bad_tariff'), ('no_geometry');
CREATE TEMP TABLE scheduled_f07_before AS
  SELECT proname, pg_get_function_identity_arguments(oid) AS args,
    pg_get_functiondef(oid) AS definition, proacl::text AS acl
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN
    ('is_driver_ready', 'guard_driver_platform_debt', 'set_flash_driver_online', 'discover_caronaa_quick_drivers');

INSERT INTO auth.users(id, email) VALUES
  ('30000000-0000-4000-8000-000000000001', 'scheduled-driver@test.local'),
  ('30000000-0000-4000-8000-000000000002', 'scheduled-other@test.local');
INSERT INTO public.profiles(id, vehicle_brand, vehicle_description, gender, is_driver_eligible)
  VALUES ('30000000-0000-4000-8000-000000000001', 'Fiat', 'Argo', 'FEMININO', false),
    ('30000000-0000-4000-8000-000000000002', 'Honda', 'Fit', 'MASCULINO', false)
  ON CONFLICT (id) DO UPDATE SET vehicle_brand = EXCLUDED.vehicle_brand,
    vehicle_description = EXCLUDED.vehicle_description, gender = EXCLUDED.gender,
    is_driver_eligible = false;
INSERT INTO public.offer_route_quotes (
  quote_id, user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
  distance_km, passenger_price, tariff_reference, route_path, route_duration_minutes, expires_at
)
SELECT quote_id,
  CASE WHEN scenario = 'foreign' THEN '30000000-0000-4000-8000-000000000002'::uuid
    ELSE '30000000-0000-4000-8000-000000000001'::uuid END,
  'F03 origem de teste', 'F03 destino de teste', -3.8, -38.6, -3.82, -38.55,
  11, CASE WHEN scenario = 'bad_price' THEN 7 ELSE 6 END,
  CASE WHEN scenario = 'bad_tariff' THEN 'unapproved-v0' ELSE 'caronaa-km-6-per-11-v1' END,
  CASE WHEN scenario = 'no_geometry' THEN NULL
    ELSE '[{"lat":-3.8,"lng":-38.6},{"lat":-3.81,"lng":-38.59},{"lat":-3.82,"lng":-38.55}]'::jsonb END,
  CASE WHEN scenario = 'no_geometry' THEN NULL ELSE 24 END,
  CASE WHEN scenario = 'expired' THEN clock_timestamp() - interval '1 minute'
    ELSE clock_timestamp() + interval '30 minutes' END
FROM scheduled_test_quotes;

CREATE OR REPLACE FUNCTION pg_temp.publish_scheduled_test(scenario_name text, changes jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE args jsonb; selected_quote uuid;
BEGIN
  SELECT quote_id INTO selected_quote FROM scheduled_test_quotes WHERE scenario = scenario_name;
  args := jsonb_build_object('origin', 'F03 origem de teste', 'destination', 'F03 destino de teste',
    'originLat', -3.8, 'originLng', -38.6, 'destinationLat', -3.82, 'destinationLng', -38.55,
    'date', (current_date + 1)::text, 'time', '10:00:00', 'seats', 2,
    'price', 6, 'mode', 'ALL', 'vehicle', 'CAR', 'detours', false, 'women', false) || changes;
  RETURN public.publish_scheduled_driver_offer(
    p_origin => args->>'origin', p_destination => args->>'destination',
    p_origin_lat => (args->>'originLat')::double precision,
    p_origin_lng => (args->>'originLng')::double precision,
    p_destination_lat => (args->>'destinationLat')::double precision,
    p_destination_lng => (args->>'destinationLng')::double precision,
    p_ride_date => (args->>'date')::date, p_departure_time => (args->>'time')::time,
    p_available_seats => (args->>'seats')::integer, p_total_price => (args->>'price')::numeric,
    p_booking_mode => args->>'mode', p_vehicle_type => args->>'vehicle',
    p_allow_detours => (args->>'detours')::boolean, p_women_only => (args->>'women')::boolean,
    -- Deliberately wrong browser geometry must never replace the quote path.
    p_route_path => '{"type":"LineString","coordinates":[[0,0],[1,1]]}'::jsonb,
    p_travel_preferences => args->'preferences', p_quote_id => selected_quote
  );
END;
$$;

SELECT set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
UPDATE scheduled_test_quotes SET offer_id = (pg_temp.publish_scheduled_test('valid')->>'offer_id')::uuid
  WHERE scenario = 'valid';
SELECT pg_temp.assert_true((SELECT o.accepts_quoted_fares AND o.passenger_price = 6
  AND o.total_price = 6 AND o.route_distance_km = 11 AND o.route_quote_id = t.quote_id
  AND o.route_duration_minutes = 24 AND o.route_path = q.route_path
  AND o.booking_mode = 'ALL' AND o.service_tier = 'SCHEDULED'
  AND o.vehicle_type = 'CAR' AND NOT o.allow_detours AND o.available_seats = 2
  FROM scheduled_test_quotes t JOIN public.ride_offers o USING(offer_id)
  JOIN public.offer_route_quotes q ON q.quote_id = t.quote_id WHERE t.scenario = 'valid'),
  'declared driver publishes trusted F03 quote and selected settings');
SELECT pg_temp.assert_true((SELECT NOT is_driver_eligible FROM public.profiles
  WHERE id = auth.uid()), 'shared publication does not grant or require professional eligibility');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('expired')$q$, 'QUOTE_EXPIRED');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('foreign')$q$, 'QUOTE_INVALID');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('bad_price', '{"price":7}')$q$, 'QUOTE_INVALID');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('bad_tariff')$q$, 'QUOTE_INVALID');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('no_geometry')$q$, 'QUOTE_INVALID');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('valid', '{"originLat":-3.81}')$q$, 'QUOTE_MISMATCH');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('valid', '{"price":3}')$q$, 'QUOTE_MISMATCH');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('valid', '{"mode":"EXCLUSIVE"}')$q$, 'QUOTE_ALREADY_USED');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('valid', '{"preferences":{"music":"off"}}')$q$, 'QUOTE_ALREADY_USED');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('valid', '{"vehicle":"MOTO","seats":2}')$q$, 'INVALID_INPUT');
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('missing')$q$, 'QUOTE_REQUIRED');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.expect_error($q$SELECT pg_temp.publish_scheduled_test('valid')$q$, 'UNAUTHENTICATED');
RESET ROLE;

-- Lost-response recovery must still work after expiry and after seats are used.
UPDATE public.offer_route_quotes SET expires_at = clock_timestamp() - interval '1 minute'
  WHERE quote_id = (SELECT quote_id FROM scheduled_test_quotes WHERE scenario = 'valid');
SELECT set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
UPDATE public.ride_offers SET seats_remaining = 0, status = 'full'
  WHERE offer_id = (SELECT offer_id FROM scheduled_test_quotes WHERE scenario = 'valid');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((pg_temp.publish_scheduled_test('valid')->>'offer_id')::uuid =
  (SELECT offer_id FROM scheduled_test_quotes WHERE scenario = 'valid'),
  'identical retry after expiry and consumed seats returns the original offer');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.ride_offers
  WHERE route_quote_id = (SELECT quote_id FROM scheduled_test_quotes WHERE scenario = 'valid')),
  'retries do not duplicate publication');
RESET ROLE;

SELECT pg_temp.assert_true(NOT EXISTS (
  SELECT proname, pg_get_function_identity_arguments(oid), pg_get_functiondef(oid), proacl::text
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN
    ('is_driver_ready', 'guard_driver_platform_debt', 'set_flash_driver_online', 'discover_caronaa_quick_drivers')
  EXCEPT SELECT proname, args, definition, acl FROM scheduled_f07_before
), 'publication does not modify F07 or debt/readiness functions');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon',
  'public.publish_scheduled_driver_offer(text,text,double precision,double precision,double precision,double precision,date,time without time zone,integer,numeric,text,text,boolean,jsonb,jsonb,boolean,uuid)',
  'EXECUTE'), 'anonymous users cannot publish scheduled offers');
ROLLBACK;
