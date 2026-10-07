-- Migration: 0022_idempotent_ride_confirmation.sql
-- Ensure ride confirmation and transitions are idempotent and do not fail on repeated calls.

CREATE OR REPLACE FUNCTION public.transition_ride_status(p_ride_id uuid, p_next_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ride_row public.rides%ROWTYPE;
  caller uuid := auth.uid();
  valid_transition boolean := false;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO ride_row FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (ride_row.passenger_user_id, ride_row.driver_user_id) THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;

  -- Idempotency guard: if ride is already in the requested status, succeed immediately
  IF ride_row.status = p_next_status THEN
    RETURN p_next_status;
  END IF;

  valid_transition :=
    (ride_row.status = 'MATCHED' AND p_next_status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW')) OR
    (ride_row.status = 'CONFIRMED' AND p_next_status IN ('IN_PROGRESS', 'CANCELLED', 'NO_SHOW')) OR
    (ride_row.status = 'IN_PROGRESS' AND p_next_status IN ('CANCELLED', 'NO_SHOW'));

  IF p_next_status = 'COMPLETED' AND ride_row.status = 'IN_PROGRESS' THEN
    INSERT INTO public.ride_completion_confirmations (ride_id, user_id)
    VALUES (p_ride_id, caller) ON CONFLICT (ride_id, user_id) DO NOTHING;

    IF (SELECT count(*) FROM public.ride_completion_confirmations WHERE ride_id = p_ride_id) < 2 THEN
      RETURN 'AWAITING_OTHER_PARTICIPANT';
    END IF;
    valid_transition := true;
  END IF;

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid ride transition: % -> %', ride_row.status, p_next_status;
  END IF;

  UPDATE public.rides
  SET status = p_next_status,
      updated_at = now(),
      completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN now() ELSE NULL END
  WHERE ride_id = p_ride_id;

  UPDATE public.ride_matches
  SET status = CASE
        WHEN p_next_status = 'COMPLETED' THEN 'completed'
        WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'cancelled'
        ELSE status
      END
  WHERE match_id = ride_row.match_id;

  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, ride_row.status, p_next_status, caller);

  RETURN p_next_status;
END;
$$;

