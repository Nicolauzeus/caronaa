-- 0250 | Extend order traceability with new, independently recorded evidence.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operations_order_evidence(
 p_service text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $evidence$
DECLARE v_base jsonb; v_events jsonb; v_counts jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 v_base:=public.admin_operations_order_timeline(p_service,p_request_id);
 IF v_base IS NULL THEN RETURN NULL; END IF;
 WITH events AS (
  SELECT e AS item FROM jsonb_array_elements(v_base->'events') e
  WHERE e->>'source' IS DISTINCT FROM 'quick_ride_driver_views'
  UNION ALL
  SELECT jsonb_build_object('event_type','passenger_cancelled','occurred_at',c.cancelled_at,
    'actor_id',c.passenger_id,'source','caronaa_order_passenger_cancellations',
    'detail',jsonb_build_object('previous_status',c.previous_status,'reason_code',c.reason_code,
    'reason_recorded_at',c.reason_recorded_at))
  FROM public.caronaa_order_passenger_cancellations c
  WHERE c.service=p_service AND c.request_id=p_request_id
  UNION ALL
  SELECT jsonb_build_object('event_type',m.kind,'occurred_at',m.event_at,
    'actor_id',h.driver_id,'source','caronaa_flash_driver_view_history','detail','{}'::jsonb)
  FROM public.caronaa_flash_driver_view_history h
  CROSS JOIN LATERAL (VALUES ('driver_first_view',h.first_viewed_at),('driver_last_view',h.last_viewed_at)) m(kind,event_at)
  WHERE p_service='flash' AND h.ride_id=p_request_id
    AND (m.kind='driver_first_view' OR h.last_viewed_at>h.first_viewed_at)
  UNION ALL
  SELECT jsonb_build_object('event_type','notification_'||n.stage,'occurred_at',n.recorded_at,
   'actor_id',NULL,'source','caronaa_order_notification_receipts',
   'detail',jsonb_build_object('recipient_id',n.driver_id,'channel',n.channel))
  FROM public.caronaa_order_notification_receipts n WHERE n.service=p_service AND n.request_id=p_request_id
 )
 SELECT coalesce(jsonb_agg(item ORDER BY (item->>'occurred_at')::timestamptz,item::text),'[]'::jsonb)
 INTO v_events FROM events;
 SELECT jsonb_build_object(
   'drivers_with_recorded_view',CASE WHEN p_service='flash' THEN
    (SELECT count(*) FROM public.caronaa_flash_driver_view_history WHERE ride_id=p_request_id) ELSE NULL END,
   'drivers_eligible_observed',nullif(count(DISTINCT driver_id) FILTER(WHERE stage='eligible'),0),
   'drivers_send_attempted_observed',nullif(count(DISTINCT driver_id) FILTER(WHERE stage='send_attempted'),0),
   'drivers_provider_accepted_observed',nullif(count(DISTINCT driver_id) FILTER(WHERE stage='provider_accepted'),0),
   'drivers_delivery_confirmed_observed',nullif(count(DISTINCT driver_id) FILTER(WHERE stage='delivery_confirmed'),0),
   'drivers_send_failed_observed',nullif(count(DISTINCT driver_id) FILTER(WHERE stage='send_failed'),0),
   'notification_coverage','partial_or_unavailable; not an exhaustive dispatch census',
   'view_coverage','historical receipts available only if retained at deployment or captured subsequently')
 INTO v_counts FROM public.caronaa_order_notification_receipts WHERE service=p_service AND request_id=p_request_id;
 RETURN v_base||jsonb_build_object('events',v_events,'counts',(v_base->'counts')||v_counts);
END;
$evidence$;
REVOKE ALL ON FUNCTION public.admin_operations_order_evidence(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_order_evidence(text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
