-- The current app had no persisted ride request, offer, or match model.
-- These tables establish the smallest domain needed for a durable match.
CREATE TABLE public.ride_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (length(btrim(origin)) > 0),
  destination text NOT NULL CHECK (length(btrim(destination)) > 0),
  ride_date date NOT NULL,
  departure_time time NOT NULL,
  passenger_count integer NOT NULL CHECK (passenger_count BETWEEN 1 AND 6),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lower(btrim(origin)) <> lower(btrim(destination)))
);

CREATE TABLE public.ride_offers (
  offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (length(btrim(origin)) > 0),
  destination text NOT NULL CHECK (length(btrim(destination)) > 0),
  ride_date date NOT NULL,
  departure_time time NOT NULL,
  available_seats integer NOT NULL CHECK (available_seats BETWEEN 1 AND 6),
  seats_remaining integer NOT NULL CHECK (seats_remaining BETWEEN 0 AND available_seats),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'full')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lower(btrim(origin)) <> lower(btrim(destination)))
);

CREATE INDEX ride_requests_open_compatibility_idx
  ON public.ride_requests (ride_date, departure_time, created_at)
  WHERE status = 'open';
CREATE INDEX ride_offers_available_compatibility_idx
  ON public.ride_offers (ride_date, departure_time, created_at)
  WHERE status = 'available';

CREATE TABLE public.ride_matches (
  match_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.ride_requests(request_id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES public.ride_offers(offer_id) ON DELETE RESTRICT,
  passenger_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ride_id text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, offer_id),
  CHECK (passenger_user_id <> driver_user_id)
);

CREATE INDEX ride_matches_offer_idx ON public.ride_matches (offer_id, created_at);
ALTER TABLE public.product_events
  ADD COLUMN request_id uuid REFERENCES public.ride_requests(request_id) ON DELETE SET NULL,
  ADD COLUMN offer_id uuid REFERENCES public.ride_offers(offer_id) ON DELETE SET NULL,
  ADD COLUMN passenger_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

WITH duplicate_match_events AS (
  SELECT event_id,
    row_number() OVER (PARTITION BY match_id ORDER BY created_at, event_id) AS duplicate_number
  FROM public.product_events
  WHERE event_name = 'MATCH_CREATED' AND match_id IS NOT NULL
)
DELETE FROM public.product_events pe
USING duplicate_match_events duplicates
WHERE pe.event_id = duplicates.event_id AND duplicates.duplicate_number > 1;

CREATE UNIQUE INDEX product_events_match_created_once_idx
  ON public.product_events (match_id)
  WHERE event_name = 'MATCH_CREATED' AND match_id IS NOT NULL;

ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.ride_requests, public.ride_offers, public.ride_matches TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ride_requests, public.ride_offers, public.ride_matches FROM anon, authenticated;

CREATE POLICY "Users read their ride requests"
  ON public.ride_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their ride offers"
  ON public.ride_offers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Match participants read their matches"
  ON public.ride_matches FOR SELECT TO authenticated
  USING (auth.uid() = passenger_user_id OR auth.uid() = driver_user_id);

-- MATCH_CREATED can only be produced by the database trigger below.
DROP POLICY IF EXISTS "Users register their own product events" ON public.product_events;
CREATE POLICY "Users register their own non-match product events"
  ON public.product_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND event_name <> 'MATCH_CREATED');

CREATE OR REPLACE FUNCTION public.track_ride_creation_product_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  event_kind public.product_event_name;
  prior_count integer;
  domain_ride_id text;
  event_metadata jsonb;
