-- CARONAA F07 | 0215 | Passenger dropoff confirmation recovers after app reopen.
-- Built from the current bilateral participant-only functions in live Supabase
-- (not the older 0210 migration). Apply manually before publishing the frontend.
-- No automatic passenger confirmation, no automatic Pix, no fee collection.
BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.quick_ride_dropoff_reviews') IS NULL OR
     to_regclass('public.quick_ride_dropoff_interactions') IS NULL OR
     to_regclass('public.quick_ride_completion_events') IS NULL OR
     NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='quick_ride_dropoff_reviews'
         AND column_name='participant_only'
     ) THEN
    RAISE EXCEPTION 'F07 bilateral dropoff schema missing. Apply existing closure migrations first.';
  END IF;
END $guard$;

-- Rescue unresolved, newly opened 2-minute requests without restarting
-- the clock and without reopening settled or administratively decided rides.
UPDATE public.quick_ride_dropoff_reviews d
SET deadline_at=greatest(d.deadline_at,d.requested_at+interval '10 minutes'),
    updated_at=now()
FROM public.professional_quick_rides q
WHERE q.id=d.ride_id AND q.status IN ('IN_PROGRESS','PENDING_REVIEW')
  AND d.passenger_response IS NULL
  -- Includes already timed-out requests with no administrator decision.
  AND d.admin_decision IS NULL
  AND d.requested_at+interval '10 minutes'>now()
  AND d.deadline_at<d.requested_at+interval '10 minutes';

-- New and repeated bilateral requests: 10 minutes without resetting
-- an active request on duplicate taps.
CREATE OR REPLACE FUNCTION public.quick_ride_request_dropoff(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_accuracy double precision;
  v_distance double precision;
  v_allowed double precision;
  v_method text := 'PARTICIPANT_REQUEST';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() OR
     q.pickup_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'DROPOFF_NOT_ALLOWED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF q.status='PENDING_REVIEW' AND FOUND THEN
    RETURN d.participant_only AND d.passenger_response IS NULL
      AND d.admin_decision IS NULL;
  END IF;
  IF q.status<>'IN_PROGRESS' THEN
    RAISE EXCEPTION 'DROPOFF_NOT_ALLOWED' USING ERRCODE='42501';
  END IF;
  IF FOUND THEN
    IF d.participant_only AND d.passenger_response='NOT_YET'
       AND d.admin_decision IS NULL THEN
      -- Avoid the driver spamming the passenger with repeated requests.
      IF d.resolved_at>now()-interval '20 seconds' THEN RETURN false; END IF;
      UPDATE public.quick_ride_dropoff_reviews SET
        passenger_response=NULL,resolved_at=NULL,
        requested_at=now(),deadline_at=now()+interval '10 minutes',
        completion_request_method='PARTICIPANT_REQUEST',
        finish_distance_m=NULL,finish_accuracy_m=NULL,
        request_count=request_count+1,updated_at=now() WHERE ride_id=p_id;
      UPDATE public.professional_quick_rides
        SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
        WHERE id=p_id AND status='IN_PROGRESS';
      INSERT INTO public.quick_ride_dropoff_interactions(ride_id,actor_id,action)
      VALUES(p_id,auth.uid(),'RE_REQUESTED');
      RETURN true;
    END IF;
    RETURN d.passenger_response IS NULL AND d.admin_decision IS NULL;
  END IF;

  -- Optional server GPS evidence; insufficient GPS never blocks dropoff.
  SELECT l.lat,l.lng,l.accuracy_m INTO v_lat,v_lng,v_accuracy
  FROM public.professional_driver_locations l
  WHERE l.user_id=q.driver_id
    AND l.accuracy_m>0 AND l.accuracy_m<=150
    AND l.sampled_at>=now()-interval '90 seconds'
    AND l.sampled_at<=now()+interval '5 seconds'
    AND l.updated_at>=now()-interval '90 seconds'
  ORDER BY l.sampled_at DESC LIMIT 1;
  IF FOUND THEN
    v_distance:=6371000.0*2*asin(least(1.0,sqrt(
      power(sin(radians((v_lat-q.destination_lat)/2)),2)+
      cos(radians(v_lat))*cos(radians(q.destination_lat))*
      power(sin(radians((v_lng-q.destination_lng)/2)),2)
    )));
    v_allowed:=greatest(150.0,least(250.0,v_accuracy+100.0));
    IF v_distance<=v_allowed THEN v_method:='GPS_VERIFIED'; END IF;
  END IF;
  INSERT INTO public.quick_ride_dropoff_reviews
    (ride_id,deadline_at,participant_only,completion_request_method,
     finish_distance_m,finish_accuracy_m)
  VALUES(p_id,now()+interval '10 minutes',true,v_method,v_distance,v_accuracy);
  UPDATE public.professional_quick_rides
    SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
    WHERE id=p_id AND status='IN_PROGRESS';
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),'DROPOFF_REQUESTED','IN_PROGRESS','PENDING_REVIEW',
    'Bilateral dropoff requested; awaiting passenger')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  INSERT INTO public.quick_ride_dropoff_interactions(ride_id,actor_id,action)
  VALUES(p_id,auth.uid(),'REQUESTED');
  RETURN true;
