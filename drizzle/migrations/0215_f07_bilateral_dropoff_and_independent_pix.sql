-- CARONAA F07 / RN021 - 2026-11-19
-- MANUAL: apply AFTER 0210 + 0157 and BEFORE publishing this frontend.
-- No fare re-pricing, automatic payment, data deletion or fee on silence.
BEGIN;

ALTER TABLE public.quick_ride_dropoff_reviews
  ADD COLUMN IF NOT EXISTS participant_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD COLUMN IF NOT EXISTS request_count integer NOT NULL DEFAULT 1
    CHECK (request_count>=1);
ALTER TABLE public.quick_ride_dropoff_reviews
  DROP CONSTRAINT IF EXISTS quick_ride_dropoff_reviews_passenger_response_check;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD CONSTRAINT quick_ride_dropoff_reviews_passenger_response_check
    CHECK (passenger_response IN ('CONFIRMED','CONTESTED','NOT_YET'));
ALTER TABLE public.quick_ride_completion_events
  DROP CONSTRAINT IF EXISTS quick_ride_completion_events_event_type_check;
ALTER TABLE public.quick_ride_completion_events
  ADD CONSTRAINT quick_ride_completion_events_event_type_check
    CHECK (event_type IN ('DROPOFF_REQUESTED','PASSENGER_CONFIRMED',
      'PASSENGER_CONTESTED','PASSENGER_NOT_YET','TIMEOUT_PENDING_REVIEW',
      'MANUAL_REVIEW_REQUESTED','ADMIN_COMPLETE','ADMIN_CANCEL'));
ALTER TABLE public.quick_ride_dropoff_reviews
  DROP CONSTRAINT IF EXISTS quick_dropoff_request_method_check;
ALTER TABLE public.quick_ride_dropoff_reviews
  ADD CONSTRAINT quick_dropoff_request_method_check CHECK (
    completion_request_method IS NULL OR
    completion_request_method IN ('GPS_VERIFIED','MANUAL_REVIEW','PARTICIPANT_REQUEST')
  );

-- Repeated denials/retries are separately recorded, preserving a trace.
CREATE TABLE IF NOT EXISTS public.quick_ride_dropoff_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('REQUESTED','RE_REQUESTED','NOT_YET','CONFIRMED','CONTESTED')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quick_ride_dropoff_interactions_ride_idx
  ON public.quick_ride_dropoff_interactions(ride_id,occurred_at);
ALTER TABLE public.quick_ride_dropoff_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_dropoff_interactions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.quick_ride_dropoff_interactions TO service_role;

-- Reuse the existing PENDING_REVIEW database status as a non-operational,
-- bilateral waiting state, marked participant_only=true. The driver is freed
-- immediately; passenger consent is still required for COMPLETED, fees + Pix.
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
        requested_at=now(),deadline_at=now()+interval '120 seconds',
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
  VALUES(p_id,now()+interval '120 seconds',true,v_method,v_distance,v_accuracy);
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
$request$;

-- Backward compatibility for older clients; reason intentionally ignored.
CREATE OR REPLACE FUNCTION public.quick_ride_request_manual_review(
  p_id uuid,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $legacy$
BEGIN
  RETURN public.quick_ride_request_dropoff(p_id);
END;
$legacy$;

-- No expiry gate: the passenger can answer after a device reconnects.
-- A real contest remains admin-reviewable; silence is NEVER confirmation.
CREATE OR REPLACE FUNCTION public.quick_ride_respond_dropoff(
  p_id uuid,p_response text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $respond$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL OR p_response IS NULL OR
     p_response NOT IN ('CONFIRMED','CONTESTED','NOT_YET') THEN
    RAISE EXCEPTION 'Invalid dropoff response' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Dropoff response unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF NOT FOUND OR d.admin_decision IS NOT NULL THEN
    RAISE EXCEPTION 'Dropoff response unavailable' USING ERRCODE='42501';
  END IF;
  IF q.status='COMPLETED' AND d.passenger_response='CONFIRMED'
     AND p_response='CONFIRMED' THEN RETURN true; END IF;
  IF q.status='PENDING_REVIEW' AND d.passenger_response='CONTESTED'
     AND p_response='CONTESTED' THEN RETURN true; END IF;
  IF q.status NOT IN ('IN_PROGRESS','PENDING_REVIEW') OR
     d.passenger_response IS NOT NULL THEN
    RAISE EXCEPTION 'Dropoff response is closed' USING ERRCODE='42501';
  END IF;
  v_new_status:=CASE WHEN p_response='CONFIRMED' THEN 'COMPLETED'
    WHEN p_response='NOT_YET' THEN 'IN_PROGRESS' ELSE 'PENDING_REVIEW' END;
  UPDATE public.quick_ride_dropoff_reviews
    SET passenger_response=p_response,resolved_at=now(),updated_at=now(),
        participant_only=CASE WHEN p_response='NOT_YET' THEN true ELSE participant_only END
    WHERE ride_id=p_id;
  UPDATE public.professional_quick_rides
    SET status=v_new_status,
        completed_at=CASE WHEN p_response='CONFIRMED' THEN now() ELSE NULL END,
        updated_at=now()
    WHERE id=p_id;
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),
    CASE WHEN p_response='CONFIRMED' THEN 'PASSENGER_CONFIRMED'
         WHEN p_response='NOT_YET' THEN 'PASSENGER_NOT_YET'
         ELSE 'PASSENGER_CONTESTED' END,
    q.status,v_new_status,'Passenger responded to bilateral dropoff')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  INSERT INTO public.quick_ride_dropoff_interactions(ride_id,actor_id,action)
  VALUES(p_id,auth.uid(),p_response);
  RETURN true;