BEGIN
  IF TG_TABLE_NAME = 'ride_requests' THEN
    event_kind := 'RIDE_REQUEST_CREATED';
    SELECT count(*) INTO prior_count FROM public.ride_requests WHERE user_id = NEW.user_id;
    domain_ride_id := NEW.request_id::text;
    event_metadata := jsonb_build_object(
      'requestId', NEW.request_id,
      'origin', NEW.origin,
      'destination', NEW.destination,
      'timeWindow', NEW.departure_time,
      'profile', 'PASSAGEIRO',
      'passengerCount', NEW.passenger_count
    );
  ELSE
    event_kind := 'RIDE_OFFER_CREATED';
    SELECT count(*) INTO prior_count FROM public.ride_offers WHERE user_id = NEW.user_id;
    domain_ride_id := NEW.offer_id::text;
    event_metadata := jsonb_build_object(
      'offerId', NEW.offer_id,
      'origin', NEW.origin,
      'destination', NEW.destination,
      'timeWindow', NEW.departure_time,
      'profile', 'MOTORISTA',
      'availableSeats', NEW.available_seats
    );
  END IF;

  INSERT INTO public.product_events (event_name, user_id, ride_id, status, source, metadata, created_at)
  VALUES (
    event_kind, NEW.user_id, domain_ride_id, NEW.status, 'direct', event_metadata, NEW.created_at
  );

  IF prior_count > 1 THEN
    INSERT INTO public.product_events (event_name, user_id, ride_id, status, source, metadata, created_at)
    VALUES ('RIDE_REPEATED', NEW.user_id, domain_ride_id, NEW.status, 'direct',
      jsonb_build_object('domainEvent', event_kind), NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

-- Only rows inserted into ride_matches can produce a match event. The
-- match_id unique index is an additional idempotency guard.
CREATE OR REPLACE FUNCTION public.track_persisted_match_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE matched_passenger_count integer;
BEGIN
  SELECT passenger_count INTO matched_passenger_count
  FROM public.ride_requests WHERE request_id = NEW.request_id;

  INSERT INTO public.product_events (
    event_name, user_id, ride_id, match_id, status, source, created_at,
    request_id, offer_id, passenger_user_id, driver_user_id, metadata
  ) VALUES (
    'MATCH_CREATED', NEW.passenger_user_id, NEW.ride_id, NEW.match_id::text,
    NEW.status, 'direct', NEW.created_at, NEW.request_id, NEW.offer_id,
    NEW.passenger_user_id, NEW.driver_user_id,
    jsonb_build_object(
      'requestId', NEW.request_id,
      'offerId', NEW.offer_id,
      'passengerUserId', NEW.passenger_user_id,
      'driverUserId', NEW.driver_user_id,
      'rideId', NEW.ride_id,
      'seatsOccupied', matched_passenger_count
    )
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ride_request_track_product_event
  AFTER INSERT ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.track_ride_creation_product_event();
CREATE TRIGGER ride_offer_track_product_event
  AFTER INSERT ON public.ride_offers
  FOR EACH ROW EXECUTE FUNCTION public.track_ride_creation_product_event();
CREATE TRIGGER ride_match_track_product_event
  AFTER INSERT ON public.ride_matches
  FOR EACH ROW EXECUTE FUNCTION public.track_persisted_match_created();

CREATE OR REPLACE FUNCTION public.try_match_ride_request(p_request_id uuid, p_preferred_offer_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  request_row public.ride_requests%ROWTYPE;
  offer_row public.ride_offers%ROWTYPE;
  created_match_id uuid;
BEGIN
  -- Serialize compatibility decisions so concurrent request/offer inserts
  -- cannot allocate the same remaining seats.
  PERFORM pg_advisory_xact_lock(74120391);

  SELECT * INTO request_row
  FROM public.ride_requests
  WHERE request_id = p_request_id AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO offer_row
  FROM public.ride_offers
  WHERE status = 'available'
    AND seats_remaining >= request_row.passenger_count
    AND user_id <> request_row.user_id
    AND ride_date = request_row.ride_date
    AND departure_time = request_row.departure_time
    AND lower(btrim(origin)) = lower(btrim(request_row.origin))
    AND lower(btrim(destination)) = lower(btrim(request_row.destination))
    AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)
  ORDER BY created_at, offer_id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.ride_matches (
    request_id, offer_id, passenger_user_id, driver_user_id, status
  ) VALUES (
    request_row.request_id, offer_row.offer_id, request_row.user_id,
    offer_row.user_id, 'created'
  ) ON CONFLICT (request_id) DO NOTHING
  RETURNING match_id INTO created_match_id;

  IF created_match_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.ride_requests SET status = 'matched'
  WHERE request_id = request_row.request_id;
  UPDATE public.ride_offers
  SET seats_remaining = seats_remaining - request_row.passenger_count,
      status = CASE WHEN seats_remaining - request_row.passenger_count = 0 THEN 'full' ELSE 'available' END
  WHERE offer_id = offer_row.offer_id;

  RETURN created_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_new_ride_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.try_match_ride_request(NEW.request_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_new_ride_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_row record;
BEGIN
  PERFORM pg_advisory_xact_lock(74120391);
  FOR request_row IN
    SELECT request_id FROM public.ride_requests
    WHERE status = 'open'
      AND user_id <> NEW.user_id
      AND ride_date = NEW.ride_date
      AND departure_time = NEW.departure_time
      AND lower(btrim(origin)) = lower(btrim(NEW.origin))
      AND lower(btrim(destination)) = lower(btrim(NEW.destination))
      AND passenger_count <= NEW.available_seats
    ORDER BY created_at, request_id
  LOOP
    PERFORM public.try_match_ride_request(request_row.request_id, NEW.offer_id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ride_request_attempt_match
  AFTER INSERT ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.match_new_ride_request();
CREATE TRIGGER ride_offer_attempt_match
  AFTER INSERT ON public.ride_offers
  FOR EACH ROW EXECUTE FUNCTION public.match_new_ride_offer();

CREATE OR REPLACE FUNCTION public.create_ride_request(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_passenger_count integer
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_requests (user_id, origin, destination, ride_date, departure_time, passenger_count)
  VALUES (auth.uid(), btrim(p_origin), btrim(p_destination), p_ride_date, p_departure_time, p_passenger_count)
  RETURNING request_id INTO created_request_id;
  RETURN created_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ride_offer(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_available_seats integer
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_offer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_offers (
    user_id, origin, destination, ride_date, departure_time,
    available_seats, seats_remaining
  ) VALUES (
    auth.uid(), btrim(p_origin), btrim(p_destination), p_ride_date,
    p_departure_time, p_available_seats, p_available_seats
  ) RETURNING offer_id INTO created_offer_id;
  RETURN created_offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_ride_creation_product_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_persisted_match_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_match_ride_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_new_ride_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_new_ride_offer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_ride_request(text, text, date, time, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_ride_offer(text, text, date, time, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ride_request(text, text, date, time, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text, text, date, time, integer) TO authenticated;
