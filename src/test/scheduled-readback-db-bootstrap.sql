-- Isolated read-adapter fixture only. Publication/lifecycle triggers are covered
-- by scheduled-offer.integration.sql and the existing ride integration suites.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, avatar_url text);
CREATE TABLE public.ride_offers(
  offer_id uuid PRIMARY KEY, user_id uuid NOT NULL, origin text NOT NULL, destination text NOT NULL,
  ride_date date NOT NULL, departure_time time NOT NULL, status text NOT NULL,
  available_seats integer NOT NULL, seats_remaining integer NOT NULL, total_price numeric NOT NULL,
  booking_mode text, service_tier text, vehicle_type text NOT NULL, meeting_point text
);
CREATE TABLE public.ride_requests(
  request_id uuid PRIMARY KEY, user_id uuid NOT NULL, passenger_count integer NOT NULL, pickup_point text
);
CREATE TABLE public.rides(
  ride_id uuid PRIMARY KEY, match_id uuid NOT NULL, request_id uuid NOT NULL REFERENCES public.ride_requests,
  offer_id uuid NOT NULL REFERENCES public.ride_offers, passenger_user_id uuid NOT NULL, driver_user_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('MATCHED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW')),
  created_at timestamptz NOT NULL DEFAULT now(), passenger_accepted_at timestamptz,
  driver_accepted_at timestamptz, passenger_group_total numeric,
  passenger_contribution numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_offer ON public.ride_offers FOR SELECT TO authenticated USING(user_id = auth.uid());
CREATE POLICY own_request ON public.ride_requests FOR SELECT TO authenticated USING(user_id = auth.uid());
CREATE POLICY own_profile ON public.profiles FOR SELECT TO authenticated USING(id = auth.uid());
CREATE POLICY participant_ride ON public.rides FOR SELECT TO authenticated
  USING(driver_user_id = auth.uid() OR passenger_user_id = auth.uid());
GRANT SELECT ON public.ride_offers, public.ride_requests, public.rides, public.profiles TO authenticated;
