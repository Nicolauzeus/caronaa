-- CARONAA F07 - 0210 / 2026-11-18
-- Separate ride completion from GPS failures, dispute, non-response and payment.
-- Manual installation required. Transactional, repeat-safe on new columns/tables.
-- No existing ride, Pix declaration, rating or commission is deleted.
BEGIN;

ALTER TABLE public.professional_quick_rides
  DROP CONSTRAINT IF EXISTS professional_quick_rides_status_check;
ALTER TABLE public.professional_quick_rides
  ADD CONSTRAINT professional_quick_rides_status_check
  CHECK (status IN (
    'SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS',
    'PENDING_REVIEW','COMPLETED','CANCELLED','EXPIRED'
  ));

ALTER TABLE public.quick_ride_dropoff_reviews
  ADD COLUMN IF NOT EXISTS completion_request_method text,
  ADD COLUMN IF NOT EXISTS driver_review_reason text,
  ADD COLUMN IF NOT EXISTS finish_distance_m numeric,
  ADD COLUMN IF NOT EXISTS finish_accuracy_m numeric;
ALTER TABLE public.quick_ride_dropoff_reviews
  DROP CONSTRAINT IF EXISTS quick_dropoff_request_method_check;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD CONSTRAINT quick_dropoff_request_method_check
  CHECK (completion_request_method IS NULL OR
    completion_request_method IN ('GPS_VERIFIED','MANUAL_REVIEW'));
ALTER TABLE public.quick_ride_dropoff_reviews
  DROP CONSTRAINT IF EXISTS quick_dropoff_driver_reason_check;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD CONSTRAINT quick_dropoff_driver_reason_check
  CHECK (driver_review_reason IS NULL OR
    char_length(btrim(driver_review_reason)) BETWEEN 20 AND 1000);

CREATE TABLE IF NOT EXISTS public.quick_ride_completion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type IN (
    'DROPOFF_REQUESTED','PASSENGER_CONFIRMED','PASSENGER_CONTESTED',
    'TIMEOUT_PENDING_REVIEW','MANUAL_REVIEW_REQUESTED','ADMIN_COMPLETE',
    'ADMIN_CANCEL'
  )),
  previous_status text NOT NULL,
  new_status text NOT NULL,
  detail text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id,event_type)
);
CREATE INDEX IF NOT EXISTS quick_completion_events_history
  ON public.quick_ride_completion_events(ride_id,occurred_at DESC);
ALTER TABLE public.quick_ride_completion_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_completion_events FROM PUBLIC,anon,authenticated;

