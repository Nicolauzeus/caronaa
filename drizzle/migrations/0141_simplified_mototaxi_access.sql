-- 0141 | F02/F07 cadastro simplificado de mototaxistas (11/11/2026).
-- Aplicar APOS 0140. Nao cria permissao automatica de motorista.
-- Registrar e validar apenas declaracoes. Habilitacao comercial regional continua independente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.professional_mototaxi_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^\+55[1-9][0-9]9[0-9]{8}$'),
  region_code text NOT NULL CHECK (region_code IN ('MACICO_BATURITE','FORTALEZA')),
  registration_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_mototaxi_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_mototaxi_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.professional_mototaxi_profiles TO authenticated;
GRANT ALL ON public.professional_mototaxi_profiles TO service_role;
DROP POLICY IF EXISTS professional_mototaxi_select_own ON public.professional_mototaxi_profiles;
CREATE POLICY professional_mototaxi_select_own ON public.professional_mototaxi_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.professional_access_requests
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'STANDARD';
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'professional_access_type_check') THEN
    ALTER TABLE public.professional_access_requests
      ADD CONSTRAINT professional_access_type_check
      CHECK (access_type IN ('STANDARD','MOTOTAXI_SIMPLE'));
  END IF;
END $check$;

-- This replaces the original validator without altering its signature.
-- Traditional CAR/MOTO registrations continue to require vehicle model/plate.
CREATE OR REPLACE FUNCTION public.professional_access_missing(
  p_user uuid, p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text
) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $validator$
DECLARE p record; m record; v text[] := '{}'; v_plate text; v_avatar_path text;
BEGIN
  SELECT full_name, avatar_url, vehicle_brand, vehicle_description, vehicle_plate INTO p
    FROM public.profiles WHERE id = p_user;
  SELECT first_name, last_name, whatsapp_e164, region_code, registration_number INTO m
    FROM public.professional_mototaxi_profiles WHERE user_id = p_user;

  -- Exclusively the previously submitted, complete mototaxi pathway.
  IF p_vehicle_type = 'MOTO' AND p_car_category IS NULL AND p_seats = 1
     AND m.region_code IS NOT NULL AND m.region_code = p_municipality THEN
    IF length(btrim(coalesce(m.first_name,''))) < 2
       OR length(btrim(coalesce(m.last_name,''))) < 2
       OR btrim(coalesce(p.full_name,'')) IS DISTINCT FROM
          (btrim(m.first_name) || ' ' || btrim(m.last_name)) THEN
      v := v || 'FULL_NAME'::text;
    END IF;
    v_avatar_path := split_part(split_part(coalesce(p.avatar_url,''), '/avatars/', 2), '?', 1);
    IF v_avatar_path !~ ('^' || p_user::text || '/[a-zA-Z0-9-]+[.](jpg|jpeg|png|webp)
      v := v || 'PHOTO'::text;
    END IF;
    IF coalesce(m.whatsapp_e164,'') !~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
      v := v || 'WHATSAPP'::text;
    END IF;
    IF length(btrim(coalesce(m.registration_number,''))) < 2 THEN
      v := v || 'REGISTRATION'::text;
    END IF;
    IF m.region_code NOT IN ('MACICO_BATURITE','FORTALEZA') THEN
      v := v || 'REGION'::text;
    END IF;
    RETURN v;
  END IF;

  IF coalesce(p.avatar_url,'') !~ '^https://' THEN v := v || 'PHOTO'::text; END IF;
  IF coalesce(btrim(p.full_name),'') !~ '^\S{2,}(\s+\S+)+$' THEN v := v || 'FULL_NAME'::text; END IF;
  IF length(btrim(coalesce(p.vehicle_brand,'') || ' ' || coalesce(p.vehicle_description,''))) < 3 THEN
    v := v || 'VEHICLE_MODEL'::text;
  END IF;
  v_plate := upper(regexp_replace(coalesce(p.vehicle_plate,''), '[\s-]', '', 'g'));
  IF v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN v := v || 'PLATE'::text; END IF;
  IF p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('CAR','MOTO') THEN v := v || 'VEHICLE_TYPE'::text;
  ELSIF p_vehicle_type = 'CAR' AND
    (p_car_category IS NULL OR p_car_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')) THEN
    v := v || 'CAR_CATEGORY'::text;
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 7
     OR (p_vehicle_type = 'MOTO' AND p_seats <> 1)
     OR (p_vehicle_type = 'CAR' AND p_car_category IN ('HATCH','SEDAN','PICKUP') AND p_seats > 4)
     OR (p_vehicle_type = 'CAR' AND p_car_category = 'SUV' AND p_seats > 6) THEN
    v := v || 'SEATS'::text;
  END IF;
  IF length(btrim(coalesce(p_municipality,''))) < 2 THEN v := v || 'MUNICIPALITY'::text; END IF;
  RETURN v;
END
$validator$;

-- One authenticated, atomic submit operation: no trusted role comes from a browser flag.
CREATE OR REPLACE FUNCTION public.submit_simple_mototaxi_access(
  p_first_name text, p_last_name text, p_whatsapp text,
  p_region text, p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $submit$
DECLARE
  v_uid uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_whatsapp,''), '[^0-9]', '', 'g');
  v_phone text;
  v_photo text;
  v_name text;
  v_id uuid;
  v_snapshot jsonb;
  v_missing text[];
  v_avatar_path text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirme seu e-mail antes de solicitar acesso' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_first_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_first_name) ~ '\s'
     OR length(btrim(coalesce(p_last_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_last_name) ~ '\s' THEN
    RAISE EXCEPTION 'Informe o primeiro nome e ultimo sobrenome' USING ERRCODE='22023';
  END IF;
  IF p_region NOT IN ('MACICO_BATURITE','FORTALEZA') OR p_region IS NULL THEN
    RAISE EXCEPTION 'Regiao invalida' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_registration_number,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe a matricula/registro' USING ERRCODE='22023';
  END IF;
  IF length(v_digits)=13 AND left(v_digits,2)='55' THEN v_digits:=substr(v_digits,3); END IF;
  IF v_digits !~ '^[1-9][0-9]9[0-9]{8}$' OR length(coalesce(p_whatsapp,'')) > 40 THEN
    RAISE EXCEPTION 'WhatsApp invalido: informe DDD e numero' USING ERRCODE='22023';
  END IF;
  v_phone := '+55' || v_digits;
  -- An approved profile cannot silently replace the details that an
  -- administrator previously reviewed. Changes require a new review workflow.
  IF EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations
    WHERE user_id=v_uid AND approved IS TRUE AND vehicle_type='MOTO'
  ) THEN
    SELECT id INTO v_id FROM public.professional_access_requests
      WHERE user_id=v_uid AND access_type='MOTOTAXI_SIMPLE' AND status='APPROVED'
      ORDER BY submitted_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT avatar_url INTO v_photo FROM public.profiles WHERE id=v_uid FOR UPDATE;
  v_avatar_path := split_part(split_part(coalesce(v_photo,''), '/avatars/', 2), '?', 1);
  IF v_avatar_path !~ ('^' || v_uid::text || '/[a-zA-Z0-9-]+[.](jpg|jpeg|png|webp)
    RAISE EXCEPTION 'Envie uma foto de perfil valida antes de solicitar acesso'
      USING ERRCODE='22023';
  END IF;
  v_name := btrim(p_first_name) || ' ' || btrim(p_last_name);
  UPDATE public.profiles SET full_name=v_name, updated_at=now() WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario indisponivel'; END IF;

  INSERT INTO public.professional_mototaxi_profiles
    (user_id,first_name,last_name,whatsapp_e164,region_code,registration_number)
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,p_region,
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=EXCLUDED.region_code,
    registration_number=EXCLUDED.registration_number, updated_at=now();

  v_missing := public.professional_access_missing(v_uid,'MOTO',NULL,1,p_region);
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  v_snapshot := jsonb_build_object(
    'full_name',v_name, 'avatar_url',v_photo, 'vehicle_model','', 'vehicle_plate','',
    'vehicle_type','MOTO','car_category',NULL,'passenger_seats',1,
    'municipality',p_region,'region_code',p_region,'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  IF EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations
    WHERE user_id=v_uid AND approved IS TRUE AND vehicle_type='MOTO'
  ) THEN
    SELECT id INTO v_id FROM public.professional_access_requests
      WHERE user_id=v_uid AND access_type='MOTOTAXI_SIMPLE' AND status='APPROVED'
      ORDER BY submitted_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT id INTO v_id FROM public.professional_access_requests
    WHERE user_id=v_uid AND status='PENDING' ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.professional_access_requests
      (user_id,status,vehicle_type,car_category,passenger_seats,municipality,snapshot,access_type)
    VALUES (v_uid,'PENDING','MOTO',NULL,1,p_region,v_snapshot,'MOTOTAXI_SIMPLE')
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.professional_access_requests
      SET vehicle_type='MOTO',car_category=NULL,passenger_seats=1,municipality=p_region,
          snapshot=v_snapshot,access_type='MOTOTAXI_SIMPLE',updated_at=now()
      WHERE id=v_id;
  END IF;
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
    VALUES (v_id,v_uid,'SUBMITTED','Cadastro simplificado de mototaxista');

  -- The user may now view professional request status, not start rides.
  INSERT INTO public.user_onboarding_progress
    (user_id,status,current_step,region_code,affiliation_type,institution_code,
     usage_role,completed_at,updated_at)
  VALUES (v_uid,'BASIC_COMPLETED','DONE',p_region,'COMUNIDADE',NULL,'MOTORISTA',now(),now())
  ON CONFLICT (user_id) DO UPDATE SET
    status='BASIC_COMPLETED',current_step='DONE',completed_at=now(),updated_at=now(),
    region_code=EXCLUDED.region_code,affiliation_type='COMUNIDADE',
    institution_code=NULL,usage_role='MOTORISTA'
    WHERE public.user_onboarding_progress.status='IN_PROGRESS';
  RETURN v_id;
END
$submit$;

-- Keep existing consumers and DB approval function compatible; live authoritative result.
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $myaccess$
DECLARE v_uid uuid := auth.uid(); r record; v_missing text[]; v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.professional_access_requests
    WHERE user_id=v_uid ORDER BY submitted_at DESC LIMIT 1;
  v_missing := CASE WHEN r.id IS NULL
    THEN public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')
    ELSE public.professional_access_missing(v_uid,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality)
  END;
  SELECT coalesce(bool_or(a.approved),false) INTO v_approved
    FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid;
  RETURN jsonb_build_object(
    'authorized',v_approved,
    'profileMissing',to_jsonb(v_missing),
    'request',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',r.id,'status',r.status,'access_type',r.access_type,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,
      'passenger_seats',r.passenger_seats,'municipality',r.municipality,
      'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,
      'review_reason',r.review_reason) END
  );
END
$myaccess$;

REVOKE ALL ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;

COMMENT ON TABLE public.professional_mototaxi_profiles IS
  'Cadastro declaratorio privado, exige decisao manual do administrador para radar.';
COMMIT;
)
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id='avatars' AND name=v_avatar_path
       ) THEN
      v := v || 'PHOTO'::text;
    END IF;
    IF coalesce(m.whatsapp_e164,'') !~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
      v := v || 'WHATSAPP'::text;
    END IF;
    IF length(btrim(coalesce(m.registration_number,''))) < 2 THEN
      v := v || 'REGISTRATION'::text;
    END IF;
    IF m.region_code NOT IN ('MACICO_BATURITE','FORTALEZA') THEN
      v := v || 'REGION'::text;
    END IF;
    RETURN v;
  END IF;

  IF coalesce(p.avatar_url,'') !~ '^https://' THEN v := v || 'PHOTO'::text; END IF;
  IF coalesce(btrim(p.full_name),'') !~ '^\S{2,}(\s+\S+)+$' THEN v := v || 'FULL_NAME'::text; END IF;
  IF length(btrim(coalesce(p.vehicle_brand,'') || ' ' || coalesce(p.vehicle_description,''))) < 3 THEN
    v := v || 'VEHICLE_MODEL'::text;
  END IF;
  v_plate := upper(regexp_replace(coalesce(p.vehicle_plate,''), '[\s-]', '', 'g'));
  IF v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN v := v || 'PLATE'::text; END IF;
  IF p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('CAR','MOTO') THEN v := v || 'VEHICLE_TYPE'::text;
  ELSIF p_vehicle_type = 'CAR' AND
    (p_car_category IS NULL OR p_car_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')) THEN
    v := v || 'CAR_CATEGORY'::text;
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 7
     OR (p_vehicle_type = 'MOTO' AND p_seats <> 1)
     OR (p_vehicle_type = 'CAR' AND p_car_category IN ('HATCH','SEDAN','PICKUP') AND p_seats > 4)
     OR (p_vehicle_type = 'CAR' AND p_car_category = 'SUV' AND p_seats > 6) THEN
    v := v || 'SEATS'::text;
  END IF;
  IF length(btrim(coalesce(p_municipality,''))) < 2 THEN v := v || 'MUNICIPALITY'::text; END IF;
  RETURN v;
END
$validator$;

-- One authenticated, atomic submit operation: no trusted role comes from a browser flag.
CREATE OR REPLACE FUNCTION public.submit_simple_mototaxi_access(
  p_first_name text, p_last_name text, p_whatsapp text,
  p_region text, p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $submit$
DECLARE
  v_uid uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_whatsapp,''), '[^0-9]', '', 'g');
  v_phone text;
  v_photo text;
  v_name text;
  v_id uuid;
  v_snapshot jsonb;
  v_missing text[];
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirme seu e-mail antes de solicitar acesso' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_first_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_first_name) ~ '\s'
     OR length(btrim(coalesce(p_last_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_last_name) ~ '\s' THEN
    RAISE EXCEPTION 'Informe o primeiro nome e ultimo sobrenome' USING ERRCODE='22023';
  END IF;
  IF p_region NOT IN ('MACICO_BATURITE','FORTALEZA') OR p_region IS NULL THEN
    RAISE EXCEPTION 'Regiao invalida' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_registration_number,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe a matricula/registro' USING ERRCODE='22023';
  END IF;
  IF length(v_digits)=13 AND left(v_digits,2)='55' THEN v_digits:=substr(v_digits,3); END IF;
  IF v_digits !~ '^[1-9][0-9]9[0-9]{8}$' OR length(coalesce(p_whatsapp,'')) > 40 THEN
    RAISE EXCEPTION 'WhatsApp invalido: informe DDD e numero' USING ERRCODE='22023';
  END IF;
  v_phone := '+55' || v_digits;
  SELECT avatar_url INTO v_photo FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF coalesce(v_photo,'') NOT LIKE '%/avatars/' || v_uid::text || '/%.jpg%' THEN
    RAISE EXCEPTION 'Envie uma foto de perfil valida antes de solicitar acesso'
      USING ERRCODE='22023';
  END IF;
  v_name := btrim(p_first_name) || ' ' || btrim(p_last_name);
  UPDATE public.profiles SET full_name=v_name, updated_at=now() WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario indisponivel'; END IF;

  INSERT INTO public.professional_mototaxi_profiles
    (user_id,first_name,last_name,whatsapp_e164,region_code,registration_number)
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,p_region,
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=EXCLUDED.region_code,
    registration_number=EXCLUDED.registration_number, updated_at=now();

  v_missing := public.professional_access_missing(v_uid,'MOTO',NULL,1,p_region);
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  v_snapshot := jsonb_build_object(
    'full_name',v_name, 'avatar_url',v_photo, 'vehicle_model','', 'vehicle_plate','',
    'vehicle_type','MOTO','car_category',NULL,'passenger_seats',1,
    'municipality',p_region,'region_code',p_region,'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  IF EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations
    WHERE user_id=v_uid AND approved IS TRUE AND vehicle_type='MOTO'
  ) THEN
    SELECT id INTO v_id FROM public.professional_access_requests
      WHERE user_id=v_uid AND access_type='MOTOTAXI_SIMPLE' AND status='APPROVED'
      ORDER BY submitted_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT id INTO v_id FROM public.professional_access_requests
    WHERE user_id=v_uid AND status='PENDING' ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.professional_access_requests
      (user_id,status,vehicle_type,car_category,passenger_seats,municipality,snapshot,access_type)
    VALUES (v_uid,'PENDING','MOTO',NULL,1,p_region,v_snapshot,'MOTOTAXI_SIMPLE')
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.professional_access_requests
      SET vehicle_type='MOTO',car_category=NULL,passenger_seats=1,municipality=p_region,
          snapshot=v_snapshot,access_type='MOTOTAXI_SIMPLE',updated_at=now()
      WHERE id=v_id;
  END IF;
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
    VALUES (v_id,v_uid,'SUBMITTED','Cadastro simplificado de mototaxista');

  -- The user may now view professional request status, not start rides.
  INSERT INTO public.user_onboarding_progress
    (user_id,status,current_step,region_code,affiliation_type,institution_code,
     usage_role,completed_at,updated_at)
  VALUES (v_uid,'BASIC_COMPLETED','DONE',p_region,'COMUNIDADE',NULL,'MOTORISTA',now(),now())
  ON CONFLICT (user_id) DO UPDATE SET
    status='BASIC_COMPLETED',current_step='DONE',completed_at=now(),updated_at=now(),
    region_code=EXCLUDED.region_code,affiliation_type='COMUNIDADE',
    institution_code=NULL,usage_role='MOTORISTA'
    WHERE public.user_onboarding_progress.status='IN_PROGRESS';
  RETURN v_id;
END
$submit$;

-- Keep existing consumers and DB approval function compatible; live authoritative result.
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $myaccess$
DECLARE v_uid uuid := auth.uid(); r record; v_missing text[]; v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.professional_access_requests
    WHERE user_id=v_uid ORDER BY submitted_at DESC LIMIT 1;
  v_missing := CASE WHEN r.id IS NULL
    THEN public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')
    ELSE public.professional_access_missing(v_uid,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality)
  END;
  SELECT coalesce(bool_or(a.approved),false) INTO v_approved
    FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid;
  RETURN jsonb_build_object(
    'authorized',v_approved,
    'profileMissing',to_jsonb(v_missing),
    'request',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',r.id,'status',r.status,'access_type',r.access_type,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,
      'passenger_seats',r.passenger_seats,'municipality',r.municipality,
      'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,
      'review_reason',r.review_reason) END
  );
END
$myaccess$;

REVOKE ALL ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;

COMMENT ON TABLE public.professional_mototaxi_profiles IS
  'Cadastro declaratorio privado, exige decisao manual do administrador para radar.';
COMMIT;
)
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects
       WHERE bucket_id='avatars' AND name=v_avatar_path
     ) THEN
    RAISE EXCEPTION 'Envie uma foto de perfil valida antes de solicitar acesso'
      USING ERRCODE='22023';
  END IF;
  v_name := btrim(p_first_name) || ' ' || btrim(p_last_name);
  UPDATE public.profiles SET full_name=v_name, updated_at=now() WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario indisponivel'; END IF;

  INSERT INTO public.professional_mototaxi_profiles
    (user_id,first_name,last_name,whatsapp_e164,region_code,registration_number)
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,p_region,
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=EXCLUDED.region_code,
    registration_number=EXCLUDED.registration_number, updated_at=now();

  v_missing := public.professional_access_missing(v_uid,'MOTO',NULL,1,p_region);
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  v_snapshot := jsonb_build_object(
    'full_name',v_name, 'avatar_url',v_photo, 'vehicle_model','', 'vehicle_plate','',
    'vehicle_type','MOTO','car_category',NULL,'passenger_seats',1,
    'municipality',p_region,'region_code',p_region,'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  IF EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations
    WHERE user_id=v_uid AND approved IS TRUE AND vehicle_type='MOTO'
  ) THEN
    SELECT id INTO v_id FROM public.professional_access_requests
      WHERE user_id=v_uid AND access_type='MOTOTAXI_SIMPLE' AND status='APPROVED'
      ORDER BY submitted_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT id INTO v_id FROM public.professional_access_requests
    WHERE user_id=v_uid AND status='PENDING' ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.professional_access_requests
      (user_id,status,vehicle_type,car_category,passenger_seats,municipality,snapshot,access_type)
    VALUES (v_uid,'PENDING','MOTO',NULL,1,p_region,v_snapshot,'MOTOTAXI_SIMPLE')
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.professional_access_requests
      SET vehicle_type='MOTO',car_category=NULL,passenger_seats=1,municipality=p_region,
          snapshot=v_snapshot,access_type='MOTOTAXI_SIMPLE',updated_at=now()
      WHERE id=v_id;
  END IF;
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
    VALUES (v_id,v_uid,'SUBMITTED','Cadastro simplificado de mototaxista');

  -- The user may now view professional request status, not start rides.
  INSERT INTO public.user_onboarding_progress
    (user_id,status,current_step,region_code,affiliation_type,institution_code,
     usage_role,completed_at,updated_at)
  VALUES (v_uid,'BASIC_COMPLETED','DONE',p_region,'COMUNIDADE',NULL,'MOTORISTA',now(),now())
  ON CONFLICT (user_id) DO UPDATE SET
    status='BASIC_COMPLETED',current_step='DONE',completed_at=now(),updated_at=now(),
    region_code=EXCLUDED.region_code,affiliation_type='COMUNIDADE',
    institution_code=NULL,usage_role='MOTORISTA'
    WHERE public.user_onboarding_progress.status='IN_PROGRESS';
  RETURN v_id;
