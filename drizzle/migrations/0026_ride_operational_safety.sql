ALTER TABLE public.rides ADD COLUMN boarded_at timestamptz;

-- Secrets are never exposed through SELECT, subscriptions, or the ride summary.
CREATE TABLE public.ride_boarding_codes (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(ride_id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
CREATE TABLE public.ride_locations (
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 10000),
  captured_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id, user_id)
);
CREATE TABLE public.ride_ratings (
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id),
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id),
  rated_user_id uuid NOT NULL REFERENCES auth.users(id),
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id, reviewer_user_id),
  CHECK (reviewer_user_id <> rated_user_id)
);
CREATE INDEX ride_ratings_rated_user_idx ON public.ride_ratings(rated_user_id);
ALTER TABLE public.ride_boarding_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ride_boarding_codes, public.ride_locations, public.ride_ratings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ride_boarding_codes, public.ride_locations, public.ride_ratings TO service_role;

CREATE FUNCTION public.issue_ride_boarding_code(p_ride_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_code text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ride_boarding_codes WHERE ride_id = p_ride_id) THEN RETURN; END IF;
  LOOP
    -- UUID v4 supplies random bits without depending on the pgcrypto installation schema.
    new_code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 100000000)::text, 8, '0');
    BEGIN
      INSERT INTO public.ride_boarding_codes(ride_id, code) VALUES(p_ride_id, new_code);
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      IF EXISTS (SELECT 1 FROM public.ride_boarding_codes WHERE ride_id = p_ride_id) THEN RETURN; END IF;
    END;
  END LOOP;
END;
$$;
CREATE FUNCTION public.issue_confirmed_ride_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' THEN PERFORM public.issue_ride_boarding_code(NEW.ride_id); END IF;
  IF NEW.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW') THEN
    DELETE FROM public.ride_locations WHERE ride_id = NEW.ride_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER confirmed_ride_boarding_code AFTER INSERT OR UPDATE OF status ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.issue_confirmed_ride_code();
SELECT public.issue_ride_boarding_code(ride_id) FROM public.rides WHERE status = 'CONFIRMED';

CREATE FUNCTION public.enforce_safe_ride_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'MATCHED' OR NEW.boarded_at IS NOT NULL THEN RAISE EXCEPTION 'Rides must start from a persisted match'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.boarded_at IS DISTINCT FROM OLD.boarded_at THEN RAISE EXCEPTION 'Boarding timestamp is immutable'; END IF;
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'MATCHED' AND NEW.status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW')) OR
    (OLD.status = 'CONFIRMED' AND NEW.status IN ('IN_PROGRESS', 'CANCELLED', 'NO_SHOW')) OR
    (OLD.status = 'IN_PROGRESS' AND NEW.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW'))
  ) THEN RAISE EXCEPTION 'Invalid ride transition: % -> %', OLD.status, NEW.status; END IF;
  IF NEW.status = 'IN_PROGRESS' AND (NEW.boarded_at IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.ride_boarding_codes WHERE ride_id = NEW.ride_id AND consumed_at = NEW.boarded_at
  )) THEN RAISE EXCEPTION 'Boarding PIN validation required'; END IF;
  IF NEW.status <> 'IN_PROGRESS' AND NEW.boarded_at IS DISTINCT FROM OLD.boarded_at THEN RAISE EXCEPTION 'Boarding timestamp is immutable'; END IF;
  IF NEW.status = 'COMPLETED' AND (SELECT count(*) FROM public.ride_completion_confirmations c
    WHERE c.ride_id = NEW.ride_id AND c.user_id IN (NEW.driver_user_id, NEW.passenger_user_id)) <> 2 THEN
    RAISE EXCEPTION 'Both participants must confirm completion';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER safe_ride_transition BEFORE INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.enforce_safe_ride_transition();

