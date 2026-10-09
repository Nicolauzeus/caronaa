-- Track user-visible edits to open publications without treating refreshes,
-- seat counters, polling, or live-location writes as new publication activity.
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.ride_offers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.ride_requests SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.ride_offers SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.ride_requests
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.ride_offers
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_ride_publication_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'ride_requests' THEN
    IF (
      NEW.origin IS DISTINCT FROM OLD.origin OR
      NEW.destination IS DISTINCT FROM OLD.destination OR
      NEW.origin_lat IS DISTINCT FROM OLD.origin_lat OR
      NEW.origin_lng IS DISTINCT FROM OLD.origin_lng OR
      NEW.destination_lat IS DISTINCT FROM OLD.destination_lat OR
      NEW.destination_lng IS DISTINCT FROM OLD.destination_lng OR
      NEW.pickup_point IS DISTINCT FROM OLD.pickup_point OR
      NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat OR
      NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng OR
      NEW.ride_date IS DISTINCT FROM OLD.ride_date OR
      NEW.departure_time IS DISTINCT FROM OLD.departure_time OR
      NEW.passenger_count IS DISTINCT FROM OLD.passenger_count OR
      NEW.time_tolerance_minutes IS DISTINCT FROM OLD.time_tolerance_minutes OR
      NEW.notes IS DISTINCT FROM OLD.notes OR
      NEW.travel_preferences IS DISTINCT FROM OLD.travel_preferences
    ) THEN
      NEW.updated_at := clock_timestamp();
    END IF;
  ELSIF TG_TABLE_NAME = 'ride_offers' THEN
    IF (
      NEW.origin IS DISTINCT FROM OLD.origin OR
      NEW.destination IS DISTINCT FROM OLD.destination OR
      NEW.origin_lat IS DISTINCT FROM OLD.origin_lat OR
      NEW.origin_lng IS DISTINCT FROM OLD.origin_lng OR
      NEW.destination_lat IS DISTINCT FROM OLD.destination_lat OR
      NEW.destination_lng IS DISTINCT FROM OLD.destination_lng OR
      NEW.meeting_point IS DISTINCT FROM OLD.meeting_point OR
      NEW.meeting_lat IS DISTINCT FROM OLD.meeting_lat OR
      NEW.meeting_lng IS DISTINCT FROM OLD.meeting_lng OR
      NEW.ride_date IS DISTINCT FROM OLD.ride_date OR
      NEW.departure_time IS DISTINCT FROM OLD.departure_time OR
      NEW.available_seats IS DISTINCT FROM OLD.available_seats OR
      NEW.time_tolerance_minutes IS DISTINCT FROM OLD.time_tolerance_minutes OR
      NEW.vehicle_description IS DISTINCT FROM OLD.vehicle_description OR
      NEW.notes IS DISTINCT FROM OLD.notes OR
      NEW.travel_preferences IS DISTINCT FROM OLD.travel_preferences OR
      NEW.route_distance_km IS DISTINCT FROM OLD.route_distance_km OR
      NEW.passenger_price IS DISTINCT FROM OLD.passenger_price OR
      NEW.accepts_quoted_fares IS DISTINCT FROM OLD.accepts_quoted_fares
    ) THEN
      NEW.updated_at := clock_timestamp();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_ride_publication_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ride_requests_relevant_edit_at ON public.ride_requests;
CREATE TRIGGER ride_requests_relevant_edit_at
  BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_ride_publication_updated_at();
DROP TRIGGER IF EXISTS ride_offers_relevant_edit_at ON public.ride_offers;
CREATE TRIGGER ride_offers_relevant_edit_at
  BEFORE UPDATE ON public.ride_offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_ride_publication_updated_at();