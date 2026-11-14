-- 0146 | F07: reparar funcao GPS de producao sem editar migrations aplicadas.
-- Reaplica a definicao corrigida (now() em vez de identificador now) e
-- preserva gate de municipio GPS real, autorizacao, financeira e presenca.
-- Aplicar via fluxo de migrations no banco de destino (backup previamente).
BEGIN;
CREATE OR REPLACE FUNCTION public.publish_verified_professional_position(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_municipality text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $publish$
DECLARE v_online boolean; v_city text := btrim(coalesce(p_municipality,''));
BEGIN
  IF p_user_id IS NULL OR p_lat IS NULL OR p_lng IS NULL OR p_accuracy_m IS NULL
      OR NOT (p_lat BETWEEN -90 AND 90)
      OR NOT (p_lng BETWEEN -180 AND 180)
      OR NOT (p_accuracy_m BETWEEN 0 AND 5000) THEN
    RAISE EXCEPTION 'Posicao GPS invalida' USING ERRCODE='22023';
  END IF;
  -- A cidade ja foi resolvida por Google Geocoding no backend.
  -- Nenhuma comparacao com profiles.city, onboarding.region ou matricula.
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_service_regions r
    JOIN public.caronaa_service_municipalities c
      ON c.municipality=r.municipality
    WHERE r.municipality=v_city AND r.public_discovery_enabled
  ) THEN
    RAISE EXCEPTION 'Municipio ainda nao habilitado para o radar'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations a
    WHERE a.user_id=p_user_id AND a.approved=true
  ) OR NOT public.driver_platform_access_allowed(p_user_id) THEN
    RAISE EXCEPTION 'Motorista nao autorizado ou bloqueado por repasses'
      USING ERRCODE='42501';
  END IF;

  -- Bloqueia a linha para que uma decisao OFFLINE concomitante prevaleca.
  SELECT p.is_available INTO v_online FROM public.professional_presence p
  WHERE p.user_id=p_user_id FOR UPDATE;
  IF v_online IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Motorista esta offline' USING ERRCODE='42501';
  END IF;

  -- Municipio de trabalho segue a posicao GPS verificada, NAO o cadastro.
  UPDATE public.professional_presence SET
    municipality=v_city,last_seen_at=now(),updated_at=now()
  WHERE user_id=p_user_id AND is_available=true;
  INSERT INTO public.professional_driver_locations
    (user_id,municipality,lat,lng,accuracy_m,sampled_at,updated_at)
  VALUES (p_user_id,v_city,p_lat,p_lng,p_accuracy_m,now(),now())
  ON CONFLICT(user_id) DO UPDATE SET
    municipality=EXCLUDED.municipality,
    lat=EXCLUDED.lat,lng=EXCLUDED.lng,
    accuracy_m=EXCLUDED.accuracy_m,sampled_at=now(),updated_at=now();
  RETURN true;
END
$publish$;
REVOKE ALL ON FUNCTION public.publish_verified_professional_position(
  uuid,double precision,double precision,double precision,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_verified_professional_position(
  uuid,double precision,double precision,double precision,text
) TO service_role;
COMMENT ON FUNCTION public.publish_verified_professional_position(
  uuid,double precision,double precision,double precision,text
) IS 'F07 GPS: INSERT/UPSERT com sampled_at=now(), updated_at=now(); uso exclusivo service_role com gates originais.';
NOTIFY pgrst,'reload schema';
COMMIT;
