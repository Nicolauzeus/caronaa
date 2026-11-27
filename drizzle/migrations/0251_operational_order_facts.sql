-- 0251 | F09: canonical order facts, exclusive outcomes and compatible history.
-- Read-only reporting; no changes to trip records or dispatch.
BEGIN;

CREATE OR REPLACE FUNCTION public.caronaa_operational_order_facts(
 p_from timestamptz,p_until timestamptz,p_service text
) RETURNS TABLE(id text,service text,requested_at timestamptz,passenger_id uuid,driver_id uuid,
 origin text,destination text,municipality text,status text,accepted boolean,completed boolean,
 cancelled boolean,expired boolean,in_progress boolean,fare_cents integer,payment_status text,
 first_accepted_at timestamptz)
LANGUAGE sql STABLE SET search_path=''
AS $facts$
 WITH raw AS (
  SELECT q.id::text AS id,'flash'::text AS service,q.requested_at,q.passenger_id,q.driver_id,
   coalesce(q.origin_label,'') AS origin,coalesce(q.destination_label,'') AS destination,
   coalesce(q.municipality,'') AS municipality,
   CASE
    WHEN upper(q.status)='COMPLETED' AND q.completed_at IS NOT NULL THEN 'COMPLETED'
    WHEN upper(q.status) IN ('CANCELLED','CANCELED') THEN 'CANCELLED'
    WHEN upper(q.status)='EXPIRED' OR (upper(q.status)='SEARCHING' AND q.expires_at<=now()) THEN 'EXPIRED'
    WHEN upper(q.status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW') THEN upper(q.status)
    WHEN upper(q.status)='SEARCHING' THEN 'SEARCHING'
    ELSE 'OTHER' END AS status,
   (q.accepted_at IS NOT NULL OR upper(q.status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
    OR (upper(q.status)='COMPLETED' AND q.completed_at IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.quick_ride_driver_cancellations c WHERE c.ride_id=q.id
       AND upper(c.previous_status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS'))) AS accepted,
   coalesce(fq.fare_cents,q.estimated_fare_cents)::integer AS fare_cents,
   coalesce(q.payment_status,'') AS payment_status,q.accepted_at AS first_accepted_at
  FROM public.professional_quick_rides q
  LEFT JOIN LATERAL (
   -- If historical attached quotes disagree, fall back to the saved request fare.
   SELECT CASE WHEN count(DISTINCT f.customer_pays_cents)=1 THEN min(f.customer_pays_cents) END AS fare_cents
   FROM public.caronaa_quick_fare_quotes f WHERE f.ride_id=q.id
  ) fq ON true
  WHERE p_service IN ('all','flash') AND q.requested_at>=p_from AND q.requested_at<p_until
  UNION ALL
  SELECT rr.request_id::text,'shared',rr.created_at,rr.user_id,chosen.driver_user_id,
   coalesce(rr.origin_label,rr.origin,''),coalesce(rr.destination_label,rr.destination,''),''::text,
   CASE
    WHEN coalesce(a.completed,false) THEN 'COMPLETED'
    WHEN coalesce(a.active,false) THEN 'IN_PROGRESS'
    WHEN upper(rr.status) IN ('CANCELLED','CANCELED') THEN 'CANCELLED'
    WHEN upper(rr.status)='EXPIRED' THEN 'EXPIRED'
    WHEN upper(rr.status) IN ('OPEN','SEARCHING','MATCHED','PENDING') THEN 'SEARCHING'
    WHEN upper(chosen.status) IN ('CANCELLED','CANCELED') THEN 'CANCELLED'
    WHEN upper(chosen.status)='EXPIRED' THEN 'EXPIRED'
    ELSE 'OTHER' END,
   coalesce(a.accepted,false),
   coalesce(round(rr.passenger_price*100)::integer,round(chosen.passenger_contribution*100)::integer),
   ''::text,a.first_accepted_at
  FROM public.ride_requests rr
  LEFT JOIN LATERAL (
   SELECT bool_or(upper(r.status)='COMPLETED' AND r.completed_at IS NOT NULL) AS completed,
    bool_or(upper(r.status) IN ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','PENDING_REVIEW')) AS active,
    bool_or(r.driver_accepted_at IS NOT NULL OR upper(r.status) IN
     ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','COMPLETED','PENDING_REVIEW')) AS accepted,
    min(r.driver_accepted_at) AS first_accepted_at
   FROM public.rides r WHERE r.request_id=rr.request_id
  ) a ON true
  LEFT JOIN LATERAL (
   SELECT r.driver_user_id,r.passenger_contribution,r.status
   FROM public.rides r WHERE r.request_id=rr.request_id
   ORDER BY CASE WHEN upper(r.status)='COMPLETED' AND r.completed_at IS NOT NULL THEN 0
      WHEN upper(r.status) IN ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','PENDING_REVIEW') THEN 1
      ELSE 2 END,r.updated_at DESC NULLS LAST,r.ride_id DESC
   LIMIT 1
  ) chosen ON true
  WHERE p_service IN ('all','shared') AND rr.created_at>=p_from AND rr.created_at<p_until
 )
 SELECT x.id,x.service,x.requested_at,x.passenger_id,x.driver_id,x.origin,x.destination,x.municipality,
  x.status,coalesce(x.accepted,false),x.status='COMPLETED',x.status='CANCELLED',x.status='EXPIRED',
  x.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW'),x.fare_cents,x.payment_status,
  x.first_accepted_at
 FROM raw x;
$facts$;
REVOKE ALL ON FUNCTION public.caronaa_operational_order_facts(timestamptz,timestamptz,text)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_operations_history_report(
  p_from date,
  p_to date,
  p_service text DEFAULT 'all',
  p_limit integer DEFAULT 40,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $reports$
DECLARE
  v_from timestamptz;
  v_until timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to>current_date+1
     OR (p_to-p_from)>366 OR p_service NOT IN ('all','flash','shared')
     OR p_service IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_offset NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023';
  END IF;
  v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
  v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';

  WITH orders AS (
    SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service)
  ), summary AS (
    SELECT count(*)::integer AS orders,
      count(*) FILTER (WHERE accepted)::integer AS accepted,
      count(*) FILTER (WHERE NOT accepted)::integer AS unaccepted,
      count(*) FILTER (WHERE completed)::integer AS completed,
      count(*) FILTER (WHERE cancelled)::integer AS cancelled,
      count(*) FILTER (WHERE expired)::integer AS expired,
      count(*) FILTER (WHERE in_progress)::integer AS in_progress,
      count(*) FILTER (WHERE status='SEARCHING')::integer AS searching,
      count(*) FILTER (WHERE NOT completed AND NOT cancelled AND NOT expired AND NOT in_progress
        AND NOT(status='SEARCHING'))::integer AS other,
      count(DISTINCT passenger_id)::integer AS unique_passengers,
      count(*) FILTER (WHERE service='flash')::integer AS flash_orders,
      count(*) FILTER (WHERE service='shared')::integer AS shared_orders,
      coalesce(sum(fare_cents) FILTER(WHERE completed),0)::bigint AS completed_fares_cents,
      count(*) FILTER(WHERE completed AND fare_cents IS NULL)::integer AS completed_unpriced,
      count(*) FILTER (WHERE NOT accepted AND cancelled)::integer AS cancelled_without_acceptance,
      count(*) FILTER (WHERE accepted AND cancelled)::integer AS cancelled_after_acceptance,
      count(*) FILTER (WHERE NOT accepted AND expired)::integer AS expired_without_acceptance
    FROM orders
  ), hours AS (
    SELECT h.hour::integer AS hour,count(o.id)::integer AS orders,
      count(DISTINCT o.passenger_id)::integer AS passengers
    FROM generate_series(0,23) h(hour)
    LEFT JOIN orders o ON EXTRACT(HOUR FROM o.requested_at AT TIME ZONE 'America/Fortaleza')::integer=h.hour
    GROUP BY h.hour
  ), hour_days AS (
    SELECT d.day::integer AS weekday,h.hour::integer AS hour,
      count(o.id)::integer AS orders
    FROM generate_series(0,6) d(day) CROSS JOIN generate_series(0,23) h(hour)
    LEFT JOIN orders o
      ON (EXTRACT(ISODOW FROM o.requested_at AT TIME ZONE 'America/Fortaleza')::integer-1)=d.day
      AND EXTRACT(HOUR FROM o.requested_at AT TIME ZONE 'America/Fortaleza')::integer=h.hour
    GROUP BY d.day,h.hour
  ), presence_hours AS (
    SELECT h.hour::integer AS hour,
      count(ph.user_id) FILTER(WHERE ph.kind='driver')::integer AS drivers,
      count(ph.user_id) FILTER(WHERE ph.kind='passenger_preparing')::integer AS passengers_preparing
    FROM generate_series(0,23) h(hour)
    LEFT JOIN public.caronaa_operational_presence_hours ph
      ON extract(hour FROM ph.hour_bucket AT TIME ZONE 'America/Fortaleza')::integer=h.hour
      AND ph.hour_bucket>=v_from AND ph.hour_bucket<v_until
    GROUP BY h.hour
  ), presence_hour_days AS (
    SELECT d.day::integer AS weekday,h.hour::integer AS hour,
      count(ph.user_id) FILTER(WHERE ph.kind='driver')::integer AS drivers,
      count(ph.user_id) FILTER(WHERE ph.kind='passenger_preparing')::integer AS passengers_preparing
    FROM generate_series(0,6) d(day) CROSS JOIN generate_series(0,23) h(hour)
    LEFT JOIN public.caronaa_operational_presence_hours ph
      ON (extract(isodow FROM ph.hour_bucket AT TIME ZONE 'America/Fortaleza')::integer-1)=d.day
      AND extract(hour FROM ph.hour_bucket AT TIME ZONE 'America/Fortaleza')::integer=h.hour
      AND ph.hour_bucket>=v_from AND ph.hour_bucket<v_until
    GROUP BY d.day,h.hour
  )
  SELECT jsonb_build_object(
    'generated_at',now(),'timezone','America/Fortaleza',
    'from',p_from,'to',p_to,'service',p_service,
    'summary',(SELECT to_jsonb(s) FROM summary s),
    'hours',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.hour) FROM hours h),'[]'::jsonb),
    'hour_days',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.weekday,d.hour) FROM hour_days d),'[]'::jsonb),
    'presence_hours',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.hour) FROM presence_hours h),'[]'::jsonb),
    'presence_hour_days',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.weekday,d.hour) FROM presence_hour_days d),'[]'::jsonb),
    'presence_started_at',(SELECT min(hour_bucket) FROM public.caronaa_operational_presence_hours),
    'active_now',jsonb_build_object(
      'drivers',(SELECT count(*)::integer FROM (
        SELECT user_id FROM public.flash_driver_presence
          WHERE is_online AND last_gps_at>now()-interval '90 seconds'
        UNION
        SELECT user_id FROM public.professional_presence
          WHERE is_available AND last_seen_at>now()-interval '90 seconds'
      ) live),
      'passengers_preparing',(SELECT count(*)::integer FROM public.caronaa_passenger_demand_presence
          WHERE last_seen_at>now()-interval '90 seconds')
    ),
    'history_of_presence_available',(SELECT EXISTS(SELECT 1 FROM public.caronaa_operational_presence_hours ph WHERE ph.hour_bucket>=v_from AND ph.hour_bucket<v_until)),
    'total_rows',(SELECT count(*)::integer FROM orders),
    'rows',coalesce((
      SELECT jsonb_agg(to_jsonb(items) ORDER BY items.requested_at DESC,items.service,items.id DESC)
      FROM (
        SELECT o.id,o.service,o.requested_at,o.origin,o.destination,o.municipality,
          o.status,o.accepted,o.completed,o.cancelled,o.expired,
          o.fare_cents,o.payment_status,
          coalesce(nullif(btrim(p.full_name),''),'Passageiro') AS passenger_name,
          CASE WHEN o.driver_id IS NULL THEN NULL
               ELSE coalesce(nullif(btrim(d.full_name),''),'Motorista') END AS driver_name
        FROM orders o
        LEFT JOIN public.profiles p ON p.id=o.passenger_id
        LEFT JOIN public.profiles d ON d.id=o.driver_id
        ORDER BY o.requested_at DESC,o.service,o.id DESC
        LIMIT p_limit OFFSET p_offset
      ) items
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$reports$;

REVOKE ALL ON FUNCTION public.admin_operations_history_report(date,date,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_history_report(date,date,text,integer,integer) TO authenticated;
COMMENT ON FUNCTION public.admin_operations_history_report(date,date,text,integer,integer) IS 'Operational order report: exclusive outcome breakdown, orthogonal acceptance state, expired search projection, no demo data in database.';

NOTIFY pgrst,'reload schema';
COMMIT;
