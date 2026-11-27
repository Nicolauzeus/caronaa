-- Read-only post-install audit. Run with an authorized database administrator.
-- Never apply the transition SQL again; this file performs no persistent writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_read,
       has_table_privilege('authenticated',c.oid,'SELECT') AS auth_read,
       has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS auth_can_write
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
  ('caronaa_f07_operation_control','caronaa_f07_operation_control_events')
ORDER BY c.relname;

SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
  ('caronaa_f07_operation_control','caronaa_f07_operation_control_events')
ORDER BY table_name,ordinal_position;

SELECT tablename,policyname,roles,cmd,qual FROM pg_policies
WHERE schemaname='public' AND tablename IN
  ('caronaa_f07_operation_control','caronaa_f07_operation_control_events')
ORDER BY tablename,policyname;

SELECT id,enabled,updated_at FROM public.caronaa_f07_operation_control;
SELECT id,enabled FROM public.caronaa_f07_pilot_control;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
       position('public.caronaa_f07_operation_dispatch_allowed()' IN p.prosrc)>0 AS uses_permanent_gate,
       position('public.caronaa_f07_test_dispatch_allowed()' IN p.prosrc)>0 AS uses_legacy_gate
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'caronaa_f07_operation_dispatch_allowed','admin_set_f07_operation_enabled',
  'caronaa_f07_test_dispatch_allowed','caronaa_f07_pilot_activate_driver',
  'caronaa_quick_region_status','caronaa_quick_submit_quoted',
  'guard_caronaa_quick_driver_assignment')
ORDER BY p.proname;

-- Configuration-level coverage, NOT a substitute for the authenticated RPC smoke.
SELECT c.municipality,v.vehicle_type,
       CASE WHEN c.car_enabled AND v.vehicle_type='CAR'
              OR c.moto_enabled AND v.vehicle_type='MOTO'
            THEN coalesce(r.public_discovery_enabled AND r.dispatch_enabled AND t.published,false)
                 AND coalesce((SELECT enabled FROM public.caronaa_f07_operation_control WHERE id=true),false)
            ELSE false END AS configured_enabled
FROM public.caronaa_service_municipalities c
CROSS JOIN (VALUES ('CAR'),('MOTO')) AS v(vehicle_type)
LEFT JOIN public.professional_service_regions r ON r.municipality=c.municipality
LEFT JOIN public.caronaa_quick_tariff_policies t
  ON t.pricing_region=c.pricing_region AND t.vehicle_type=v.vehicle_type
ORDER BY c.municipality,v.vehicle_type;

ROLLBACK;
