-- A persisted match is a proposal, not a confirmed ride. Reserve the seats for
-- a bounded period and require an explicit response from both participants.
ALTER TABLE public.rides
  ADD COLUMN passenger_accepted_at timestamptz,
  ADD COLUMN driver_accepted_at timestamptz,
  ADD COLUMN response_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

UPDATE public.rides
SET passenger_accepted_at = created_at,
    driver_accepted_at = created_at
WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE public.ride_matches
  DROP CONSTRAINT IF EXISTS ride_matches_request_id_key;
CREATE UNIQUE INDEX ride_matches_one_active_request_idx
  ON public.ride_matches(request_id) WHERE status = 'created';

-- A declined/expired offer must not be proposed to the same request again.
-- Keep the existing eligibility checks and ranking from prior migrations.
DO $matching$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure)
    INTO definition;

  IF position('AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)' IN definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate stable preferred-offer predicate in try_match_ride_request';
  END IF;
  definition := replace(
    definition,
    'AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)',
    'AND NOT EXISTS (SELECT 1 FROM public.ride_matches prior WHERE prior.request_id = request_row.request_id AND prior.offer_id = public.ride_offers.offer_id) AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)'
  );

  IF position('abs(extract(epoch from (departure_time - request_row.departure_time)) / 60) <= tolerance_mins' IN definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate request/offer time tolerance predicate';
  END IF;
  definition := replace(
    definition,
    'abs(extract(epoch from (departure_time - request_row.departure_time)) / 60) <= tolerance_mins',
    'abs(extract(epoch from (departure_time - request_row.departure_time)) / 60) <= least(tolerance_mins, coalesce(time_tolerance_minutes, 15))'
  );

  IF position('ON CONFLICT (request_id) DO NOTHING' IN definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate request match conflict clause';
  END IF;
  definition := replace(
    definition,
    'ON CONFLICT (request_id) DO NOTHING',
    'ON CONFLICT (request_id) WHERE status = ''created'' DO NOTHING'
  );
  EXECUTE definition;

  SELECT pg_get_functiondef('public.search_available_ride_offers(text,text,date,time,integer,integer,integer,double precision,double precision,double precision,double precision)'::regprocedure)
    INTO definition;
  IF position('abs(extract(epoch from (o.departure_time - p_departure_time)) / 60) <= coalesce(p_time_tolerance_minutes, 15)' IN definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate search time tolerance predicate';
  END IF;
  definition := replace(
    definition,
    'abs(extract(epoch from (o.departure_time - p_departure_time)) / 60) <= coalesce(p_time_tolerance_minutes, 15)',
    'abs(extract(epoch from (o.departure_time - p_departure_time)) / 60) <= least(coalesce(p_time_tolerance_minutes, 15), coalesce(o.time_tolerance_minutes, 15))'
  );
  EXECUTE definition;
END $matching$;

-- Shared base ranking used by both database matching and discovery. This is an
-- explainable fit score, not a probability; route distances are straight-line
-- estimates because this deployment has no road-routing provider.
CREATE OR REPLACE FUNCTION public.travel_route_score(
  qolat float8, qolng float8, qdlat float8, qdlng float8,
  oolat float8, oolng float8, odlat float8, odlng float8,
  qt time, ot time
) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT greatest(0, 94 - CASE
    WHEN qolat BETWEEN -90 AND 90 AND qolng BETWEEN -180 AND 180
      AND qdlat BETWEEN -90 AND 90 AND qdlng BETWEEN -180 AND 180
      AND oolat BETWEEN -90 AND 90 AND oolng BETWEEN -180 AND 180
      AND odlat BETWEEN -90 AND 90 AND odlng BETWEEN -180 AND 180
    THEN
      least(35, round(greatest(0,
        public.distance_km(oolat, oolng, qolat, qolng)
        + public.distance_km(qolat, qolng, qdlat, qdlng)
        + public.distance_km(qdlat, qdlng, odlat, odlng)
        - public.distance_km(oolat, oolng, odlat, odlng)
      ) * 5.5))::integer
      + least(20, round(public.distance_km(oolat, oolng, qolat, qolng) * 8))::integer
      + least(15, round(public.distance_km(qdlat, qdlng, odlat, odlng) * 5))::integer
    ELSE 15
  END - least(20, round(coalesce(abs(extract(epoch FROM (ot - qt))) / 60, 60) / 3))::integer);
$$;

DO $rank_guard$
BEGIN
  IF position('public.travel_route_score(' IN pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure)) = 0
    OR position('public.travel_route_score(' IN pg_get_functiondef('public.search_available_ride_offers(text,text,date,time,integer,integer,integer,double precision,double precision,double precision,double precision)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Match ranking functions are not using the shared travel route score';
  END IF;
END $rank_guard$;

CREATE TABLE public.ride_notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(ride_id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.ride_matches(match_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL CHECK (event_name = 'MATCH_PROPOSED'),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (ride_id, user_id, event_name)
);
CREATE INDEX ride_notifications_unread_user_idx
  ON public.ride_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
ALTER TABLE public.ride_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ride_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ride_notifications TO authenticated;
GRANT ALL ON public.ride_notifications TO service_role;
CREATE POLICY ride_notifications_participant_read ON public.ride_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.notify_ride_match_proposed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ride_notifications(ride_id, match_id, user_id, event_name)
  VALUES
    (NEW.ride_id, NEW.match_id, NEW.passenger_user_id, 'MATCH_PROPOSED'),
    (NEW.ride_id, NEW.match_id, NEW.driver_user_id, 'MATCH_PROPOSED')
  ON CONFLICT (ride_id, user_id, event_name) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_ride_match_proposed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ride_match_proposed_notifications
  AFTER INSERT ON public.rides FOR EACH ROW
  EXECUTE FUNCTION public.notify_ride_match_proposed();

CREATE FUNCTION public.mark_ride_notification_read(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.ride_notifications SET read_at = coalesce(read_at, clock_timestamp())
  WHERE notification_id = p_notification_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_ride_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_ride_notification_read(uuid) TO authenticated;

-- Release inventory only for a cancellation before boarding. The old match is
-- marked cancelled by the existing lifecycle RPC; that transition then asks
-- the matcher for another eligible offer (excluding this declined pair).
CREATE FUNCTION public.release_cancelled_ride_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE passenger_count integer;
BEGIN
  IF OLD.status NOT IN ('MATCHED', 'CONFIRMED') OR NEW.status NOT IN ('CANCELLED', 'NO_SHOW') THEN
    RETURN NEW;
  END IF;

  SELECT rr.passenger_count INTO passenger_count
  FROM public.ride_requests rr WHERE rr.request_id = NEW.request_id;
  IF passenger_count IS NULL THEN RETURN NEW; END IF;

  UPDATE public.ride_offers ro
  SET seats_remaining = least(ro.available_seats, ro.seats_remaining + passenger_count),
      status = CASE WHEN least(ro.available_seats, ro.seats_remaining + passenger_count) > 0 THEN 'available' ELSE 'full' END
  WHERE ro.offer_id = NEW.offer_id;
  UPDATE public.ride_requests SET status = 'open' WHERE request_id = NEW.request_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_cancelled_ride_reservation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ride_release_cancelled_reservation
  AFTER UPDATE OF status ON public.rides FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.release_cancelled_ride_reservation();

CREATE FUNCTION public.rematch_cancelled_ride_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'created' AND NEW.status = 'cancelled' THEN
    PERFORM public.try_match_ride_request(NEW.request_id, NULL);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rematch_cancelled_ride_proposal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ride_match_retry_after_cancel
  AFTER UPDATE OF status ON public.ride_matches FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.rematch_cancelled_ride_proposal();

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
    UPDATE public.rides SET status = 'CANCELLED', updated_at = clock_timestamp() WHERE ride_id = p_ride_id;
    UPDATE public.ride_matches SET status = 'cancelled' WHERE match_id = r.match_id AND status = 'created';
    RETURN 'EXPIRED';
  END IF;

  IF p_response = 'DECLINE' THEN
    UPDATE public.rides SET status = 'CANCELLED', updated_at = clock_timestamp() WHERE ride_id = p_ride_id;
    UPDATE public.ride_matches SET status = 'cancelled' WHERE match_id = r.match_id AND status = 'created';
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

  UPDATE public.rides SET status = 'CONFIRMED', updated_at = clock_timestamp()
  WHERE ride_id = p_ride_id AND status = 'MATCHED';
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, 'MATCHED', 'CONFIRMED', caller);
  RETURN 'CONFIRMED';
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_ride_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_ride_match(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_ride_status(p_ride_id uuid, p_next_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rides%ROWTYPE; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (r.passenger_user_id, r.driver_user_id) THEN RAISE EXCEPTION 'Ride not found'; END IF;
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
  UPDATE public.rides SET status = p_next_status, updated_at = clock_timestamp(),
    completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN clock_timestamp() ELSE NULL END
  WHERE ride_id = p_ride_id;
  UPDATE public.ride_matches SET status = CASE
    WHEN p_next_status = 'COMPLETED' THEN 'completed'
    WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'cancelled'
    ELSE status END
  WHERE match_id = r.match_id;
  INSERT INTO public.ride_status_history(ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, r.status, p_next_status, caller);
  RETURN p_next_status;
END;
$$;

CREATE FUNCTION public.expire_ride_match_proposals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE expired record; expired_count integer := 0;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  FOR expired IN
    SELECT ride_id, match_id FROM public.rides
    WHERE status = 'MATCHED' AND response_expires_at <= clock_timestamp()
    ORDER BY response_expires_at FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.rides SET status = 'CANCELLED', updated_at = clock_timestamp()
    WHERE ride_id = expired.ride_id AND status = 'MATCHED';
    UPDATE public.ride_matches SET status = 'cancelled'
    WHERE match_id = expired.match_id AND status = 'created';
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_ride_match_proposals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_ride_match_proposals() TO authenticated, service_role;

DO $realtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_notifications';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $realtime$;

NOTIFY pgrst, 'reload schema';
