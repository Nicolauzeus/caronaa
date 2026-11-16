-- Isolated database only; run with scripts/test-scheduled-readback.mjs.
-- Every synthetic row is rolled back. No CRM/contact table is present.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END;
$$;
INSERT INTO public.profiles(id, full_name, avatar_url) VALUES
  ('40000000-0000-4000-8000-000000000001', 'Motorista A', NULL),
  ('40000000-0000-4000-8000-000000000002', 'Motorista B', NULL),
  ('40000000-0000-4000-8000-000000000003', 'Passageira confirmada', 'confirmed-avatar'),
  ('40000000-0000-4000-8000-000000000004', 'Proposta ainda não aceita', 'private-avatar'),
  ('40000000-0000-4000-8000-000000000005', 'Passageira em viagem', NULL);
INSERT INTO public.ride_offers(
  offer_id, user_id, origin, destination, ride_date, departure_time, status,
  available_seats, seats_remaining, total_price, booking_mode, service_tier, vehicle_type, meeting_point
)
SELECT ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  CASE WHEN n = 3 THEN '40000000-0000-4000-8000-000000000002'::uuid
    ELSE '40000000-0000-4000-8000-000000000001'::uuid END,
  'Origem de teste', 'Destino de teste',
  CASE WHEN n = 6 THEN current_date - 2 ELSE current_date + 1 END, '10:00:00',
  CASE WHEN n = 5 THEN 'cancelled' ELSE 'available' END,
  CASE WHEN n = 1 THEN 1 ELSE 3 END, CASE WHEN n = 1 THEN 1 ELSE 3 END, 6, 'ALL', CASE WHEN n = 4 THEN 'FLASH' WHEN n = 7 THEN NULL ELSE 'SCHEDULED' END,
  CASE WHEN n = 1 THEN 'MOTO' ELSE 'CAR' END, 'Ponto da oferta'
FROM generate_series(1, 7) n;
INSERT INTO public.ride_requests(request_id, user_id, passenger_count, pickup_point)
SELECT ('60000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  CASE WHEN n IN (1, 4, 5, 7, 8) THEN '40000000-0000-4000-8000-000000000003'::uuid
    WHEN n = 2 THEN '40000000-0000-4000-8000-000000000005'::uuid
    ELSE '40000000-0000-4000-8000-000000000004'::uuid END,
  1, CASE WHEN n = 1 THEN 'Entrada combinada' ELSE NULL END
FROM generate_series(1, 8) n;
INSERT INTO public.rides(
  ride_id, match_id, request_id, offer_id, passenger_user_id, driver_user_id, status,
  passenger_accepted_at, driver_accepted_at, passenger_group_total, passenger_contribution
)
SELECT ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('80000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('60000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '50000000-0000-4000-8000-000000000002'::uuid,
  CASE WHEN n = 2 THEN '40000000-0000-4000-8000-000000000005'::uuid
    WHEN n = 3 THEN '40000000-0000-4000-8000-000000000004'::uuid
    ELSE '40000000-0000-4000-8000-000000000003'::uuid END,
  CASE WHEN n = 5 THEN '40000000-0000-4000-8000-000000000002'::uuid
    ELSE '40000000-0000-4000-8000-000000000001'::uuid END,
  CASE WHEN n = 2 THEN 'IN_PROGRESS' WHEN n = 3 THEN 'MATCHED' WHEN n = 4 THEN 'CANCELLED' ELSE 'CONFIRMED' END,
  CASE WHEN n IN (3, 7) THEN NULL ELSE now() END, CASE WHEN n IN (3, 8) THEN NULL ELSE now() END,
  CASE WHEN n = 2 THEN NULL ELSE 4.50 END, 3
FROM generate_series(1, 8) n;

CREATE TEMP TABLE scheduled_before_rows AS SELECT
  (SELECT jsonb_agg(to_jsonb(o) ORDER BY offer_id) FROM public.ride_offers o) AS offers,
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY ride_id) FROM public.rides r) AS rides;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(jsonb_array_length(public.get_driver_scheduled_trips()) = 3,
  'own scheduled offers include legacy tier and exclude other owner, Flash, cancelled and past');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_driver_scheduled_trips()) t
  WHERE t->>'offer_id' = '50000000-0000-4000-8000-000000000001' AND t->'passengers' = '[]'),
  'newly published own offer remains visible with no passengers');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_driver_scheduled_trips()) t
  WHERE t->>'offer_id' = '50000000-0000-4000-8000-000000000001' AND t->>'vehicle_type' = 'MOTO'
    AND ((t->>'departure_at')::timestamptz AT TIME ZONE 'UTC')::time = '13:00:00'),
  'vehicle is preserved and ten AM Fortaleza is thirteen UTC');
