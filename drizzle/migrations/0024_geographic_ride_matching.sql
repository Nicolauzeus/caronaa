-- Migration: 0024_geographic_ride_matching.sql
-- Add coordinate-aware ride matching with an explicit 2 km MVP fallback radius.

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS origin_lat double precision,
  ADD COLUMN IF NOT EXISTS origin_lng double precision,
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision;

ALTER TABLE public.ride_offers
  ADD COLUMN IF NOT EXISTS origin_lat double precision,
  ADD COLUMN IF NOT EXISTS origin_lng double precision,
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision;

CREATE OR REPLACE FUNCTION public.distance_km(lat_a double precision, lng_a double precision, lat_b double precision, lng_b double precision)
RETURNS double precision
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT 6371 * 2 * asin(
    least(1, sqrt(
      power(sin(radians((lat_b - lat_a) / 2)), 2) +
      cos(radians(lat_a)) * cos(radians(lat_b)) *
      power(sin(radians((lng_b - lng_a) / 2)), 2)
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.has_route_coordinates(
  origin_lat double precision, origin_lng double precision,
  destination_lat double precision, destination_lng double precision
)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT origin_lat BETWEEN -90 AND 90
    AND origin_lng BETWEEN -180 AND 180
    AND destination_lat BETWEEN -90 AND 90
    AND destination_lng BETWEEN -180 AND 180;
$$;

CREATE OR REPLACE FUNCTION public.distance_point_to_segment_km(
  point_lat double precision, point_lng double precision,
  start_lat double precision, start_lng double precision,
  end_lat double precision, end_lng double precision
)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  km_per_degree_lat double precision := 111.32;
  km_per_degree_lng double precision := 111.32 * cos(radians(start_lat));
  point_x double precision := (point_lng - start_lng) * km_per_degree_lng;
  point_y double precision := (point_lat - start_lat) * km_per_degree_lat;
  end_x double precision := (end_lng - start_lng) * km_per_degree_lng;
  end_y double precision := (end_lat - start_lat) * km_per_degree_lat;
  length_squared double precision := end_x * end_x + end_y * end_y;
  projection double precision;
  nearest_x double precision;
  nearest_y double precision;
BEGIN
  IF length_squared = 0 THEN
    RETURN public.distance_km(point_lat, point_lng, start_lat, start_lng);
  END IF;

  projection := greatest(0, least(1, (point_x * end_x + point_y * end_y) / length_squared));
  nearest_x := projection * end_x;
  nearest_y := projection * end_y;
  RETURN sqrt(power(point_x - nearest_x, 2) + power(point_y - nearest_y, 2));
END;
$$;

CREATE OR REPLACE FUNCTION public.is_point_compatible_with_route(
  point_lat double precision, point_lng double precision,
  route_origin_lat double precision, route_origin_lng double precision,
  route_destination_lat double precision, route_destination_lng double precision,
  endpoint_lat double precision, endpoint_lng double precision,
  tolerance_km double precision
)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT public.distance_km(point_lat, point_lng, endpoint_lat, endpoint_lng) <= tolerance_km
    OR public.distance_point_to_segment_km(
      point_lat, point_lng,
      route_origin_lat, route_origin_lng,
      route_destination_lat, route_destination_lng
    ) <= tolerance_km;
$$;

CREATE OR REPLACE FUNCTION public.are_ride_routes_compatible(
  request_origin text, request_destination text,
  request_origin_lat double precision, request_origin_lng double precision,
  request_destination_lat double precision, request_destination_lng double precision,
  offer_origin text, offer_destination text,
  offer_origin_lat double precision, offer_origin_lng double precision,
  offer_destination_lat double precision, offer_destination_lng double precision,
  tolerance_km double precision DEFAULT 2
)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN public.has_route_coordinates(
      request_origin_lat, request_origin_lng, request_destination_lat, request_destination_lng
    ) AND public.has_route_coordinates(
      offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng
    )
    THEN public.is_point_compatible_with_route(
        request_origin_lat, request_origin_lng,
        offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng,
        offer_origin_lat, offer_origin_lng, tolerance_km
      )
      AND public.is_point_compatible_with_route(
        request_destination_lat, request_destination_lng,
        offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng,
        offer_destination_lat, offer_destination_lng, tolerance_km
      )
      AND public.distance_km(request_origin_lat, request_origin_lng, request_destination_lat, request_destination_lng) > 0
      AND public.distance_km(offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng) > 0
    WHEN public.has_route_coordinates(
      request_origin_lat, request_origin_lng, request_destination_lat, request_destination_lng
    ) OR public.has_route_coordinates(
      offer_origin_lat, offer_origin_lng, offer_destination_lat, offer_destination_lng
    )
    THEN false
    ELSE lower(btrim(request_origin)) = lower(btrim(offer_origin))
      AND lower(btrim(request_destination)) = lower(btrim(offer_destination))
      AND lower(btrim(request_origin)) <> lower(btrim(request_destination))
  END;
$$;

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
    AND public.are_ride_routes_compatible(
      request_row.origin, request_row.destination,
      request_row.origin_lat, request_row.origin_lng,
      request_row.destination_lat, request_row.destination_lng,
      origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, 2
    )
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
    SELECT * FROM public.ride_requests
    WHERE status = 'open'
      AND user_id <> NEW.user_id
      AND ride_date = NEW.ride_date
      AND abs(extract(epoch from (NEW.departure_time - departure_time)) / 60) <= coalesce(time_tolerance_minutes, 15)
      AND public.are_ride_routes_compatible(
        origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
        NEW.origin, NEW.destination, NEW.origin_lat, NEW.origin_lng,
        NEW.destination_lat, NEW.destination_lng, 2
      )
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
  p_time_tolerance_minutes integer DEFAULT 15,
  p_origin_lat double precision DEFAULT NULL, p_origin_lng double precision DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL, p_destination_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  offer_id uuid, user_id uuid, origin text, destination text,
  origin_lat double precision, origin_lng double precision,
  destination_lat double precision, destination_lng double precision,
  ride_date date, departure_time time, available_seats integer, seats_remaining integer,
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
  SELECT o.offer_id, o.user_id, o.origin, o.destination,
    o.origin_lat, o.origin_lng, o.destination_lat, o.destination_lng,
    o.ride_date, o.departure_time, o.available_seats, o.seats_remaining, o.status,
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
    AND (
      nullif(btrim(coalesce(p_origin, '')), '') IS NULL
      OR nullif(btrim(coalesce(p_destination, '')), '') IS NULL
      OR public.are_ride_routes_compatible(
        p_origin, p_destination, p_origin_lat, p_origin_lng, p_destination_lat, p_destination_lng,
        o.origin, o.destination, o.origin_lat, o.origin_lng, o.destination_lat, o.destination_lng, 2
      )
    )
  ORDER BY o.ride_date, o.departure_time, o.created_at, o.offer_id
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ride_request(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_passenger_count integer,
  p_time_tolerance_minutes integer DEFAULT 15,
  p_origin_lat double precision DEFAULT NULL, p_origin_lng double precision DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL, p_destination_lng double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_requests (
    user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
    ride_date, departure_time, passenger_count, time_tolerance_minutes
  ) VALUES (
    auth.uid(), btrim(p_origin), btrim(p_destination), p_origin_lat, p_origin_lng,
    p_destination_lat, p_destination_lng, p_ride_date, p_departure_time,
    p_passenger_count, coalesce(p_time_tolerance_minutes, 15)
  )
  RETURNING request_id INTO created_request_id;
  RETURN created_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ride_offer(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_available_seats integer,
  p_time_tolerance_minutes integer DEFAULT 15,
  p_origin_lat double precision DEFAULT NULL, p_origin_lng double precision DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL, p_destination_lng double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_offer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_offers (
    user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
    ride_date, departure_time, available_seats, seats_remaining, time_tolerance_minutes
  ) VALUES (
    auth.uid(), btrim(p_origin), btrim(p_destination), p_origin_lat, p_origin_lng,
    p_destination_lat, p_destination_lng, p_ride_date, p_departure_time,
    p_available_seats, p_available_seats, coalesce(p_time_tolerance_minutes, 15)
  ) RETURNING offer_id INTO created_offer_id;
  RETURN created_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ride_request(text, text, date, time, integer, integer, double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text, text, date, time, integer, integer, double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_available_ride_offers(text, text, date, time, integer, integer, integer, double precision, double precision, double precision, double precision) TO authenticated;