-- Driver requests passenger confirmation only near the real destination
-- with an accurate, recent, server-verified GPS point. Repeat calls are
-- idempotent and NEVER reset the 120s deadline.
CREATE OR REPLACE FUNCTION public.quick_ride_request_dropoff(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $request$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_accuracy double precision;
  v_distance double precision;
  v_allowed double precision;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid()
     OR q.status<>'IN_PROGRESS' OR q.pickup_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'DROPOFF_NOT_ALLOWED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF FOUND THEN
    -- Never give the driver a way to extend/restart an outstanding review.
    RETURN d.resolved_at IS NULL AND d.passenger_response IS NULL;
  END IF;
  SELECT l.lat,l.lng,l.accuracy_m INTO v_lat,v_lng,v_accuracy
  FROM public.professional_driver_locations l
  WHERE l.user_id=q.driver_id
    AND l.accuracy_m>0 AND l.accuracy_m<=150
    AND l.sampled_at >= now()-interval '90 seconds'
    AND l.sampled_at <= now()+interval '5 seconds'
    AND l.updated_at >= now()-interval '90 seconds'
  ORDER BY l.sampled_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DROPOFF_GPS_UNVERIFIED' USING ERRCODE='22023';
  END IF;
  v_distance:=6371000.0*2*asin(least(1.0,sqrt(
    power(sin(radians((v_lat-q.destination_lat)/2)),2)+
    cos(radians(v_lat))*cos(radians(q.destination_lat))*
    power(sin(radians((v_lng-q.destination_lng)/2)),2)
  )));
  -- 150m minimum for mobile road access, capped at 250m with GPS uncertainty.
  v_allowed:=greatest(150.0,least(250.0,v_accuracy+100.0));
  IF v_distance>v_allowed THEN
    RAISE EXCEPTION 'DROPOFF_TOO_FAR_FROM_DESTINATION' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.quick_ride_dropoff_reviews
    (ride_id,deadline_at,completion_request_method,finish_distance_m,finish_accuracy_m)
  VALUES (p_id,now()+interval '120 seconds','GPS_VERIFIED',v_distance,v_accuracy);
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES (p_id,auth.uid(),'DROPOFF_REQUESTED','IN_PROGRESS','IN_PROGRESS',
    'GPS verified near destination; passenger has 120 seconds')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$request$;

-- If precise destination GPS cannot be obtained, the driver can end the
-- operational part only by escalating for human review. There is NO Pix,
-- platform fee or confirmed completion until an administrator decides.
CREATE OR REPLACE FUNCTION public.quick_ride_request_manual_review(
  p_id uuid,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $manual$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_reason text:=btrim(coalesce(p_reason,''));
BEGIN
  IF auth.uid() IS NULL OR char_length(v_reason) NOT BETWEEN 20 AND 1000 THEN
    RAISE EXCEPTION 'DROPOFF_MANUAL_REASON_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() OR
     q.pickup_confirmed_at IS NULL OR
     q.status NOT IN ('IN_PROGRESS','PENDING_REVIEW') THEN
    RAISE EXCEPTION 'DROPOFF_NOT_ALLOWED' USING ERRCODE='42501';
  END IF;
  IF q.status='PENDING_REVIEW' THEN RETURN true; END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF FOUND AND d.resolved_at IS NOT NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.quick_ride_dropoff_reviews
    (ride_id,deadline_at,resolved_at,completion_request_method,driver_review_reason)
  VALUES (p_id,now(),now(),'MANUAL_REVIEW',v_reason)
  ON CONFLICT (ride_id) DO UPDATE
    SET resolved_at=now(),deadline_at=now(),updated_at=now(),
        completion_request_method='MANUAL_REVIEW',driver_review_reason=v_reason
    WHERE public.quick_ride_dropoff_reviews.resolved_at IS NULL
      AND public.quick_ride_dropoff_reviews.passenger_response IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.professional_quick_rides
    SET status='PENDING_REVIEW',updated_at=now() WHERE id=p_id AND status='IN_PROGRESS';
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),'MANUAL_REVIEW_REQUESTED','IN_PROGRESS','PENDING_REVIEW',v_reason)
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$manual$;

CREATE OR REPLACE FUNCTION public.quick_ride_respond_dropoff(
  p_id uuid,p_response text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $respond$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() OR
     q.status<>'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Dropoff response unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF NOT FOUND OR d.resolved_at IS NOT NULL OR d.deadline_at<=now() OR
    p_response NOT IN ('CONFIRMED','CONTESTED') THEN
    RAISE EXCEPTION 'Dropoff response is closed' USING ERRCODE='42501';
  END IF;
  v_new_status:=CASE WHEN p_response='CONFIRMED'
    THEN 'COMPLETED' ELSE 'PENDING_REVIEW' END;
  UPDATE public.quick_ride_dropoff_reviews
    SET passenger_response=p_response,resolved_at=now(),updated_at=now()
    WHERE ride_id=p_id;
  UPDATE public.professional_quick_rides
    SET status=v_new_status,
        completed_at=CASE WHEN p_response='CONFIRMED' THEN now() ELSE NULL END,
        updated_at=now()
    WHERE id=p_id;
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),
    CASE WHEN p_response='CONFIRMED' THEN 'PASSENGER_CONFIRMED' ELSE 'PASSENGER_CONTESTED' END,
    'IN_PROGRESS',v_new_status,
    'Participant response validated within dropoff deadline')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$respond$;

