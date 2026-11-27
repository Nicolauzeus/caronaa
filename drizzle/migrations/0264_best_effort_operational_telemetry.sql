-- 0264 | F03/F07/F09: analytics and optional evidence must not veto domain writes.
-- Keep domain state, acceptance, cancellation and authoritative history atomic;
-- only the secondary observation writes below are best-effort.
BEGIN;

CREATE OR REPLACE FUNCTION public.track_ride_creation_product_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $telemetry$
DECLARE
  event_kind public.product_event_name;
  prior_count integer;
  domain_ride_id text;
  domain_request_id uuid;
  domain_offer_id uuid;
  profile_name text;
  event_metadata jsonb;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'ride_requests' THEN
      event_kind := 'RIDE_REQUEST_CREATED'; profile_name := 'PASSAGEIRO';
      domain_request_id := NEW.request_id; domain_ride_id := NEW.request_id::text;
      SELECT count(*) INTO prior_count FROM public.ride_requests WHERE user_id = NEW.user_id;
      event_metadata := jsonb_build_object('requestId', NEW.request_id, 'origin', NEW.origin,
        'destination', NEW.destination, 'timeWindow', NEW.departure_time, 'profile', profile_name,
        'passengerCount', NEW.passenger_count);
    ELSE
      event_kind := 'RIDE_OFFER_CREATED'; profile_name := 'MOTORISTA';
      domain_offer_id := NEW.offer_id; domain_ride_id := NEW.offer_id::text;
      SELECT count(*) INTO prior_count FROM public.ride_offers WHERE user_id = NEW.user_id;
      event_metadata := jsonb_build_object('offerId', NEW.offer_id, 'origin', NEW.origin,
        'destination', NEW.destination, 'timeWindow', NEW.departure_time, 'profile', profile_name,
        'availableSeats', NEW.available_seats);
    END IF;

    INSERT INTO public.product_events (
      event_name, user_id, ride_id, status, source, metadata, created_at,
      request_id, offer_id, trusted_source
    ) VALUES (
      event_kind, NEW.user_id, domain_ride_id, NEW.status, 'direct', event_metadata,
      NEW.created_at, domain_request_id, domain_offer_id, true
    );
    IF prior_count > 1 THEN
      INSERT INTO public.product_events (event_name, user_id, ride_id, status, source, metadata, created_at, trusted_source)
      VALUES ('RIDE_REPEATED', NEW.user_id, domain_ride_id, NEW.status, 'direct',
        jsonb_build_object('domainEvent', event_kind, 'profile', profile_name), NEW.created_at, true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'CARONAA product event unavailable';
  END;
  RETURN NEW;
END;
$telemetry$;

CREATE OR REPLACE FUNCTION public.track_persisted_match_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $match$
DECLARE passenger_count integer; created_ride_id uuid;
BEGIN
  -- These writes represent the match itself and remain part of the transaction.
  SELECT rr.passenger_count INTO passenger_count FROM public.ride_requests rr WHERE rr.request_id = NEW.request_id;
  INSERT INTO public.rides (match_id, request_id, offer_id, passenger_user_id, driver_user_id, status, created_at)
  VALUES (NEW.match_id, NEW.request_id, NEW.offer_id, NEW.passenger_user_id, NEW.driver_user_id, 'MATCHED', NEW.created_at)
  ON CONFLICT (match_id) DO UPDATE SET match_id = EXCLUDED.match_id
  RETURNING ride_id INTO created_ride_id;
  UPDATE public.ride_matches SET ride_id = created_ride_id::text WHERE match_id = NEW.match_id;
  INSERT INTO public.ride_status_history (ride_id, from_status, to_status, created_at)
  VALUES (created_ride_id, NULL, 'MATCHED', NEW.created_at) ON CONFLICT DO NOTHING;

  -- Product analytics are secondary; their failure cannot undo a match or ride.
  BEGIN
    INSERT INTO public.product_events (
      event_name, user_id, ride_id, match_id, status, source, created_at,
      request_id, offer_id, passenger_user_id, driver_user_id, metadata, trusted_source
    ) VALUES (
      'MATCH_CREATED', NEW.passenger_user_id, created_ride_id::text, NEW.match_id::text,
      NEW.status, 'direct', NEW.created_at, NEW.request_id, NEW.offer_id,
      NEW.passenger_user_id, NEW.driver_user_id,
      jsonb_build_object('requestId', NEW.request_id, 'offerId', NEW.offer_id,
        'passengerUserId', NEW.passenger_user_id, 'driverUserId', NEW.driver_user_id,
        'rideId', created_ride_id, 'seatsOccupied', passenger_count, 'profile', 'PASSAGEIRO'), true
    ) ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'CARONAA match telemetry unavailable';
  END;
  RETURN NEW;
END;
$match$;

CREATE OR REPLACE FUNCTION public.track_ride_status_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $status$
DECLARE event_source text; event_campaign text;
BEGIN
  BEGIN
    SELECT pe.source, pe.campaign INTO event_source, event_campaign
    FROM public.product_events pe
    WHERE pe.event_name = 'MATCH_CREATED' AND pe.match_id = NEW.match_id::text
    ORDER BY pe.created_at LIMIT 1;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'COMPLETED' THEN
      INSERT INTO public.product_events (
        event_name, user_id, ride_id, match_id, status, source, campaign, created_at, request_id,
        offer_id, passenger_user_id, driver_user_id, trusted_source, metadata
      ) VALUES (
        'RIDE_COMPLETED', NEW.passenger_user_id, NEW.ride_id::text, NEW.match_id::text,
        NEW.status, coalesce(event_source, 'domain'), event_campaign, NEW.completed_at, NEW.request_id, NEW.offer_id,
        NEW.passenger_user_id, NEW.driver_user_id, true,
        jsonb_build_object('rideId', NEW.ride_id, 'matchId', NEW.match_id, 'profile', 'PASSAGEIRO')
      ) ON CONFLICT DO NOTHING;
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'IN_PROGRESS' THEN
      INSERT INTO public.product_events (
        event_name, user_id, ride_id, match_id, status, source, campaign, created_at, request_id,
        offer_id, passenger_user_id, driver_user_id, trusted_source, metadata
      ) VALUES (
        'RIDE_STARTED', NEW.driver_user_id, NEW.ride_id::text, NEW.match_id::text,
        NEW.status, coalesce(event_source, 'domain'), event_campaign, now(), NEW.request_id, NEW.offer_id,
        NEW.passenger_user_id, NEW.driver_user_id, true,
        jsonb_build_object('rideId', NEW.ride_id, 'matchId', NEW.match_id, 'profile', 'MOTORISTA')
      ) ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'CARONAA ride status telemetry unavailable';
  END;
  RETURN NEW;
END;
$status$;

CREATE OR REPLACE FUNCTION public.caronaa_capture_passenger_cancellation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $capture$
DECLARE v_service text; v_request uuid; v_passenger uuid;
BEGIN
  IF upper(NEW.status) NOT IN ('CANCELLED','CANCELED')
     OR upper(OLD.status) IN ('CANCELLED','CANCELED') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='professional_quick_rides' THEN
    v_service:='flash'; v_request:=NEW.id; v_passenger:=NEW.passenger_id;
  ELSE
    v_service:='shared'; v_request:=NEW.request_id; v_passenger:=NEW.user_id;
  END IF;
  -- Never infer an actor from the request owner on an automated/admin update.
  IF auth.uid() IS DISTINCT FROM v_passenger OR v_passenger IS NULL THEN RETURN NEW; END IF;
  BEGIN
    INSERT INTO public.caronaa_order_passenger_cancellations(service,request_id,passenger_id,previous_status)
    VALUES(v_service,v_request,v_passenger,OLD.status)
    ON CONFLICT(service,request_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'CARONAA passenger cancellation observation unavailable';
  END;
  RETURN NEW;
END;
$capture$;

COMMENT ON FUNCTION public.track_ride_creation_product_event() IS
 'Best-effort product analytics; its failure never rejects ride request or offer creation.';
COMMENT ON FUNCTION public.track_persisted_match_created() IS
 'Creates ride and authoritative status history transactionally; MATCH_CREATED product analytics are best-effort.';
COMMENT ON FUNCTION public.caronaa_capture_passenger_cancellation() IS
 'Best-effort actor evidence; its failure never rejects a valid passenger cancellation.';

NOTIFY pgrst,'reload schema';
COMMIT;
