-- Runs after the six-migration integration suite, using synthetic data only.
\set ON_ERROR_STOP on
INSERT INTO public.caronaa_quick_fare_quotes(id,ride_id,passenger_id,issued_at,customer_pays_cents) VALUES
 ('40000000-0000-0000-0000-000000000003',NULL,'00000000-0000-0000-0000-000000000002','2025-01-15 09:59-03',500);
INSERT INTO public.offer_route_quotes VALUES
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','2025-01-15 14:59-03'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','2025-01-15 14:59-03'),
 ('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','2025-01-15 15:59-03'),
 ('50000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','2025-01-15 16:59-03');
UPDATE public.ride_requests SET route_quote_id='50000000-0000-0000-0000-000000000001'
 WHERE request_id='20000000-0000-0000-0000-000000000001';
UPDATE public.ride_requests SET route_quote_id='50000000-0000-0000-0000-000000000004'
 WHERE request_id='20000000-0000-0000-0000-000000000003'; -- wrong owner must not link
INSERT INTO public.ride_offers VALUES
 ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','2025-01-15 15:00-03');
INSERT INTO public.ride_status_history(ride_id,actor_user_id,created_at,from_status,to_status) VALUES
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','2025-01-15 15:00:30-03','MATCHED','CANCELLED');
INSERT INTO public.flash_order_driver_skips(ride_id,driver_id,skipped_at) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','2025-01-15 10:01-03');
UPDATE public.professional_quick_rides SET arrived_at='2025-01-15 13:03:30-03'
 WHERE id='10000000-0000-0000-0000-000000000004';
INSERT INTO public.caronaa_order_notification_receipts(service,request_id,driver_id,channel,dispatch_key,stage) VALUES
 ('flash','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','push','a','send_failed'),
 ('flash','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','push','b','send_failed');
INSERT INTO public.quick_ride_payment_events VALUES
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','PASSENGER_DECLARED','2025-01-15 13:21-03'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','DRIVER_ACKNOWLEDGED','2025-01-15 13:22-03');
INSERT INTO public.caronaa_operational_presence_hours VALUES
 ('00000000-0000-0000-0000-000000000003','driver','2025-01-15 10:00-03');