END
$submit$;

-- Keep existing consumers and DB approval function compatible; live authoritative result.
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $myaccess$
DECLARE v_uid uuid := auth.uid(); r record; v_missing text[]; v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.professional_access_requests
    WHERE user_id=v_uid ORDER BY submitted_at DESC LIMIT 1;
  v_missing := CASE WHEN r.id IS NULL
    THEN public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')
    ELSE public.professional_access_missing(v_uid,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality)
  END;
  SELECT coalesce(bool_or(a.approved),false) INTO v_approved
    FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid;
  RETURN jsonb_build_object(
    'authorized',v_approved,
    'profileMissing',to_jsonb(v_missing),
    'request',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',r.id,'status',r.status,'access_type',r.access_type,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,
      'passenger_seats',r.passenger_seats,'municipality',r.municipality,
      'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,
      'review_reason',r.review_reason) END
  );
END
$myaccess$;

REVOKE ALL ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;

COMMENT ON TABLE public.professional_mototaxi_profiles IS
  'Cadastro declaratorio privado, exige decisao manual do administrador para radar.';
COMMIT;
)
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id='avatars' AND name=v_avatar_path
       ) THEN
      v := v || 'PHOTO'::text;
    END IF;
    IF coalesce(m.whatsapp_e164,'') !~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
      v := v || 'WHATSAPP'::text;
    END IF;
    IF length(btrim(coalesce(m.registration_number,''))) < 2 THEN
      v := v || 'REGISTRATION'::text;
    END IF;
    IF m.region_code NOT IN ('MACICO_BATURITE','FORTALEZA') THEN
      v := v || 'REGION'::text;
    END IF;
    RETURN v;
  END IF;

  IF coalesce(p.avatar_url,'') !~ '^https://' THEN v := v || 'PHOTO'::text; END IF;
  IF coalesce(btrim(p.full_name),'') !~ '^\S{2,}(\s+\S+)+$' THEN v := v || 'FULL_NAME'::text; END IF;
  IF length(btrim(coalesce(p.vehicle_brand,'') || ' ' || coalesce(p.vehicle_description,''))) < 3 THEN
    v := v || 'VEHICLE_MODEL'::text;
  END IF;
  v_plate := upper(regexp_replace(coalesce(p.vehicle_plate,''), '[\s-]', '', 'g'));
  IF v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN v := v || 'PLATE'::text; END IF;
  IF p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('CAR','MOTO') THEN v := v || 'VEHICLE_TYPE'::text;
  ELSIF p_vehicle_type = 'CAR' AND
    (p_car_category IS NULL OR p_car_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')) THEN
    v := v || 'CAR_CATEGORY'::text;
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 7
     OR (p_vehicle_type = 'MOTO' AND p_seats <> 1)
     OR (p_vehicle_type = 'CAR' AND p_car_category IN ('HATCH','SEDAN','PICKUP') AND p_seats > 4)
     OR (p_vehicle_type = 'CAR' AND p_car_category = 'SUV' AND p_seats > 6) THEN
    v := v || 'SEATS'::text;
  END IF;
  IF length(btrim(coalesce(p_municipality,''))) < 2 THEN v := v || 'MUNICIPALITY'::text; END IF;
  RETURN v;
END
$validator$;

-- One authenticated, atomic submit operation: no trusted role comes from a browser flag.
CREATE OR REPLACE FUNCTION public.submit_simple_mototaxi_access(
  p_first_name text, p_last_name text, p_whatsapp text,
  p_region text, p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $submit$
DECLARE
  v_uid uuid := auth.uid();
  v_digits text := regexp_replace(coalesce(p_whatsapp,''), '[^0-9]', '', 'g');
  v_phone text;
  v_photo text;
  v_name text;
  v_id uuid;
  v_snapshot jsonb;
  v_missing text[];
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirme seu e-mail antes de solicitar acesso' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_first_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_first_name) ~ '\s'
     OR length(btrim(coalesce(p_last_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_last_name) ~ '\s' THEN
    RAISE EXCEPTION 'Informe o primeiro nome e ultimo sobrenome' USING ERRCODE='22023';
  END IF;
  IF p_region NOT IN ('MACICO_BATURITE','FORTALEZA') OR p_region IS NULL THEN
    RAISE EXCEPTION 'Regiao invalida' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_registration_number,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe a matricula/registro' USING ERRCODE='22023';
  END IF;
  IF length(v_digits)=13 AND left(v_digits,2)='55' THEN v_digits:=substr(v_digits,3); END IF;
  IF v_digits !~ '^[1-9][0-9]9[0-9]{8}$' OR length(coalesce(p_whatsapp,'')) > 40 THEN
    RAISE EXCEPTION 'WhatsApp invalido: informe DDD e numero' USING ERRCODE='22023';
  END IF;
  v_phone := '+55' || v_digits;
  SELECT avatar_url INTO v_photo FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF coalesce(v_photo,'') NOT LIKE '%/avatars/' || v_uid::text || '/%.jpg%' THEN
    RAISE EXCEPTION 'Envie uma foto de perfil valida antes de solicitar acesso'
      USING ERRCODE='22023';
  END IF;
  v_name := btrim(p_first_name) || ' ' || btrim(p_last_name);
  UPDATE public.profiles SET full_name=v_name, updated_at=now() WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario indisponivel'; END IF;

  INSERT INTO public.professional_mototaxi_profiles
    (user_id,first_name,last_name,whatsapp_e164,region_code,registration_number)
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,p_region,
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=EXCLUDED.region_code,
    registration_number=EXCLUDED.registration_number, updated_at=now();

  v_missing := public.professional_access_missing(v_uid,'MOTO',NULL,1,p_region);
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  v_snapshot := jsonb_build_object(
    'full_name',v_name, 'avatar_url',v_photo, 'vehicle_model','', 'vehicle_plate','',
    'vehicle_type','MOTO','car_category',NULL,'passenger_seats',1,
    'municipality',p_region,'region_code',p_region,'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  IF EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations
    WHERE user_id=v_uid AND approved IS TRUE AND vehicle_type='MOTO'
  ) THEN
    SELECT id INTO v_id FROM public.professional_access_requests
      WHERE user_id=v_uid AND access_type='MOTOTAXI_SIMPLE' AND status='APPROVED'
      ORDER BY submitted_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT id INTO v_id FROM public.professional_access_requests
    WHERE user_id=v_uid AND status='PENDING' ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.professional_access_requests
      (user_id,status,vehicle_type,car_category,passenger_seats,municipality,snapshot,access_type)
    VALUES (v_uid,'PENDING','MOTO',NULL,1,p_region,v_snapshot,'MOTOTAXI_SIMPLE')
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.professional_access_requests
      SET vehicle_type='MOTO',car_category=NULL,passenger_seats=1,municipality=p_region,
          snapshot=v_snapshot,access_type='MOTOTAXI_SIMPLE',updated_at=now()
      WHERE id=v_id;
  END IF;
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
    VALUES (v_id,v_uid,'SUBMITTED','Cadastro simplificado de mototaxista');

  -- The user may now view professional request status, not start rides.
  INSERT INTO public.user_onboarding_progress
    (user_id,status,current_step,region_code,affiliation_type,institution_code,
     usage_role,completed_at,updated_at)
  VALUES (v_uid,'BASIC_COMPLETED','DONE',p_region,'COMUNIDADE',NULL,'MOTORISTA',now(),now())
  ON CONFLICT (user_id) DO UPDATE SET
    status='BASIC_COMPLETED',current_step='DONE',completed_at=now(),updated_at=now(),
    region_code=EXCLUDED.region_code,affiliation_type='COMUNIDADE',
    institution_code=NULL,usage_role='MOTORISTA'
    WHERE public.user_onboarding_progress.status='IN_PROGRESS';
  RETURN v_id;
END
$submit$;

-- Keep existing consumers and DB approval function compatible; live authoritative result.
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $myaccess$
DECLARE v_uid uuid := auth.uid(); r record; v_missing text[]; v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.professional_access_requests
    WHERE user_id=v_uid ORDER BY submitted_at DESC LIMIT 1;
  v_missing := CASE WHEN r.id IS NULL
    THEN public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')
    ELSE public.professional_access_missing(v_uid,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality)
  END;
  SELECT coalesce(bool_or(a.approved),false) INTO v_approved
    FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid;
  RETURN jsonb_build_object(
    'authorized',v_approved,
    'profileMissing',to_jsonb(v_missing),
    'request',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',r.id,'status',r.status,'access_type',r.access_type,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,
      'passenger_seats',r.passenger_seats,'municipality',r.municipality,
      'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,
      'review_reason',r.review_reason) END
  );
END
$myaccess$;

REVOKE ALL ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;

COMMENT ON TABLE public.professional_mototaxi_profiles IS
  'Cadastro declaratorio privado, exige decisao manual do administrador para radar.';
COMMIT;
