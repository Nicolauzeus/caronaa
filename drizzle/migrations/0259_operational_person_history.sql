-- 0259 | F09 individual account history; no changes to matching or ride state.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_person_history(
 p_person_id uuid,p_role text,p_from date,p_to date,p_service text DEFAULT 'all',
 p_limit integer DEFAULT 20,p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $person$
DECLARE v_from timestamptz; v_until timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 IF p_person_id IS NULL OR p_role IS NULL OR p_role NOT IN ('driver','passenger')
 OR p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared')
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
 THEN RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_person_id) THEN RETURN NULL; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH facts AS MATERIALIZED (
  SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,p_service)
 ), observed AS (
  SELECT o.*,
   CASE WHEN o.service='flash' THEN EXISTS(SELECT 1 FROM public.caronaa_flash_driver_view_history v WHERE v.ride_id=o.id::uuid AND v.driver_id=p_person_id) ELSE false END AS viewed,
   CASE WHEN o.service='flash' THEN EXISTS(SELECT 1 FROM public.flash_order_driver_skips s WHERE s.ride_id=o.id::uuid AND s.driver_id=p_person_id) ELSE false END AS skipped,
   EXISTS(SELECT 1 FROM public.caronaa_order_notification_receipts n WHERE n.service=o.service AND n.request_id=o.id::uuid AND n.driver_id=p_person_id AND n.stage='eligible') AS eligible,
   CASE WHEN o.service='flash' THEN (o.driver_id IS NOT DISTINCT FROM p_person_id AND o.accepted)
      OR EXISTS(SELECT 1 FROM public.quick_ride_driver_cancellations c WHERE c.ride_id=o.id::uuid AND c.driver_id=p_person_id AND upper(c.previous_status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS'))
    ELSE EXISTS(SELECT 1 FROM public.rides r WHERE r.request_id=o.id::uuid AND r.driver_user_id=p_person_id AND (r.driver_accepted_at IS NOT NULL OR upper(r.status) IN ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','COMPLETED','PENDING_REVIEW'))) END AS driver_accepted,
   CASE WHEN o.service='flash' THEN (o.driver_id IS NOT DISTINCT FROM p_person_id AND o.completed)
    ELSE EXISTS(SELECT 1 FROM public.rides r WHERE r.request_id=o.id::uuid AND r.driver_user_id=p_person_id AND upper(r.status)='COMPLETED' AND r.completed_at IS NOT NULL) END AS driver_completed,
   CASE WHEN p_role='driver' AND o.service='flash' THEN (
    SELECT extract(epoch FROM v.first_viewed_at-o.requested_at) FROM public.caronaa_flash_driver_view_history v
    WHERE v.ride_id=o.id::uuid AND v.driver_id=p_person_id AND v.first_viewed_at BETWEEN o.requested_at AND now()
   ) END AS view_seconds,
   CASE WHEN p_role='driver' AND o.service='flash' THEN (
    SELECT extract(epoch FROM q.accepted_at-o.requested_at) FROM public.professional_quick_rides q
    WHERE q.id=o.id::uuid AND q.driver_id=p_person_id AND q.accepted_at BETWEEN o.requested_at AND now()
   ) WHEN p_role='driver' AND o.service='shared' THEN (
    SELECT extract(epoch FROM min(r.driver_accepted_at)-o.requested_at) FROM public.rides r
    WHERE r.request_id=o.id::uuid AND r.driver_user_id=p_person_id AND r.driver_accepted_at BETWEEN o.requested_at AND now()
   ) END AS accept_seconds,
   CASE WHEN p_role='driver' AND o.service='flash' THEN (
    SELECT extract(epoch FROM q.arrived_at-q.accepted_at) FROM public.professional_quick_rides q
    WHERE q.id=o.id::uuid AND q.driver_id=p_person_id AND q.accepted_at>=o.requested_at AND q.arrived_at BETWEEN q.accepted_at AND now()
   ) END AS arrival_seconds,
   CASE WHEN o.service='flash' THEN EXISTS(SELECT 1 FROM public.quick_ride_driver_cancellations c WHERE c.ride_id=o.id::uuid AND c.driver_id=p_person_id)
    ELSE EXISTS(SELECT 1 FROM public.rides r JOIN public.ride_status_history h ON h.ride_id=r.ride_id WHERE r.request_id=o.id::uuid AND r.driver_user_id=p_person_id AND h.actor_user_id=p_person_id AND upper(h.to_status) IN ('CANCELLED','CANCELED')) END AS driver_cancelled
  FROM facts o
  WHERE (p_role='passenger' AND o.passenger_id=p_person_id)
    OR (p_role='driver' AND o.passenger_id IS DISTINCT FROM p_person_id)
 ), selected AS MATERIALIZED (
  SELECT o.id,o.service,o.requested_at,o.origin,o.destination,o.status,o.fare_cents,
   CASE WHEN p_role='driver' THEN o.driver_accepted ELSE o.accepted END AS accepted,
   CASE WHEN p_role='driver' THEN o.driver_completed ELSE o.completed END AS completed,
   CASE WHEN p_role='driver' THEN o.driver_cancelled ELSE o.cancelled END AS cancelled,
   CASE WHEN p_role='driver' AND o.service='flash' THEN o.viewed ELSE NULL END AS viewed,
   CASE WHEN p_role='driver' AND o.service='flash' THEN o.skipped ELSE NULL END AS skipped,
   CASE WHEN p_role='driver' THEN CASE WHEN o.eligible THEN true ELSE NULL END ELSE NULL END AS eligible,
   o.view_seconds,o.accept_seconds,o.arrival_seconds
  FROM observed o WHERE p_role='passenger' OR o.viewed OR o.skipped OR o.eligible OR o.driver_accepted OR o.driver_completed OR o.driver_cancelled
 ), totals AS (
  SELECT count(*) AS orders,count(*) FILTER(WHERE accepted) AS accepted,
   count(*) FILTER(WHERE completed) AS completed,count(*) FILTER(WHERE cancelled) AS cancelled,
   CASE WHEN p_role='driver' AND p_service IN ('all','flash') THEN count(*) FILTER(WHERE viewed) ELSE NULL END AS recorded_views,
   CASE WHEN p_role='driver' AND p_service IN ('all','flash') THEN count(*) FILTER(WHERE skipped) ELSE NULL END AS recorded_skips,
   CASE WHEN p_role='driver' THEN nullif(count(*) FILTER(WHERE eligible),0) ELSE NULL END AS observed_eligible,
   count(view_seconds) AS view_samples,round(avg(view_seconds),2) AS mean_view_seconds,
   count(accept_seconds) AS accept_samples,round(avg(accept_seconds),2) AS mean_accept_seconds,
   count(arrival_seconds) AS arrival_samples,round(avg(arrival_seconds),2) AS mean_arrival_seconds
  FROM selected
 ), page AS (
  SELECT * FROM selected ORDER BY requested_at DESC,service,id LIMIT p_limit OFFSET p_offset
 )
 SELECT jsonb_build_object('person_id',p_person_id,'role',p_role,'from',p_from,'to',p_to,'service',p_service,
  'summary',(SELECT to_jsonb(t) FROM totals t),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.requested_at DESC,p.service,p.id) FROM page p),'[]'::jsonb),
  'notes',jsonb_build_object('scope','Request creation cohort, current recorded outcomes; driver history is observed participation, not every registered driver or eligible order.',
   'driver','Driver cancellation and completion can coexist after separate attempts; status describes the order, not necessarily this driver.',
   'coverage','View and skip data only available for Flash; absence of eligibility record is unknown.'))
 INTO v_result;
 RETURN v_result;
END;
$person$;
REVOKE ALL ON FUNCTION public.admin_operational_person_history(uuid,text,date,date,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_person_history(uuid,text,date,date,text,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
