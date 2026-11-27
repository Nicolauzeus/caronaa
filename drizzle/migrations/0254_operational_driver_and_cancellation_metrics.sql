-- 0254 | F09: driver activity by distinct request/driver and evidenced cancellation attribution.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_driver_performance(
 p_from date,p_to date,p_service text DEFAULT 'all',p_limit integer DEFAULT 50,p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $drivers$
DECLARE v_from timestamptz; v_until timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared')
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
 THEN RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH orders AS MATERIALIZED (
  SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service)
 ), evidence AS (
  SELECT o.service,o.id,v.driver_id,'viewed'::text AS kind,
   CASE WHEN v.first_viewed_at BETWEEN o.requested_at AND now() THEN extract(epoch FROM v.first_viewed_at-o.requested_at) END AS elapsed
  FROM orders o JOIN public.caronaa_flash_driver_view_history v ON o.service='flash' AND v.ride_id=o.id::uuid
  UNION ALL
  SELECT o.service,o.id,s.driver_id,'skipped',NULL FROM orders o
  JOIN public.flash_order_driver_skips s ON o.service='flash' AND s.ride_id=o.id::uuid
  UNION ALL
  SELECT o.service,o.id,q.driver_id,'accepted',
   CASE WHEN q.accepted_at BETWEEN o.requested_at AND now() THEN extract(epoch FROM q.accepted_at-o.requested_at) END
  FROM orders o JOIN public.professional_quick_rides q ON o.service='flash' AND q.id=o.id::uuid
  WHERE q.driver_id IS NOT NULL AND (q.accepted_at IS NOT NULL OR upper(q.status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW','COMPLETED'))
  UNION ALL
  SELECT o.service,o.id,c.driver_id,'accepted',NULL FROM orders o
  JOIN public.quick_ride_driver_cancellations c ON o.service='flash' AND c.ride_id=o.id::uuid
  WHERE upper(c.previous_status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  UNION ALL
  SELECT o.service,o.id,c.driver_id,'driver_cancelled',NULL FROM orders o
  JOIN public.quick_ride_driver_cancellations c ON o.service='flash' AND c.ride_id=o.id::uuid
  UNION ALL
  SELECT o.service,o.id,q.driver_id,'completed',NULL FROM orders o
  JOIN public.professional_quick_rides q ON o.service='flash' AND q.id=o.id::uuid WHERE o.completed
  UNION ALL
  SELECT o.service,o.id,q.driver_id,'arrived',
    CASE WHEN q.arrived_at>=q.accepted_at AND q.arrived_at<=now() AND q.accepted_at>=o.requested_at
     THEN extract(epoch FROM q.arrived_at-q.accepted_at) END
  FROM orders o JOIN public.professional_quick_rides q ON o.service='flash' AND q.id=o.id::uuid
  WHERE q.arrived_at IS NOT NULL
  UNION ALL
  SELECT o.service,o.id,r.driver_user_id,'accepted',
   CASE WHEN r.driver_accepted_at BETWEEN o.requested_at AND now() THEN extract(epoch FROM r.driver_accepted_at-o.requested_at) END
  FROM orders o JOIN public.rides r ON o.service='shared' AND r.request_id=o.id::uuid
  WHERE r.driver_accepted_at IS NOT NULL OR upper(r.status) IN ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','COMPLETED','PENDING_REVIEW')
  UNION ALL
  SELECT o.service,o.id,r.driver_user_id,'completed',NULL FROM orders o
  JOIN public.rides r ON o.service='shared' AND r.request_id=o.id::uuid
  WHERE upper(r.status)='COMPLETED' AND r.completed_at IS NOT NULL
  UNION ALL
  SELECT o.service,o.id,r.driver_user_id,'driver_cancelled',NULL FROM orders o
  JOIN public.rides r ON o.service='shared' AND r.request_id=o.id::uuid
  JOIN public.ride_status_history h ON h.ride_id=r.ride_id AND h.actor_user_id=r.driver_user_id
   AND upper(h.to_status) IN ('CANCELLED','CANCELED')
  UNION ALL
  SELECT o.service,o.id,n.driver_id,'notification_'||n.stage,NULL FROM orders o
  JOIN public.caronaa_order_notification_receipts n ON n.service=o.service AND n.request_id=o.id::uuid
 ), pairs AS (
  SELECT service,id,driver_id,
   bool_or(kind='viewed') AS viewed,bool_or(kind='skipped') AS skipped,
   bool_or(kind='accepted') AS accepted,bool_or(kind='completed') AS completed,
   bool_or(kind='driver_cancelled') AS driver_cancelled,
   bool_or(kind='notification_eligible') AS eligible,
   bool_or(kind='notification_delivery_confirmed') AS delivered,
   min(elapsed) FILTER(WHERE kind='viewed') AS view_seconds,
   min(elapsed) FILTER(WHERE kind='accepted') AS accept_seconds,
   min(elapsed) FILTER(WHERE kind='arrived') AS arrival_seconds
  FROM evidence WHERE driver_id IS NOT NULL GROUP BY service,id,driver_id
 ), drivers AS (
  SELECT driver_id,count(*) AS observed_order_pairs,
   count(*) FILTER(WHERE viewed) AS recorded_views,count(*) FILTER(WHERE skipped) AS recorded_skips,
   count(*) FILTER(WHERE accepted) AS accepted_orders,count(*) FILTER(WHERE completed) AS completed_orders,
   count(*) FILTER(WHERE driver_cancelled) AS driver_cancelled_orders,
   nullif(count(*) FILTER(WHERE eligible),0) AS observed_eligible_orders,
   nullif(count(*) FILTER(WHERE delivered),0) AS observed_delivered_orders,
   count(view_seconds) AS view_samples,round(avg(view_seconds),2) AS mean_view_seconds,
   count(accept_seconds) AS accept_samples,round(avg(accept_seconds),2) AS mean_accept_seconds,
   count(arrival_seconds) AS arrival_samples,round(avg(arrival_seconds),2) AS mean_arrival_seconds
  FROM pairs GROUP BY driver_id
 ), page AS (
  SELECT d.*,p.full_name AS driver_name FROM drivers d LEFT JOIN public.profiles p ON p.id=d.driver_id
  ORDER BY d.accepted_orders DESC,d.driver_id LIMIT p_limit OFFSET p_offset
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
  'total_drivers',(SELECT count(*) FROM drivers),
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.accepted_orders DESC,p.driver_id) FROM page p),'[]'::jsonb),
  'notes',jsonb_build_object('unit','Distinct service/request/driver; multiple attempts and receipt retries never inflate an individual count.',
   'coverage','Observed participants only; not all registered/online drivers. View and skip telemetry is Flash only. A skip is a recorded dismissal, not necessarily refusal.',
   'cancellation','Driver cancellation events can coexist with acceptance or a later completed attempt; not exclusive outcomes.',
   'timing','Only valid recorded timestamps; arrival is from acceptance; each sample count accompanies mean.',
   'rates','No acceptance rate against unknown eligible audience; notification observations are partial.'))
 INTO v_result;
 RETURN v_result;
