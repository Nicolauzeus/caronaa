-- New proposals require explicit passenger acceptance before the driver may
-- respond. Existing confirmed and historical rides are not rewritten.

-- Publication consent used to stamp a driver's acceptance when the route quote
-- was attached to a proposal. Remove that automatic acceptance for new rides.
DROP TRIGGER IF EXISTS a_accept_published_offer_fare ON public.rides;

ALTER TABLE public.ride_notifications
  DROP CONSTRAINT IF EXISTS ride_notifications_event_name_check;
ALTER TABLE public.ride_notifications
  ADD CONSTRAINT ride_notifications_event_name_check
  CHECK (event_name IN (
    'MATCH_PROPOSED', 'BOTH_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED',
    'RIDE_CANCELLED', 'RIDE_COMPLETED', 'PASSENGER_ACCEPTED', 'RIDE_CONFIRMED',
    'PROPOSAL_EXPIRED'
  ));

CREATE OR REPLACE FUNCTION public.respond_to_ride_match(p_ride_id uuid, p_response text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES
      (p_ride_id, r.match_id, r.passenger_user_id, 'PROPOSAL_EXPIRED'),
      (p_ride_id, r.match_id, r.driver_user_id, 'PROPOSAL_EXPIRED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
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

  IF caller = r.driver_user_id AND r.passenger_accepted_at IS NULL THEN
    RAISE EXCEPTION 'Aguarde o aceite do passageiro antes de confirmar esta combinação.';
  END IF;

  IF r.route_distance_km IS NULL OR r.passenger_price IS NULL OR r.passenger_group_total IS NULL THEN
    RAISE EXCEPTION 'Calcule o preço do trecho antes de aceitar esta combinação.';
  END IF;

  IF caller = r.passenger_user_id THEN
    -- Older pending proposals may carry a driver timestamp from the former
    -- quote-trigger auto-accept. Require a fresh driver response after the
    -- passenger's explicit acceptance, without changing confirmed rides.
    UPDATE public.rides SET
      passenger_accepted_at = coalesce(passenger_accepted_at, clock_timestamp()),
      driver_accepted_at = CASE WHEN passenger_accepted_at IS NULL THEN NULL ELSE driver_accepted_at END
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
  RETURN 'CONFIRMED';
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_ride_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_ride_match(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_ride_match_proposals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE expired record; expired_count integer := 0;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  FOR expired IN
    SELECT ride_id, match_id, passenger_user_id, driver_user_id
    FROM public.rides
    WHERE status = 'MATCHED' AND response_expires_at <= clock_timestamp()
    ORDER BY response_expires_at
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.rides
    SET status = 'CANCELLED', transit_stage = 'CANCELLED', updated_at = clock_timestamp()
    WHERE ride_id = expired.ride_id AND status = 'MATCHED';
    UPDATE public.ride_matches SET status = 'cancelled'
    WHERE match_id = expired.match_id AND status = 'created';
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES
      (expired.ride_id, expired.match_id, expired.passenger_user_id, 'PROPOSAL_EXPIRED'),
      (expired.ride_id, expired.match_id, expired.driver_user_id, 'PROPOSAL_EXPIRED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_ride_match_proposals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_ride_match_proposals() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_ride_acceptance_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.passenger_accepted_at IS NULL AND NEW.passenger_accepted_at IS NOT NULL THEN
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES (NEW.ride_id, NEW.match_id, NEW.driver_user_id, 'PASSENGER_ACCEPTED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
  END IF;

  IF OLD.status IS DISTINCT FROM 'CONFIRMED' AND NEW.status = 'CONFIRMED' THEN
    INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
    VALUES
      (NEW.ride_id, NEW.match_id, NEW.passenger_user_id, 'RIDE_CONFIRMED'),
      (NEW.ride_id, NEW.match_id, NEW.driver_user_id, 'RIDE_CONFIRMED')
    ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_ride_acceptance_progress() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ride_acceptance_progress_notifications ON public.rides;
CREATE TRIGGER ride_acceptance_progress_notifications
  AFTER UPDATE OF passenger_accepted_at, status ON public.rides
  FOR EACH ROW
  WHEN (
    OLD.passenger_accepted_at IS DISTINCT FROM NEW.passenger_accepted_at
    OR OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.notify_ride_acceptance_progress();

NOTIFY pgrst, 'reload schema';
