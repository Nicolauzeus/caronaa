-- 0145 | F07: restore self exclusion on public discovery after the parallel
-- Lovable 0123_radar_show_self_homologacao.sql migration. The self marker
-- belongs ONLY in caronaa_f07_test_self_radar, accessible to service_role
-- behind the private homologation backend dual gate (migration 0144).
-- Apply after both 0123_radar_show_self_homologacao and 0142.
BEGIN;
CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(
  p_municipality text, p_vehicle text
)
RETURNS TABLE(
  driver_key text, lat double precision, lng double precision, seen_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $discover$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria' USING ERRCODE='42501';
  END IF;
  IF p_vehicle NOT IN ('CAR','MOTO') THEN RETURN; END IF;
  RETURN QUERY
  SELECT md5(l.user_id::text||current_date::text),
    round(l.lat::numeric,2)::double precision,
    round(l.lng::numeric,2)::double precision,l.updated_at
  FROM public.professional_driver_locations l
  JOIN public.professional_presence p ON p.user_id=l.user_id
  JOIN public.professional_driver_authorizations a ON a.user_id=l.user_id
  JOIN public.professional_service_regions r ON r.municipality=l.municipality
  WHERE l.municipality=btrim(p_municipality)
    AND r.public_discovery_enabled
    AND a.approved AND a.vehicle_type=p_vehicle
    AND public.driver_platform_access_allowed(l.user_id)
    AND p.is_available AND p.municipality=l.municipality
    AND p.last_seen_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
    -- Public radar only: never silently expose the viewer as another driver.
    AND l.user_id<>auth.uid()
  ORDER BY l.updated_at DESC LIMIT 100;
END
$discover$;
REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  TO authenticated;
COMMENT ON FUNCTION public.discover_caronaa_quick_drivers(text,text) IS
  'Public authenticated approximate radar, exact vehicle match, no self; staging-only own marker uses separate service-role RPC.';
NOTIFY pgrst,'reload schema';
COMMIT;
