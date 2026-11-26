-- Synthetic records only. Executes actual RPCs, triggers and access checks.
\set ON_ERROR_STOP on
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
INSERT INTO public.profiles SELECT id,'Synthetic test account' FROM auth.users;
INSERT INTO public.professional_quick_rides
 (id,passenger_id,driver_id,origin_label,destination_label,municipality,requested_at,status,accepted_at,completed_at,estimated_fare_cents,expires_at)
VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',NULL,'A','B','Acarape','2025-01-15 10:00-03','SEARCHING',NULL,NULL,500,now()+interval '30 minutes'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',NULL,'A','B','Acarape','2025-01-15 11:00-03','SEARCHING',NULL,NULL,600,'2025-01-15 11:30-03'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',NULL,'A','B','Acarape','2025-01-15 12:00-03','SEARCHING',NULL,NULL,500,now()+interval '30 minutes'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','A','B','Acarape','2025-01-15 13:00-03','COMPLETED','2025-01-15 13:01:30-03','2025-01-15 13:20-03',1200,'2025-01-15 13:30-03'),
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','A','B','Acarape','2025-01-15 14:00-03','ACCEPTED','2025-01-15 14:02-03',NULL,800,'2025-01-15 14:30-03');
INSERT INTO public.ride_requests(request_id,user_id,origin,destination,created_at,status,passenger_price) VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','A','B','2025-01-15 15:00-03','matched',9),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','A','B','2025-01-15 16:00-03','open',6),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','A','B','2025-01-15 17:00-03','open',7);
INSERT INTO public.rides(ride_id,request_id,driver_user_id,passenger_user_id,created_at,updated_at,status,driver_accepted_at,completed_at,passenger_contribution) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','2025-01-15 15:00-03','2025-01-15 15:00:30-03','CANCELLED',NULL,NULL,9),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','2025-01-15 15:00:31-03','2025-01-15 15:20-03','COMPLETED','2025-01-15 15:01-03','2025-01-15 15:20-03',9);
INSERT INTO public.caronaa_quick_fare_quotes(id,ride_id,passenger_id,issued_at,customer_pays_cents) VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','2025-01-15 12:59-03',1200),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','2025-01-15 12:59:30-03',1200);
INSERT INTO public.quick_ride_driver_views VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',now(),now());
UPDATE public.quick_ride_driver_views SET last_viewed_at=last_viewed_at+interval '1 second';
DELETE FROM public.quick_ride_driver_views;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
UPDATE public.professional_quick_rides SET status='CANCELLED' WHERE id='10000000-0000-0000-0000-000000000001';
UPDATE public.ride_requests SET status='cancelled' WHERE request_id='20000000-0000-0000-0000-000000000003';
SET ROLE authenticated;
DO $$ BEGIN
 IF public.caronaa_record_passenger_cancel_reason('flash','10000000-0000-0000-0000-000000000001','WAIT_TOO_LONG') IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: passenger reason'; END IF;
 IF public.caronaa_record_passenger_cancel_reason('flash','10000000-0000-0000-0000-000000000001','PRICE') IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL: reason overwritten'; END IF;
 RAISE NOTICE 'PASS: cancellation reason persisted and immutable';
 BEGIN
  PERFORM public.admin_operations_order_evidence('flash','10000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'FAIL: unauthorized timeline';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: passenger denied admin timeline'; END;
 IF has_function_privilege(current_user,'public.caronaa_record_notification_receipt(text,uuid,uuid,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: passenger can write receipt'; END IF;
 RAISE NOTICE 'PASS: passenger denied trusted receipt RPC';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
UPDATE public.professional_quick_rides SET status='CANCELLED' WHERE id='10000000-0000-0000-0000-000000000005';
INSERT INTO public.quick_ride_driver_cancellations VALUES
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003',now(),'ACCEPTED','Synthetic reason');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.caronaa_order_passenger_cancellations)<>2 THEN RAISE EXCEPTION 'FAIL: passenger actor attribution'; END IF;
 IF (SELECT count(*) FROM public.caronaa_flash_driver_view_history)<>1 THEN RAISE EXCEPTION 'FAIL: durable views'; END IF;
 RAISE NOTICE 'PASS: driver cancellation excluded from passenger records and views survive deletion';
END $$;
SELECT set_config('request.jwt.claim.role','service_role',false);
SET ROLE service_role;
SELECT public.caronaa_record_notification_receipt('flash','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','push','test','provider_accepted');
SELECT public.caronaa_record_notification_receipt('flash','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','push','test','provider_accepted');
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb; s jsonb; h jsonb; e jsonb;
BEGIN
 r:=public.admin_operational_order_kpis('2025-01-15','2025-01-15','all'); s:=r->'summary';
 IF (s->>'requested')::int IS DISTINCT FROM 8 OR (s->>'accepted')::int IS DISTINCT FROM 3 OR (s->>'never_accepted')::int IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'FAIL: deduplicated requests %',s; END IF;
 RAISE NOTICE 'PASS: one request per service/id despite multiple attempts or quotes';
 IF (s->>'completed')::int IS DISTINCT FROM 2 OR (s->>'cancelled')::int IS DISTINCT FROM 3 OR (s->>'expired')::int IS DISTINCT FROM 1 OR (s->>'waiting')::int IS DISTINCT FROM 2 OR (s->>'unserved')::int IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'FAIL: exclusive outcomes %',s; END IF;
 RAISE NOTICE 'PASS: exclusive outcomes and terminal unmet demand';
 IF (s->>'mean_wait_seconds')::numeric IS DISTINCT FROM 90 OR (s->>'wait_samples')::int IS DISTINCT FROM 3 OR (s->>'unserved_quoted_value_cents')::int IS DISTINCT FROM 1800 THEN RAISE EXCEPTION 'FAIL: wait or gross values %',s; END IF;
 RAISE NOTICE 'PASS: wait and quoted amounts';
 h:=public.admin_operations_history_report('2025-01-15','2025-01-15','all',40,0);
 IF (h->>'total_rows')::int IS DISTINCT FROM 8 OR jsonb_array_length(h->'rows') IS DISTINCT FROM 8 THEN RAISE EXCEPTION 'FAIL: legacy report compatibility %',h; END IF;
 RAISE NOTICE 'PASS: existing report uses canonical count';
 e:=public.admin_operations_order_evidence('flash','10000000-0000-0000-0000-000000000001');
 IF (e#>>'{counts,drivers_with_recorded_view}')::int IS DISTINCT FROM 1 OR (e#>>'{counts,drivers_provider_accepted_observed}')::int IS DISTINCT FROM 1 OR e#>>'{counts,drivers_delivery_confirmed_observed}' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: evidence stage separation %',e; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e->'events') j WHERE j->>'event_type'='passenger_cancelled' AND j#>>'{detail,reason_code}'='WAIT_TOO_LONG') THEN RAISE EXCEPTION 'FAIL: timeline cancellation evidence'; END IF;
 RAISE NOTICE 'PASS: evidence timeline, receipt deduplication and unknown delivery';
END $$;
RESET ROLE;
