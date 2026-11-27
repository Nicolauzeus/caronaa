-- 0262 | F08/F09: separate reasons for a cancelled shared matching attempt.
-- A rejected match can reopen the request; never count it as a terminal request cancellation.
BEGIN;
CREATE TABLE public.caronaa_shared_attempt_cancel_reasons(
 ride_id uuid PRIMARY KEY,request_id uuid NOT NULL,passenger_id uuid NOT NULL,
 reason_code text NOT NULL CHECK(reason_code IN ('WAIT_TOO_LONG','CHANGED_PLANS','PRICE','FOUND_ALTERNATIVE','WRONG_ROUTE','TECHNICAL_PROBLEM','OTHER','PREFER_NOT_TO_SAY')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX caronaa_shared_attempt_reason_request_idx ON public.caronaa_shared_attempt_cancel_reasons(request_id,recorded_at);
ALTER TABLE public.caronaa_shared_attempt_cancel_reasons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_shared_attempt_cancel_reasons FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.caronaa_record_shared_attempt_cancel_reason(p_ride_id uuid,p_reason_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $reason$
DECLARE u uuid:=auth.uid(); v_request uuid; v_latest timestamptz;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_ride_id IS NULL OR p_reason_code IS NULL OR p_reason_code NOT IN ('WAIT_TOO_LONG','CHANGED_PLANS','PRICE','FOUND_ALTERNATIVE','WRONG_ROUTE','TECHNICAL_PROBLEM','OTHER','PREFER_NOT_TO_SAY')
 THEN RAISE EXCEPTION 'Invalid cancellation reason' USING ERRCODE='22023'; END IF;
 SELECT r.request_id INTO v_request FROM public.rides r WHERE r.ride_id=p_ride_id AND r.passenger_user_id=u AND upper(r.status) IN ('CANCELLED','CANCELED');
 IF v_request IS NULL THEN RETURN false; END IF;
 SELECT max(h.created_at) INTO v_latest FROM public.ride_status_history h WHERE h.ride_id=p_ride_id AND upper(h.to_status) IN ('CANCELLED','CANCELED');
 IF v_latest IS NULL OR NOT EXISTS(SELECT 1 FROM public.ride_status_history h WHERE h.ride_id=p_ride_id AND h.created_at=v_latest AND upper(h.to_status) IN ('CANCELLED','CANCELED') AND h.actor_user_id=u)
 OR EXISTS(SELECT 1 FROM public.ride_status_history h WHERE h.ride_id=p_ride_id AND h.created_at=v_latest AND upper(h.to_status) IN ('CANCELLED','CANCELED') AND h.actor_user_id IS DISTINCT FROM u)
 THEN RETURN false; END IF;
 INSERT INTO public.caronaa_shared_attempt_cancel_reasons(ride_id,request_id,passenger_id,reason_code)
 VALUES(p_ride_id,v_request,u,p_reason_code) ON CONFLICT(ride_id) DO NOTHING;
 RETURN EXISTS(SELECT 1 FROM public.caronaa_shared_attempt_cancel_reasons a WHERE a.ride_id=p_ride_id AND a.passenger_id=u AND a.reason_code=p_reason_code);
END;
$reason$;
REVOKE ALL ON FUNCTION public.caronaa_record_shared_attempt_cancel_reason(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_record_shared_attempt_cancel_reason(uuid,text) TO authenticated;
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
  SELECT jsonb_build_object('event_type','creation_candidates_snapshot','occurred_at',s.captured_at,
   'actor_id',NULL,'source','caronaa_flash_creation_candidates',
   'detail',jsonb_build_object('evidence','radar_pre_limit_candidate_snapshot','candidate_count',cardinality(s.driver_ids),'rule_version',s.rule_version))
  FROM public.caronaa_flash_creation_candidates s WHERE p_service='flash' AND s.request_id=p_request_id
  UNION ALL
  SELECT jsonb_build_object('event_type','shared_attempt_cancel_reason','occurred_at',a.recorded_at,
    'actor_id',a.passenger_id,'source','caronaa_shared_attempt_cancel_reasons',
    'detail',jsonb_build_object('attempt_id',a.ride_id,'reason_code',a.reason_code,'evidence','attempt_not_terminal_request'))
  FROM public.caronaa_shared_attempt_cancel_reasons a WHERE p_service='shared' AND a.request_id=p_request_id
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
 SELECT coalesce(jsonb_agg(
  e.item||jsonb_build_object('detail',(e.item->'detail')||jsonb_strip_nulls(jsonb_build_object(
   'actor_name_current',nullif(btrim(actor.full_name),''),
   'recipient_name_current',nullif(btrim(recipient.full_name),'')
  ))) ORDER BY (e.item->>'occurred_at')::timestamptz,e.item::text),'[]'::jsonb)
 INTO v_events FROM events e
 LEFT JOIN public.profiles actor ON actor.id=(e.item->>'actor_id')::uuid
 LEFT JOIN public.profiles recipient ON recipient.id=(e.item#>>'{detail,recipient_id}')::uuid;
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
   'creation_radar_candidates',CASE WHEN p_service='flash' THEN
    (SELECT cardinality(s.driver_ids) FROM public.caronaa_flash_creation_candidates s WHERE s.request_id=p_request_id) ELSE NULL END,
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
