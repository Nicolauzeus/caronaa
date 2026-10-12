-- A passenger's requested segment and its server-generated road fare travel
-- together from discovery through the existing bilateral acceptance flow.
-- This migration is additive: historical requests/rides and their prices stay
-- untouched.

ALTER TABLE public.offer_route_quotes
  ADD COLUMN IF NOT EXISTS origin_lat double precision,
  ADD COLUMN IF NOT EXISTS origin_lng double precision,
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision;

DO $quote_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.offer_route_quotes'::regclass
    AND conname = 'offer_route_quotes_coordinates_check') THEN
    ALTER TABLE public.offer_route_quotes ADD CONSTRAINT offer_route_quotes_coordinates_check CHECK (
      (origin_lat IS NULL AND origin_lng IS NULL AND destination_lat IS NULL AND destination_lng IS NULL)
      OR public.has_route_coordinates(origin_lat, origin_lng, destination_lat, destination_lng)
    );
  END IF;
END
$quote_constraints$;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS route_quote_id uuid REFERENCES public.offer_route_quotes(quote_id),
  ADD COLUMN IF NOT EXISTS route_distance_km numeric(14,6),
  ADD COLUMN IF NOT EXISTS passenger_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS passenger_group_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS tariff_reference text;

DO $request_quote_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ride_requests'::regclass
    AND conname = 'ride_requests_route_quote_complete_check') THEN
    ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_route_quote_complete_check CHECK (
      (route_quote_id IS NULL AND route_distance_km IS NULL AND passenger_price IS NULL
        AND passenger_group_total IS NULL AND tariff_reference IS NULL)
      OR
      (route_quote_id IS NOT NULL AND route_distance_km IS NOT NULL AND route_distance_km > 0
        AND passenger_price IS NOT NULL AND passenger_price >= 0
        AND passenger_group_total IS NOT NULL AND passenger_group_total >= 0
        AND tariff_reference = 'caronaa-km-6-per-11-v1')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ride_requests'::regclass
    AND conname = 'ride_requests_route_quote_id_fkey') THEN
    ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_route_quote_id_fkey
      FOREIGN KEY (route_quote_id) REFERENCES public.offer_route_quotes(quote_id);
  END IF;
END
$request_quote_constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_route_quote_once_idx
  ON public.ride_requests(route_quote_id) WHERE route_quote_id IS NOT NULL;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS route_quote_id uuid;

DO $ride_quote_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.rides'::regclass
    AND conname = 'rides_route_quote_id_fkey') THEN
    ALTER TABLE public.rides ADD CONSTRAINT rides_route_quote_id_fkey
      FOREIGN KEY (route_quote_id) REFERENCES public.offer_route_quotes(quote_id);
  END IF;
END
$ride_quote_constraints$;

CREATE OR REPLACE FUNCTION public.copy_request_route_quote_to_ride()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_quote public.ride_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_quote
  FROM public.ride_requests
  WHERE request_id = NEW.request_id;

  IF request_quote.route_quote_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> 'MATCHED' OR NEW.passenger_accepted_at IS NOT NULL OR NEW.driver_accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'A passenger fare quote can only be attached to a new pending proposal';
  END IF;

  UPDATE public.rides SET
    route_quote_id = request_quote.route_quote_id,
    route_distance_km = request_quote.route_distance_km,
    passenger_price = request_quote.passenger_price,
    passenger_group_total = request_quote.passenger_group_total,
    tariff_reference = request_quote.tariff_reference,
    total_price = request_quote.passenger_group_total,
    passenger_contribution = request_quote.passenger_group_total,
    updated_at = clock_timestamp()
  WHERE ride_id = NEW.ride_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.copy_request_route_quote_to_ride() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ride_copy_request_route_quote ON public.rides;
CREATE TRIGGER ride_copy_request_route_quote
  AFTER INSERT ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.copy_request_route_quote_to_ride();

CREATE OR REPLACE FUNCTION public.guard_ride_route_quote_id()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE request_quote_id uuid;
BEGIN
  IF OLD.route_quote_id IS NOT DISTINCT FROM NEW.route_quote_id THEN RETURN NEW; END IF;
  IF OLD.route_quote_id IS NOT NULL THEN RAISE EXCEPTION 'Saved route quote reference is immutable'; END IF;
  IF OLD.status <> 'MATCHED' OR OLD.passenger_accepted_at IS NOT NULL OR OLD.driver_accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only a new pending proposal can receive a route quote reference';
  END IF;
  SELECT route_quote_id INTO request_quote_id FROM public.ride_requests WHERE request_id = OLD.request_id;
  IF request_quote_id IS NULL OR NEW.route_quote_id IS DISTINCT FROM request_quote_id THEN
    RAISE EXCEPTION 'Ride quote must be the quote attached to its passenger request';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_ride_route_quote_id() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ride_route_quote_id_guard ON public.rides;
CREATE TRIGGER ride_route_quote_id_guard
  BEFORE UPDATE OF route_quote_id ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.guard_ride_route_quote_id();