CREATE OR REPLACE FUNCTION public.transition_ride_status(p_ride_id uuid, p_next_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (r.passenger_user_id, r.driver_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF p_next_status = 'IN_PROGRESS' THEN RAISE EXCEPTION 'Valide o PIN de embarque para iniciar a viagem.'; END IF;
  IF r.status = p_next_status AND p_next_status IN ('CONFIRMED', 'CANCELLED') THEN RETURN p_next_status; END IF;
  IF NOT (
    (r.status = 'MATCHED' AND p_next_status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW')) OR
    (r.status = 'CONFIRMED' AND p_next_status IN ('CANCELLED', 'NO_SHOW')) OR
    (r.status = 'IN_PROGRESS' AND p_next_status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW'))
  ) THEN RAISE EXCEPTION 'Invalid ride transition: % -> %', r.status, p_next_status; END IF;
  IF p_next_status = 'COMPLETED' AND r.status = 'IN_PROGRESS' THEN
    INSERT INTO public.ride_completion_confirmations(ride_id, user_id) VALUES(p_ride_id, caller) ON CONFLICT DO NOTHING;
    IF (SELECT count(*) FROM public.ride_completion_confirmations WHERE ride_id = p_ride_id AND user_id IN (r.driver_user_id, r.passenger_user_id)) < 2 THEN
      RETURN 'AWAITING_OTHER_PARTICIPANT';
    END IF;
  END IF;
  UPDATE public.rides SET status = p_next_status, updated_at = now(), completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN now() ELSE NULL END WHERE ride_id = p_ride_id;
  UPDATE public.ride_matches SET status = CASE WHEN p_next_status = 'COMPLETED' THEN 'completed' WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'cancelled' ELSE status END WHERE match_id = r.match_id;
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id) VALUES(p_ride_id, r.status, p_next_status, caller);
  RETURN p_next_status;
END;
$$;

CREATE FUNCTION public.validate_ride_boarding(p_ride_id uuid, p_code text)
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
  UPDATE public.rides SET status = 'IN_PROGRESS', boarded_at = stamp, updated_at = stamp WHERE ride_id = p_ride_id;
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id) VALUES(p_ride_id, 'CONFIRMED', 'IN_PROGRESS', auth.uid());
  RETURN 'IN_PROGRESS';
END;
$$;

CREATE FUNCTION public.update_ride_location(p_ride_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy_m double precision, p_captured_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF r.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'Location requires a ride in progress'; END IF;
  IF p_captured_at IS NULL OR NOT isfinite(p_captured_at) OR p_captured_at < clock_timestamp() - interval '2 minutes' OR p_captured_at > clock_timestamp() + interval '30 seconds' THEN RAISE EXCEPTION 'Stale or invalid location timestamp'; END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_accuracy_m IS NULL THEN RAISE EXCEPTION 'Coordinates and accuracy required'; END IF;
  INSERT INTO public.ride_locations(ride_id, user_id, latitude, longitude, accuracy_m, captured_at)
  VALUES(p_ride_id, auth.uid(), p_latitude, p_longitude, p_accuracy_m, p_captured_at)
  ON CONFLICT(ride_id, user_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy_m = EXCLUDED.accuracy_m, captured_at = EXCLUDED.captured_at, updated_at = now()
  WHERE EXCLUDED.captured_at > ride_locations.captured_at AND ride_locations.updated_at <= clock_timestamp() - interval '5 seconds';
END;
$$;

CREATE FUNCTION public.rate_ride(p_ride_id uuid, p_score integer, p_comment text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE; other_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
  IF r.status <> 'COMPLETED' THEN RAISE EXCEPTION 'Only completed rides can be rated'; END IF;
  other_user := CASE WHEN auth.uid() = r.driver_user_id THEN r.passenger_user_id ELSE r.driver_user_id END;
  INSERT INTO public.ride_ratings(ride_id, reviewer_user_id, rated_user_id, score, comment) VALUES(p_ride_id, auth.uid(), other_user, p_score, coalesce(btrim(p_comment), ''));
END;
$$;

CREATE FUNCTION public.get_ride_safety(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE; other_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT FOUND OR auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
  other_user := CASE WHEN auth.uid() = r.driver_user_id THEN r.passenger_user_id ELSE r.driver_user_id END;
  RETURN jsonb_build_object(
    'status', r.status, 'boardedAt', r.boarded_at,
    'pin', CASE WHEN r.status = 'CONFIRMED' AND auth.uid() = r.passenger_user_id THEN (SELECT code FROM public.ride_boarding_codes WHERE ride_id = p_ride_id AND consumed_at IS NULL) ELSE NULL END,
    'locations', CASE WHEN r.status = 'IN_PROGRESS' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('userId', l.user_id, 'latitude', l.latitude, 'longitude', l.longitude, 'accuracyM', l.accuracy_m, 'capturedAt', l.captured_at, 'updatedAt', l.updated_at)), '[]') FROM public.ride_locations l WHERE l.ride_id = p_ride_id) ELSE '[]'::jsonb END,
    'completionConfirmed', EXISTS(SELECT 1 FROM public.ride_completion_confirmations WHERE ride_id = p_ride_id AND user_id = auth.uid()),
    'myRating', (SELECT jsonb_build_object('score', score, 'comment', comment) FROM public.ride_ratings WHERE ride_id = p_ride_id AND reviewer_user_id = auth.uid()),
    'receivedRating', (SELECT jsonb_build_object('score', score, 'comment', comment) FROM public.ride_ratings WHERE ride_id = p_ride_id AND rated_user_id = auth.uid()),
    'otherUserRating', (SELECT jsonb_build_object('average', round(avg(score), 2), 'count', count(*)) FROM public.ride_ratings WHERE rated_user_id = other_user),
    'myUserRating', (SELECT jsonb_build_object('average', round(avg(score), 2), 'count', count(*)) FROM public.ride_ratings WHERE rated_user_id = auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_ride_boarding_code(uuid), public.issue_confirmed_ride_code(), public.enforce_safe_ride_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ride_boarding(uuid, text), public.update_ride_location(uuid, double precision, double precision, double precision, timestamptz), public.rate_ride(uuid, integer, text), public.get_ride_safety(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ride_boarding(uuid, text), public.update_ride_location(uuid, double precision, double precision, double precision, timestamptz), public.rate_ride(uuid, integer, text), public.get_ride_safety(uuid) TO authenticated;
