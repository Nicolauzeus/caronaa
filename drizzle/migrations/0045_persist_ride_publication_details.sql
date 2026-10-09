ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS pickup_point text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE public.ride_offers
  ADD COLUMN IF NOT EXISTS vehicle_description text,
  ADD COLUMN IF NOT EXISTS meeting_point text,
  ADD COLUMN IF NOT EXISTS meeting_lat double precision,
  ADD COLUMN IF NOT EXISTS meeting_lng double precision,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_user_idempotency_key
  ON public.ride_requests(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ride_offers_user_idempotency_key
  ON public.ride_offers(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_preferred_ride(
  p_kind text,
  p_details jsonb,
  p_preferences jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result uuid;
  request_key uuid;
  vehicle text;
  meeting text;
  details_notes text;
  v_meeting_lat double precision;
  v_meeting_lng double precision;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('request', 'offer') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object' THEN RAISE EXCEPTION 'Invalid publication details'; END IF;

  request_key := nullif(p_details->>'idempotencyKey', '')::uuid;
  IF request_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_kind || ':' || request_key::text, 0));
    IF p_kind = 'request' THEN
      SELECT request_id INTO result FROM public.ride_requests
      WHERE user_id = auth.uid() AND idempotency_key = request_key;
    ELSE
      SELECT offer_id INTO result FROM public.ride_offers
      WHERE user_id = auth.uid() AND idempotency_key = request_key;
    END IF;
    IF result IS NOT NULL THEN RETURN result; END IF;
  END IF;

  meeting := nullif(btrim(p_details->>'meetingPoint'), '');
  details_notes := nullif(btrim(p_details->>'notes'), '');
  vehicle := nullif(btrim(p_details->>'vehicleDescription'), '');
  v_meeting_lat := nullif(p_details->>'meetingLat', '')::double precision;
  v_meeting_lng := nullif(p_details->>'meetingLng', '')::double precision;

  IF (v_meeting_lat IS NULL) <> (v_meeting_lng IS NULL)
     OR v_meeting_lat IS NOT NULL AND (v_meeting_lat NOT BETWEEN -90 AND 90 OR v_meeting_lng NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Invalid meeting point coordinates';
  END IF;
  IF length(coalesce(meeting, '')) > 200 OR length(coalesce(details_notes, '')) > 500
     OR length(coalesce(vehicle, '')) > 160 THEN
    RAISE EXCEPTION 'Publication details exceed the allowed length';
  END IF;

  PERFORM set_config(
    'caronaa.travel_preferences',
    CASE WHEN p_preferences IS NULL THEN '' ELSE public.validate_travel_preferences(p_preferences)::text END,
    true
  );

  IF p_kind = 'request' THEN
    result := public.create_ride_request(
      p_origin => p_details->>'origin',
      p_destination => p_details->>'destination',
      p_ride_date => (p_details->>'rideDate')::date,
      p_departure_time => (p_details->>'departureTime')::time,
      p_passenger_count => coalesce((p_details->>'passengerCount')::integer, 1),
      p_time_tolerance_minutes => coalesce((p_details->>'timeToleranceMinutes')::integer, 15),
      p_origin_lat => (p_details->>'originLat')::double precision,
      p_origin_lng => (p_details->>'originLng')::double precision,
      p_destination_lat => (p_details->>'destinationLat')::double precision,
      p_destination_lng => (p_details->>'destinationLng')::double precision,
      p_price => (p_details->>'price')::numeric
    );
    UPDATE public.ride_requests SET
      pickup_point = meeting, pickup_lat = v_meeting_lat, pickup_lng = v_meeting_lng,
      notes = details_notes, idempotency_key = request_key
    WHERE request_id = result AND user_id = auth.uid();
  ELSE
    result := public.create_ride_offer(
      p_origin => p_details->>'origin',
      p_destination => p_details->>'destination',
      p_ride_date => (p_details->>'rideDate')::date,
      p_departure_time => (p_details->>'departureTime')::time,
      p_available_seats => coalesce((p_details->>'availableSeats')::integer, 1),
      p_time_tolerance_minutes => coalesce((p_details->>'timeToleranceMinutes')::integer, 15),
      p_origin_lat => (p_details->>'originLat')::double precision,
      p_origin_lng => (p_details->>'originLng')::double precision,
      p_destination_lat => (p_details->>'destinationLat')::double precision,
      p_destination_lng => (p_details->>'destinationLng')::double precision,
      p_total_price => coalesce((p_details->>'totalPrice')::numeric, 30),
      p_passenger_gender_preference => coalesce(p_details->>'passengerGenderPreference', 'ANY')
    );
    UPDATE public.ride_offers SET
      vehicle_description = vehicle, meeting_point = meeting,
      meeting_lat = v_meeting_lat, meeting_lng = v_meeting_lng,
      notes = details_notes, idempotency_key = request_key
    WHERE offer_id = result AND user_id = auth.uid();
  END IF;

  PERFORM set_config('caronaa.travel_preferences', '', true);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_preferred_ride(text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_preferred_ride(text, jsonb, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