END;
$respond$;

-- Admin queue contains actual contests and legacy reviews, not routine
-- bilateral confirmations. Keeps existing audit and admin resolution RPC.
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
    WHERE (q.status='PENDING_REVIEW' AND
      (d.passenger_response='CONTESTED' OR d.participant_only=false))
      OR d.admin_decision IS NOT NULL
  ),'[]'::jsonb);
END;
$admin_list$;

-- Immutable receiver + amount per ride. Both devices fetch this one
-- server-owned snapshot; changing a profile Pix key cannot change an
-- already displayed collection. The first completed-trip lookup creates it
-- only when the driver has a valid key. No transfer takes place here.
CREATE TABLE IF NOT EXISTS public.quick_ride_pix_checkout_snapshot (
  ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE RESTRICT,
  recipient_key text NOT NULL CHECK (char_length(btrim(recipient_key)) BETWEEN 6 AND 77),
  recipient_name text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents>=450),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_ride_pix_checkout_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_pix_checkout_snapshot FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.quick_ride_pix_checkout_snapshot TO service_role;

CREATE OR REPLACE FUNCTION public.get_completed_quick_ride_pix(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $pix_snapshot$
DECLARE
  r public.professional_quick_rides%ROWTYPE;
  q public.caronaa_quick_fare_quotes%ROWTYPE;
  s public.quick_ride_pix_checkout_snapshot%ROWTYPE;
  v_key text;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.professional_quick_rides WHERE id=p_ride_id;
  IF NOT FOUND OR (r.passenger_id IS DISTINCT FROM auth.uid() AND
      r.driver_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Quick ride not found' USING ERRCODE='42501';
  END IF;
  IF r.status<>'COMPLETED' OR r.driver_id IS NULL THEN
    RAISE EXCEPTION 'Pix somente apos conclusao confirmada' USING ERRCODE='22023';
  END IF;
  SELECT * INTO q FROM public.caronaa_quick_fare_quotes WHERE ride_id=p_ride_id;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM r.passenger_id
      OR q.municipality IS DISTINCT FROM r.municipality
      OR q.vehicle_type IS DISTINCT FROM r.vehicle_type
      OR q.customer_pays_cents<450
      OR q.customer_pays_cents <> q.driver_receives_cents+q.platform_commission_cents THEN
    RAISE EXCEPTION 'Contrato de tarifa inconsistente' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM public.quick_ride_pix_checkout_snapshot WHERE ride_id=p_ride_id;
  IF NOT FOUND THEN
    SELECT d.pix_key INTO v_key FROM public.driver_pix_settings d
      WHERE d.user_id=r.driver_id;
    IF length(btrim(coalesce(v_key,''))) BETWEEN 6 AND 77 THEN
      SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id=r.driver_id;
      INSERT INTO public.quick_ride_pix_checkout_snapshot
        (ride_id,recipient_key,recipient_name,amount_cents)
      VALUES(p_ride_id,btrim(v_key),
        coalesce(nullif(btrim(v_name),''),'Motorista'),q.customer_pays_cents)
      ON CONFLICT(ride_id) DO NOTHING;
      SELECT * INTO s FROM public.quick_ride_pix_checkout_snapshot
        WHERE ride_id=p_ride_id;
    END IF;
  END IF;
  IF s.ride_id IS NOT NULL AND s.amount_cents<>q.customer_pays_cents THEN
    RAISE EXCEPTION 'Snapshot Pix inconsistente' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object(
    'available',s.ride_id IS NOT NULL,
    'key',s.recipient_key,
    'name',coalesce(s.recipient_name,'Motorista'),
    'amountCents',q.customer_pays_cents,
    'rideId',r.id,
    'paymentMethod','MANUAL_DRIVER_PIX',
    'automaticConfirmation',false,
    'pilotOnly',(q.policy_version LIKE '%-piloto')
  );
END;
$pix_snapshot$;
REVOKE ALL ON FUNCTION public.get_completed_quick_ride_pix(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_completed_quick_ride_pix(uuid) TO authenticated;

-- Payment declarations are separate, idempotent events. Driver can
-- acknowledge a real bank receipt even if passenger forgot to tap "paguei".
-- Never treat the app button as bank reconciliation or platform fee payment.
CREATE OR REPLACE FUNCTION public.quick_ride_declare_manual_pix(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $passenger_pix$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF auth.uid() IS NULL OR NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid()
     OR q.status<>'COMPLETED' THEN
    RAISE EXCEPTION 'Pagamento indisponivel' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quick_ride_pix_checkout_snapshot s
    WHERE s.ride_id=p_id) THEN
    RAISE EXCEPTION 'Cobrança Pix ainda nao emitida' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.caronaa_quick_fare_quotes f
    WHERE f.ride_id=p_id AND f.passenger_id IS NOT DISTINCT FROM q.passenger_id
      AND f.municipality IS NOT DISTINCT FROM q.municipality
      AND f.vehicle_type IS NOT DISTINCT FROM q.vehicle_type
      AND f.customer_pays_cents>=450
      AND f.customer_pays_cents=f.driver_receives_cents+f.platform_commission_cents) THEN
    RAISE EXCEPTION 'Contrato tarifario inconsistente' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.quick_ride_pix_declarations
    (ride_id,code_hash,salt,expires_at,passenger_declared_at)
  VALUES (p_id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),
    gen_random_uuid(),now()+interval '24 hours',now())
  ON CONFLICT(ride_id) DO UPDATE
    SET passenger_declared_at=coalesce(
      public.quick_ride_pix_declarations.passenger_declared_at,now());
  INSERT INTO public.quick_ride_payment_events(ride_id,actor_id,event_type)
  VALUES(p_id,auth.uid(),'PASSENGER_DECLARED') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$passenger_pix$;

CREATE OR REPLACE FUNCTION public.quick_ride_acknowledge_manual_pix(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $driver_pix$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF auth.uid() IS NULL OR NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid()
     OR q.status<>'COMPLETED' THEN
    RAISE EXCEPTION 'Recebimento indisponivel' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quick_ride_pix_checkout_snapshot s
    WHERE s.ride_id=p_id) THEN
    RAISE EXCEPTION 'Cobrança Pix ainda nao emitida' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.caronaa_quick_fare_quotes f
    WHERE f.ride_id=p_id AND f.passenger_id IS NOT DISTINCT FROM q.passenger_id
      AND f.municipality IS NOT DISTINCT FROM q.municipality
      AND f.vehicle_type IS NOT DISTINCT FROM q.vehicle_type
      AND f.customer_pays_cents>=450
      AND f.customer_pays_cents=f.driver_receives_cents+f.platform_commission_cents) THEN
    RAISE EXCEPTION 'Contrato tarifario inconsistente' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.quick_ride_pix_declarations
    (ride_id,code_hash,salt,expires_at,driver_acknowledged_at)
  VALUES (p_id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),
    gen_random_uuid(),now()+interval '24 hours',now())
  ON CONFLICT(ride_id) DO UPDATE
    SET driver_acknowledged_at=coalesce(
      public.quick_ride_pix_declarations.driver_acknowledged_at,now());
  INSERT INTO public.quick_ride_payment_events(ride_id,actor_id,event_type)
  VALUES(p_id,auth.uid(),'DRIVER_ACKNOWLEDGED') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$driver_pix$;

REVOKE ALL ON FUNCTION public.quick_ride_request_dropoff(uuid),
  public.quick_ride_request_manual_review(uuid,text),
  public.quick_ride_respond_dropoff(uuid,text),public.admin_quick_ride_disputes(),
  public.quick_ride_declare_manual_pix(uuid),
  public.quick_ride_acknowledge_manual_pix(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_request_dropoff(uuid),
  public.quick_ride_request_manual_review(uuid,text),
  public.quick_ride_respond_dropoff(uuid,text),public.admin_quick_ride_disputes(),
  public.quick_ride_declare_manual_pix(uuid),
  public.quick_ride_acknowledge_manual_pix(uuid) TO authenticated;

COMMENT ON COLUMN public.quick_ride_dropoff_reviews.participant_only IS
  'Pending bilateral confirmation; no routine admin review until contested.';
COMMENT ON FUNCTION public.quick_ride_acknowledge_manual_pix(uuid) IS
  'Manual driver declaration only; not bank reconciliation or fee settlement.';
NOTIFY pgrst,'reload schema';
COMMIT;
