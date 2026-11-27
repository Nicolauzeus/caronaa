-- 0252 | F09: aggregate observed operational outcomes, with explicit denominators.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_order_kpis(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $kpi$
DECLARE v_from timestamptz; v_until timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared') THEN
  RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023';
 END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH orders AS MATERIALIZED (
  SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service)
 ), facts AS (
  SELECT o.*, (o.cancelled OR o.expired) AND NOT o.accepted AS unserved,
   CASE WHEN o.first_accepted_at>=o.requested_at AND o.first_accepted_at<=now()
   THEN extract(epoch FROM o.first_accepted_at-o.requested_at) END AS wait_seconds
  FROM orders o
 ), totals AS (
  SELECT count(*) AS requested,count(*) FILTER(WHERE accepted) AS accepted,
   count(*) FILTER(WHERE NOT accepted) AS never_accepted,
   count(*) FILTER(WHERE unserved) AS unserved,
   count(*) FILTER(WHERE completed) AS completed,
   count(*) FILTER(WHERE cancelled) AS cancelled,
   count(*) FILTER(WHERE expired) AS expired,
   count(*) FILTER(WHERE in_progress) AS in_progress,
   count(*) FILTER(WHERE status='SEARCHING') AS waiting,
   count(*) FILTER(WHERE status='OTHER') AS other,
   count(*) FILTER(WHERE cancelled AND accepted) AS cancelled_after_acceptance,
   count(*) FILTER(WHERE cancelled AND NOT accepted) AS cancelled_before_acceptance,
   count(wait_seconds) AS wait_samples,
   round(avg(wait_seconds),2) AS mean_wait_seconds,
   round((percentile_cont(0.5) WITHIN GROUP(ORDER BY wait_seconds))::numeric,2) AS median_wait_seconds,
   round(100.0*count(*) FILTER(WHERE accepted)/nullif(count(*),0),2) AS acceptance_pct,
   round(100.0*count(*) FILTER(WHERE completed)/nullif(count(*),0),2) AS completion_pct,
   round(100.0*count(*) FILTER(WHERE unserved)/nullif(count(*),0),2) AS unserved_pct,
   sum(fare_cents) FILTER(WHERE unserved AND fare_cents>=0) AS unserved_quoted_value_cents,
   count(*) FILTER(WHERE unserved AND (fare_cents IS NULL OR fare_cents<0)) AS unserved_unknown_fare,
   sum(fare_cents) FILTER(WHERE completed AND fare_cents>=0) AS completed_quoted_value_cents,
   count(DISTINCT passenger_id) AS passengers
  FROM facts
 ), cancellations AS (
  SELECT CASE WHEN c.request_id IS NULL THEN 'ACTOR_UNKNOWN_OR_OTHER'
     WHEN c.reason_code IS NULL THEN 'REASON_NOT_RECORDED'
     ELSE c.reason_code END AS reason_code,
    count(*) AS orders
  FROM facts o LEFT JOIN public.caronaa_order_passenger_cancellations c
    ON c.service=o.service AND c.request_id=o.id::uuid
  WHERE o.cancelled GROUP BY 1
 ), hours AS (
  SELECT extract(hour FROM requested_at AT TIME ZONE 'America/Fortaleza')::int AS hour,
   count(*) AS requests,count(*) FILTER(WHERE unserved) AS unserved
  FROM facts GROUP BY 1
 ), territories AS (
  SELECT service,coalesce(nullif(btrim(municipality),''),'Não identificado') AS municipality,
   count(*) AS requests,count(*) FILTER(WHERE unserved) AS unserved
  FROM facts GROUP BY 1,2
 ), recurring AS (
  SELECT passenger_id FROM facts WHERE passenger_id IS NOT NULL GROUP BY passenger_id HAVING count(*)>=2
 ), receipts AS (
  SELECT n.stage,count(*) AS observed_events,
   count(DISTINCT (n.service,n.request_id,n.driver_id)) AS observed_order_driver_pairs,
   count(DISTINCT n.driver_id) AS observed_unique_drivers
  FROM facts o JOIN public.caronaa_order_notification_receipts n
   ON n.service=o.service AND n.request_id=o.id::uuid GROUP BY n.stage
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
 'generated_at',now(),'summary',(SELECT to_jsonb(t) FROM totals t),
 'cancellation_reasons',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.orders DESC,c.reason_code) FROM cancellations c),'[]'::jsonb),
 'hours',(SELECT jsonb_agg(jsonb_build_object('hour',h,'requests',coalesce(a.requests,0),'unserved',coalesce(a.unserved,0)) ORDER BY h)
 FROM generate_series(0,23) h LEFT JOIN hours a ON a.hour=h),
 'territories',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.requests DESC,t.service,t.municipality) FROM territories t),'[]'::jsonb),
 'recurring_passengers',(SELECT count(*) FROM recurring),
 'notification_observations',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.stage) FROM receipts r),'[]'::jsonb),
 'notes',jsonb_build_object('cohort','Request creation dates; current known outcomes, not historical as-of snapshots',
 'unserved','Never accepted and cancelled or expired; waiting orders excluded',
 'money','Gross quoted value only, not platform revenue, settlement or guaranteed lost sales',
 'notifications','Observed partial evidence only; absent stage means unknown, not zero delivery',
 'wait','Seconds to first recorded acceptance; sample count required; missing timestamps excluded',
 'territory','Shared municipality unknown unless independently persisted; no geocoding',
 'cancellations','Passenger reason only where captured; unknown or other actors not inferred'))
 INTO v_result;
 RETURN v_result;
END;
$kpi$;
REVOKE ALL ON FUNCTION public.admin_operational_order_kpis(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_order_kpis(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
