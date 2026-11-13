-- F07 staging-only ACTIVATE. Requires the 0143 schema migration.
-- Connect to an ISOLATED homologation Supabase/Postgres database.
-- The administrator must first run: SET caronaa.f07_target = 'homologacao';
-- Never run on the connected public CARONAA production database.
BEGIN;

DO $check$
BEGIN
  IF current_setting('caronaa.f07_target',true) IS DISTINCT FROM 'homologacao' THEN
    RAISE EXCEPTION 'ABORTADO: target nao e homologacao (caronaa.f07_target)'
      USING ERRCODE='42501';
  END IF;
  IF to_regclass('public.caronaa_f07_pilot_control') IS NULL
     OR to_regclass('public.caronaa_quick_fare_quotes') IS NULL THEN
    RAISE EXCEPTION 'Migration 0143 e dependencias pendentes';
  END IF;
END
$check$;

-- Catalog already exists; explicit upsert preserves the approved classification.
INSERT INTO public.caronaa_service_municipalities(
  municipality,pricing_region,car_enabled,moto_enabled
) VALUES
('Fortaleza','FORTALEZA_CORRIDOR',true,true),
('Maracanaú','FORTALEZA_CORRIDOR',true,true),
('Pacatuba','FORTALEZA_CORRIDOR',true,true),
('Guaiúba','FORTALEZA_CORRIDOR',true,true),
('Acarape','MACICO_BATURITE',true,true),
('Redenção','MACICO_BATURITE',true,true),
('Aracoiaba','MACICO_BATURITE',true,true),
('Baturité','MACICO_BATURITE',true,true),
('Barreira','MACICO_BATURITE',true,true),
('Ocara','MACICO_BATURITE',true,true),
('Capistrano','MACICO_BATURITE',true,true),
('Itapiúna','MACICO_BATURITE',true,true),
('Aratuba','MACICO_BATURITE',true,true),
('Guaramiranga','MACICO_BATURITE',true,true),
('Mulungu','MACICO_BATURITE',true,true),
('Pacoti','MACICO_BATURITE',true,true),
('Palmácia','MACICO_BATURITE',true,true)
ON CONFLICT(municipality) DO UPDATE SET
  pricing_region=EXCLUDED.pricing_region,
  car_enabled=true,moto_enabled=true,updated_at=now();

INSERT INTO public.professional_service_regions(
  municipality,public_discovery_enabled,dispatch_enabled
)
SELECT municipality,true,true FROM public.caronaa_service_municipalities
WHERE municipality IN (
 'Fortaleza','Maracanaú','Pacatuba','Guaiúba','Acarape','Redenção',
 'Aracoiaba','Baturité','Barreira','Ocara','Capistrano','Itapiúna',
 'Aratuba','Guaramiranga','Mulungu','Pacoti','Palmácia'
)
ON CONFLICT(municipality) DO UPDATE SET
  public_discovery_enabled=true,dispatch_enabled=true,updated_at=now();

-- Pilot tariff matrices: BRL values represented in integral centavos.
-- 0 processing_fee_cents means NO simulated processor fee is charged;
-- it is not a claim that a real PSP charges zero.
-- Maciço Moto extra distance (>11km) uses the existing pricing-engine
-- rule: 750 centavos for first 11km, plus 600/11 per excess km.
INSERT INTO public.caronaa_quick_tariff_policies(
  pricing_region,vehicle_type,base_cents,per_km_cents,per_minute_cents,
  minimum_cents,commission_bps,processing_fee_cents,
  minimum_platform_margin_cents,intermunicipal_enabled,published,policy_version,
  updated_at
) VALUES
('MACICO_BATURITE','MOTO',0,0,0,750,2000,0,50,true,true,'macico-moto-piloto',now()),
('MACICO_BATURITE','CAR',500,200,30,1000,2000,0,100,true,true,'macico-car-piloto',now()),
('FORTALEZA_CORRIDOR','MOTO',350,120,20,600,1500,0,50,true,true,'fortaleza-moto-piloto',now()),
('FORTALEZA_CORRIDOR','CAR',550,220,35,1200,1500,0,100,true,true,'fortaleza-car-piloto',now())
ON CONFLICT(pricing_region,vehicle_type) DO UPDATE SET
  base_cents=EXCLUDED.base_cents,
  per_km_cents=EXCLUDED.per_km_cents,
  per_minute_cents=EXCLUDED.per_minute_cents,
  minimum_cents=EXCLUDED.minimum_cents,
  commission_bps=EXCLUDED.commission_bps,
  processing_fee_cents=EXCLUDED.processing_fee_cents,
  minimum_platform_margin_cents=EXCLUDED.minimum_platform_margin_cents,
  intermunicipal_enabled=true,published=true,
  policy_version=EXCLUDED.policy_version,updated_at=now();

INSERT INTO public.caronaa_f07_pilot_control(
  id,enabled,activated_at,expires_at,updated_at
) VALUES(true,true,now(),now()+interval '14 days',now())
ON CONFLICT(id) DO UPDATE SET
  enabled=true,activated_at=now(),expires_at=now()+interval '14 days',
  updated_at=now();

DO $verify$
DECLARE v_count integer; v_policies integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.caronaa_service_municipalities c
  JOIN public.professional_service_regions r USING(municipality)
  WHERE c.car_enabled AND c.moto_enabled
    AND r.public_discovery_enabled AND r.dispatch_enabled
    AND c.municipality IN (
      'Fortaleza','Maracanaú','Pacatuba','Guaiúba','Acarape','Redenção',
      'Aracoiaba','Baturité','Barreira','Ocara','Capistrano','Itapiúna',
      'Aratuba','Guaramiranga','Mulungu','Pacoti','Palmácia'
    );
  SELECT count(*) INTO v_policies
  FROM public.caronaa_quick_tariff_policies
  WHERE published AND intermunicipal_enabled
    AND policy_version IN (
      'macico-moto-piloto','macico-car-piloto',
      'fortaleza-moto-piloto','fortaleza-car-piloto'
    );
  IF v_count <> 17 OR v_policies <> 4 THEN
    RAISE EXCEPTION 'Ativacao incompleta (municipios %, tarifas %)',
      v_count,v_policies;
  END IF;
END
$verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
