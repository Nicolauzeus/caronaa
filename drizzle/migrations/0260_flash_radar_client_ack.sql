-- 0260 | F07/F09: authenticated app acknowledgement of authorized radar response.
-- Never treat client acknowledgement as a trusted push receipt, a card view, or a dispatch census.
BEGIN;
CREATE TABLE public.caronaa_flash_radar_client_ack(
 request_id uuid NOT NULL,driver_id uuid NOT NULL,
 acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(request_id,driver_id)
);
ALTER TABLE public.caronaa_flash_radar_client_ack ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_flash_radar_client_ack FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.caronaa_ack_flash_radar_response(p_request_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $ack$
DECLARE v_driver uuid:=auth.uid(); v_count integer;
BEGIN
 IF v_driver IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_request_ids IS NULL OR cardinality(p_request_ids)>5 OR array_position(p_request_ids,NULL::uuid) IS NOT NULL
 THEN RAISE EXCEPTION 'Invalid radar acknowledgement' USING ERRCODE='22023'; END IF;
 INSERT INTO public.caronaa_flash_radar_client_ack(request_id,driver_id)
 SELECT DISTINCT n.request_id,v_driver FROM public.caronaa_order_notification_receipts n
 WHERE n.service='flash' AND n.driver_id=v_driver AND n.request_id=ANY(p_request_ids)
 AND n.channel='in_app' AND n.dispatch_key='radar_query_observed_v1' AND n.stage='eligible'
 ON CONFLICT(request_id,driver_id) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END;
$ack$;
REVOKE ALL ON FUNCTION public.caronaa_ack_flash_radar_response(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_ack_flash_radar_response(uuid[]) TO authenticated;
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
  SELECT jsonb_build_object('event_type','queue_signal_recorded','occurred_at',q.recorded_at,
   'actor_id',NULL,'source','caronaa_flash_queue_signal_history',
   'detail',jsonb_build_object('evidence','municipal_queue_upsert_not_delivery','operation',q.operation,'status',q.status))
  FROM public.caronaa_flash_queue_signal_history q WHERE p_service='flash' AND q.request_id=p_request_id
  UNION ALL
  SELECT jsonb_build_object('event_type','radar_client_acknowledged','occurred_at',a.acknowledged_at,
    'actor_id',a.driver_id,'source','caronaa_flash_radar_client_ack',
    'detail',jsonb_build_object('evidence','authenticated_client_ack_not_push_delivery'))
  FROM public.caronaa_flash_radar_client_ack a WHERE p_service='flash' AND a.request_id=p_request_id
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
   'queue_signals_recorded',CASE WHEN p_service='flash' THEN
    nullif((SELECT count(*) FROM public.caronaa_flash_queue_signal_history WHERE request_id=p_request_id),0) ELSE NULL END,
   'drivers_radar_acknowledged',CASE WHEN p_service='flash' THEN
    nullif((SELECT count(*) FROM public.caronaa_flash_radar_client_ack WHERE request_id=p_request_id),0) ELSE NULL END,
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
