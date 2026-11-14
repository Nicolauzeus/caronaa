-- F07: realtime queue invalidation without exposing rider data or exact GPS.
-- Publication must only expose the municipality and a version timestamp.
BEGIN;

CREATE TABLE IF NOT EXISTS public.caronaa_quick_queue_events (
 municipality text PRIMARY KEY REFERENCES public.caronaa_service_municipalities(municipality),
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caronaa_quick_queue_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_quick_queue_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.caronaa_quick_queue_events TO authenticated;

-- SECURITY DEFINER is required because driver GPS and authorization tables
-- are not directly readable through client RLS, by design.
CREATE OR REPLACE FUNCTION public.caronaa_quick_event_allowed(p_municipality text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $allowed$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations a
    JOIN public.professional_presence p ON p.user_id=a.user_id
    JOIN public.professional_driver_locations l ON l.user_id=a.user_id
    JOIN public.professional_service_regions r ON r.municipality=l.municipality
    WHERE a.user_id=auth.uid() AND a.approved
      AND p.is_available AND p.last_seen_at>now()-interval '90 seconds'
      AND l.updated_at>now()-interval '90 seconds'
      AND l.municipality=p_municipality
      AND r.dispatch_enabled AND r.public_discovery_enabled
 );
$allowed$;
REVOKE ALL ON FUNCTION public.caronaa_quick_event_allowed(text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_event_allowed(text)
  TO authenticated;

DROP POLICY IF EXISTS quick_queue_events_verified_driver_select
  ON public.caronaa_quick_queue_events;
CREATE POLICY quick_queue_events_verified_driver_select
ON public.caronaa_quick_queue_events FOR SELECT TO authenticated
USING(public.caronaa_quick_event_allowed(municipality));

CREATE OR REPLACE FUNCTION public.notify_caronaa_quick_queue_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $event$
BEGIN
  IF NEW.municipality IS NOT NULL THEN
    INSERT INTO public.caronaa_quick_queue_events(municipality,changed_at)
      VALUES(NEW.municipality,clock_timestamp())
    ON CONFLICT(municipality) DO UPDATE
      SET changed_at=EXCLUDED.changed_at;
  END IF;
  RETURN NEW;
END;
$event$;
REVOKE ALL ON FUNCTION public.notify_caronaa_quick_queue_change()
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS caronaa_quick_queue_realtime_event
  ON public.professional_quick_rides;
CREATE TRIGGER caronaa_quick_queue_realtime_event
  AFTER INSERT OR UPDATE OF status,driver_id ON public.professional_quick_rides
  FOR EACH ROW EXECUTE FUNCTION public.notify_caronaa_quick_queue_change();

-- Repeatable on a Supabase-managed database. The table is intentionally
-- separate from professional_quick_rides (which has no client SELECT RLS).
DO $publication$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime'
        AND schemaname='public' AND tablename='caronaa_quick_queue_events'
    ) THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.caronaa_quick_queue_events;
 END IF;
END;
$publication$;
COMMIT;
