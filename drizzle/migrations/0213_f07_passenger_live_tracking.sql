-- 0213 | Live tracking for assigned passenger + driver only.
-- Small Realtime signals contain NO coordinates, identities or vehicle data.
-- Precise positions remain exclusively in the participant-scoped map RPC.
BEGIN;

CREATE TABLE IF NOT EXISTS public.caronaa_quick_position_updates (
  ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caronaa_quick_position_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.caronaa_quick_position_updates
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.caronaa_quick_position_updates TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_quick_position_update(p_ride_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $access$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.professional_quick_rides q
    WHERE q.id=p_ride_id
      AND (q.passenger_id=auth.uid() OR q.driver_id=auth.uid())
      AND q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  );
$access$;
REVOKE ALL ON FUNCTION public.can_read_quick_position_update(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_quick_position_update(uuid)
  TO authenticated;
DROP POLICY IF EXISTS quick_position_participants_read
  ON public.caronaa_quick_position_updates;
CREATE POLICY quick_position_participants_read
  ON public.caronaa_quick_position_updates
  FOR SELECT TO authenticated
  USING (public.can_read_quick_position_update(ride_id));

-- A position UPDATE emits only the fact that an active ride has a new fix.
-- This never replicates driver coordinates to other customers or the radar.
CREATE OR REPLACE FUNCTION public.signal_assigned_quick_ride_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $signal$
DECLARE v_ride_id uuid;
BEGIN
  SELECT q.id INTO v_ride_id
  FROM public.professional_quick_rides q
  WHERE q.driver_id=NEW.user_id
    AND q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  ORDER BY q.accepted_at DESC
  LIMIT 1;
  IF v_ride_id IS NOT NULL THEN
    INSERT INTO public.caronaa_quick_position_updates(ride_id,changed_at)
      VALUES(v_ride_id,clock_timestamp())
    ON CONFLICT (ride_id) DO UPDATE
      SET changed_at=EXCLUDED.changed_at;
  END IF;
  RETURN NEW;
END
$signal$;
REVOKE ALL ON FUNCTION public.signal_assigned_quick_ride_position()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS quick_position_signal_on_gps
  ON public.professional_driver_locations;
CREATE TRIGGER quick_position_signal_on_gps
  AFTER INSERT OR UPDATE OF lat,lng,updated_at
  ON public.professional_driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.signal_assigned_quick_ride_position();

-- Do not leave a position signal attached to a finished ride.
CREATE OR REPLACE FUNCTION public.clear_assigned_quick_ride_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $clear$
BEGIN
  IF OLD.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
    AND NEW.status NOT IN ('ACCEPTED','ARRIVED','IN_PROGRESS') THEN
    DELETE FROM public.caronaa_quick_position_updates WHERE ride_id=NEW.id;
  END IF;
  RETURN NEW;
END
$clear$;
REVOKE ALL ON FUNCTION public.clear_assigned_quick_ride_position()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS quick_position_signal_on_completion
  ON public.professional_quick_rides;
CREATE TRIGGER quick_position_signal_on_completion
  AFTER UPDATE OF status ON public.professional_quick_rides
  FOR EACH ROW EXECUTE FUNCTION public.clear_assigned_quick_ride_position();

-- Lightweight updates between official geocoding validations.
-- An existing recently verified municipal fix + authenticated active trip
-- are mandatory. The existing validated v2 SQL enforces GPS quality, speed
-- plausibility, driver authorization, presence and service coverage.
CREATE OR REPLACE FUNCTION public.publish_active_quick_ride_gps(
  p_ride_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_sampled_at_ms bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE
  v_driver uuid := auth.uid();
  v_current public.professional_driver_locations%ROWTYPE;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_quick_rides q
    WHERE q.id=p_ride_id AND q.driver_id=v_driver
      AND q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_RIDE_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_current
  FROM public.professional_driver_locations l
  WHERE l.user_id=v_driver
    AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
  FOR UPDATE;
  IF NOT FOUND THEN
    -- The full municipality-verifying GPS publication must establish the
    -- official position before faster updates are accepted.
    RETURN false;
  END IF;
  IF v_current.updated_at>now()-interval '6 seconds' THEN
    RETURN false;
  END IF;
  RETURN public.publish_verified_professional_position_v2(
    v_driver,p_lat,p_lng,p_accuracy_m,v_current.municipality,p_sampled_at_ms
  );
END
$live$;
REVOKE ALL ON FUNCTION public.publish_active_quick_ride_gps(
  uuid,double precision,double precision,double precision,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_active_quick_ride_gps(
  uuid,double precision,double precision,double precision,bigint)
  TO authenticated;

-- Idempotent Supabase Realtime publication; no private GPS table is added.
DO $publication$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS(
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public'
        AND tablename='caronaa_quick_position_updates'
    ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.caronaa_quick_position_updates;
  END IF;
END
$publication$;

COMMENT ON TABLE public.caronaa_quick_position_updates IS
  'Participant-scoped signal for new official driver GPS: never contains precise coordinates.';
COMMENT ON FUNCTION public.publish_active_quick_ride_gps(
  uuid,double precision,double precision,double precision,bigint) IS
  'Active driver only: publish trusted GPS between full city validations; v2 validates precision and movement.';
NOTIFY pgrst,'reload schema';
COMMIT;