END;
$function$;

-- Reconcile operationally released PENDING_REVIEW after timeout.
CREATE OR REPLACE FUNCTION public.quick_ride_finalize_after_timeout(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR (q.driver_id IS DISTINCT FROM auth.uid() AND
      q.passenger_id IS DISTINCT FROM auth.uid()) OR q.status NOT IN ('IN_PROGRESS','PENDING_REVIEW') THEN
    RETURN false;
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF NOT FOUND OR d.deadline_at>now() OR d.passenger_response IS NOT NULL
     OR d.resolved_at IS NOT NULL THEN RETURN false; END IF;
  UPDATE public.quick_ride_dropoff_reviews
    SET resolved_at=now(),updated_at=now() WHERE ride_id=p_id;
  UPDATE public.professional_quick_rides
    SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
    WHERE id=p_id AND status IN ('IN_PROGRESS','PENDING_REVIEW');
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),'TIMEOUT_PENDING_REVIEW',
    q.status,'PENDING_REVIEW','Passenger did not respond within 10 minutes')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$function$;

-- A participant reopening the app reconciles elapsed deadlines.
CREATE OR REPLACE FUNCTION public.quick_ride_my_requests()
 RETURNS TABLE(id uuid, role text, municipality text, vehicle_type text, origin_label text, destination_label text, status text, requested_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  FOR v_id IN
    SELECT q.id
    FROM public.professional_quick_rides q
    JOIN public.quick_ride_dropoff_reviews d ON d.ride_id=q.id
    WHERE (q.driver_id=auth.uid() OR q.passenger_id=auth.uid())
      AND q.status IN ('IN_PROGRESS','PENDING_REVIEW')
      AND d.deadline_at<=now()
      AND d.resolved_at IS NULL AND d.passenger_response IS NULL
  LOOP
    PERFORM public.quick_ride_finalize_after_timeout(v_id);
  END LOOP;
  RETURN QUERY SELECT
    q.id,
    CASE WHEN q.passenger_id=auth.uid() THEN 'PASSENGER'::text ELSE 'DRIVER'::text END,
    q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
    CASE WHEN q.status='SEARCHING' AND q.expires_at<now() THEN 'EXPIRED'::text ELSE q.status END,
    q.requested_at,q.expires_at
  FROM public.professional_quick_rides q
  WHERE (q.passenger_id=auth.uid() OR q.driver_id=auth.uid())
    AND q.status IN ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS',
      'PENDING_REVIEW','COMPLETED','CANCELLED','EXPIRED')
  ORDER BY q.requested_at DESC
  LIMIT 20;
END;
$function$;

-- The admin list shows only contestations, elapsed deadlines or decisions.
CREATE OR REPLACE FUNCTION public.admin_quick_ride_disputes()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'ride_id',q.id,'municipality',q.municipality,'vehicle_type',q.vehicle_type,
      'status',q.status,'requested_at',d.requested_at,
      'passenger_name',coalesce(pp.full_name,'Passageiro'),
      'driver_name',coalesce(dp.full_name,'Motorista'),
      'origin_label',q.origin_label,'destination_label',q.destination_label,
      'passenger_response',d.passenger_response,
      'completion_request_method',d.completion_request_method,
      'driver_review_reason',d.driver_review_reason,
      'finish_distance_m',d.finish_distance_m,
      'finish_accuracy_m',d.finish_accuracy_m,
      'deadline_at',d.deadline_at,'resolved_at',d.resolved_at,
      'admin_decision',d.admin_decision,'admin_reason',d.admin_reason,
      'admin_resolved_at',d.admin_resolved_at,
      'admin_resolved_by',d.admin_resolved_by,'audit_at',a.occurred_at
    ) ORDER BY d.requested_at DESC)
    FROM public.quick_ride_dropoff_reviews d
    JOIN public.professional_quick_rides q ON q.id=d.ride_id
    LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
    LEFT JOIN public.profiles dp ON dp.id=q.driver_id
    LEFT JOIN public.quick_ride_dispute_audit a ON a.ride_id=q.id
    WHERE (q.status='PENDING_REVIEW' AND
      (d.passenger_response='CONTESTED' OR d.deadline_at<=now()))
      OR d.admin_decision IS NOT NULL
  ),'[]'::jsonb);
