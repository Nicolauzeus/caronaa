-- Ride date/time are local wall-clock values. Interpret them in the project's
-- America/Fortaleza context, independently of the connection TimeZone.
-- Use wall-clock time so waiting for an allocation lock cannot admit expired rides.
-- Discovery exposes only card data; table SELECT remains owner-only.
CREATE FUNCTION public.search_available_ride_offers(
  p_origin text DEFAULT NULL, p_destination text DEFAULT NULL,
  p_ride_date date DEFAULT NULL, p_departure_time time DEFAULT NULL,
  p_passenger_count integer DEFAULT 1, p_limit integer DEFAULT 30
)
RETURNS TABLE (
  offer_id uuid, user_id uuid, origin text, destination text, ride_date date,
  departure_time time, available_seats integer, seats_remaining integer,
  status text, created_at timestamptz, full_name text, avatar_url text,
  city text, verifications jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_passenger_count IS NULL OR p_passenger_count NOT BETWEEN 1 AND 6
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid search parameters';
  END IF;
  RETURN QUERY
  SELECT o.offer_id, o.user_id, o.origin, o.destination, o.ride_date,
    o.departure_time, o.available_seats, o.seats_remaining, o.status,
    o.created_at, p.full_name, p.avatar_url, p.city,
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'type', v.type, 'status', v.status
    )) FROM public.user_verifications v
      WHERE v.user_id = o.user_id AND v.status = 'VERIFIED'), '[]'::jsonb)
  FROM public.ride_offers o LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.user_id <> auth.uid() AND o.status = 'available'
    AND o.seats_remaining > 0 AND o.seats_remaining >= p_passenger_count
    AND (o.ride_date + o.departure_time) AT TIME ZONE 'America/Fortaleza' >= pg_catalog.clock_timestamp()
    AND (p_ride_date IS NULL OR o.ride_date = p_ride_date)
    AND (p_departure_time IS NULL OR o.departure_time = p_departure_time)
    AND (nullif(btrim(p_origin), '') IS NULL OR strpos(lower(o.origin), lower(btrim(p_origin))) > 0)
    AND (nullif(btrim(p_destination), '') IS NULL OR strpos(lower(o.destination), lower(btrim(p_destination))) > 0)
  ORDER BY o.ride_date, o.departure_time, o.created_at, o.offer_id
  LIMIT p_limit;
END;
$$;

-- Persist the chosen offer so the existing insert trigger cannot match another one.
ALTER TABLE public.ride_requests ADD COLUMN target_offer_id uuid
  REFERENCES public.ride_offers(offer_id) ON DELETE RESTRICT;

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
    AND (ride_date + departure_time) AT TIME ZONE 'America/Fortaleza' >= pg_catalog.clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO offer_row
  FROM public.ride_offers
  WHERE status = 'available'
    AND seats_remaining >= request_row.passenger_count
    AND (ride_date + departure_time) AT TIME ZONE 'America/Fortaleza' >= pg_catalog.clock_timestamp()
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
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.try_match_ride_request(NEW.request_id, NEW.target_offer_id);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.request_available_ride_offer(p_offer_id uuid, p_passenger_count integer DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller uuid := auth.uid();
  offer_row public.ride_offers%ROWTYPE;
  existing_request uuid;
  created_request uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_passenger_count IS NULL OR p_passenger_count NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'Invalid passenger count';
  END IF;
  -- Same lock/order as the existing allocator, including concurrent retries.
  PERFORM pg_catalog.pg_advisory_xact_lock(74120391);
  SELECT * INTO offer_row FROM public.ride_offers WHERE offer_id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR offer_row.user_id = caller THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
  IF (offer_row.ride_date + offer_row.departure_time) AT TIME ZONE 'America/Fortaleza' < pg_catalog.clock_timestamp() THEN
    RAISE EXCEPTION 'Offer expired';
  END IF;
  SELECT m.request_id INTO existing_request FROM public.ride_matches m
    JOIN public.ride_requests r ON r.request_id = m.request_id
    WHERE m.offer_id = p_offer_id AND m.passenger_user_id = caller
    ORDER BY m.created_at LIMIT 1;
  IF existing_request IS NOT NULL THEN
    IF (SELECT passenger_count FROM public.ride_requests WHERE request_id = existing_request) <> p_passenger_count THEN
      RAISE EXCEPTION 'A request with another passenger count already exists';
    END IF;
    RETURN existing_request;
  END IF;
  IF offer_row.status <> 'available' OR offer_row.seats_remaining < p_passenger_count THEN
    RAISE EXCEPTION 'Offer unavailable';
  END IF;
  INSERT INTO public.ride_requests (user_id, origin, destination, ride_date,
    departure_time, passenger_count, target_offer_id)
  VALUES (caller, offer_row.origin, offer_row.destination, offer_row.ride_date,
    offer_row.departure_time, p_passenger_count, p_offer_id)
  RETURNING request_id INTO created_request;
  IF NOT EXISTS (SELECT 1 FROM public.ride_matches WHERE request_id = created_request AND offer_id = p_offer_id) THEN
    RAISE EXCEPTION 'Offer unavailable';
  END IF;
  RETURN created_request;
END;
$$;

REVOKE ALL ON FUNCTION public.search_available_ride_offers(text,text,date,time,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_available_ride_offer(uuid,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.match_new_ride_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_match_ride_request(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_available_ride_offers(text,text,date,time,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_available_ride_offer(uuid,integer) TO authenticated;
