-- Migration: 0023_flexible_time_tolerance_matching.sql
-- Implement configurable temporal matching tolerance (default +-15 min, options +-5, +-15, +-30, +-60 min).
-- Replaces rigid exact time check with minute-based interval difference comparison.

ALTER TABLE public.ride_requests
ADD COLUMN IF NOT EXISTS time_tolerance_minutes integer NOT NULL DEFAULT 15
CHECK (time_tolerance_minutes IN (5, 15, 30, 60));

ALTER TABLE public.ride_offers
ADD COLUMN IF NOT EXISTS time_tolerance_minutes integer NOT NULL DEFAULT 15
CHECK (time_tolerance_minutes IN (5, 15, 30, 60));

CREATE OR REPLACE FUNCTION public.try_match_ride_request(p_request_id uuid, p_preferred_offer_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  request_row public.ride_requests%ROWTYPE;
  offer_row public.ride_offers%ROWTYPE;
  created_match_id uuid;
  tolerance_mins integer;
BEGIN
  PERFORM pg_advisory_xact_lock(74120391);

  SELECT * INTO request_row
  FROM public.ride_requests
  WHERE request_id = p_request_id AND status = 'open'
    AND (ride_date + departure_time) AT TIME ZONE 'America/Fortaleza' >= pg_catalog.clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  tolerance_mins := coalesce(request_row.time_tolerance_minutes, 15);

  SELECT * INTO offer_row
  FROM public.ride_offers
  WHERE status = 'available'
    AND seats_remaining >= request_row.passenger_count
    AND (ride_date + departure_time) AT TIME ZONE 'America/Fortaleza' >= pg_catalog.clock_timestamp()
    AND user_id <> request_row.user_id
    AND ride_date = request_row.ride_date
    AND abs(extract(epoch from (departure_time - request_row.departure_time)) / 60) <= tolerance_mins
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

CREATE OR REPLACE FUNCTION public.match_new_ride_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_row record;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(74120391);
  FOR request_row IN
    SELECT request_id FROM public.ride_requests
    WHERE status = 'open'
      AND user_id <> NEW.user_id
      AND ride_date = NEW.ride_date
      AND abs(extract(epoch from (NEW.departure_time - departure_time)) / 60) <= coalesce(time_tolerance_minutes, 15)
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

CREATE OR REPLACE FUNCTION public.search_available_ride_offers(
  p_origin text DEFAULT NULL, p_destination text DEFAULT NULL,
  p_ride_date date DEFAULT NULL, p_departure_time time DEFAULT NULL,
  p_passenger_count integer DEFAULT 1, p_limit integer DEFAULT 30,
  p_time_tolerance_minutes integer DEFAULT 15
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
    AND (p_departure_time IS NULL OR abs(extract(epoch from (o.departure_time - p_departure_time)) / 60) <= coalesce(p_time_tolerance_minutes, 15))
    AND (nullif(btrim(p_origin), '') IS NULL OR strpos(lower(o.origin), lower(btrim(p_origin))) > 0)
    AND (nullif(btrim(p_destination), '') IS NULL OR strpos(lower(o.destination), lower(btrim(p_destination))) > 0)
  ORDER BY o.ride_date, o.departure_time, o.created_at, o.offer_id
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ride_request(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_passenger_count integer,
  p_time_tolerance_minutes integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_requests (user_id, origin, destination, ride_date, departure_time, passenger_count, time_tolerance_minutes)
  VALUES (auth.uid(), btrim(p_origin), btrim(p_destination), p_ride_date, p_departure_time, p_passenger_count, coalesce(p_time_tolerance_minutes, 15))
  RETURNING request_id INTO created_request_id;
  RETURN created_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ride_offer(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_available_seats integer,
  p_time_tolerance_minutes integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_offer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_offers (
    user_id, origin, destination, ride_date, departure_time,
    available_seats, seats_remaining, time_tolerance_minutes
  ) VALUES (
    auth.uid(), btrim(p_origin), btrim(p_destination), p_ride_date,
    p_departure_time, p_available_seats, p_available_seats, coalesce(p_time_tolerance_minutes, 15)
  ) RETURNING offer_id INTO created_offer_id;
  RETURN created_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ride_request(text, text, date, time, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text, text, date, time, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_available_ride_offers(text, text, date, time, integer, integer, integer) TO authenticated;

