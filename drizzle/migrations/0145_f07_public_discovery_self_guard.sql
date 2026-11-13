-- F07 public-discovery security repair after Lovable's 0123_homologacao
-- removed the self-exclusion in the *PUBLIC* RPC.
-- The approved self-view remains in the separate, service-role-only 0144
-- diagnostic RPC and private homologation server. Apply this LAST if 0123
-- was already applied after migration 0142.
BEGIN;

CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(
  p_municipality text, p_vehicle text
)
RETURNS TABLE (
  driver_key text,lat double precision,lng double precision,seen_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $discover_public$
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
    AND l.user_id<>auth.uid()
  ORDER BY l.updated_at DESC LIMIT 100;
END
$discover_public$;

REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  TO authenticated;
COMMENT ON FUNCTION public.discover_caronaa_quick_drivers(text,text) IS
  'Public CAR/MOTO discovery excludes the viewer; test self-visibility is isolated in caronaa_f07_test_self_radar.';
NOTIFY pgrst,'reload schema';
COMMIT;
