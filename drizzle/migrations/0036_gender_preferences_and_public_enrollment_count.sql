ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check CHECK (gender IS NULL OR gender IN ('FEMININO', 'MASCULINO'));

ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS passenger_gender_preference text NOT NULL DEFAULT 'ANY';
ALTER TABLE public.ride_offers DROP CONSTRAINT IF EXISTS ride_offers_passenger_gender_preference_check;
ALTER TABLE public.ride_offers ADD CONSTRAINT ride_offers_passenger_gender_preference_check CHECK (passenger_gender_preference IN ('ANY', 'FEMININO', 'MASCULINO'));

CREATE OR REPLACE FUNCTION public.get_public_enrollment_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) >= 25 THEN count(*)::integer ELSE NULL END FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_public_enrollment_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_enrollment_count() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assigned_role public.app_role;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('caronaa:first-admin'));
  INSERT INTO public.profiles (id, full_name, avatar_url, gender)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''), coalesce(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture'), nullif(NEW.raw_user_meta_data ->> 'gender', ''))
  ON CONFLICT (id) DO UPDATE SET full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END, avatar_url = coalesce(public.profiles.avatar_url, EXCLUDED.avatar_url), gender = coalesce(public.profiles.gender, EXCLUDED.gender), updated_at = now();
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN assigned_role := 'user'; ELSE assigned_role := 'admin'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.product_events (event_name, user_id, status, source, trusted_source) VALUES ('USER_REGISTERED', NEW.id, 'registered', 'direct', true) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Replace the canonical offer function to persist the driver's audience preference.
DROP FUNCTION IF EXISTS public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric);
CREATE FUNCTION public.create_ride_offer(
  p_origin text, p_destination text, p_ride_date date, p_departure_time time, p_available_seats integer,
  p_time_tolerance_minutes integer DEFAULT 15, p_origin_lat double precision DEFAULT NULL, p_origin_lng double precision DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL, p_destination_lng double precision DEFAULT NULL, p_total_price numeric DEFAULT 30.00,
  p_passenger_gender_preference text DEFAULT 'ANY'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_offer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF coalesce(p_passenger_gender_preference, 'ANY') NOT IN ('ANY','FEMININO','MASCULINO') THEN RAISE EXCEPTION 'Invalid gender preference'; END IF;
  INSERT INTO public.ride_offers (user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng, ride_date, departure_time, available_seats, seats_remaining, time_tolerance_minutes, total_price, passenger_gender_preference)
  VALUES (auth.uid(), btrim(p_origin), btrim(p_destination), p_origin_lat, p_origin_lng, p_destination_lat, p_destination_lng, p_ride_date, p_departure_time, p_available_seats, p_available_seats, coalesce(p_time_tolerance_minutes,15), coalesce(round(p_total_price,2),30), coalesce(p_passenger_gender_preference,'ANY')) RETURNING offer_id INTO created_offer_id;
  RETURN created_offer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_available_ride_offer(p_offer_id uuid, p_passenger_count integer DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); offer_row public.ride_offers%ROWTYPE; caller_gender text; created_request uuid; existing_request uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT gender INTO caller_gender FROM public.profiles WHERE id = caller;
  IF p_passenger_count IS NULL OR p_passenger_count NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Invalid passenger count'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(74120391);
  SELECT * INTO offer_row FROM public.ride_offers WHERE offer_id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR offer_row.user_id = caller OR (offer_row.ride_date + offer_row.departure_time) AT TIME ZONE 'America/Fortaleza' < pg_catalog.clock_timestamp() THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
  IF offer_row.passenger_gender_preference <> 'ANY' AND caller_gender IS DISTINCT FROM offer_row.passenger_gender_preference THEN RAISE EXCEPTION 'This ride has a gender preference'; END IF;
  SELECT m.request_id INTO existing_request FROM public.ride_matches m JOIN public.ride_requests r ON r.request_id = m.request_id WHERE m.offer_id = p_offer_id AND m.passenger_user_id = caller ORDER BY m.created_at LIMIT 1;
  IF existing_request IS NOT NULL THEN
    IF (SELECT passenger_count FROM public.ride_requests WHERE request_id = existing_request) <> p_passenger_count THEN RAISE EXCEPTION 'A request with another passenger count already exists'; END IF;
    RETURN existing_request;
  END IF;
  IF offer_row.status <> 'available' OR offer_row.seats_remaining < p_passenger_count THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
  INSERT INTO public.ride_requests (user_id,origin,destination,ride_date,departure_time,passenger_count,target_offer_id) VALUES (caller,offer_row.origin,offer_row.destination,offer_row.ride_date,offer_row.departure_time,p_passenger_count,p_offer_id) RETURNING request_id INTO created_request;
  IF NOT EXISTS (SELECT 1 FROM public.ride_matches WHERE request_id = created_request AND offer_id = p_offer_id) THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
  RETURN created_request;
END;
$$;
REVOKE ALL ON FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
