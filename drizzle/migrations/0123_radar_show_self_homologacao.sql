CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(p_municipality text, p_vehicle text)
 RETURNS TABLE(driver_key text, lat double precision, lng double precision, seen_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria' USING ERRCODE='42501';
  END IF;
  IF p_vehicle NOT IN ('CAR','MOTO') THEN RETURN; END IF;
  -- Homologacao: o proprio motorista tambem aparece para validar com uma conta.
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
  ORDER BY l.updated_at DESC LIMIT 100;
END
$function$;