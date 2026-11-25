-- 0247 | Read-only order traceability, without altering dispatch or historical rows.
-- One request ID per service. Evidence is explicit: missing signals are not zero
-- notifications, and an expiration deadline is not an observed status transition.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operations_order_timeline(
 p_service text,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $timeline$
DECLARE v_order jsonb; v_events jsonb; v_counts jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_service IS NULL OR p_service NOT IN ('flash','shared') THEN
  RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023';
 END IF;
 IF p_service='flash' THEN
  SELECT jsonb_build_object('id',q.id,'service','flash','passenger_id',q.passenger_id,
    'passenger_name',p.full_name,'driver_id',q.driver_id,'driver_name',d.full_name,
    'origin',q.origin_label,'destination',q.destination_label,'municipality',q.municipality,
    'requested_at',q.requested_at,'raw_status',q.status,'accepted_at',q.accepted_at,
    'fare_cents',q.estimated_fare_cents,'expires_at',q.expires_at,
    'effective_status',CASE WHEN upper(q.status)='SEARCHING' AND q.expires_at<=now()
      THEN 'EXPIRED' ELSE upper(q.status) END,
    'expiration_projected',upper(q.status)='SEARCHING' AND q.expires_at<=now())
  INTO v_order FROM public.professional_quick_rides q
  LEFT JOIN public.profiles p ON p.id=q.passenger_id
  LEFT JOIN public.profiles d ON d.id=q.driver_id WHERE q.id=p_request_id;
  IF v_order IS NULL THEN RETURN NULL; END IF;
  WITH events AS (
   SELECT 'requested'::text AS event_type,q.requested_at AS occurred_at,
     q.passenger_id AS actor_id,'professional_quick_rides'::text AS source,
     jsonb_build_object('evidence','recorded_timestamp') AS detail
   FROM public.professional_quick_rides q WHERE q.id=p_request_id
   UNION ALL
   SELECT m.event_type,m.occurred_at,NULL::uuid,'professional_quick_rides',
     jsonb_build_object('evidence','recorded_timestamp','actor_unverified',true)
   FROM public.professional_quick_rides q CROSS JOIN LATERAL (VALUES
    ('accepted',q.accepted_at),('arrived',q.arrived_at),
    ('pickup_confirmed',q.pickup_confirmed_at),('in_trip',q.in_trip_at),
    ('completed',q.completed_at)) m(event_type,occurred_at)
   WHERE q.id=p_request_id AND m.occurred_at IS NOT NULL
   UNION ALL
   SELECT 'driver_first_view',v.first_viewed_at,v.driver_id,'quick_ride_driver_views',
    jsonb_build_object('evidence','recorded_timestamp')
   FROM public.quick_ride_driver_views v WHERE v.ride_id=p_request_id
   UNION ALL
   SELECT 'driver_last_view',v.last_viewed_at,v.driver_id,'quick_ride_driver_views',
    jsonb_build_object('evidence','recorded_timestamp')
   FROM public.quick_ride_driver_views v WHERE v.ride_id=p_request_id AND v.last_viewed_at>v.first_viewed_at
   UNION ALL
   SELECT 'driver_skip',s.skipped_at,s.driver_id,'flash_order_driver_skips',
    jsonb_build_object('evidence','recorded_timestamp')
   FROM public.flash_order_driver_skips s WHERE s.ride_id=p_request_id
   UNION ALL
   SELECT 'driver_cancelled',c.cancelled_at,c.driver_id,'quick_ride_driver_cancellations',
    jsonb_build_object('evidence','recorded_timestamp','previous_status',c.previous_status,'reason',c.reason)
   FROM public.quick_ride_driver_cancellations c WHERE c.ride_id=p_request_id
   UNION ALL
   SELECT 'quote_issued',f.issued_at,f.passenger_id,'caronaa_quick_fare_quotes',
    jsonb_build_object('evidence','recorded_timestamp','quote_id',f.id,'fare_cents',f.customer_pays_cents)
   FROM public.caronaa_quick_fare_quotes f WHERE f.ride_id=p_request_id
   UNION ALL
   SELECT 'expiration_deadline',q.expires_at,NULL::uuid,'professional_quick_rides',
    jsonb_build_object('evidence','deadline_not_observed_transition')
   FROM public.professional_quick_rides q WHERE q.id=p_request_id
    AND upper(q.status)='SEARCHING' AND q.expires_at<=now()
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at,e.event_type,e.actor_id NULLS LAST,e.detail::text),'[]'::jsonb)
   INTO v_events FROM events e;
  SELECT jsonb_build_object(
    'drivers_with_recorded_view',(SELECT count(DISTINCT driver_id) FROM public.quick_ride_driver_views WHERE ride_id=p_request_id),
    'drivers_with_recorded_skip',(SELECT count(DISTINCT driver_id) FROM public.flash_order_driver_skips WHERE ride_id=p_request_id),
    'drivers_notified',NULL,'eligible_drivers_at_request',NULL,
    'driver_cancel_record_exists',EXISTS(SELECT 1 FROM public.quick_ride_driver_cancellations WHERE ride_id=p_request_id))
   INTO v_counts;
 ELSE
  SELECT jsonb_build_object('id',r.request_id,'service','shared','passenger_id',r.user_id,
    'passenger_name',p.full_name,'origin',coalesce(r.origin_label,r.origin),
    'destination',coalesce(r.destination_label,r.destination),'municipality',NULL,
    'requested_at',r.created_at,'raw_status',r.status,
    'fare_cents',round(r.passenger_price*100),
    'attempt_count',(SELECT count(*) FROM public.rides x WHERE x.request_id=r.request_id))
   INTO v_order FROM public.ride_requests r LEFT JOIN public.profiles p ON p.id=r.user_id
   WHERE r.request_id=p_request_id;
  IF v_order IS NULL THEN RETURN NULL; END IF;
  WITH events AS (
   SELECT 'requested'::text AS event_type,r.created_at AS occurred_at,r.user_id AS actor_id,
    'ride_requests'::text AS source,jsonb_build_object('evidence','recorded_timestamp') AS detail
   FROM public.ride_requests r WHERE r.request_id=p_request_id
   UNION ALL
   SELECT 'ride_attempt_created',x.created_at,NULL::uuid,'rides',
    jsonb_build_object('evidence','recorded_timestamp','attempt_id',x.ride_id,'driver_id',x.driver_user_id)
   FROM public.rides x WHERE x.request_id=p_request_id
   UNION ALL
   SELECT m.event_type,m.occurred_at,m.actor_id,'rides',
    jsonb_build_object('evidence','recorded_timestamp','attempt_id',x.ride_id)
   FROM public.rides x CROSS JOIN LATERAL (VALUES
    ('driver_accepted',x.driver_accepted_at,x.driver_user_id),
    ('passenger_accepted',x.passenger_accepted_at,x.passenger_user_id),
    ('boarded',x.boarded_at,NULL::uuid),('completed',x.completed_at,NULL::uuid)
   ) m(event_type,occurred_at,actor_id)
   WHERE x.request_id=p_request_id AND m.occurred_at IS NOT NULL
   UNION ALL
   SELECT 'status_changed',h.created_at,h.actor_user_id,'ride_status_history',
    jsonb_build_object('evidence','recorded_timestamp','attempt_id',x.ride_id,
    'from_status',h.from_status,'to_status',h.to_status)
   FROM public.rides x JOIN public.ride_status_history h ON h.ride_id=x.ride_id
   WHERE x.request_id=p_request_id
   UNION ALL
   SELECT 'notification_record_created',n.created_at,NULL::uuid,'ride_notifications',
    jsonb_build_object('evidence','record_created_not_delivery','attempt_id',x.ride_id,
      'recipient_id',n.user_id,'notification_id',n.notification_id,'event_name',n.event_name)
   FROM public.rides x JOIN public.ride_notifications n ON n.ride_id=x.ride_id
   WHERE x.request_id=p_request_id
   UNION ALL
   SELECT 'notification_read',n.read_at,n.user_id,'ride_notifications',
    jsonb_build_object('evidence','notification_read_not_order_view','attempt_id',x.ride_id,'notification_id',n.notification_id)
   FROM public.rides x JOIN public.ride_notifications n ON n.ride_id=x.ride_id
   WHERE x.request_id=p_request_id AND n.read_at IS NOT NULL
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at,e.event_type,e.actor_id NULLS LAST,e.detail::text),'[]'::jsonb)
   INTO v_events FROM events e;
  SELECT jsonb_build_object(
   'drivers_with_recorded_view',NULL,'drivers_with_recorded_skip',NULL,'drivers_notified',NULL,
   'eligible_drivers_at_request',NULL,
   'notification_records',(SELECT count(*) FROM public.rides x JOIN public.ride_notifications n ON n.ride_id=x.ride_id WHERE x.request_id=p_request_id),
   'notification_read_records',(SELECT count(*) FROM public.rides x JOIN public.ride_notifications n ON n.ride_id=x.ride_id WHERE x.request_id=p_request_id AND n.read_at IS NOT NULL))
   INTO v_counts;
 END IF;
 RETURN jsonb_build_object('order',v_order,'events',v_events,'counts',v_counts,
  'timezone','America/Fortaleza','generated_at',now(),
  'coverage','recorded evidence only; null means unavailable; missing events do not prove absence');
END;
$timeline$;
REVOKE ALL ON FUNCTION public.admin_operations_order_timeline(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_order_timeline(text,uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_operations_order_timeline(text,uuid) IS 'Admin-only traceability for one order, preserving recorded evidence without reconstructing unknown actors or timestamps.';
NOTIFY pgrst,'reload schema';
COMMIT;
