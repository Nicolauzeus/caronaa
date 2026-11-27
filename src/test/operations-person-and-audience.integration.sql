\set ON_ERROR_STOP on
-- Runs after the previous 27 groups; no production data.
INSERT INTO public.caronaa_order_notification_receipts(service,request_id,driver_id,channel,dispatch_key,stage)
VALUES('flash','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','in_app','radar_query_observed_v1','eligible');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
SET ROLE authenticated;
DO $$
DECLARE ids uuid[]:=ARRAY['10000000-0000-0000-0000-000000000003'::uuid];
BEGIN
 IF public.caronaa_ack_flash_radar_response(ids)<>1 THEN RAISE EXCEPTION 'FAIL: acknowledgement initial'; END IF;
 IF public.caronaa_ack_flash_radar_response(ids)<>0 THEN RAISE EXCEPTION 'FAIL: acknowledgement dedup'; END IF;
 IF public.caronaa_ack_flash_radar_response(ARRAY['10000000-0000-0000-0000-000000000001'::uuid])<>0 THEN RAISE EXCEPTION 'FAIL: unobserved acknowledgement'; END IF;
 RAISE NOTICE 'PASS: only own prior radar observations can be acknowledged idempotently';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF public.caronaa_ack_flash_radar_response(ARRAY['10000000-0000-0000-0000-000000000003'::uuid])<>0 THEN RAISE EXCEPTION 'FAIL: cross-driver ack'; END IF;
 BEGIN
  PERFORM public.admin_operational_person_history('00000000-0000-0000-0000-000000000003','driver','2025-01-15','2025-01-15');
  RAISE EXCEPTION 'FAIL: non-admin personal history';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: private personal history and cross-driver acknowledgement isolation';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb; s jsonb;
BEGIN
 r:=public.admin_operational_person_history('00000000-0000-0000-0000-000000000002','passenger','2025-01-15','2025-01-15','all',2,0);
 s:=r->'summary';
 IF (s->>'orders')::int IS DISTINCT FROM 8 OR (s->>'completed')::int IS DISTINCT FROM 2 OR jsonb_array_length(r->'rows') IS DISTINCT FROM 2 OR s->>'recorded_views' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: passenger history %',r; END IF;
 RAISE NOTICE 'PASS: passenger history deduplicated and paginated';
 r:=public.admin_operational_person_history('00000000-0000-0000-0000-000000000003','driver','2025-01-15','2025-01-15');
 s:=r->'summary';
 IF (s->>'accepted')::int IS DISTINCT FROM 3 OR (s->>'completed')::int IS DISTINCT FROM 2
 OR (s->>'cancelled')::int IS DISTINCT FROM 1 OR (s->>'recorded_views')::int IS DISTINCT FROM 1
 OR (s->>'mean_arrival_seconds')::numeric IS DISTINCT FROM 120 THEN RAISE EXCEPTION 'FAIL: driver history %',r; END IF;
 RAISE NOTICE 'PASS: individual driver counts and timing samples';
 r:=public.admin_operations_order_evidence('flash','10000000-0000-0000-0000-000000000003');
 IF (r#>>'{counts,drivers_radar_acknowledged}')::int IS DISTINCT FROM 1 OR r#>>'{counts,drivers_delivery_confirmed_observed}' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: radar ack confused with delivery %',r; END IF;
 RAISE NOTICE 'PASS: app acknowledgment remains distinct from trusted push delivery';
END $$;
RESET ROLE;
-- Shared attempt cancelled by passenger, while the original request remains OPEN.
INSERT INTO public.rides(ride_id,request_id,driver_user_id,passenger_user_id,created_at,updated_at,status)
VALUES('82000000-0000-4000-8000-000000000001','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',now(),now(),'CANCELLED');
INSERT INTO public.ride_status_history(ride_id,actor_user_id,created_at,from_status,to_status)
VALUES('82000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000002',now(),'MATCHED','CANCELLED');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SET ROLE authenticated;
DO $$ BEGIN
 IF NOT public.caronaa_record_shared_attempt_cancel_reason('82000000-0000-4000-8000-000000000001','PRICE') THEN RAISE EXCEPTION 'FAIL: first attempt reason'; END IF;
 IF public.caronaa_record_shared_attempt_cancel_reason('82000000-0000-4000-8000-000000000001','OTHER')
 OR public.caronaa_record_shared_attempt_cancel_reason('30000000-0000-0000-0000-000000000001','OTHER')
 THEN RAISE EXCEPTION 'FAIL: shared attempt reason attribution'; END IF;
 RAISE NOTICE 'PASS: shared cancellation reason requires recorded passenger actor and is immutable';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SET ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.admin_operations_order_evidence('shared','20000000-0000-0000-0000-000000000002');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'events') e WHERE e->>'event_type'='shared_attempt_cancel_reason' AND e#>>'{detail,reason_code}'='PRICE')
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.admin_operations_history_report('2025-01-15','2025-01-15','shared',40,0)->'rows') j WHERE j->>'id'='20000000-0000-0000-0000-000000000002' AND j->>'status'='SEARCHING')
 THEN RAISE EXCEPTION 'FAIL: attempt changed terminal outcome'; END IF;
 RAISE NOTICE 'PASS: shared attempt reason is visible without converting open request into cancelled order';
