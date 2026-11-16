-- F03: scheduled shared rides use the same trusted quote publication pipeline
-- as the existing offer flow. No F07 authorization, presence or fee gate changes.
-- Keep the Supabase mirror safe when previews run before the Drizzle baseline.
ALTER TABLE IF EXISTS public.ride_offers
  ADD COLUMN IF NOT EXISTS service_tier text DEFAULT 'SCHEDULED'
    CHECK (service_tier IN ('FLASH', 'SCHEDULED')),
  ADD COLUMN IF NOT EXISTS booking_mode text DEFAULT 'ON_ROUTE'
    CHECK (booking_mode IN ('ALL', 'ON_ROUTE', 'EXCLUSIVE'));

-- Snapshot these options before AFTER INSERT matching observes the new offer.
-- Calls outside this scheduled wrapper preserve their existing behavior.
CREATE OR REPLACE FUNCTION public.attach_scheduled_offer_options()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_mode text := nullif(current_setting('caronaa.scheduled_booking_mode', true), '');
BEGIN
  IF v_mode IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid()
     OR v_mode NOT IN ('ALL', 'ON_ROUTE', 'EXCLUSIVE') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  NEW.service_tier := 'SCHEDULED';
  NEW.booking_mode := v_mode;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_scheduled_offer_options() FROM PUBLIC, anon, authenticated;

DO $scheduled_triggers$
BEGIN
  IF to_regclass('public.ride_offers') IS NULL THEN RETURN; END IF;
  DROP TRIGGER IF EXISTS a_scheduled_offer_options ON public.ride_offers;
  CREATE TRIGGER a_scheduled_offer_options
    BEFORE INSERT ON public.ride_offers
    FOR EACH ROW EXECUTE FUNCTION public.attach_scheduled_offer_options();

  -- The managed database also has a PostGIS corridor. Its original sync trigger
  -- runs before z_offer_route_geometry_before_insert copies the trusted path.
  -- Recalculate only this scheduled insert, after the copy and before matching.
  IF to_regprocedure('public.sync_ride_offer_route_geom()') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.ride_offers'::regclass
         AND attname = 'route_geom' AND NOT attisdropped
     ) THEN
    DROP TRIGGER IF EXISTS zz_scheduled_offer_route_geom ON public.ride_offers;
    CREATE TRIGGER zz_scheduled_offer_route_geom
      BEFORE INSERT ON public.ride_offers
      FOR EACH ROW
      WHEN (nullif(current_setting('caronaa.scheduled_booking_mode', true), '') IS NOT NULL)
      EXECUTE FUNCTION public.sync_ride_offer_route_geom();
  END IF;
END;
$scheduled_triggers$;

-- Avoid an ambiguous PostgREST overload when callers omit the new optional arg.
DROP FUNCTION IF EXISTS public.publish_scheduled_driver_offer(
  text, text, double precision, double precision, double precision, double precision,
  date, time without time zone, integer, numeric, text, text, boolean, jsonb, jsonb, boolean
);

