-- F07 / phase 1: consented, privacy-preserving professional location.
-- No commercial rides are enabled by this migration.
CREATE TABLE IF NOT EXISTS public.professional_service_regions (
  municipality text PRIMARY KEY,
  public_discovery_enabled boolean NOT NULL DEFAULT false,
  dispatch_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT region_name_nonempty CHECK (length(btrim(municipality)) BETWEEN 2 AND 120),
  CONSTRAINT dispatch_requires_discovery CHECK (NOT dispatch_enabled OR public_discovery_enabled)
);
CREATE TABLE IF NOT EXISTS public.professional_driver_authorizations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.professional_driver_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality text NOT NULL REFERENCES public.professional_service_regions(municipality),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m >= 0 AND accuracy_m <= 5000),
  sampled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS professional_driver_locations_recent_idx
  ON public.professional_driver_locations(municipality, updated_at DESC);
ALTER TABLE public.professional_service_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_driver_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_driver_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_service_regions, public.professional_driver_authorizations, public.professional_driver_locations FROM PUBLIC, anon, authenticated;
-- All access is via narrowly scoped SECURITY DEFINER RPCs; no direct location SELECT.
CREATE OR REPLACE FUNCTION public.professional_location_opt_in(
  p_lat double precision, p_lng double precision, p_accuracy_m double precision,
  p_municipality text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_region text := btrim(p_municipality);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT (p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180
     AND p_accuracy_m BETWEEN 0 AND 5000)
     OR p_lat IS NULL OR p_lng IS NULL OR p_accuracy_m IS NULL THEN
    RAISE EXCEPTION 'Invalid GPS coordinate';
  END IF;
  -- Explicitly approved driver and enabled region, never presence alone.
  IF NOT EXISTS (SELECT 1 FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved) THEN
    RAISE EXCEPTION 'Driver not approved for professional location' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.professional_service_regions r
    WHERE r.municipality=v_region AND r.public_discovery_enabled) THEN
    RAISE EXCEPTION 'Professional discovery not available in this region' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.professional_presence p
    WHERE p.user_id=v_uid AND p.is_available AND p.last_seen_at > now()-interval '90 seconds'
    AND p.municipality=v_region) THEN
    RAISE EXCEPTION 'Set professional availability online first' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.professional_driver_locations(user_id,municipality,lat,lng,accuracy_m,sampled_at,updated_at)
  VALUES(v_uid,v_region,p_lat,p_lng,p_accuracy_m,now(),now())
  ON CONFLICT(user_id) DO UPDATE SET
    municipality=EXCLUDED.municipality,lat=EXCLUDED.lat,lng=EXCLUDED.lng,
    accuracy_m=EXCLUDED.accuracy_m,sampled_at=now(),updated_at=now();
  RETURN true;
END;$$;
CREATE OR REPLACE FUNCTION public.professional_location_stop()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  DELETE FROM public.professional_driver_locations WHERE user_id=auth.uid();
END;$$;
CREATE OR REPLACE FUNCTION public.discover_approximate_professional_drivers(p_municipality text)
RETURNS TABLE(driver_key text, lat double precision, lng double precision, seen_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT md5(l.user_id::text || current_date::text), round(l.lat::numeric,2)::double precision,
     round(l.lng::numeric,2)::double precision, l.updated_at
  FROM public.professional_driver_locations l
  JOIN public.professional_presence p ON p.user_id=l.user_id
  JOIN public.professional_driver_authorizations a ON a.user_id=l.user_id
  JOIN public.professional_service_regions r ON r.municipality=l.municipality
  WHERE l.municipality=btrim(p_municipality) AND r.public_discovery_enabled
    AND a.approved AND p.is_available AND p.municipality=l.municipality
    AND p.last_seen_at > now()-interval '90 seconds'
    AND l.updated_at > now()-interval '90 seconds'
    AND l.user_id <> auth.uid()
  ORDER BY l.updated_at DESC LIMIT 150;
END;$$;
REVOKE ALL ON FUNCTION public.professional_location_opt_in(double precision,double precision,double precision,text),
  public.professional_location_stop(), public.discover_approximate_professional_drivers(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.professional_location_opt_in(double precision,double precision,double precision,text),
  public.professional_location_stop(), public.discover_approximate_professional_drivers(text) TO authenticated;
COMMENT ON TABLE public.professional_service_regions IS 'Admin-configured region gates, default disabled. Never auto-enable professional commercial service.';
COMMENT ON FUNCTION public.discover_approximate_professional_drivers(text) IS 'Approximate 0.01 degree coordinates of opted-in, approved, recently online drivers only. No exact location or stable user ID.';
NOTIFY pgrst, 'reload schema';