END $$;
RESET ROLE;
-- Actual candidate predicate if PostGIS installed; otherwise the fixture explicitly
-- substitutes only that source. Both paths test the real capture trigger.
SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgis') AS have_postgis \gset
\if :have_postgis
 INSERT INTO public.professional_driver_authorizations VALUES
 ('00000000-0000-0000-0000-000000000003',true,'CAR'),('00000000-0000-0000-0000-000000000004',true,'CAR'),
 ('00000000-0000-0000-0000-000000000005',true,'CAR'),('00000000-0000-0000-0000-000000000006',true,'MOTO'),
 ('00000000-0000-0000-0000-000000000007',true,'CAR');
 INSERT INTO public.professional_presence(user_id,is_available,last_seen_at) SELECT user_id,true,now() FROM public.professional_driver_authorizations;
 INSERT INTO public.professional_driver_locations SELECT user_id,50,now(),now() FROM public.professional_driver_authorizations;
 INSERT INTO public.flash_driver_presence(user_id,is_online,last_gps_at,last_sampled_at,last_accuracy_m,available_seats,dispatch_mode,last_lat,last_lng,route_geom) VALUES
 ('00000000-0000-0000-0000-000000000003',true,now(),now(),50,4,'ALL',-4.22,-38.73,NULL),
 ('00000000-0000-0000-0000-000000000004',true,now(),now(),50,4,'EXCLUSIVE',-5.22,-38.73,NULL),
 ('00000000-0000-0000-0000-000000000005',true,now(),now(),50,4,'ON_ROUTE',-5.22,-38.73,public.ST_GeomFromText('LINESTRING(-38.74 -4.22,-38.72 -4.22)',4326)),
 ('00000000-0000-0000-0000-000000000006',true,now(),now(),50,4,'ALL',-4.22,-38.73,NULL),
 ('00000000-0000-0000-0000-000000000007',true,now()-interval '3 minutes',now()-interval '3 minutes',50,4,'ALL',-4.22,-38.73,NULL);
 INSERT INTO public.professional_quick_rides(id,passenger_id,origin_label,destination_label,municipality,requested_at,status,expires_at,origin_lat,origin_lng)
 VALUES('81000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000002','A','B','Acarape',now(),'SEARCHING',now()+interval '30 minutes',-4.22,-38.73),
 ('81000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000002','A','B','Acarape',now(),'SEARCHING',now()+interval '30 minutes',-20,-50);
\else
 INSERT INTO public.professional_quick_rides(id,passenger_id,origin_label,destination_label,municipality,requested_at,status,expires_at)
 VALUES('81000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000002','A','B','Acarape',now(),'SEARCHING',now()+interval '30 minutes'),
 ('81000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000002','A','B','Acarape',now(),'SEARCHING',now()+interval '30 minutes');
\endif
DO $$
DECLARE ids uuid[];
BEGIN
 SELECT driver_ids INTO ids FROM public.caronaa_flash_creation_candidates WHERE request_id='81000000-0000-4000-8000-000000000001';
 IF ids IS DISTINCT FROM ARRAY['00000000-0000-0000-0000-000000000003'::uuid,'00000000-0000-0000-0000-000000000005'::uuid]
 OR (SELECT cardinality(driver_ids) FROM public.caronaa_flash_creation_candidates WHERE request_id='81000000-0000-4000-8000-000000000002') IS DISTINCT FROM 0
 THEN RAISE EXCEPTION 'FAIL: creation candidate snapshot %',ids; END IF;
 RAISE NOTICE 'PASS: creation snapshot stores exact source IDs and distinguishes measured zero';
END $$;
CREATE FUNCTION pg_temp.fail_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic snapshot failure'; END $$;
CREATE TRIGGER fail_snapshot BEFORE INSERT ON public.caronaa_flash_creation_candidates FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_snapshot();
INSERT INTO public.professional_quick_rides(id,passenger_id,origin_label,destination_label,municipality,requested_at,status,expires_at)
VALUES('81000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000002','A','B','Acarape',now(),'SEARCHING',now()+interval '30 minutes');
DROP TRIGGER fail_snapshot ON public.caronaa_flash_creation_candidates;
SET ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.admin_operations_order_evidence('flash','81000000-0000-4000-8000-000000000003');
 IF r IS NULL OR r#>>'{counts,creation_radar_candidates}' IS NOT NULL THEN RAISE EXCEPTION 'FAIL: snapshot failure blocked order or fabricated zero %',r; END IF;
 RAISE NOTICE 'PASS: snapshot failure preserves ride creation and unknown audience';
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$
DECLARE r jsonb; d date:=(now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
 r:=public.admin_operational_audience_diagnostics(d,d,'all');
 IF (r->>'flash_orders')::int IS DISTINCT FROM 3 OR (r->>'snapshot_known')::int IS DISTINCT FROM 2
 OR (r->>'snapshot_zero')::int IS DISTINCT FROM 1 OR (r->>'snapshot_with_candidates')::int IS DISTINCT FROM 1
 OR (r->>'snapshot_unknown')::int IS DISTINCT FROM 1
 OR public.admin_operational_audience_diagnostics(d,d,'shared') IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: audience diagnostics %',r; END IF;
 RAISE NOTICE 'PASS: audience diagnostics reconcile known zero, known candidates and unknown coverage';
END $$;
RESET ROLE;
