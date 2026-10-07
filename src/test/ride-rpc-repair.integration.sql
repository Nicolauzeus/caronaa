\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END;
$$;
SELECT pg_temp.assert_true(to_regclass('public.ride_routines') IS NOT NULL AND to_regclass('public.admin_driver_reviews') IS NOT NULL, 'routine and review structures restored');
SELECT pg_temp.assert_true((SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='create_ride_offer') = 1, 'offer RPC has one unambiguous signature');
SELECT pg_temp.assert_true((SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='create_ride_request') = 1, 'request RPC has one unambiguous signature');
SELECT pg_temp.assert_true((SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='search_available_ride_offers') = 1, 'search RPC has one unambiguous signature');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.refresh_ride_routine_occurrences()','EXECUTE'), 'anonymous caller cannot materialize routines');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.get_admin_operation_data()','EXECUTE'), 'admin snapshot not exposed to anonymous caller');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric)','EXECUTE'), 'anonymous caller cannot create rides');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.refresh_ride_routine_occurrences()','EXECUTE'), 'routine RPC executable by authenticated caller');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.get_admin_operation_data()','EXECUTE'), 'admin RPC executable with internal role check');

INSERT INTO auth.users(email) VALUES('admin@rpc.test') RETURNING id AS administrator \gset
INSERT INTO auth.users(email) VALUES('user@rpc.test') RETURNING id AS regular_user \gset
SELECT set_config('request.jwt.claim.sub', :'administrator', true);
SET LOCAL ROLE authenticated;
SELECT public.create_ride_offer('Origem RPC','Destino RPC', current_date + 1, '09:00',2) AS offer \gset
SELECT pg_temp.assert_true((SELECT total_price = 30 AND time_tolerance_minutes = 15 FROM public.ride_offers WHERE offer_id=:'offer'), 'offer accepts omitted optional arguments without ambiguity');
SELECT pg_temp.assert_true(public.get_admin_operation_data() ?& ARRAY['offers','requests','rides','matches','users','reviews','forms','contacts'], 'admin snapshot preserves its complete contract');
SELECT public.refresh_ride_routine_occurrences();
SELECT set_config('request.jwt.claim.sub', :'regular_user', true);
SELECT public.create_ride_request('Origem RPC','Destino RPC',current_date + 1,'09:00',1) AS request \gset
SELECT pg_temp.assert_true((SELECT status='matched' FROM public.ride_requests WHERE request_id=:'request'), 'restored creation retains automatic matching');
DO $$ BEGIN
  BEGIN
    PERFORM public.get_admin_operation_data();
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: non-admin snapshot denied'; RETURN;
  END;
  RAISE EXCEPTION 'Non-admin gained admin access';
END; $$;
ROLLBACK;
