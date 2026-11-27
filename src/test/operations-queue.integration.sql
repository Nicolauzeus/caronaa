\set ON_ERROR_STOP on
-- Existing order 1 was inserted and then cancelled; no fake delivery.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.admin_operations_order_evidence('flash','10000000-0000-0000-0000-000000000001');
 IF (r#>>'{counts,queue_signals_recorded}')::int IS DISTINCT FROM 2
 OR r#>>'{counts,drivers_delivery_confirmed_observed}' IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'events') j WHERE j->>'event_type'='queue_signal_recorded' AND j#>>'{detail,evidence}'='municipal_queue_upsert_not_delivery')
 THEN RAISE EXCEPTION 'FAIL: queue signal evidence %',r; END IF;
 IF has_table_privilege(current_user,'public.caronaa_flash_queue_signal_history','SELECT') THEN RAISE EXCEPTION 'FAIL: direct queue history access'; END IF;
 RAISE NOTICE 'PASS: real queue upserts retained separately from delivery with private storage';
END $$;
RESET ROLE;
DO $$
DECLARE before_n bigint; after_n bigint;
BEGIN
 SELECT count(*) INTO before_n FROM public.caronaa_flash_queue_signal_history;
 UPDATE public.professional_quick_rides SET status=status WHERE id='10000000-0000-0000-0000-000000000003';
 SELECT count(*) INTO after_n FROM public.caronaa_flash_queue_signal_history;
 IF before_n<>after_n THEN RAISE EXCEPTION 'FAIL: no-op status inflated queue history'; END IF;
 RAISE NOTICE 'PASS: no-op status preserves signal without duplicate evidence';
END $$;
CREATE FUNCTION pg_temp.fail_queue_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Synthetic evidence failure'; END $$;
CREATE TRIGGER fail_queue_history BEFORE INSERT ON public.caronaa_flash_queue_signal_history FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_queue_history();
DO $$
DECLARE old_signal timestamptz; new_signal timestamptz;
BEGIN
 SELECT e.changed_at INTO old_signal FROM public.caronaa_quick_queue_events e JOIN public.professional_quick_rides q USING(municipality) WHERE q.id='10000000-0000-0000-0000-000000000003';
 UPDATE public.professional_quick_rides SET status='CANCELLED' WHERE id='10000000-0000-0000-0000-000000000003';
 SELECT e.changed_at INTO new_signal FROM public.caronaa_quick_queue_events e JOIN public.professional_quick_rides q USING(municipality) WHERE q.id='10000000-0000-0000-0000-000000000003';
 IF new_signal IS NULL OR new_signal<old_signal OR NOT EXISTS(SELECT 1 FROM public.professional_quick_rides WHERE id='10000000-0000-0000-0000-000000000003' AND status='CANCELLED') THEN RAISE EXCEPTION 'FAIL: telemetry blocked existing signal'; END IF;
 RAISE NOTICE 'PASS: queue history failure preserves ride update and existing queue signal';
END $$;
DROP TRIGGER fail_queue_history ON public.caronaa_flash_queue_signal_history;