END;
$function$;

-- An administrator can decide expired cases even if both parties were offline.
CREATE OR REPLACE FUNCTION public.admin_resolve_quick_ride_dispute(p_ride_id uuid, p_decision text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('COMPLETE','CANCEL') OR
     char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Invalid decision/reason (20 to 2000 chars)' USING ERRCODE='22023';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR q.status NOT IN ('PENDING_REVIEW','IN_PROGRESS') THEN
    RAISE EXCEPTION 'Ride is not pending review' USING ERRCODE='23514';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews
    WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR (d.resolved_at IS NULL AND NOT (
       q.status='PENDING_REVIEW' AND d.passenger_response IS NULL
       AND d.deadline_at<=now())) OR d.admin_decision IS NOT NULL
     OR (d.passenger_response IS DISTINCT FROM 'CONTESTED'
         AND (d.passenger_response IS NOT NULL OR d.deadline_at>now()))
     OR EXISTS (
       SELECT 1 FROM public.quick_ride_dispute_audit WHERE ride_id=p_ride_id
     ) THEN
    RAISE EXCEPTION 'Review missing or already decided' USING ERRCODE='23514';
  END IF;
  v_new_status:=CASE WHEN p_decision='COMPLETE' THEN 'COMPLETED' ELSE 'CANCELLED' END;
  UPDATE public.professional_quick_rides
    SET status=v_new_status,
        completed_at=CASE WHEN p_decision='COMPLETE' THEN now() ELSE NULL END,
        updated_at=now() WHERE id=p_ride_id;
  UPDATE public.quick_ride_dropoff_reviews
    SET resolved_at=coalesce(resolved_at,now()),
        admin_decision=p_decision,admin_reason=btrim(p_reason),
        admin_resolved_by=auth.uid(),admin_resolved_at=now(),updated_at=now()
    WHERE ride_id=p_ride_id;
  INSERT INTO public.quick_ride_dispute_audit
    (ride_id,actor_id,action,previous_ride_status,new_ride_status,reason)
  VALUES(p_ride_id,auth.uid(),p_decision,q.status,v_new_status,btrim(p_reason));
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_ride_id,auth.uid(),
    CASE WHEN p_decision='COMPLETE' THEN 'ADMIN_COMPLETE' ELSE 'ADMIN_CANCEL' END,
    q.status,v_new_status,btrim(p_reason))
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$function$;

-- One participant-scoped read, regardless of which page the passenger opens.
-- A pending request remains answerable until a passenger response or admin
-- decision; the deadline only determines when an unanswered case is reviewable.
CREATE OR REPLACE FUNCTION public.quick_ride_pending_dropoff()
RETURNS TABLE (
  ride_id uuid,
  origin_label text,
  destination_label text,
  vehicle_type text,
  ride_status text,
  requested_at timestamptz,
  deadline_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $pending$
  SELECT q.id,q.origin_label,q.destination_label,q.vehicle_type,
         q.status,d.requested_at,d.deadline_at
  FROM public.professional_quick_rides q
  JOIN public.quick_ride_dropoff_reviews d ON d.ride_id=q.id
  WHERE auth.uid() IS NOT NULL
    AND q.passenger_id=auth.uid()
    AND q.pickup_confirmed_at IS NOT NULL
    AND q.status IN ('IN_PROGRESS','PENDING_REVIEW')
    AND d.passenger_response IS NULL
    AND d.admin_decision IS NULL
  ORDER BY d.requested_at DESC
  LIMIT 1;
$pending$;

REVOKE ALL ON FUNCTION public.quick_ride_pending_dropoff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_pending_dropoff() TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