-- This RPC intentionally accepts only the quote identifier and trip metadata.
-- Coordinates, route distance and fare come exclusively from the server quote.
CREATE OR REPLACE FUNCTION public.request_available_ride_segment(
  p_offer_id uuid,
  p_quote_id uuid,
  p_ride_date date,
  p_departure_time time,
  p_passenger_count integer DEFAULT 1,
  p_time_tolerance_minutes integer DEFAULT 15
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  quote_row public.offer_route_quotes%ROWTYPE;
  offer_row public.ride_offers%ROWTYPE;
  existing_request uuid;
  created_request uuid;
  group_total numeric(10,2);
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_quote_id IS NULL OR p_ride_date IS NULL OR p_departure_time IS NULL
    OR p_passenger_count IS NULL OR p_passenger_count NOT BETWEEN 1 AND 6
    OR p_time_tolerance_minutes IS NULL OR p_time_tolerance_minutes NOT IN (5, 15, 30, 60) THEN
    RAISE EXCEPTION 'Invalid passenger trip details';
  END IF;
  IF (p_ride_date + p_departure_time) AT TIME ZONE 'America/Fortaleza' < clock_timestamp() THEN
    RAISE EXCEPTION 'Departure time has already passed';
  END IF;

  PERFORM pg_advisory_xact_lock(74120391);
  SELECT * INTO quote_row FROM public.offer_route_quotes
  WHERE quote_id = p_quote_id AND user_id = caller FOR UPDATE;
  IF NOT FOUND
    OR quote_row.distance_km <= 0
    OR quote_row.distance_km::text IN ('NaN', 'Infinity', '-Infinity')
    OR quote_row.passenger_price IS DISTINCT FROM round(quote_row.distance_km * 6 / 11, 2)
    OR quote_row.tariff_reference IS DISTINCT FROM 'caronaa-km-6-per-11-v1'
    OR NOT public.has_route_coordinates(quote_row.origin_lat, quote_row.origin_lng,
      quote_row.destination_lat, quote_row.destination_lng) THEN
    RAISE EXCEPTION 'Passenger route quote is invalid or expired';
  END IF;

  SELECT request_id INTO existing_request FROM public.ride_requests
  WHERE route_quote_id = p_quote_id AND user_id = caller;
  IF existing_request IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.ride_requests WHERE request_id = existing_request
      AND target_offer_id IS NOT DISTINCT FROM p_offer_id AND ride_date = p_ride_date
      AND departure_time = p_departure_time AND passenger_count = p_passenger_count) THEN
      RAISE EXCEPTION 'This quote was already used for another trip';
    END IF;
    RETURN existing_request;
  END IF;
  IF quote_row.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Passenger route quote is invalid or expired';
  END IF;

  IF p_offer_id IS NOT NULL THEN
    SELECT * INTO offer_row FROM public.ride_offers WHERE offer_id = p_offer_id FOR UPDATE;
    IF NOT FOUND OR offer_row.user_id = caller OR offer_row.status <> 'available'
      OR offer_row.seats_remaining < p_passenger_count THEN
      RAISE EXCEPTION 'Offer unavailable';
    END IF;
    IF (offer_row.ride_date + offer_row.departure_time) AT TIME ZONE 'America/Fortaleza' < clock_timestamp() THEN
      RAISE EXCEPTION 'Offer expired';
    END IF;
  END IF;

  group_total := round(quote_row.passenger_price * p_passenger_count, 2);
  INSERT INTO public.ride_requests (
    user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
    ride_date, departure_time, passenger_count, time_tolerance_minutes, target_offer_id,
    route_quote_id, route_distance_km, passenger_price, passenger_group_total, tariff_reference
  ) VALUES (
    caller, quote_row.origin, quote_row.destination, quote_row.origin_lat, quote_row.origin_lng,
    quote_row.destination_lat, quote_row.destination_lng, p_ride_date, p_departure_time,
    p_passenger_count, p_time_tolerance_minutes, p_offer_id,
    quote_row.quote_id, quote_row.distance_km, quote_row.passenger_price, group_total, quote_row.tariff_reference
  ) RETURNING request_id INTO created_request;

  -- This UI action targets one offer. If the authoritative allocator cannot
  -- reserve that offer for this exact segment, roll back the whole request.
  IF p_offer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ride_matches
    WHERE request_id = created_request AND offer_id = p_offer_id AND status = 'created') THEN
    RAISE EXCEPTION 'Offer no longer matches this segment or has no seats available';
  END IF;
  RETURN created_request;
END;
$$;
REVOKE ALL ON FUNCTION public.request_available_ride_segment(uuid, uuid, date, time, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_available_ride_segment(uuid, uuid, date, time, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_priced_ride_request(
  p_quote_id uuid,
  p_ride_date date,
  p_departure_time time,
  p_passenger_count integer DEFAULT 1,
  p_time_tolerance_minutes integer DEFAULT 15,
  p_preferences jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  PERFORM set_config(
    'caronaa.travel_preferences',
    CASE WHEN p_preferences IS NULL THEN '' ELSE public.validate_travel_preferences(p_preferences)::text END,
    true
  );
  RETURN public.request_available_ride_segment(
    NULL, p_quote_id, p_ride_date, p_departure_time, p_passenger_count, p_time_tolerance_minutes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_priced_ride_request(uuid, date, time, integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_priced_ride_request(uuid, date, time, integer, integer, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';