\set ON_ERROR_STOP on
-- Runs after the advanced integration suite; source records remain synthetic.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb; original jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO original FROM public.get_flash_driver_radar_orders() x;
 r:=public.get_flash_driver_radar_orders_observed();
 IF r IS DISTINCT FROM original OR jsonb_array_length(r)<>1 THEN RAISE EXCEPTION 'FAIL: radar response changed'; END IF;
 IF public.get_flash_driver_radar_orders_observed() IS DISTINCT FROM r THEN RAISE EXCEPTION 'FAIL: radar repeat'; END IF;
 RAISE NOTICE 'PASS: observed radar preserves authorized result';
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.caronaa_order_notification_receipts WHERE dispatch_key='radar_query_observed_v1')<>1
 OR EXISTS(SELECT 1 FROM public.caronaa_order_notification_receipts WHERE dispatch_key='radar_query_observed_v1' AND stage<>'eligible')
 THEN RAISE EXCEPTION 'FAIL: observation duplicates or fake delivery'; END IF;
 RAISE NOTICE 'PASS: radar observation deduplicates without inventing delivery';
END $$;
DELETE FROM public.caronaa_order_notification_receipts WHERE dispatch_key='radar_query_observed_v1';
CREATE FUNCTION pg_temp.fail_telemetry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Synthetic telemetry failure'; END $$;
CREATE TRIGGER fail_telemetry BEFORE INSERT ON public.caronaa_order_notification_receipts
 FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_telemetry();
SET ROLE authenticated;
DO $$ BEGIN
 IF jsonb_array_length(public.get_flash_driver_radar_orders_observed())<>1 THEN RAISE EXCEPTION 'FAIL: telemetry failure blocked radar'; END IF;
 RAISE NOTICE 'PASS: telemetry write failure does not block radar';
END $$;
RESET ROLE;
DROP TRIGGER fail_telemetry ON public.caronaa_order_notification_receipts;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF public.get_flash_driver_radar_orders_observed() IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'FAIL: radar exposed unauthorized order'; END IF;
 BEGIN
  PERFORM public.admin_operational_overview('2025-01-15','2025-01-15','all');
  RAISE EXCEPTION 'FAIL: non-admin overview';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_operational_quote_funnel('2025-01-15','2025-01-15','all');
  RAISE EXCEPTION 'FAIL: non-admin funnel';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: radar scope and administrative permissions preserved';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb; f jsonb; s jsonb;
BEGIN
 r:=public.admin_operational_overview('2025-01-15','2025-01-15','all');
 SELECT j INTO f FROM jsonb_array_elements(r#>'{funnel,rows}') j WHERE j->>'service'='flash';
 SELECT j INTO s FROM jsonb_array_elements(r#>'{funnel,rows}') j WHERE j->>'service'='shared';
 IF (f->>'quotes_issued')::int IS DISTINCT FROM 3 OR (f->>'quotes_with_request')::int IS DISTINCT FROM 2
 OR (f->>'quotes_with_acceptance')::int IS DISTINCT FROM 2 OR (f->>'quotes_with_completion')::int IS DISTINCT FROM 2
 OR (s->>'quotes_issued')::int IS DISTINCT FROM 4 OR (s->>'quotes_with_request')::int IS DISTINCT FROM 1
 OR (s->>'quotes_with_acceptance')::int IS DISTINCT FROM 1 OR (s->>'quotes_with_completion')::int IS DISTINCT FROM 1
 THEN RAISE EXCEPTION 'FAIL: quote funnel %',r->'funnel'; END IF;
 RAISE NOTICE 'PASS: quote funnel retains quote units through completion';
 IF (r#>>'{kpis,summary,requested}')::int IS DISTINCT FROM 8 OR
 (r#>>'{kpis,summary,cancelled}')::int IS DISTINCT FROM (r#>>'{cancellations,total_cancelled}')::int
 THEN RAISE EXCEPTION 'FAIL: overview inconsistent'; END IF;
 RAISE NOTICE 'PASS: overview reuses consistent canonical metrics';
 r:=public.admin_operational_quote_funnel('2025-01-20','2025-01-20','flash');
 IF (r#>>'{rows,0,quotes_issued}')::int IS DISTINCT FROM 0 OR r#>>'{rows,0,completion_pct}' IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: empty quote funnel'; END IF;
 RAISE NOTICE 'PASS: empty funnel preserves unknown denominator';
END $$;
RESET ROLE;
