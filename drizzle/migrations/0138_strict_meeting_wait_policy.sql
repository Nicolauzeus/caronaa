-- CARONAA F03/F05: strictly controlled pickup waiting, no F07 changes.
BEGIN;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS strict_pickup_arrived_at timestamptz;

-- Arrival is stamped exclusively by the database on the existing driver stage transition.
CREATE OR REPLACE FUNCTION public.stamp_strict_pickup_arrival()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.strict_pickup_arrived_at IS DISTINCT FROM OLD.strict_pickup_arrived_at THEN
    RAISE EXCEPTION 'Arrival timestamp is server-managed';
  END IF;
  IF OLD.transit_stage IS DISTINCT FROM 'AWAITING_BOARDING'
     AND NEW.transit_stage = 'AWAITING_BOARDING'
     AND NEW.status = 'CONFIRMED'
     AND NEW.boarded_at IS NULL
     AND EXISTS (SELECT 1 FROM public.ride_offers o
                 WHERE o.offer_id = NEW.offer_id AND o.allow_detours = false)
  THEN
    IF auth.uid() IS DISTINCT FROM NEW.driver_user_id THEN
      RAISE EXCEPTION 'Only the driver can report arrival';
    END IF;
    NEW.strict_pickup_arrived_at := coalesce(OLD.strict_pickup_arrived_at, clock_timestamp());
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.stamp_strict_pickup_arrival() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS rides_stamp_strict_pickup_arrival ON public.rides;
CREATE TRIGGER rides_stamp_strict_pickup_arrival
  BEFORE UPDATE ON public.rides FOR EACH ROW
  EXECUTE FUNCTION public.stamp_strict_pickup_arrival();

-- Prevent bypass via the historical transition_ride_status RPC.
CREATE OR REPLACE FUNCTION public.guard_strict_pickup_no_show()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'NO_SHOW' AND OLD.status IS DISTINCT FROM 'NO_SHOW'
     AND EXISTS (SELECT 1 FROM public.ride_offers o
                 WHERE o.offer_id = OLD.offer_id AND o.allow_detours = false)
  THEN
    IF auth.uid() IS DISTINCT FROM OLD.driver_user_id
       OR OLD.status IS DISTINCT FROM 'CONFIRMED'
       OR OLD.boarded_at IS NOT NULL
       OR OLD.transit_stage IS DISTINCT FROM 'AWAITING_BOARDING'
       OR OLD.strict_pickup_arrived_at IS NULL
       OR OLD.strict_pickup_arrived_at > clock_timestamp() - interval '8 minutes' THEN
      RAISE EXCEPTION 'Strict pickup no-show not authorized or tolerance not elapsed';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_strict_pickup_no_show() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS rides_guard_strict_pickup_no_show ON public.rides;
CREATE TRIGGER rides_guard_strict_pickup_no_show
  BEFORE UPDATE OF status ON public.rides FOR EACH ROW
  EXECUTE FUNCTION public.guard_strict_pickup_no_show();

-- Participant-only read: no public radar exposure of the arrival timestamp.
CREATE OR REPLACE FUNCTION public.get_strict_pickup_wait(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.rides%ROWTYPE; strict_route boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id;
  IF NOT FOUND OR auth.uid() NOT IN (r.driver_user_id, r.passenger_user_id)
    THEN RAISE EXCEPTION 'Ride not found'; END IF;
  SELECT coalesce(o.allow_detours = false, false) INTO strict_route
  FROM public.ride_offers o WHERE o.offer_id = r.offer_id;
  RETURN jsonb_build_object(
    'strict', coalesce(strict_route, false),
    'arrivedAt', CASE WHEN strict_route THEN r.strict_pickup_arrived_at ELSE NULL END,
    'status', r.status,
    'boarded', r.boarded_at IS NOT NULL,
    'canMarkNoShow', coalesce(strict_route, false)
      AND auth.uid() = r.driver_user_id AND r.status = 'CONFIRMED'
      AND r.transit_stage = 'AWAITING_BOARDING' AND r.boarded_at IS NULL
      AND r.strict_pickup_arrived_at IS NOT NULL
      AND r.strict_pickup_arrived_at <= clock_timestamp() - interval '8 minutes'
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_strict_pickup_wait(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_strict_pickup_wait(uuid) TO authenticated;

-- Lock the row and reuse the existing transition RPC; its triggers release seats,
-- notify counterpart, clean live GPS and maintain lifecycle history.
CREATE OR REPLACE FUNCTION public.mark_strict_pickup_no_show(p_ride_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.rides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM public.rides WHERE ride_id = p_ride_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS DISTINCT FROM r.driver_user_id
     THEN RAISE EXCEPTION 'Driver authorization required'; END IF;
  IF r.status = 'NO_SHOW' THEN RETURN 'NO_SHOW'; END IF;
  IF r.status <> 'CONFIRMED' OR r.boarded_at IS NOT NULL
     OR r.transit_stage <> 'AWAITING_BOARDING'
     OR r.strict_pickup_arrived_at IS NULL
     OR r.strict_pickup_arrived_at > clock_timestamp() - interval '8 minutes'
     OR NOT EXISTS (SELECT 1 FROM public.ride_offers o
                    WHERE o.offer_id = r.offer_id AND o.allow_detours = false)
  THEN RAISE EXCEPTION 'Waiting tolerance not met'; END IF;
  RETURN public.transition_ride_status(p_ride_id, 'NO_SHOW');
END; $$;
REVOKE ALL ON FUNCTION public.mark_strict_pickup_no_show(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_strict_pickup_no_show(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
