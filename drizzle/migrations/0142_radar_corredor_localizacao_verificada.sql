-- 0142 | F07: radar de homologacao Fortaleza <-> Macico (CE-060/CE-356).
-- Aplicar APOS o frontend que usa publishVerifiedProfessionalPosition.
-- Esta migration habilita SOMENTE descoberta aproximada de motoristas.
-- Nao ativa viagens pagas, despacho, tarifas ou permissoes documentais.
BEGIN;

-- Oito municipios contiguos do eixo principal. Outras cidades do inventario
-- permanecem com sua configuracao administrativa anterior.
INSERT INTO public.caronaa_service_municipalities (municipality, pricing_region)
VALUES
  ('Fortaleza','FORTALEZA_CORRIDOR'),
  ('Maracanaú','FORTALEZA_CORRIDOR'),
  ('Pacatuba','FORTALEZA_CORRIDOR'),
  ('Guaiúba','FORTALEZA_CORRIDOR'),
  ('Acarape','MACICO_BATURITE'),
  ('Redenção','MACICO_BATURITE'),
  ('Aracoiaba','MACICO_BATURITE'),
  ('Baturité','MACICO_BATURITE')
ON CONFLICT (municipality) DO NOTHING;

INSERT INTO public.professional_service_regions
  (municipality,public_discovery_enabled,dispatch_enabled)
VALUES
  ('Fortaleza',true,false),
  ('Maracanaú',true,false),
  ('Pacatuba',true,false),
  ('Guaiúba',true,false),
  ('Acarape',true,false),
  ('Redenção',true,false),
  ('Aracoiaba',true,false),
  ('Baturité',true,false)
ON CONFLICT (municipality) DO UPDATE
SET public_discovery_enabled=true,updated_at=now();
-- Nao alterar c.car_enabled, c.moto_enabled, r.dispatch_enabled ou tarifas.
-- A operacao comercial permanece governada pelos gates independentes F07.

-- Limita chamadas de GPS antes de qualquer chamada paga ao Google.
CREATE TABLE IF NOT EXISTS public.professional_radar_location_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_radar_location_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_radar_location_rate_limits
  FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.professional_radar_location_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.professional_radar_location_rate_gate()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $gate$
DECLARE v_user uuid := auth.uid(); v_ok boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.professional_radar_location_rate_limits(user_id,attempted_at)
  VALUES(v_user,now())
  ON CONFLICT(user_id) DO UPDATE SET attempted_at=now()
    WHERE public.professional_radar_location_rate_limits.attempted_at
      <= now() - interval '12 seconds'
  RETURNING true INTO v_ok;
  RETURN coalesce(v_ok,false);
END
$gate$;
REVOKE ALL ON FUNCTION public.professional_radar_location_rate_gate()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.professional_radar_location_rate_gate()
  TO authenticated;

-- O servidor autentica o usuario, consulta o Google e passa a cidade real
-- canonica. Este RPC nao pode ser chamado por um cliente autenticado comum:
-- evita publicar uma localidade apenas declarada no formulario/perfil.
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

-- Excluir sinal preciso caso o servidor detecte que a cidade nao e permitida.
-- O backend so exclui o proprio usuario autenticado, usando userId do token.
-- Nenhum novo acesso direto e concedido a usuarios autenticados.

-- Desabilita a publicacao antiga que confiava no municipio enviado pelo client.
-- Aplicar APOS publicar a versao do frontend que usa o servidor como mediador.
REVOKE EXECUTE ON FUNCTION public.professional_location_opt_in(
  double precision,double precision,double precision,text
) FROM PUBLIC,anon,authenticated;

-- O radar pode mostrar profissionais em homologacao SEM liberar despacho:
-- estas posicoes sao aproximadas, nao enderecos precisos nem promessa de viagem.
CREATE OR REPLACE FUNCTION public.discover_caronaa_quick_drivers(
  p_municipality text,p_vehicle text
)
RETURNS TABLE(driver_key text,lat double precision,lng double precision,seen_at timestamptz)
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
    AND l.user_id<>auth.uid()
  ORDER BY l.updated_at DESC LIMIT 100;
END
$discover$;
REVOKE ALL ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discover_caronaa_quick_drivers(text,text)
  TO authenticated;

-- Mantem WAITLIST ate haver aprovacao explicita de tarifa+dispatch.
-- O campo radar agora indica descoberta aprovada independentemente do despacho.
CREATE OR REPLACE FUNCTION public.caronaa_quick_region_status(
  p_municipality text,p_vehicle text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $status$
DECLARE r record; enabled boolean; tariff_published boolean; v_commercial boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria' USING ERRCODE='42501';
  END IF;
  IF p_vehicle NOT IN ('CAR','MOTO')
    OR length(btrim(coalesce(p_municipality,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Regiao ou veiculo invalido' USING ERRCODE='22023';
  END IF;
  SELECT c.pricing_region,c.car_enabled,c.moto_enabled,
    coalesce(p.public_discovery_enabled,false) AS radar,
    coalesce(p.dispatch_enabled,false) AS dispatch
  INTO r FROM public.caronaa_service_municipalities c
  LEFT JOIN public.professional_service_regions p ON p.municipality=c.municipality
  WHERE lower(c.municipality)=lower(btrim(p_municipality)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','OUTSIDE','region',null,
      'radar',false,'dispatch',false);
  END IF;
  enabled := CASE WHEN p_vehicle='MOTO' THEN r.moto_enabled ELSE r.car_enabled END;
  SELECT coalesce(published,false) INTO tariff_published
    FROM public.caronaa_quick_tariff_policies
    WHERE pricing_region=r.pricing_region AND vehicle_type=p_vehicle;
  v_commercial := enabled AND r.dispatch AND r.radar AND coalesce(tariff_published,false);
  RETURN jsonb_build_object(
    'status',CASE WHEN v_commercial THEN 'ENABLED' ELSE 'WAITLIST' END,
    'region',r.pricing_region,'radar',r.radar,'dispatch',v_commercial
  );
END
$status$;
REVOKE ALL ON FUNCTION public.caronaa_quick_region_status(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_quick_region_status(text,text)
  TO authenticated;

COMMENT ON FUNCTION public.publish_verified_professional_position(
  uuid,double precision,double precision,double precision,text
) IS 'Somente service_role apos reverse geocoding Google; GPS privado, area aprovada, aprovacao, financeiro e ONLINE.';
NOTIFY pgrst,'reload schema';
COMMIT;
