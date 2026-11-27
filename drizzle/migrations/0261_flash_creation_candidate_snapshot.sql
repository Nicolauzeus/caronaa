-- 0261 | F07/F09: record candidates at creation using the documented 0233 primary radar predicates.
-- Pre-limit candidate cohort; not a delivery list or a guarantee of a successful accept.
-- No coordinates are copied into the evidence table. Never backfill past snapshots.
BEGIN;
CREATE TABLE public.caronaa_flash_creation_candidates(
 request_id uuid PRIMARY KEY,captured_at timestamptz NOT NULL,
 rule_version text NOT NULL,driver_ids uuid[] NOT NULL
);
ALTER TABLE public.caronaa_flash_creation_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_flash_creation_candidates FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.caronaa_flash_creation_candidate_ids(p_request_id uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SET search_path=''
AS $candidates$
DECLARE v_ids uuid[];
BEGIN
 -- Same approval, presence, GPS freshness, capacity, skip/active-ride and
 -- radius/corridor predicates as migration 0233. No per-driver LIMIT 5:
 -- the list is potential radar audience, not actual card delivery.
 SELECT coalesce(array_agg(DISTINCT f.user_id ORDER BY f.user_id),'{}'::uuid[])
 INTO v_ids
 FROM public.professional_quick_rides r
 JOIN public.profiles passenger ON passenger.id=r.passenger_id
 JOIN public.flash_driver_presence f ON f.user_id<>r.passenger_id
 WHERE r.id=p_request_id AND r.status='SEARCHING' AND r.expires_at>now()
  AND f.is_online AND f.last_gps_at>now()-interval '90 seconds'
  AND f.last_sampled_at>now()-interval '90 seconds' AND f.last_accuracy_m<=150
  AND f.available_seats>=coalesce(r.seats_requested,1)
  AND EXISTS(SELECT 1 FROM public.professional_driver_authorizations a WHERE a.user_id=f.user_id AND a.approved AND a.vehicle_type=r.vehicle_type)
  AND public.driver_platform_access_allowed(f.user_id)
  AND EXISTS(SELECT 1 FROM public.professional_driver_locations l
   JOIN public.professional_presence p ON p.user_id=l.user_id
   WHERE l.user_id=f.user_id AND l.accuracy_m<=150 AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds' AND p.is_available AND p.last_seen_at>now()-interval '90 seconds')
  AND NOT EXISTS(SELECT 1 FROM public.flash_order_driver_skips s WHERE s.ride_id=r.id AND s.driver_id=f.user_id)
  AND NOT EXISTS(SELECT 1 FROM public.professional_quick_rides active WHERE active.driver_id=f.user_id AND active.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS'))
  AND (
   (f.dispatch_mode IN ('ALL','EXCLUSIVE') AND public.ST_DWithin(
    public.ST_SetSRID(public.ST_MakePoint(f.last_lng,f.last_lat),4326)::public.geography,
    public.ST_SetSRID(public.ST_MakePoint(coalesce(r.meeting_point_lng,r.origin_lng),coalesce(r.meeting_point_lat,r.origin_lat)),4326)::public.geography,15000))
   OR (f.dispatch_mode IN ('ALL','ON_ROUTE') AND f.route_geom IS NOT NULL AND public.ST_DWithin(
    f.route_geom::public.geography,
    public.ST_SetSRID(public.ST_MakePoint(coalesce(r.meeting_point_lng,r.origin_lng),coalesce(r.meeting_point_lat,r.origin_lat)),4326)::public.geography,500))
  );
 RETURN v_ids;
END;
$candidates$;
REVOKE ALL ON FUNCTION public.caronaa_flash_creation_candidate_ids(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.caronaa_capture_flash_creation_candidates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $capture$
DECLARE v_ids uuid[]; v_timeout text; v_captured_at timestamptz:=clock_timestamp();
BEGIN
 IF NEW.status IS DISTINCT FROM 'SEARCHING' THEN RETURN NEW; END IF;
 BEGIN
  v_timeout:=current_setting('lock_timeout');
  PERFORM set_config('lock_timeout','150ms',true);
  v_ids:=public.caronaa_flash_creation_candidate_ids(NEW.id);
  IF v_ids IS NOT NULL THEN
   INSERT INTO public.caronaa_flash_creation_candidates(request_id,captured_at,rule_version,driver_ids)
   VALUES(NEW.id,v_captured_at,'radar_0233_pre_limit',v_ids) ON CONFLICT(request_id) DO NOTHING;
  END IF;
  PERFORM set_config('lock_timeout',v_timeout,true);
 EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'CARONAA creation candidate snapshot unavailable';
 END;
 RETURN NEW;
END;
$capture$;
REVOKE ALL ON FUNCTION public.caronaa_capture_flash_creation_candidates() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER caronaa_flash_capture_creation_candidates
 AFTER INSERT ON public.professional_quick_rides
 FOR EACH ROW EXECUTE FUNCTION public.caronaa_capture_flash_creation_candidates();
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