CREATE OR REPLACE FUNCTION public.publish_scheduled_driver_offer(
  p_origin text,
  p_destination text,
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_destination_lat double precision,
  p_destination_lng double precision,
  p_ride_date date,
  p_departure_time time without time zone,
  p_available_seats integer,
  p_total_price numeric,
  p_booking_mode text DEFAULT 'ALL',
  p_vehicle_type text DEFAULT 'CAR',
  p_allow_detours boolean DEFAULT true,
  p_route_path jsonb DEFAULT NULL,
  p_travel_preferences jsonb DEFAULT NULL,
  p_women_only boolean DEFAULT false,
  p_quote_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_origin text := nullif(btrim(p_origin), '');
  v_destination text := nullif(btrim(p_destination), '');
  v_quote record;
  v_saved record;
  v_profile record;
  v_offer_id uuid;
  v_vehicle_description text;
  v_preferences jsonb;
  v_audience text := CASE WHEN p_women_only THEN 'FEMININO' ELSE 'ANY' END;
  v_previous_mode text := coalesce(current_setting('caronaa.scheduled_booking_mode', true), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  IF to_regclass('public.ride_offers') IS NULL
     OR to_regclass('public.offer_route_quotes') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regprocedure('public.publish_filtered_priced_offer(jsonb,uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_SCHEMA_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'QUOTE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_origin IS NULL OR v_destination IS NULL
     OR length(v_origin) > 160 OR length(v_destination) > 160
     OR lower(v_origin) = lower(v_destination)
     OR p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('CAR', 'MOTO')
     OR p_booking_mode IS NULL OR p_booking_mode NOT IN ('ALL', 'ON_ROUTE', 'EXCLUSIVE')
     OR p_allow_detours IS NULL OR p_women_only IS NULL
     OR p_available_seats IS NULL OR p_available_seats NOT BETWEEN 1 AND 4
     OR (p_vehicle_type = 'MOTO' AND p_available_seats <> 1)
     OR p_origin_lat IS NULL OR p_origin_lat NOT BETWEEN -90 AND 90
     OR p_origin_lng IS NULL OR p_origin_lng NOT BETWEEN -180 AND 180
     OR p_destination_lat IS NULL OR p_destination_lat NOT BETWEEN -90 AND 90
     OR p_destination_lng IS NULL OR p_destination_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  -- Serialize retries for one owner/quote. One quote represents one reviewed
  -- publication; a lost HTTP response must not create a second offer.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':offer:' || p_quote_id::text, 0
  ));
  SELECT * INTO v_quote FROM public.offer_route_quotes
    WHERE quote_id = p_quote_id AND user_id = v_user_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_quote.origin IS DISTINCT FROM v_origin
     OR v_quote.destination IS DISTINCT FROM v_destination
     OR v_quote.origin_lat IS DISTINCT FROM p_origin_lat
     OR v_quote.origin_lng IS DISTINCT FROM p_origin_lng
     OR v_quote.destination_lat IS DISTINCT FROM p_destination_lat
     OR v_quote.destination_lng IS DISTINCT FROM p_destination_lng
     OR v_quote.passenger_price IS DISTINCT FROM p_total_price THEN
    RAISE EXCEPTION 'QUOTE_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF p_travel_preferences IS NOT NULL THEN
    v_preferences := public.validate_travel_preferences(p_travel_preferences);
  END IF;

  SELECT * INTO v_saved FROM public.ride_offers
    WHERE user_id = v_user_id AND idempotency_key = p_quote_id;
  IF FOUND THEN
    IF v_saved.route_quote_id IS DISTINCT FROM p_quote_id
       OR v_saved.origin IS DISTINCT FROM v_origin
       OR v_saved.destination IS DISTINCT FROM v_destination
       OR v_saved.origin_lat IS DISTINCT FROM p_origin_lat
       OR v_saved.origin_lng IS DISTINCT FROM p_origin_lng
       OR v_saved.destination_lat IS DISTINCT FROM p_destination_lat
       OR v_saved.destination_lng IS DISTINCT FROM p_destination_lng
       OR v_saved.ride_date IS DISTINCT FROM p_ride_date
       OR v_saved.departure_time IS DISTINCT FROM p_departure_time
       OR v_saved.available_seats IS DISTINCT FROM p_available_seats
       OR v_saved.vehicle_type IS DISTINCT FROM p_vehicle_type
       OR v_saved.booking_mode IS DISTINCT FROM p_booking_mode
       OR v_saved.service_tier IS DISTINCT FROM 'SCHEDULED'
       OR v_saved.allow_detours IS DISTINCT FROM p_allow_detours
       OR v_saved.passenger_gender_preference IS DISTINCT FROM v_audience
       OR (p_travel_preferences IS NOT NULL AND v_saved.travel_preferences IS DISTINCT FROM v_preferences) THEN
      RAISE EXCEPTION 'QUOTE_ALREADY_USED' USING ERRCODE = '22023';
    END IF;
    -- An already committed, identical request remains retryable after expiry.
    RETURN jsonb_build_object('success', true, 'offer_id', v_saved.offer_id,
      'seats', v_saved.available_seats, 'date', v_saved.ride_date, 'time', v_saved.departure_time);
  END IF;
  IF EXISTS (SELECT 1 FROM public.ride_offers WHERE route_quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'QUOTE_ALREADY_USED' USING ERRCODE = '22023';
  END IF;
  IF v_quote.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22023';
  END IF;
  IF p_ride_date IS NULL OR NOT isfinite(p_ride_date) OR p_departure_time IS NULL
     OR (p_ride_date + p_departure_time) AT TIME ZONE 'America/Fortaleza'
       < clock_timestamp() + interval '30 minutes' THEN
    RAISE EXCEPTION 'INVALID_SCHEDULE' USING ERRCODE = '22023';
  END IF;
  IF v_quote.distance_km <= 0 OR v_quote.distance_km::text IN ('NaN', 'Infinity', '-Infinity')
     OR v_quote.passenger_price IS DISTINCT FROM round(v_quote.distance_km * 6 / 11, 2)
     OR v_quote.tariff_reference IS DISTINCT FROM 'caronaa-km-6-per-11-v1'
     OR NOT public.has_valid_route_path(v_quote.route_path)
     OR v_quote.route_duration_minutes IS NULL OR v_quote.route_duration_minutes <= 0
     OR v_quote.route_duration_minutes::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'QUOTE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT vehicle_brand, vehicle_description, gender INTO v_profile
    FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_vehicle_description := nullif(btrim(concat_ws(' · ',
    nullif(btrim(v_profile.vehicle_brand), ''),
    nullif(btrim(v_profile.vehicle_description), '')
  )), '');
  IF v_vehicle_description IS NULL THEN
    RAISE EXCEPTION 'VEHICLE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_women_only AND v_profile.gender IS DISTINCT FROM 'FEMININO' THEN
    RAISE EXCEPTION 'WOMEN_ONLY_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.driver_platform_access_allowed(v_user_id) THEN
    RAISE EXCEPTION 'DEBT_PENDING' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('caronaa.scheduled_booking_mode', p_booking_mode, true);
  v_offer_id := public.publish_filtered_priced_offer(
    jsonb_build_object(
      'origin', v_quote.origin, 'destination', v_quote.destination,
      'originLat', v_quote.origin_lat, 'originLng', v_quote.origin_lng,
      'destinationLat', v_quote.destination_lat, 'destinationLng', v_quote.destination_lng,
      'rideDate', p_ride_date, 'departureTime', p_departure_time,
      'availableSeats', p_available_seats, 'timeToleranceMinutes', 15,
      'vehicleType', p_vehicle_type, 'vehicleDescription', v_vehicle_description,
      'passengerGenderPreference', v_audience, 'allowDetours', p_allow_detours,
      'idempotencyKey', p_quote_id, 'totalPrice', v_quote.passenger_price
    ),
    p_quote_id,
    p_travel_preferences
  );
  PERFORM set_config('caronaa.scheduled_booking_mode', v_previous_mode, true);
  SELECT * INTO v_saved FROM public.ride_offers
    WHERE offer_id = v_offer_id AND user_id = v_user_id;
  IF NOT FOUND OR v_saved.route_quote_id IS DISTINCT FROM p_quote_id
     OR v_saved.booking_mode IS DISTINCT FROM p_booking_mode
     OR v_saved.service_tier IS DISTINCT FROM 'SCHEDULED' THEN
    RAISE EXCEPTION 'SCHEDULE_SCHEMA_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;
  -- p_route_path is retained for API compatibility but never trusted or stored.
  RETURN jsonb_build_object('success', true, 'offer_id', v_offer_id,
    'seats', v_saved.available_seats, 'date', v_saved.ride_date, 'time', v_saved.departure_time);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_scheduled_driver_offer(
  text, text, double precision, double precision, double precision, double precision,
  date, time without time zone, integer, numeric, text, text, boolean, jsonb, jsonb, boolean, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_scheduled_driver_offer(
  text, text, double precision, double precision, double precision, double precision,
  date, time without time zone, integer, numeric, text, text, boolean, jsonb, jsonb, boolean, uuid
) TO authenticated, service_role;

COMMENT ON FUNCTION public.publish_scheduled_driver_offer(
  text, text, double precision, double precision, double precision, double precision,
  date, time without time zone, integer, numeric, text, text, boolean, jsonb, jsonb, boolean, uuid
) IS 'F03 scheduled shared-ride publication through an owned, expiring server quote. Quote retries are idempotent; no F07 approval is granted.';

NOTIFY pgrst, 'reload schema';
