-- 0144 | F07: diagnostic-only SELF radar and simulated markers.
-- IMPORTANT: no changes to the public discovery function or municipal dispatch.
-- Synthetic coordinates NEVER enter professional_driver_locations or live
-- dispatch, and are visible only to their authenticated owner in a separate
-- preview on the private homologation server.
BEGIN;

CREATE TABLE IF NOT EXISTS public.caronaa_f07_simulated_driver_positions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text NOT NULL REFERENCES public.professional_service_regions(municipality),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('CAR','MOTO')),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT f07_simulated_short_lived CHECK(expires_at > updated_at)
);
ALTER TABLE public.caronaa_f07_simulated_driver_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_f07_simulated_driver_positions
  FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.caronaa_f07_simulated_driver_positions TO service_role;

-- Service-only diagnostic function: validated SERVER account id, no exposure
-- to a different user and no mixing of simulation with commercial discovery.
-- It can return a real verified fix (90s) or an explicit test marker (15 min).
-- Both must be the viewer's own approved, currently available vehicle.
CREATE OR REPLACE FUNCTION public.caronaa_f07_test_self_radar(
  p_user_id uuid, p_municipality text, p_vehicle text
)
RETURNS TABLE (
  driver_key text, lat double precision, lng double precision,
  seen_at timestamptz, is_self boolean, simulated boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $self$
BEGIN
  IF p_user_id IS NULL OR p_vehicle NOT IN ('CAR','MOTO')
      OR p_municipality IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_f07_pilot_control c
    WHERE c.id=true AND c.enabled=true
      AND c.expires_at IS NOT NULL AND c.expires_at>now()
  ) THEN RETURN; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.professional_driver_authorizations a
    JOIN public.professional_presence p ON p.user_id=a.user_id
    WHERE a.user_id=p_user_id AND a.approved AND a.vehicle_type=p_vehicle
      AND p.is_available AND p.last_seen_at>now()-interval '90 seconds'
      AND public.driver_platform_access_allowed(a.user_id)
  ) THEN RETURN; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.professional_service_regions r
    WHERE r.municipality=btrim(p_municipality)
      AND r.public_discovery_enabled
  ) THEN RETURN; END IF;

  -- Real position takes precedence, but never expose precise GPS even to
  -- the debug map: the same rounded accuracy as public discovery.
  RETURN QUERY
  SELECT md5(l.user_id::text||current_date::text),
    round(l.lat::numeric,2)::double precision,
    round(l.lng::numeric,2)::double precision,
    l.updated_at, true, false
  FROM public.professional_driver_locations l
  JOIN public.professional_presence p ON p.user_id=l.user_id
  WHERE l.user_id=p_user_id AND l.municipality=btrim(p_municipality)
    AND p.municipality=l.municipality
    AND p.last_seen_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds';
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT md5(s.user_id::text||'SIMULATED'||current_date::text),
    s.lat,s.lng,s.updated_at,true,true
  FROM public.caronaa_f07_simulated_driver_positions s
  WHERE s.user_id=p_user_id
    AND s.municipality=btrim(p_municipality)
    AND s.vehicle_type=p_vehicle AND s.expires_at>now()
  LIMIT 1;
END
$self$;
REVOKE ALL ON FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text)
  TO service_role;

COMMENT ON TABLE public.caronaa_f07_simulated_driver_positions IS
  'TEST-ONLY. Never feed synthetic positions into production GPS, driver queue, commercial dispatch or route ETA.';
COMMENT ON FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text) IS
  'Service-role diagnostic of own verified or simulated pin on an isolated pilot server.';
NOTIFY pgrst,'reload schema';
COMMIT;
