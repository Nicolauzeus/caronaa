-- 0217 | F07: differentiated dropoff dispute, audit, persistent post-trip notice.
-- Apply manually in Supabase SQL Editor BEFORE publishing the matching frontend.
-- Does not auto-confirm passenger arrival, initiate Pix, or mark payment as received.
-- Leaves the existing live quick_ride_respond_dropoff(uuid,text) untouched.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.professional_quick_rides') IS NULL
     OR to_regclass('public.quick_ride_dropoff_reviews') IS NULL
     OR to_regclass('public.quick_ride_completion_events') IS NULL
     OR to_regclass('public.quick_ride_dispute_audit') IS NULL
     OR to_regprocedure('public.quick_ride_respond_dropoff(uuid,text)') IS NULL
  THEN
    RAISE EXCEPTION '0217 requires the current F07 bilateral dropoff schema and respond RPC';
  END IF;
END;
$preflight$;

-- A response of NOT_YET is a normal resumption, NOT a dispute.
-- The installed response RPC already inserts PASSENGER_NOT_YET.
ALTER TABLE public.quick_ride_completion_events
  DROP CONSTRAINT IF EXISTS quick_ride_completion_events_event_type_check;
ALTER TABLE public.quick_ride_completion_events
  ADD CONSTRAINT quick_ride_completion_events_event_type_check
  CHECK (event_type IN (
    'DROPOFF_REQUESTED', 'PASSENGER_CONFIRMED',
    'PASSENGER_CONTESTED', 'PASSENGER_NOT_YET',
    'TIMEOUT_PENDING_REVIEW', 'MANUAL_REVIEW_REQUESTED',
    'ADMIN_COMPLETE', 'ADMIN_CANCEL'
  ));

-- Structured evidence for an explicit disagreement only.
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD COLUMN IF NOT EXISTS passenger_dispute_reason_code text,
  ADD COLUMN IF NOT EXISTS passenger_dispute_note text;
ALTER TABLE public.quick_ride_dropoff_reviews
  DROP CONSTRAINT IF EXISTS quick_dropoff_dispute_reason_check;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD CONSTRAINT quick_dropoff_dispute_reason_check CHECK (
    passenger_dispute_reason_code IS NULL OR
    passenger_dispute_reason_code IN (
      'DRIVER_ENDED_EARLY', 'WRONG_LOCATION', 'UNSAFE_STOP', 'OTHER'
    )
  );
ALTER TABLE public.quick_ride_dropoff_reviews
  DROP CONSTRAINT IF EXISTS quick_dropoff_dispute_note_check;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD CONSTRAINT quick_dropoff_dispute_note_check CHECK (
    passenger_dispute_note IS NULL OR
    char_length(passenger_dispute_note) <= 1000
  );

-- Existing respondent function remains the single authoritative state machine.
-- New entry point atomically captures a reason and delegates the response.
CREATE OR REPLACE FUNCTION public.quick_ride_open_dropoff_dispute(
  p_id uuid, p_reason_code text, p_note text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $dispute$
DECLARE
  v_ride public.professional_quick_rides%ROWTYPE;
  v_review public.quick_ride_dropoff_reviews%ROWTYPE;
  v_note text := nullif(btrim(coalesce(p_note,'')), '');
BEGIN
  IF auth.uid() IS NULL
     OR p_reason_code IS NULL
     OR p_reason_code NOT IN (
       'DRIVER_ENDED_EARLY','WRONG_LOCATION','UNSAFE_STOP','OTHER'
     )
     OR char_length(coalesce(v_note,'')) > 1000
     OR (p_reason_code='OTHER' AND char_length(coalesce(v_note,'')) < 10)
  THEN
    RAISE EXCEPTION 'Informe o motivo correto da contestacao'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_ride
  FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_ride.passenger_id IS DISTINCT FROM auth.uid()
     OR v_ride.status NOT IN ('IN_PROGRESS','PENDING_REVIEW')
  THEN
    RAISE EXCEPTION 'Contestacao indisponivel' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_review
  FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF NOT FOUND OR v_review.admin_decision IS NOT NULL THEN
    RAISE EXCEPTION 'Contestacao indisponivel' USING ERRCODE='42501';
  END IF;
  IF v_review.passenger_response='CONTESTED' THEN
    RETURN true; -- idempotent retry; do not overwrite original reason
  END IF;
  IF v_review.passenger_response IS NOT NULL THEN
    RAISE EXCEPTION 'Desembarque ja respondido' USING ERRCODE='23514';
  END IF;

  UPDATE public.quick_ride_dropoff_reviews
    SET passenger_dispute_reason_code=p_reason_code,
        passenger_dispute_note=v_note,updated_at=now()
    WHERE ride_id=p_id;
  -- Same transaction: if state transition fails, the reason rolls back.
  RETURN public.quick_ride_respond_dropoff(p_id,'CONTESTED');
END;
$dispute$;
REVOKE ALL ON FUNCTION public.quick_ride_open_dropoff_dispute(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quick_ride_open_dropoff_dispute(uuid,text,text)
  TO authenticated;

-- The admin sees explicit disputes separately from unanswered confirmations.
CREATE OR REPLACE FUNCTION public.admin_quick_ride_disputes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $cases$
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
      'passenger_dispute_reason_code',d.passenger_dispute_reason_code,
      'passenger_dispute_note',d.passenger_dispute_note,
      'deadline_at',d.deadline_at,'resolved_at',d.resolved_at,
      'admin_decision',d.admin_decision,'admin_reason',d.admin_reason,
      'admin_resolved_at',d.admin_resolved_at,
      'admin_resolved_by',d.admin_resolved_by,'audit_at',a.occurred_at,
      'case_kind', CASE
        WHEN d.passenger_response='CONTESTED' THEN 'DISPUTED'
        WHEN d.passenger_response IS NULL AND d.deadline_at<=now()
          THEN 'NO_RESPONSE'
        ELSE 'AWAITING_PASSENGER' END
    ) ORDER BY d.requested_at DESC)
    FROM public.quick_ride_dropoff_reviews d
    JOIN public.professional_quick_rides q ON q.id=d.ride_id
    LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
    LEFT JOIN public.profiles dp ON dp.id=q.driver_id
    LEFT JOIN public.quick_ride_dispute_audit a ON a.ride_id=q.id
    WHERE (q.status='PENDING_REVIEW'
      AND (d.passenger_response='CONTESTED' OR d.deadline_at<=now()))
      OR d.admin_decision IS NOT NULL
  ),'[]'::jsonb);