INSERT INTO public.caronaa_f07_operations_incidents VALUES ('GPS','RESOLVED','2025-01-15 10:00-03');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb; f jsonb; s jsonb; d jsonb; h jsonb; e jsonb;
BEGIN
 r:=public.admin_operational_conversion_retention('2025-01-15','2025-01-15','all');
 SELECT j INTO f FROM jsonb_array_elements(r->'quote_conversion') j WHERE j->>'service'='flash';
 SELECT j INTO s FROM jsonb_array_elements(r->'quote_conversion') j WHERE j->>'service'='shared';
 IF (f->>'issued')::int IS DISTINCT FROM 3 OR (f->>'linked_to_request')::int IS DISTINCT FROM 2
 OR (f->>'no_persisted_link')::int IS DISTINCT FROM 1
 OR (s->>'issued')::int IS DISTINCT FROM 4 OR (s->>'linked_to_request')::int IS DISTINCT FROM 1
 OR (s->>'linked_to_offer')::int IS DISTINCT FROM 1 OR (s->>'no_persisted_link')::int IS DISTINCT FROM 2
 THEN RAISE EXCEPTION 'FAIL: explicit quote linkage %',r; END IF;
 RAISE NOTICE 'PASS: quote ownership, offer separation and exact persisted conversion';
 r:=public.admin_operational_driver_performance('2025-01-15','2025-01-15','all',50,0);
 SELECT j INTO d FROM jsonb_array_elements(r->'rows') j WHERE j->>'driver_id'='00000000-0000-0000-0000-000000000003';
 IF (r->>'total_drivers')::int IS DISTINCT FROM 2 OR (d->>'accepted_orders')::int IS DISTINCT FROM 3
 OR (d->>'completed_orders')::int IS DISTINCT FROM 2 OR (d->>'driver_cancelled_orders')::int IS DISTINCT FROM 1
 OR (d->>'recorded_views')::int IS DISTINCT FROM 1 OR (d->>'recorded_skips')::int IS DISTINCT FROM 1
 OR (d->>'observed_order_pairs')::int IS DISTINCT FROM 5 OR (d->>'mean_arrival_seconds')::numeric IS DISTINCT FROM 120
 OR d->>'observed_delivered_orders' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: driver evidence %',r; END IF;
 RAISE NOTICE 'PASS: driver pair deduplication, skip, acceptance, arrival and cancellation';
 r:=public.admin_operational_driver_performance('2025-01-15','2025-01-15','all',1,1);
 IF jsonb_array_length(r->'rows') IS DISTINCT FROM 1 OR (r->>'total_drivers')::int IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'FAIL: driver paging %',r; END IF;
 RAISE NOTICE 'PASS: driver pagination preserves total';
 r:=public.admin_operational_cancellation_breakdown('2025-01-15','2025-01-15','all');
 IF (r->>'total_cancelled')::int IS DISTINCT FROM 3
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'groups') j WHERE j->>'actor'='PASSENGER' AND j->>'reason_code'='WAIT_TOO_LONG')
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'groups') j WHERE j->>'actor'='DRIVER' AND (j->>'after_acceptance')::int=1)
 THEN RAISE EXCEPTION 'FAIL: cancellation attribution %',r; END IF;
 RAISE NOTICE 'PASS: terminal cancellation attribution excludes failed attempts on completed orders';
 r:=public.admin_operational_diagnostics('2025-01-15','2025-01-15','all'); f:=r->'flash_manual_pix'; s:=r->'notification_diagnostics';
 SELECT j INTO h FROM jsonb_array_elements(r->'flash_hourly_supply_demand') j WHERE (j->>'hour')::int=10;
 SELECT j INTO e FROM jsonb_array_elements(r->'flash_hourly_supply_demand') j WHERE (j->>'hour')::int=11;
 IF (f->>'bilateral_pix_orders')::int IS DISTINCT FROM 1 OR (f->>'bilateral_quoted_value_cents')::int IS DISTINCT FROM 1200
 OR (s->>'orders_with_observed_send_failure')::int IS DISTINCT FROM 1
 OR (s->>'unserved_with_observed_send_failure')::int IS DISTINCT FROM 1
 OR (h->>'observed_driver_hours')::int IS DISTINCT FROM 1 OR e->>'observed_driver_hours' IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: observed diagnostics %',r; END IF;
 RAISE NOTICE 'PASS: bilateral Pix, failed-send deduplication and unknown supply';
 r:=public.admin_operational_conversion_retention('2025-01-20','2025-01-20','flash');
 IF (r#>>'{quote_conversion,0,issued}')::int IS DISTINCT FROM 0 OR r#>>'{quote_conversion,0,request_link_pct}' IS NOT NULL
 OR r#>>'{retention,previous_cohort_retention_pct}' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: empty denominators %',r; END IF;
 RAISE NOTICE 'PASS: empty cohorts return unknown rates, not fabricated zero';
END $$;
RESET ROLE;
-- Equal-length retention cohorts with known past, new and returning accounts.
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000005'),('00000000-0000-0000-0000-000000000006'),
 ('00000000-0000-0000-0000-000000000007');
INSERT INTO public.ride_requests(request_id,user_id,origin,destination,created_at,status) VALUES
 ('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','A','B','2025-02-01 10:00-03','open'),
 ('70000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','A','B','2025-02-01 10:00-03','open'),
 ('70000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','A','B','2025-02-02 10:00-03','open'),
 ('70000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','A','B','2025-02-02 10:00-03','open'),
 ('70000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000007','A','B','2025-01-25 10:00-03','open'),
 ('70000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007','A','B','2025-02-02 11:00-03','open');
SET ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.admin_operational_conversion_retention('2025-02-02','2025-02-02','shared')->'retention';
 IF (r->>'current_passengers')::int IS DISTINCT FROM 3 OR (r->>'previous_passengers')::int IS DISTINCT FROM 2
 OR (r->>'retained_from_previous')::int IS DISTINCT FROM 1 OR (r->>'first_observed_in_period')::int IS DISTINCT FROM 1
 OR (r->>'returned_after_gap')::int IS DISTINCT FROM 1 OR (r->>'previous_not_returned')::int IS DISTINCT FROM 1
 OR (r->>'previous_cohort_retention_pct')::numeric IS DISTINCT FROM 50 THEN RAISE EXCEPTION 'FAIL: retention %',r; END IF;
 RAISE NOTICE 'PASS: retention, first observation and returned-after-gap cohorts';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SET ROLE authenticated;
DO $$
DECLARE q text; denied int:=0;
BEGIN
 FOREACH q IN ARRAY ARRAY[
  'SELECT public.admin_operational_conversion_retention(''2025-01-15'',''2025-01-15'',''all'')',
  'SELECT public.admin_operational_driver_performance(''2025-01-15'',''2025-01-15'',''all'',50,0)',
  'SELECT public.admin_operational_cancellation_breakdown(''2025-01-15'',''2025-01-15'',''all'')',
  'SELECT public.admin_operational_diagnostics(''2025-01-15'',''2025-01-15'',''all'')'
 ] LOOP
  BEGIN EXECUTE q; EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 END LOOP;
 IF denied<>4 THEN RAISE EXCEPTION 'FAIL: advanced RPC access denied only % times',denied; END IF;
 RAISE NOTICE 'PASS: all four advanced analytics RPCs deny non-admin access';
END $$;
RESET ROLE;