-- Timeout is NOT consent, proof of arrival, proof of payment or a completed
-- commercial ride. It only releases the live trip into pending review.
CREATE OR REPLACE FUNCTION public.quick_ride_finalize_after_timeout(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $timeout$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR (q.driver_id IS DISTINCT FROM auth.uid() AND
      q.passenger_id IS DISTINCT FROM auth.uid()) OR q.status<>'IN_PROGRESS' THEN
    RETURN false;
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF NOT FOUND OR d.deadline_at>now() OR d.passenger_response IS NOT NULL
     OR d.resolved_at IS NOT NULL THEN RETURN false; END IF;
  UPDATE public.quick_ride_dropoff_reviews
    SET resolved_at=now(),updated_at=now() WHERE ride_id=p_id;
  UPDATE public.professional_quick_rides
    SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
    WHERE id=p_id AND status='IN_PROGRESS';
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),'TIMEOUT_PENDING_REVIEW',
    'IN_PROGRESS','PENDING_REVIEW','Passenger did not respond within 120 seconds')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$timeout$;

-- Reconcile expired reviews when either participant next opens or refreshes
-- the application. No background cron or unsafe client-completion needed.
CREATE OR REPLACE FUNCTION public.quick_ride_my_requests()
RETURNS TABLE (
  id uuid,role text,municipality text,vehicle_type text,
  origin_label text,destination_label text,status text,
  requested_at timestamptz,expires_at timestamptz
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $requests$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  FOR v_id IN
    SELECT q.id
    FROM public.professional_quick_rides q
    JOIN public.quick_ride_dropoff_reviews d ON d.ride_id=q.id
    WHERE (q.driver_id=auth.uid() OR q.passenger_id=auth.uid())
      AND q.status='IN_PROGRESS' AND d.deadline_at<=now()
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
$requests$;

-- Include both explicit contests and GPS/non-response reviews in the
-- admin decision queue. Preserve historical decisions in the all tab.
CREATE OR REPLACE FUNCTION public.admin_quick_ride_disputes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $admin_list$
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
    WHERE q.status='PENDING_REVIEW'
      OR d.passenger_response='CONTESTED'
      OR d.admin_decision IS NOT NULL
  ),'[]'::jsonb);
END;
$admin_list$;

-- A review decision is not a payment declaration. Only human approval can
-- change a pending case to COMPLETED and hence accrue the driver commission.
CREATE OR REPLACE FUNCTION public.admin_resolve_quick_ride_dispute(
  p_ride_id uuid,p_decision text,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $admin_resolve$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_decision NOT IN ('COMPLETE','CANCEL') OR
     char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Invalid decision/reason (20 to 2000 chars)' USING ERRCODE='22023';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR q.status NOT IN ('PENDING_REVIEW','IN_PROGRESS') THEN
    RAISE EXCEPTION 'Ride is not pending review' USING ERRCODE='23514';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews
    WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR d.resolved_at IS NULL OR d.admin_decision IS NOT NULL
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
    SET admin_decision=p_decision,admin_reason=btrim(p_reason),
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
$admin_resolve$;

REVOKE ALL ON FUNCTION
  public.quick_ride_request_dropoff(uuid),
  public.quick_ride_request_manual_review(uuid,text),
  public.quick_ride_respond_dropoff(uuid,text),
  public.quick_ride_finalize_after_timeout(uuid),
  public.quick_ride_my_requests(),
  public.admin_quick_ride_disputes(),
  public.admin_resolve_quick_ride_dispute(uuid,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION
  public.quick_ride_request_dropoff(uuid),
  public.quick_ride_request_manual_review(uuid,text),
  public.quick_ride_respond_dropoff(uuid,text),
  public.quick_ride_finalize_after_timeout(uuid),
  public.quick_ride_my_requests(),
  public.admin_quick_ride_disputes(),
  public.admin_resolve_quick_ride_dispute(uuid,text,text)
  TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