END;
$cases$;
REVOKE ALL ON FUNCTION public.admin_quick_ride_disputes()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_quick_ride_disputes()
  TO authenticated;

-- Persist acknowledgement of displaying checkout in the user's account.
-- This is NEVER proof of Pix, payment, rating or settlement.
CREATE TABLE IF NOT EXISTS public.quick_ride_posttrip_acknowledgements (
  ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ride_id,user_id)
);
CREATE INDEX IF NOT EXISTS quick_posttrip_ack_user_idx
  ON public.quick_ride_posttrip_acknowledgements(user_id,seen_at DESC);
ALTER TABLE public.quick_ride_posttrip_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_posttrip_acknowledgements
  FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.quick_ride_posttrip_acknowledgements TO service_role;

CREATE OR REPLACE FUNCTION public.quick_ride_my_posttrip_pending()
RETURNS TABLE(ride_id uuid, role text, completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $posttrip$
  SELECT q.id,
    CASE WHEN q.passenger_id=auth.uid() THEN 'PASSENGER'::text
         ELSE 'DRIVER'::text END,
    q.completed_at
  FROM public.professional_quick_rides q
  WHERE auth.uid() IS NOT NULL
    AND q.status='COMPLETED' AND q.completed_at IS NOT NULL
    AND q.completed_at >= now()-interval '7 days'
    AND (q.passenger_id=auth.uid() OR q.driver_id=auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.quick_ride_posttrip_acknowledgements a
      WHERE a.ride_id=q.id AND a.user_id=auth.uid()
    )
  ORDER BY q.completed_at DESC
  LIMIT 1;
$posttrip$;

CREATE OR REPLACE FUNCTION public.quick_ride_ack_posttrip(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ack$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.professional_quick_rides q
    WHERE q.id=p_id AND q.status='COMPLETED'
      AND (q.passenger_id=auth.uid() OR q.driver_id=auth.uid())
  ) THEN
    RAISE EXCEPTION 'Pos-corrida indisponivel' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.quick_ride_posttrip_acknowledgements(ride_id,user_id)
    VALUES(p_id,auth.uid())
    ON CONFLICT(ride_id,user_id) DO NOTHING;
  RETURN true;
END;
$ack$;
REVOKE ALL ON FUNCTION public.quick_ride_my_posttrip_pending(),
  public.quick_ride_ack_posttrip(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.quick_ride_my_posttrip_pending(),
  public.quick_ride_ack_posttrip(uuid) TO authenticated;

COMMENT ON FUNCTION public.quick_ride_ack_posttrip(uuid) IS
  'Acknowledges displaying checkout only; never confirms Pix or settlement.';
COMMENT ON COLUMN public.quick_ride_dropoff_reviews.passenger_dispute_reason_code
  IS 'Set only for a passenger-initiated dispute; NOT_YET is not a dispute.';

NOTIFY pgrst,'reload schema';
COMMIT;
