-- Migration: 0042_realtime_ride_tracking_and_stages.sql
-- Enables real-time location sharing and structured transit stages for confirmed rides:
-- Stages: CONFIRMED -> DRIVER_EN_ROUTE -> AWAITING_BOARDING -> IN_PROGRESS -> COMPLETED
-- Location sharing is strictly authenticated to participants of the active ride,
-- requires explicit user authorization, and is deleted on completion/cancellation or explicit revocation.

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS transit_stage text NOT NULL DEFAULT 'CONFIRMED'
  CHECK (transit_stage IN ('CONFIRMED', 'DRIVER_EN_ROUTE', 'AWAITING_BOARDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

UPDATE public.rides
SET transit_stage = CASE
  WHEN status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
  WHEN status = 'COMPLETED' THEN 'COMPLETED'
  WHEN status IN ('CANCELLED', 'NO_SHOW') THEN 'CANCELLED'
  ELSE 'CONFIRMED'
END;

ALTER TABLE public.ride_notifications
  DROP CONSTRAINT IF EXISTS ride_notifications_event_name_check;

ALTER TABLE public.ride_notifications
  ADD CONSTRAINT ride_notifications_event_name_check
  CHECK (event_name IN ('MATCH_PROPOSED', 'BOTH_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_CANCELLED', 'RIDE_COMPLETED'));

-- Notification on bilateral acceptance
CREATE OR REPLACE FUNCTION public.respond_to_ride_match(p_ride_id uuid, p_response text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rides%ROWTYPE;
  caller uuid := auth.uid();
  both_accepted boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_response NOT IN ('ACCEPT', 'DECLINE') THEN RAISE EXCEPTION 'Invalid match response'; END IF;

  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (r.passenger_user_id, r.driver_user_id) THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  IF r.status <> 'MATCHED' THEN RAISE EXCEPTION 'Match proposal is no longer active'; END IF;

  IF r.response_expires_at <= clock_timestamp() THEN
    UPDATE public.rides SET status = 'CANCELLED', transit_stage = 'CANCELLED', updated_at = clock_timestamp() WHERE ride_id = p_ride_id;
    UPDATE public.ride_matches SET status = 'cancelled' WHERE match_id = r.match_id AND status = 'created';
    RETURN 'EXPIRED';
  END IF;

  IF p_response = 'DECLINE' THEN
    UPDATE public.rides SET status = 'CANCELLED', transit_stage = 'CANCELLED', updated_at = clock_timestamp() WHERE ride_id = p_ride_id;
    UPDATE public.ride_matches SET status = 'cancelled' WHERE match_id = r.match_id AND status = 'created';
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES (p_ride_id, r.match_id, CASE WHEN caller = r.driver_user_id THEN r.passenger_user_id ELSE r.driver_user_id END, 'RIDE_CANCELLED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
    RETURN 'DECLINED';
  END IF;

  IF caller = r.passenger_user_id THEN
    UPDATE public.rides SET passenger_accepted_at = coalesce(passenger_accepted_at, clock_timestamp())
    WHERE ride_id = p_ride_id;
  ELSE
    UPDATE public.rides SET driver_accepted_at = coalesce(driver_accepted_at, clock_timestamp())
    WHERE ride_id = p_ride_id;
  END IF;

  SELECT passenger_accepted_at IS NOT NULL AND driver_accepted_at IS NOT NULL
    INTO both_accepted FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT both_accepted THEN RETURN 'AWAITING_OTHER_PARTICIPANT'; END IF;

  UPDATE public.rides SET status = 'CONFIRMED', transit_stage = 'CONFIRMED', updated_at = clock_timestamp()
  WHERE ride_id = p_ride_id AND status = 'MATCHED';
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, 'MATCHED', 'CONFIRMED', caller);

  -- Emite notificação de ambos aceitaram
  INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
  VALUES
    (p_ride_id, r.match_id, r.passenger_user_id, 'BOTH_ACCEPTED'),
    (p_ride_id, r.match_id, r.driver_user_id, 'BOTH_ACCEPTED')
  ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;

  RETURN 'CONFIRMED';
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_ride_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_ride_match(uuid, text) TO authenticated;

-- Atualização explícita de etapa pelo motorista
CREATE OR REPLACE FUNCTION public.update_ride_transit_stage(p_ride_id uuid, p_stage text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rides%ROWTYPE;
  caller uuid := auth.uid();
  notif_event text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF caller <> r.driver_user_id THEN
    RAISE EXCEPTION 'Only the driver can update transit stage';
  END IF;
  IF r.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'Transit stages are only available for confirmed rides';
  END IF;
  IF p_stage NOT IN ('DRIVER_EN_ROUTE', 'AWAITING_BOARDING') THEN
    RAISE EXCEPTION 'Invalid transit stage: %', p_stage;
  END IF;

  UPDATE public.rides
  SET transit_stage = p_stage, updated_at = clock_timestamp()
  WHERE ride_id = p_ride_id;

  notif_event := CASE
    WHEN p_stage = 'DRIVER_EN_ROUTE' THEN 'DRIVER_EN_ROUTE'
    WHEN p_stage = 'AWAITING_BOARDING' THEN 'DRIVER_ARRIVED'
    ELSE NULL
  END;

  IF notif_event IS NOT NULL THEN
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES (p_ride_id, r.match_id, r.passenger_user_id, notif_event)
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
  END IF;

  RETURN p_stage;
END;
$$;
REVOKE ALL ON FUNCTION public.update_ride_transit_stage(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ride_transit_stage(uuid, text) TO authenticated;

-- Revogação imediata de compartilhamento de localização pelo participante
CREATE OR REPLACE FUNCTION public.revoke_ride_location(p_ride_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.ride_locations
  WHERE ride_id = p_ride_id AND user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_ride_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_ride_location(uuid) TO authenticated;

-- Atualização de localização durante CONFIRMED e IN_PROGRESS
CREATE OR REPLACE FUNCTION public.update_ride_location(
  p_ride_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id) THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  IF r.status NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Location sharing requires a confirmed or in progress ride';
  END IF;
  IF p_captured_at IS NULL OR NOT isfinite(p_captured_at)
    OR p_captured_at < clock_timestamp() - interval '2 minutes'
    OR p_captured_at > clock_timestamp() + interval '30 seconds' THEN
    RAISE EXCEPTION 'Stale or invalid location timestamp';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_accuracy_m IS NULL THEN
    RAISE EXCEPTION 'Coordinates and accuracy required';
  END IF;

  INSERT INTO public.ride_locations(ride_id, user_id, latitude, longitude, accuracy_m, captured_at)
  VALUES (p_ride_id, auth.uid(), p_latitude, p_longitude, p_accuracy_m, p_captured_at)
  ON CONFLICT(ride_id, user_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy_m = EXCLUDED.accuracy_m,
    captured_at = EXCLUDED.captured_at,
    updated_at = now()
  WHERE EXCLUDED.captured_at > ride_locations.captured_at
    AND ride_locations.updated_at <= clock_timestamp() - interval '5 seconds';
END;
$$;
REVOKE ALL ON FUNCTION public.update_ride_location(uuid, double precision, double precision, double precision, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ride_location(uuid, double precision, double precision, double precision, timestamptz) TO authenticated;

-- Validação de embarque sincroniza transit_stage
CREATE OR REPLACE FUNCTION public.validate_ride_boarding(p_ride_id uuid, p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE; secret public.ride_boarding_codes%ROWTYPE; stamp timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR r.driver_user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the driver can validate boarding'; END IF;
  IF r.status <> 'CONFIRMED' THEN RAISE EXCEPTION 'Boarding requires a confirmed ride'; END IF;
  SELECT * INTO secret FROM public.ride_boarding_codes WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR secret.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'Boarding code unavailable or already used'; END IF;
  stamp := clock_timestamp();
  IF secret.locked_until > stamp THEN RETURN 'LOCKED'; END IF;
  IF secret.locked_until IS NOT NULL THEN secret.failed_attempts := 0; END IF;
  IF p_code IS NULL OR p_code <> secret.code THEN
    UPDATE public.ride_boarding_codes SET failed_attempts = secret.failed_attempts + 1,
      locked_until = CASE WHEN secret.failed_attempts + 1 >= 5 THEN stamp + interval '5 minutes' ELSE NULL END WHERE ride_id = p_ride_id;
    RETURN CASE WHEN secret.failed_attempts + 1 >= 5 THEN 'LOCKED' ELSE 'INVALID_PIN' END;
  END IF;
  UPDATE public.ride_boarding_codes SET consumed_at = stamp, failed_attempts = 0, locked_until = NULL WHERE ride_id = p_ride_id;
  UPDATE public.rides SET status = 'IN_PROGRESS', transit_stage = 'IN_PROGRESS', boarded_at = stamp, updated_at = stamp WHERE ride_id = p_ride_id;
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id) VALUES(p_ride_id, 'CONFIRMED', 'IN_PROGRESS', auth.uid());
  RETURN 'IN_PROGRESS';
END;
$$;

-- Transições de status sincronizam transit_stage e apagam localizações imediatamente
CREATE OR REPLACE FUNCTION public.transition_ride_status(p_ride_id uuid, p_next_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rides%ROWTYPE;
  caller uuid := auth.uid();
  other_user uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (r.passenger_user_id, r.driver_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
  other_user := CASE WHEN caller = r.driver_user_id THEN r.passenger_user_id ELSE r.driver_user_id END;

  IF p_next_status = 'CONFIRMED' THEN
    RAISE EXCEPTION 'Use respond_to_ride_match so both participants must accept';
  END IF;
  IF p_next_status = 'IN_PROGRESS' THEN RAISE EXCEPTION 'Valide o PIN de embarque para iniciar a viagem.'; END IF;
  IF r.status = p_next_status AND p_next_status IN ('CANCELLED') THEN RETURN p_next_status; END IF;
  IF NOT (
    (r.status = 'MATCHED' AND p_next_status IN ('CANCELLED', 'NO_SHOW')) OR
    (r.status = 'CONFIRMED' AND p_next_status IN ('CANCELLED', 'NO_SHOW')) OR
    (r.status = 'IN_PROGRESS' AND p_next_status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW'))
  ) THEN RAISE EXCEPTION 'Invalid ride transition: % -> %', r.status, p_next_status; END IF;
  IF p_next_status = 'COMPLETED' AND r.status = 'IN_PROGRESS' THEN
    INSERT INTO public.ride_completion_confirmations(ride_id, user_id)
    VALUES (p_ride_id, caller) ON CONFLICT DO NOTHING;
    IF (SELECT count(*) FROM public.ride_completion_confirmations
        WHERE ride_id = p_ride_id AND user_id IN (r.driver_user_id, r.passenger_user_id)) < 2 THEN
      RETURN 'AWAITING_OTHER_PARTICIPANT';
    END IF;
  END IF;
  UPDATE public.rides SET
    status = p_next_status,
    transit_stage = CASE
      WHEN p_next_status = 'COMPLETED' THEN 'COMPLETED'
      WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'CANCELLED'
      ELSE transit_stage
    END,
    updated_at = clock_timestamp(),
    completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN clock_timestamp() ELSE NULL END
  WHERE ride_id = p_ride_id;
  UPDATE public.ride_matches SET status = CASE
    WHEN p_next_status = 'COMPLETED' THEN 'completed'
    WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'cancelled'
    ELSE status END
  WHERE match_id = r.match_id;
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, r.status, p_next_status, caller);

  IF p_next_status IN ('CANCELLED', 'NO_SHOW') THEN
    DELETE FROM public.ride_locations WHERE ride_id = p_ride_id;
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES (p_ride_id, r.match_id, other_user, 'RIDE_CANCELLED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
  ELSIF p_next_status = 'COMPLETED' THEN
    DELETE FROM public.ride_locations WHERE ride_id = p_ride_id;
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES
      (p_ride_id, r.match_id, r.passenger_user_id, 'RIDE_COMPLETED'),
      (p_ride_id, r.match_id, r.driver_user_id, 'RIDE_COMPLETED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
  END IF;

  RETURN p_next_status;
END;
$$;

-- Consulta de segurança incluindo transit_stage, participantes, endpoints e localizações
CREATE OR REPLACE FUNCTION public.get_ride_safety(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rides%ROWTYPE;
  rr public.ride_requests%ROWTYPE;
  ro public.ride_offers%ROWTYPE;
  other_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT FOUND OR auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id) THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  SELECT * INTO rr FROM public.ride_requests WHERE request_id = r.request_id;
  SELECT * INTO ro FROM public.ride_offers WHERE offer_id = r.offer_id;
  other_user := CASE WHEN auth.uid() = r.driver_user_id THEN r.passenger_user_id ELSE r.driver_user_id END;

  RETURN jsonb_build_object(
    'status', r.status,
    'transitStage', coalesce(r.transit_stage, r.status),
    'driverUserId', r.driver_user_id,
    'passengerUserId', r.passenger_user_id,
    'boardedAt', r.boarded_at,
    'pin', CASE WHEN r.status = 'CONFIRMED' AND auth.uid() = r.passenger_user_id THEN (SELECT code FROM public.ride_boarding_codes WHERE ride_id = p_ride_id AND consumed_at IS NULL) ELSE NULL END,
    'locations', CASE WHEN r.status IN ('CONFIRMED', 'IN_PROGRESS') THEN (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'userId', l.user_id,
        'latitude', l.latitude,
        'longitude', l.longitude,
        'accuracyM', l.accuracy_m,
        'capturedAt', l.captured_at,
        'updatedAt', l.updated_at
      )), '[]')
      FROM public.ride_locations l WHERE l.ride_id = p_ride_id
    ) ELSE '[]'::jsonb END,
    'routeDetails', jsonb_build_object(
      'origin', coalesce(ro.origin, rr.origin, ''),
      'destination', coalesce(ro.destination, rr.destination, ''),
      'originLat', ro.origin_lat,
      'originLng', ro.origin_lng,
      'destinationLat', ro.destination_lat,
      'destinationLng', ro.destination_lng,
      'passengerOriginLat', rr.origin_lat,
      'passengerOriginLng', rr.origin_lng,
      'passengerDestinationLat', rr.destination_lat,
      'passengerDestinationLng', rr.destination_lng
    ),
    'completionConfirmed', EXISTS(SELECT 1 FROM public.ride_completion_confirmations WHERE ride_id = p_ride_id AND user_id = auth.uid()),
    'myRating', (SELECT jsonb_build_object('score', score, 'comment', comment) FROM public.ride_ratings WHERE ride_id = p_ride_id AND reviewer_user_id = auth.uid()),
    'receivedRating', (SELECT jsonb_build_object('score', score, 'comment', comment) FROM public.ride_ratings WHERE ride_id = p_ride_id AND rated_user_id = auth.uid()),
    'otherUserRating', (SELECT jsonb_build_object('average', round(avg(score), 2), 'count', count(*)) FROM public.ride_ratings WHERE rated_user_id = other_user),
    'myUserRating', (SELECT jsonb_build_object('average', round(avg(score), 2), 'count', count(*)) FROM public.ride_ratings WHERE rated_user_id = auth.uid())
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_ride_safety(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ride_safety(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

