-- F07: make the public radar position approximate but geographically useful.
-- Existing 0.01 degree rounding can displace a nearby driver by ~1 km.
-- 0.001 degree rounding keeps approximately 100 m resolution; never expose
-- the driver's precise device fix to unassigned passengers.
-- All existing authorization, freshness, platform-debt and self-visibility
-- checks are retained from the radius-discovery RPC.
CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(
  p_lat double precision,
  p_lng double precision,
  p_vehicle text,
  p_radius_km double precision DEFAULT 15.0
)
RETURNS TABLE (
  driver_key text,
  lat double precision,
  lng double precision,
  seen_at timestamptz,
  distance_km double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $discover_radius$
DECLARE
  v_radius double precision := least(greatest(coalesce(p_radius_km, 15.0), 1.0), 30.0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria' USING ERRCODE='42501';
  END IF;
  IF p_vehicle NOT IN ('CAR','MOTO') THEN RETURN; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH c AS (
    SELECT
      md5(l.user_id::text || current_date::text) AS d_key,
      round(l.lat::numeric, 3)::double precision AS d_lat,
      round(l.lng::numeric, 3)::double precision AS d_lng,
      l.updated_at AS d_seen_at,
      (6371.0 * acos(least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(l.lat))
      )))) AS d_dist
    FROM public.professional_driver_locations l
    JOIN public.professional_presence p ON p.user_id = l.user_id
    JOIN public.professional_driver_authorizations a ON a.user_id = l.user_id
    JOIN public.professional_service_regions r ON r.municipality = l.municipality
    WHERE r.public_discovery_enabled
      AND a.approved AND a.vehicle_type = p_vehicle
      AND public.driver_platform_access_allowed(l.user_id)
      AND p.is_available
      AND p.last_seen_at > now() - interval '90 seconds'
      AND l.updated_at > now() - interval '90 seconds'
      AND l.user_id <> auth.uid()
  )
  SELECT d_key, d_lat, d_lng, d_seen_at, round(d_dist::numeric, 1)::double precision
  FROM c WHERE d_dist <= v_radius
  ORDER BY d_dist ASC
  LIMIT 50;
END;
$discover_radius$;

REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(double precision, double precision, text, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(double precision, double precision, text, double precision) TO authenticated;
COMMENT ON FUNCTION public.discover_caronaa_quick_drivers(double precision, double precision, text, double precision) IS
  'F07 radius discovery: approved, fee-cleared, fresh (90s) drivers in public-discovery regions within radius of the passenger pickup; excludes viewer; approximately 100m coordinates (3 decimal places), not precise live GPS.';
NOTIFY pgrst, 'reload schema';