END;
$drivers$;
REVOKE ALL ON FUNCTION public.admin_operational_driver_performance(date,date,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_driver_performance(date,date,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_operational_cancellation_breakdown(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $cancel$
DECLARE v_from timestamptz; v_until timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared') THEN
  RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH orders AS MATERIALIZED (
  SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service) WHERE cancelled
 ), actors AS (
  SELECT o.service,o.id,'PASSENGER'::text AS actor FROM orders o
  JOIN public.caronaa_order_passenger_cancellations c ON c.service=o.service AND c.request_id=o.id::uuid
  UNION ALL
  SELECT o.service,o.id,'DRIVER' FROM orders o JOIN public.quick_ride_driver_cancellations c
   ON o.service='flash' AND c.ride_id=o.id::uuid
  UNION ALL
  SELECT o.service,o.id,'ADMIN' FROM orders o JOIN public.caronaa_f07_operations_audit a
   ON o.service='flash' AND a.ride_id=o.id::uuid AND a.action='STALE_ASSIGNMENT_CANCELLED'
  UNION ALL
  SELECT o.service,o.id,CASE WHEN h.actor_user_id=r.passenger_user_id THEN 'PASSENGER'
    WHEN h.actor_user_id=r.driver_user_id THEN 'DRIVER' ELSE 'OTHER_RECORDED_ACTOR' END
  FROM orders o JOIN public.rides r ON o.service='shared' AND r.request_id=o.id::uuid
  JOIN public.ride_status_history h ON h.ride_id=r.ride_id
  WHERE upper(r.status) IN ('CANCELLED','CANCELED') AND upper(h.to_status) IN ('CANCELLED','CANCELED')
    AND h.actor_user_id IS NOT NULL
 ), actor_rollup AS (
  SELECT service,id,count(DISTINCT actor) AS actor_count,min(actor) AS only_actor FROM actors GROUP BY service,id
 ), classified AS (
  SELECT o.service,o.id,o.accepted,
   CASE WHEN a.actor_count>1 THEN 'AMBIGUOUS' WHEN a.actor_count=1 THEN a.only_actor ELSE 'UNKNOWN' END AS actor,
   CASE WHEN a.actor_count=1 AND a.only_actor='PASSENGER' THEN coalesce(c.reason_code,'REASON_NOT_RECORDED')
    ELSE 'REASON_NOT_CLASSIFIED' END AS reason_code
  FROM orders o LEFT JOIN actor_rollup a USING(service,id)
  LEFT JOIN public.caronaa_order_passenger_cancellations c ON c.service=o.service AND c.request_id=o.id::uuid
 ), groups AS (
  SELECT actor,reason_code,count(*) AS cancelled_orders,
   count(*) FILTER(WHERE accepted) AS after_acceptance,count(*) FILTER(WHERE NOT accepted) AS before_acceptance
  FROM classified GROUP BY actor,reason_code
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
  'total_cancelled',(SELECT count(*) FROM orders),
  'groups',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.actor,g.reason_code) FROM groups g),'[]'::jsonb),
  'notes',jsonb_build_object('actor','Explicit recorded evidence only. Multiple actor categories on shared attempts are ambiguous; unknown is never assigned to system.',
    'reason','Only recorded passenger reason codes are aggregated. Driver/admin free text is not reclassified or exported here.',
    'scope','Current cancelled orders only; cancelled attempts on otherwise completed requests do not inflate totals.'))
 INTO v_result;
 RETURN v_result;
END;
$cancel$;
REVOKE ALL ON FUNCTION public.admin_operational_cancellation_breakdown(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_cancellation_breakdown(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
