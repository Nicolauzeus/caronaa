-- 0255 | F09: observed demand/supply, notification failure and financial evidence.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_diagnostics(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $diag$
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
  SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service)
 ), demand AS (
  SELECT extract(hour FROM requested_at AT TIME ZONE 'America/Fortaleza')::int AS hour,
   count(*) AS requests,count(*) FILTER(WHERE NOT accepted AND (cancelled OR expired)) AS unserved
  FROM orders WHERE service='flash' GROUP BY 1
 ), presence AS (
  SELECT extract(hour FROM hour_bucket AT TIME ZONE 'America/Fortaleza')::int AS hour,
   count(DISTINCT (hour_bucket,user_id)) FILTER(WHERE kind='driver') AS observed_driver_hours,
   count(DISTINCT hour_bucket) AS observed_hour_buckets
  FROM public.caronaa_operational_presence_hours
  WHERE hour_bucket>=v_from AND hour_bucket<v_until GROUP BY 1
 ), hourly AS (
  SELECT h.hour,coalesce(d.requests,0) AS requests,coalesce(d.unserved,0) AS unserved,
   nullif(p.observed_driver_hours,0) AS observed_driver_hours,p.observed_hour_buckets
  FROM generate_series(0,23) h(hour) LEFT JOIN demand d USING(hour) LEFT JOIN presence p USING(hour)
  WHERE p_service IN ('all','flash')
 ), receipt_flags AS (
  SELECT n.service,n.request_id,
   bool_or(n.stage='eligible') AS eligible,
   bool_or(n.stage='send_attempted') AS attempted,
   bool_or(n.stage='send_failed') AS failed,
   bool_or(n.stage='provider_accepted') AS provider_accepted,
   bool_or(n.stage='delivery_confirmed') AS delivered
  FROM public.caronaa_order_notification_receipts n JOIN orders o
   ON n.service=o.service AND n.request_id=o.id::uuid GROUP BY n.service,n.request_id
 ), delivery AS (
  SELECT count(*) AS orders,
   count(r.request_id) AS orders_with_receipts,
   count(*) FILTER(WHERE r.failed) AS orders_with_observed_send_failure,
   count(*) FILTER(WHERE r.failed AND NOT r.delivered) AS failures_without_recorded_delivery,
   count(*) FILTER(WHERE r.delivered) AS orders_with_observed_delivery,
   count(*) FILTER(WHERE r.request_id IS NULL) AS orders_without_receipts,
   count(*) FILTER(WHERE NOT o.accepted AND (o.cancelled OR o.expired) AND r.failed) AS unserved_with_observed_send_failure,
   count(*) FILTER(WHERE NOT o.accepted AND (o.cancelled OR o.expired) AND r.request_id IS NULL) AS unserved_without_receipts
  FROM orders o LEFT JOIN receipt_flags r ON r.service=o.service AND r.request_id=o.id::uuid
 ), pay AS (
  SELECT o.id,o.fare_cents,
   EXISTS(SELECT 1 FROM public.quick_ride_payment_events e WHERE e.ride_id=o.id::uuid
    AND e.event_type='PASSENGER_DECLARED' AND e.actor_id=o.passenger_id) AS declared,
   EXISTS(SELECT 1 FROM public.quick_ride_payment_events e WHERE e.ride_id=o.id::uuid
    AND e.event_type='DRIVER_ACKNOWLEDGED' AND e.actor_id=o.driver_id) AS acknowledged
  FROM orders o WHERE o.service='flash' AND o.completed
 ), finance AS (
  SELECT count(*) AS completed_flash_orders,
   count(*) FILTER(WHERE declared AND acknowledged) AS bilateral_pix_orders,
   count(*) FILTER(WHERE declared AND NOT acknowledged) AS passenger_declared_only,
   count(*) FILTER(WHERE NOT declared AND acknowledged) AS acknowledgement_without_declaration,
   count(*) FILTER(WHERE NOT declared AND NOT acknowledged) AS no_bilateral_evidence,
   sum(fare_cents) FILTER(WHERE declared AND acknowledged AND fare_cents>=0) AS bilateral_quoted_value_cents,
   count(*) FILTER(WHERE declared AND acknowledged AND (fare_cents IS NULL OR fare_cents<0)) AS bilateral_unknown_fare
  FROM pay
 ), incidents AS (
  SELECT i.category,count(*) AS recorded_incidents,count(*) FILTER(WHERE i.status='RESOLVED') AS resolved_incidents
  FROM public.caronaa_f07_operations_incidents i
  WHERE p_service IN ('all','flash') AND i.created_at>=v_from AND i.created_at<v_until
  GROUP BY i.category
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
  'flash_hourly_supply_demand',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.hour) FROM hourly h),'[]'::jsonb),
  'notification_diagnostics',(SELECT to_jsonb(d) FROM delivery d),
  'flash_manual_pix',CASE WHEN p_service IN ('all','flash') THEN (SELECT to_jsonb(f) FROM finance f) ELSE NULL END,
  'recorded_incidents',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.category) FROM incidents i),'[]'::jsonb),
  'notes',jsonb_build_object(
   'supply','Observed driver-hour signals only, not an eligible dispatch census. Missing signals do not prove zero supply. Shared scheduled offers excluded.',
   'notification','Observed failures are not proven causes of cancellation; absent receipt is unknown. Counts can overlap, including retries.',
   'finance','Manual Pix bilateral confirmation is not bank settlement. Values are saved fare amounts, not verified transfers or platform revenue.',
   'incidents','Incident creation cohort; separate from order cohort; manually recorded issues are not an exhaustive outage census.'))
 INTO v_result;
 RETURN v_result;
END;
$diag$;
REVOKE ALL ON FUNCTION public.admin_operational_diagnostics(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_diagnostics(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
