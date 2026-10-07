-- Migration: 0027_automatic_ride_cost_splitting.sql
-- Add automatic ride cost splitting with persistence, recalculation on match/cancel,
-- and strict immutability after confirmation.

ALTER TABLE public.ride_offers
  ADD COLUMN IF NOT EXISTS total_price numeric(10,2) NOT NULL DEFAULT 30.00;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS price numeric(10,2);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS total_price numeric(10,2) NOT NULL DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS passenger_contribution numeric(10,2) NOT NULL DEFAULT 0.00;

-- Function to recalculate cost split dynamically among confirmed/active passengers
CREATE OR REPLACE FUNCTION public.recalculate_ride_cost_split(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  offer_price numeric(10,2);
  confirmed_count integer;
  contribution_val numeric(10,2);
BEGIN
  SELECT coalesce(total_price, 30.00) INTO offer_price
  FROM public.ride_offers WHERE offer_id = p_offer_id;

  IF offer_price IS NULL THEN
    offer_price := 30.00;
  END IF;

  -- Conta a quantidade de passageiros em caronas ativas (MATCHED, CONFIRMED, IN_PROGRESS, COMPLETED)
  SELECT coalesce(sum(rr.passenger_count), 0) INTO confirmed_count
  FROM public.rides r
  JOIN public.ride_requests rr ON rr.request_id = r.request_id
  WHERE r.offer_id = p_offer_id
    AND r.status IN ('MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED');

  IF confirmed_count > 0 THEN
    contribution_val := round(offer_price / confirmed_count, 2);
  ELSE
    contribution_val := 0.00;
  END IF;

  UPDATE public.rides
  SET total_price = offer_price,
      passenger_contribution = CASE
        WHEN status = 'CANCELLED' THEN 0.00
        ELSE contribution_val
      END,
      updated_at = now()
  WHERE offer_id = p_offer_id;
END;
$$;

-- Function to allow driver to update ride cost strictly before confirmation
CREATE OR REPLACE FUNCTION public.update_ride_total_cost(p_ride_id uuid, p_total_price numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ride_row public.rides%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'Invalid ride price';
  END IF;

  SELECT * INTO ride_row FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;

  IF caller <> ride_row.driver_user_id THEN
    RAISE EXCEPTION 'Only the driver can update the ride price';
  END IF;

  -- Regra estrita de imutabilidade: não permitir alteração após confirmação ou início
  IF ride_row.status NOT IN ('MATCHED') THEN
    RAISE EXCEPTION 'Cannot update ride cost after confirmation. Current status: %', ride_row.status;
  END IF;

  UPDATE public.ride_offers
  SET total_price = round(p_total_price, 2)
  WHERE offer_id = ride_row.offer_id;

  PERFORM public.recalculate_ride_cost_split(ride_row.offer_id);

  RETURN round(p_total_price, 2);
END;
$$;

-- Trigger to recalculate cost split when match is created
CREATE OR REPLACE FUNCTION public.track_persisted_match_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  passenger_count integer;
  offer_total_price numeric(10,2);
  created_ride_id uuid;
BEGIN
  SELECT rr.passenger_count INTO passenger_count FROM public.ride_requests rr WHERE rr.request_id = NEW.request_id;
  SELECT coalesce(ro.total_price, 30.00) INTO offer_total_price FROM public.ride_offers ro WHERE ro.offer_id = NEW.offer_id;

  INSERT INTO public.rides (
    match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at,
    total_price, passenger_contribution
  ) VALUES (
    NEW.match_id, NEW.request_id, NEW.offer_id, NEW.passenger_user_id, NEW.driver_user_id, 'MATCHED', NEW.created_at,
    coalesce(offer_total_price, 30.00), coalesce(offer_total_price, 30.00)
  )
  ON CONFLICT (match_id) DO UPDATE SET match_id = EXCLUDED.match_id
  RETURNING ride_id INTO created_ride_id;

  UPDATE public.ride_matches SET ride_id = created_ride_id::text WHERE match_id = NEW.match_id;

  PERFORM public.recalculate_ride_cost_split(NEW.offer_id);

  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, created_at)
  VALUES (created_ride_id, NULL, 'MATCHED', NEW.created_at)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.product_events (
    event_name, user_id, ride_id, match_id, status, source, created_at,
    request_id, offer_id, passenger_user_id, driver_user_id, metadata, trusted_source
  ) VALUES (
    'MATCH_CREATED', NEW.passenger_user_id, created_ride_id::text, NEW.match_id::text,
    NEW.status, 'direct', NEW.created_at, NEW.request_id, NEW.offer_id,
    NEW.passenger_user_id, NEW.driver_user_id,
    jsonb_build_object('requestId', NEW.request_id, 'offerId', NEW.offer_id, 'passengerUserId', NEW.passenger_user_id, 'driverUserId', NEW.driver_user_id, 'rideId', created_ride_id, 'seatsOccupied', passenger_count), true
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Update transition_ride_status to trigger recalculation on cancellation
CREATE OR REPLACE FUNCTION public.transition_ride_status(p_ride_id uuid, p_next_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ride_row public.rides%ROWTYPE;
  caller uuid := auth.uid();
  valid_transition boolean := false;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO ride_row FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR caller NOT IN (ride_row.passenger_user_id, ride_row.driver_user_id) THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;

  IF p_next_status = 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Valide o PIN de embarque para iniciar a viagem.';
  END IF;

  -- Preserve safe retries without reopening terminal rides or bypassing boarding.
  IF ride_row.status = p_next_status AND p_next_status IN ('CONFIRMED', 'CANCELLED') THEN
    RETURN p_next_status;
  END IF;

  valid_transition :=
    (ride_row.status = 'MATCHED' AND p_next_status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW')) OR
    (ride_row.status = 'CONFIRMED' AND p_next_status IN ('IN_PROGRESS', 'CANCELLED', 'NO_SHOW')) OR
    (ride_row.status = 'IN_PROGRESS' AND p_next_status IN ('CANCELLED', 'NO_SHOW'));

  IF p_next_status = 'COMPLETED' AND ride_row.status = 'IN_PROGRESS' THEN
    INSERT INTO public.ride_completion_confirmations (ride_id, user_id)
    VALUES (p_ride_id, caller) ON CONFLICT (ride_id, user_id) DO NOTHING;

    IF (SELECT count(*) FROM public.ride_completion_confirmations WHERE ride_id = p_ride_id) < 2 THEN
      RETURN 'AWAITING_OTHER_PARTICIPANT';
    END IF;
    valid_transition := true;
  END IF;

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid ride transition: % -> %', ride_row.status, p_next_status;
  END IF;

  UPDATE public.rides
  SET status = p_next_status,
      updated_at = now(),
      completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN now() ELSE NULL END
  WHERE ride_id = p_ride_id;

  UPDATE public.ride_matches
  SET status = CASE
        WHEN p_next_status = 'COMPLETED' THEN 'completed'
        WHEN p_next_status IN ('CANCELLED', 'NO_SHOW') THEN 'cancelled'
        ELSE status
      END
  WHERE match_id = ride_row.match_id;

  -- Recalcula a divisão de custos se a carona foi cancelada
  IF p_next_status IN ('CANCELLED', 'NO_SHOW') THEN
    PERFORM public.recalculate_ride_cost_split(ride_row.offer_id);
  END IF;

  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, actor_user_id)
  VALUES (p_ride_id, ride_row.status, p_next_status, caller);

  RETURN p_next_status;
END;
$$;

-- Update create_ride_offer to accept optional p_total_price
CREATE OR REPLACE FUNCTION public.create_ride_offer(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_available_seats integer,
  p_time_tolerance_minutes integer DEFAULT 15,
  p_origin_lat double precision DEFAULT NULL, p_origin_lng double precision DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL, p_destination_lng double precision DEFAULT NULL,
  p_total_price numeric DEFAULT 30.00
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_offer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_offers (
    user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
    ride_date, departure_time, available_seats, seats_remaining, time_tolerance_minutes, total_price
  ) VALUES (
    auth.uid(), btrim(p_origin), btrim(p_destination), p_origin_lat, p_origin_lng,
    p_destination_lat, p_destination_lng, p_ride_date, p_departure_time,
    p_available_seats, p_available_seats, coalesce(p_time_tolerance_minutes, 15),
    coalesce(round(p_total_price, 2), 30.00)
  ) RETURNING offer_id INTO created_offer_id;
  RETURN created_offer_id;
END;
$$;

-- Update create_ride_request to accept optional p_price
CREATE OR REPLACE FUNCTION public.create_ride_request(
  p_origin text, p_destination text, p_ride_date date,
  p_departure_time time, p_passenger_count integer,
  p_time_tolerance_minutes integer DEFAULT 15,
  p_origin_lat double precision DEFAULT NULL, p_origin_lng double precision DEFAULT NULL,
  p_destination_lat double precision DEFAULT NULL, p_destination_lng double precision DEFAULT NULL,
  p_price numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.ride_requests (
    user_id, origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
    ride_date, departure_time, passenger_count, time_tolerance_minutes, price
  ) VALUES (
    auth.uid(), btrim(p_origin), btrim(p_destination), p_origin_lat, p_origin_lng,
    p_destination_lat, p_destination_lng, p_ride_date, p_departure_time,
    p_passenger_count, coalesce(p_time_tolerance_minutes, 15),
    CASE WHEN p_price IS NOT NULL THEN round(p_price, 2) ELSE NULL END
  )
  RETURNING request_id INTO created_request_id;
  RETURN created_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_ride_cost_split(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ride_total_cost(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text, text, date, time, integer, integer, double precision, double precision, double precision, double precision, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_request(text, text, date, time, integer, integer, double precision, double precision, double precision, double precision, numeric) TO authenticated;