SELECT pg_temp.assert_true((SELECT jsonb_array_length(t->'passengers') = 2
  FROM jsonb_array_elements(public.get_driver_scheduled_trips()) t
  WHERE t->>'offer_id' = '50000000-0000-4000-8000-000000000002'),
  'only confirmed or in-progress bilateral participants are listed');
SELECT pg_temp.assert_true(EXISTS(SELECT 1
  FROM jsonb_array_elements(public.get_driver_scheduled_trips()) t,
    jsonb_array_elements(t->'passengers') p
  WHERE p->>'id' = '40000000-0000-4000-8000-000000000003'
    AND p->>'name' = 'Passageira confirmada' AND p->>'avatar_url' = 'confirmed-avatar'
    AND p->>'meeting_name' = 'Entrada combinada' AND (p->>'agreed_fare')::numeric = 4.50),
  'confirmed participant presentation and stored contracted fare use client aliases');
SELECT pg_temp.assert_true(EXISTS(SELECT 1
  FROM jsonb_array_elements(public.get_driver_scheduled_trips()) t,
    jsonb_array_elements(t->'passengers') p
  WHERE p->>'id' = '40000000-0000-4000-8000-000000000005'
    AND p->>'meeting_name' = 'Ponto da oferta' AND (p->>'agreed_fare')::numeric = 3),
  'legacy contribution and saved offer meeting point remain available');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1
  FROM jsonb_array_elements(public.get_driver_scheduled_trips()) t,
    jsonb_array_elements(t->'passengers') p
  WHERE p->>'whatsapp' IS NOT NULL OR p->>'avatar_url' = 'private-avatar'
    OR p->>'ride_id' IN ('70000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000006')),
  'unaccepted, wrong-driver, wrong-request-owner and contact data are not exposed');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.profiles
  WHERE id = '40000000-0000-4000-8000-000000000003'),
  'profile RLS still blocks unrelated direct profile access');
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.assert_true(jsonb_array_length(public.get_driver_scheduled_trips()) = 1
  AND public.get_driver_scheduled_trips()->0->>'offer_id' = '50000000-0000-4000-8000-000000000003',
  'another driver sees only their own offer');
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
SELECT pg_temp.assert_true(public.get_driver_scheduled_trips() = '[]',
  'passenger cannot list the driver offers through this RPC');
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.get_driver_scheduled_trips();
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM = 'UNAUTHENTICATED' THEN RAISE NOTICE 'PASS: missing session is rejected'; RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'FAIL: missing session was accepted';
END;
$$;
RESET ROLE;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.get_driver_scheduled_trips()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_driver_scheduled_trips()', 'EXECUTE'),
  'RPC execute privilege is limited to authenticated callers');
SELECT pg_temp.assert_true((SELECT
  offers = (SELECT jsonb_agg(to_jsonb(o) ORDER BY offer_id) FROM public.ride_offers o)
  AND rides = (SELECT jsonb_agg(to_jsonb(r) ORDER BY ride_id) FROM public.rides r)
  FROM scheduled_before_rows), 'scheduled readback never mutates offers or rides');
ROLLBACK;
