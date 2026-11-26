-- 0258 | F07/F09: preserve actual municipal queue writes as separate evidence.
-- This is not a transport receipt, recipient list, delivery or a push notification.
BEGIN;
CREATE TABLE public.caronaa_flash_queue_signal_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL,
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE')),
 status text NOT NULL
);
CREATE INDEX caronaa_flash_queue_signal_request_idx ON public.caronaa_flash_queue_signal_history(request_id,recorded_at);
ALTER TABLE public.caronaa_flash_queue_signal_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_flash_queue_signal_history FROM PUBLIC,anon,authenticated;

-- Preserve the existing 0148 queue upsert and the installed trigger.
CREATE OR REPLACE FUNCTION public.notify_caronaa_quick_queue_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $event$
DECLARE v_changed_at timestamptz; v_old_timeout text;
BEGIN
 IF NEW.municipality IS NOT NULL THEN
  INSERT INTO public.caronaa_quick_queue_events(municipality,changed_at)
  VALUES(NEW.municipality,clock_timestamp())
  ON CONFLICT(municipality) DO UPDATE SET changed_at=EXCLUDED.changed_at
  RETURNING changed_at INTO v_changed_at;
  -- No duplicate history on a status/driver no-op; the original queue write is preserved.
  IF TG_OP='INSERT' OR (OLD.status IS DISTINCT FROM NEW.status OR OLD.driver_id IS DISTINCT FROM NEW.driver_id) THEN
   BEGIN
    v_old_timeout:=current_setting('lock_timeout');
    PERFORM set_config('lock_timeout','150ms',true);
    INSERT INTO public.caronaa_flash_queue_signal_history(request_id,recorded_at,operation,status)
    VALUES(NEW.id,v_changed_at,TG_OP,NEW.status);
    PERFORM set_config('lock_timeout',v_old_timeout,true);
   EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'CARONAA queue history unavailable';
   END;
  END IF;
 END IF;
 RETURN NEW;
END;
$event$;
REVOKE ALL ON FUNCTION public.notify_caronaa_quick_queue_change() FROM PUBLIC,anon,authenticated;
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
