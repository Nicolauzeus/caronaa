-- 0245 | Cadastro de CAR e MOTO por conta com placa própria, uma modalidade ativa.
-- Não apagar valores históricos de registration_number; apenas deixar de exigi-los.
BEGIN;
CREATE TABLE IF NOT EXISTS public.professional_driver_vehicles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 vehicle_type text NOT NULL CHECK(vehicle_type IN('CAR','MOTO')),
 brand text NOT NULL CHECK(length(btrim(brand)) BETWEEN 1 AND 60),
 model text NOT NULL CHECK(length(btrim(model)) BETWEEN 1 AND 160),
 color text NOT NULL CHECK(length(btrim(color)) BETWEEN 1 AND 60),
 plate text NOT NULL CHECK(plate ~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$'),
 car_category text CHECK(car_category IS NULL OR car_category IN('HATCH','SEDAN','SUV','MINIVAN','PICKUP')),
 passenger_seats integer NOT NULL CHECK(passenger_seats BETWEEN 1 AND 3),
 approved boolean NOT NULL DEFAULT false,
 is_active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT professional_driver_vehicles_user_plate_key UNIQUE(user_id,plate),
 CONSTRAINT professional_driver_vehicles_seats_type CHECK(vehicle_type='CAR' OR (passenger_seats=1 AND car_category IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS professional_driver_vehicles_one_active_per_account
 ON public.professional_driver_vehicles(user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS professional_driver_vehicles_user_index
 ON public.professional_driver_vehicles(user_id);
ALTER TABLE public.professional_driver_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS professional_driver_vehicles_owner_read ON public.professional_driver_vehicles;
CREATE POLICY professional_driver_vehicles_owner_read ON public.professional_driver_vehicles
 FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
REVOKE ALL ON TABLE public.professional_driver_vehicles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.professional_driver_vehicles TO authenticated;
ALTER TABLE public.professional_mototaxi_profiles ALTER COLUMN registration_number DROP NOT NULL;
INSERT INTO public.professional_driver_vehicles(user_id,vehicle_type,brand,model,color,plate,car_category,passenger_seats,approved,is_active)
SELECT a.user_id,a.vehicle_type,btrim(p.vehicle_brand),btrim(p.vehicle_description),btrim(p.vehicle_color),
  upper(regexp_replace(p.vehicle_plate,'[^A-Za-z0-9]','','g')),
  CASE WHEN a.vehicle_type='CAR' THEN
    (SELECT r.car_category FROM public.professional_access_requests r
      WHERE r.user_id=a.user_id AND r.vehicle_type='CAR' AND r.status='APPROVED'
      ORDER BY r.submitted_at DESC LIMIT 1) ELSE NULL END,
  CASE WHEN a.vehicle_type='MOTO' THEN 1 ELSE greatest(1,least(coalesce(p.vehicle_seats,1),3)) END,
  a.approved,true
FROM public.professional_driver_authorizations a JOIN public.profiles p ON p.id=a.user_id
WHERE lower(coalesce(p.vehicle_type,''))=lower(a.vehicle_type)
  AND length(btrim(coalesce(p.vehicle_brand,'')))>0 AND length(btrim(coalesce(p.vehicle_description,'')))>0
  AND length(btrim(coalesce(p.vehicle_color,'')))>0
  AND upper(regexp_replace(coalesce(p.vehicle_plate,''),'[^A-Za-z0-9]','','g')) ~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$'
ON CONFLICT(user_id,plate) DO NOTHING;
CREATE OR REPLACE FUNCTION public.complete_professional_driver_registration(p_full_name text, p_whatsapp text, p_municipality text, p_vehicle_type text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_color text, p_vehicle_plate text, p_car_category text, p_vehicle_seats integer, p_registration_number text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid:=auth.uid();
  v_phone text;
  v_name text:=btrim(coalesce(p_full_name,''));
  v_city text:=nullif(btrim(p_municipality),'');
  v_plate text:=upper(
    regexp_replace(
      coalesce(p_vehicle_plate,''),
      '[^A-Za-z0-9]','','g'
    )
  );
  v_photo text;
  v_avatar_path text;
  v_category text:=CASE
    WHEN p_vehicle_type='CAR' THEN p_car_category
    ELSE NULL
  END;
  v_registration text:=nullif(
    btrim(coalesce(p_registration_number,'')),''
  );
  v_first text;
  v_last text;
  v_request_id uuid;
  v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Confirme seu e-mail para concluir o cadastro'
    USING ERRCODE='42501';
  END IF;

  IF v_name !~ '^[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}'
     OR length(v_name)>120 THEN
    RAISE EXCEPTION 'Dados pendentes: FULL_NAME'
    USING ERRCODE='22023';
  END IF;

  v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);

  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
       WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
       WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
       WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164'
       FROM public.professional_access_requests r
       WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
       ORDER BY r.submitted_at DESC LIMIT 1)
    ) INTO v_phone;
  END IF;


  IF v_city IS NOT NULL AND (
    length(v_city) NOT BETWEEN 2 AND 120
    OR upper(v_city) IN
      ('MACICO_BATURITE','OUTRA_REGIAO')
  ) THEN
    RAISE EXCEPTION 'Municipio opcional invalido'
    USING ERRCODE='22023';
  END IF;

  IF p_vehicle_type NOT IN ('CAR','MOTO')
     OR p_vehicle_type IS NULL THEN
    RAISE EXCEPTION 'Dados pendentes: VEHICLE_TYPE'
    USING ERRCODE='22023';
  END IF;

  IF length(btrim(coalesce(p_vehicle_brand,'')))=0
     OR length(btrim(coalesce(p_vehicle_model,'')))=0
     OR length(btrim(coalesce(p_vehicle_color,'')))=0
  THEN
    RAISE EXCEPTION
      'Dados pendentes: VEHICLE_MODEL,VEHICLE_COLOR'
    USING ERRCODE='22023';
  END IF;

  IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$'
  THEN
    RAISE EXCEPTION 'Dados pendentes: PLATE'
    USING ERRCODE='22023';
  END IF;

  IF p_vehicle_type='CAR' AND (
    v_category NOT IN
      ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')
    OR v_category IS NULL
    OR p_vehicle_seats NOT BETWEEN 1 AND 3
  ) THEN
    RAISE EXCEPTION 'Dados pendentes: CAR_CATEGORY,SEATS'
    USING ERRCODE='22023';
  END IF;

  IF p_vehicle_type='MOTO' AND p_vehicle_seats IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Dados pendentes: SEATS' USING ERRCODE='22023';
  END IF;

  SELECT avatar_url
  INTO v_photo
  FROM public.profiles
  WHERE id=v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil indisponivel'
    USING ERRCODE='22023';
  END IF;

  v_avatar_path:=split_part(
    split_part(coalesce(v_photo,''),'/avatars/',2),
    '?',1
  );

  IF v_avatar_path !~ (
    '^'||v_uid::text||
    '/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$'
  )
  OR NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id='avatars' AND name=v_avatar_path
  ) THEN
    RAISE EXCEPTION 'Dados pendentes: PHOTO'
    USING ERRCODE='22023';
  END IF;

  UPDATE public.profiles
  SET full_name=v_name,
      city=coalesce(v_city,city),
      vehicle_type=lower(p_vehicle_type),
      vehicle_brand=btrim(p_vehicle_brand),
      vehicle_description=btrim(p_vehicle_model),
      vehicle_color=btrim(p_vehicle_color),
      vehicle_plate=v_plate,
      vehicle_seats=p_vehicle_seats,
      updated_at=now()
  WHERE id=v_uid;

  INSERT INTO public.professional_driver_contacts
    (
      user_id,whatsapp_e164,municipality,
      registration_number
    )
  VALUES (
    v_uid,v_phone,v_city,
    CASE WHEN p_vehicle_type='MOTO'
      THEN v_registration ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET whatsapp_e164=EXCLUDED.whatsapp_e164,
      municipality=coalesce(
        EXCLUDED.municipality,
        public.professional_driver_contacts.municipality
      ),
      registration_number=coalesce(EXCLUDED.registration_number,public.professional_driver_contacts.registration_number),
      updated_at=now();

  INSERT INTO public.caronaa_account_whatsapp
    (user_id,whatsapp_e164,contact_consent)
  VALUES (v_uid,v_phone,false)
  ON CONFLICT(user_id) DO UPDATE
  SET whatsapp_e164=EXCLUDED.whatsapp_e164,
      contact_consent=CASE
        WHEN public.caronaa_account_whatsapp.whatsapp_e164
          IS DISTINCT FROM EXCLUDED.whatsapp_e164
        THEN false
        ELSE public.caronaa_account_whatsapp.contact_consent
      END,
      updated_at=now();

  v_snapshot:=jsonb_build_object(
    'full_name',v_name,
    'avatar_url',v_photo,
    'vehicle_model',
      btrim(p_vehicle_brand)||' '||btrim(p_vehicle_model),
    'vehicle_plate',v_plate,
    'vehicle_type',p_vehicle_type,
    'car_category',v_category,
    'passenger_seats',p_vehicle_seats,
    'municipality',coalesce(
      v_city,
      (
        SELECT c.municipality
        FROM public.professional_driver_contacts c
        WHERE c.user_id=v_uid
      ),
      (
        SELECT p.city
        FROM public.profiles p
        WHERE p.id=v_uid
      )
    ),
    'whatsapp_e164',v_phone,
    'vehicle_registration_plate',v_plate,
    'access_type','STANDARD'
  );

  v_request_id:=public.professional_auto_enable(
    v_uid,p_vehicle_type,v_category,p_vehicle_seats,
    v_city,v_snapshot,'STANDARD'
  );

  -- Persist the default active vehicle after the existing eligibility checks.
  IF EXISTS(SELECT 1 FROM public.professional_presence pr
      WHERE pr.user_id=v_uid AND pr.is_available)
  OR EXISTS(SELECT 1 FROM public.professional_quick_rides q
      WHERE q.driver_id=v_uid AND q.accepted_at IS NOT NULL
       AND q.status NOT IN('COMPLETED','CANCELLED','CANCELED','EXPIRED'))
  THEN RAISE EXCEPTION 'Fique offline e conclua as corridas antes de trocar o veiculo'
       USING ERRCODE='42501'; END IF;
  UPDATE public.professional_driver_vehicles SET is_active=false,updated_at=now()
    WHERE user_id=v_uid AND is_active;
  INSERT INTO public.professional_driver_vehicles
    (user_id,vehicle_type,brand,model,color,plate,car_category,passenger_seats,approved,is_active)
  VALUES (v_uid,p_vehicle_type,btrim(p_vehicle_brand),btrim(p_vehicle_model),btrim(p_vehicle_color),
          v_plate,v_category,p_vehicle_seats,true,true)
  ON CONFLICT(user_id,plate) DO UPDATE SET
     brand=excluded.brand,model=excluded.model,color=excluded.color,
     car_category=excluded.car_category,passenger_seats=excluded.passenger_seats,
     is_active=true,updated_at=now();
  UPDATE public.profiles
  SET active_role='MOTORISTA',updated_at=now()
  WHERE id=v_uid;

  INSERT INTO public.user_onboarding_progress
    (
      user_id,status,current_step,usage_role,
      completed_at,updated_at
    )
  VALUES (
    v_uid,'BASIC_COMPLETED','DONE','MOTORISTA',
    now(),now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET status='BASIC_COMPLETED',
      current_step='DONE',
      usage_role='MOTORISTA',
      completed_at=coalesce(
        public.user_onboarding_progress.completed_at,
        now()
      ),
      updated_at=now();

  RETURN v_request_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  v_missing text[];
  v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  SELECT r0.* INTO r FROM public.professional_access_requests r0
    LEFT JOIN public.professional_driver_authorizations a ON a.user_id=v_uid
    WHERE r0.user_id=v_uid
    ORDER BY (r0.status='APPROVED' AND r0.vehicle_type=a.vehicle_type) DESC,
             r0.submitted_at DESC,r0.id DESC LIMIT 1;

  v_missing := CASE WHEN r.id IS NULL
    THEN public.professional_access_missing(v_uid,'CAR','HATCH',1,'XX')
    ELSE public.professional_access_missing(
      v_uid,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality)
  END;

  SELECT coalesce(bool_or(a.approved AND a.vehicle_type=r.vehicle_type),false)
    INTO v_approved
    FROM public.professional_driver_authorizations a WHERE a.user_id=v_uid;

  RETURN jsonb_build_object(
    'authorized',v_approved AND cardinality(v_missing)=0
      AND r.status='APPROVED'
      AND EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id=v_uid
          AND u.email_confirmed_at IS NOT NULL
      ),
    'profileMissing',to_jsonb(v_missing),
    'request',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',r.id,'status',r.status,'access_type',r.access_type,
      'vehicle_type',r.vehicle_type,'car_category',r.car_category,
      'passenger_seats',r.passenger_seats,'municipality',r.municipality,
      'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,
      'review_reason',r.review_reason) END
  );
END
$function$;
CREATE OR REPLACE FUNCTION public.professional_access_missing(p_user uuid, p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  p record;
  m record;
  v text[] := '{}';
  v_plate text;
  v_avatar_path text;
  v_simple boolean;
BEGIN
  SELECT full_name, avatar_url, vehicle_brand,
         vehicle_description, vehicle_color, vehicle_plate,
         vehicle_type, vehicle_seats
  INTO p FROM public.profiles WHERE id=p_user;

  SELECT first_name,last_name,whatsapp_e164,
         region_code,registration_number
  INTO m
  FROM public.professional_mototaxi_profiles
  WHERE user_id=p_user;

  v_simple :=
    p_vehicle_type='MOTO'
    AND p_car_category IS NULL
    AND p_seats=1
    AND EXISTS (
      SELECT 1 FROM public.professional_mototaxi_profiles s WHERE s.user_id=p_user
    )
    AND (SELECT r.access_type FROM public.professional_access_requests r
      WHERE r.user_id=p_user AND r.vehicle_type='MOTO' AND r.status='APPROVED'
      ORDER BY r.submitted_at DESC LIMIT 1)='MOTOTAXI_SIMPLE';

  IF v_simple THEN
    IF length(btrim(coalesce(m.first_name,'')))<2
       OR length(btrim(coalesce(m.last_name,'')))<2
       OR btrim(coalesce(p.full_name,'')) IS DISTINCT FROM
          (btrim(m.first_name)||' '||btrim(m.last_name)) THEN
      v := array_append(v,'FULL_NAME');
    END IF;

    v_avatar_path := split_part(
      split_part(coalesce(p.avatar_url,''),'/avatars/',2),
      '?',1
    );

    IF v_avatar_path !~ (
       '^'||p_user::text||
       '/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$'
    )
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id='avatars' AND name=v_avatar_path
    ) THEN
      v := array_append(v,'PHOTO');
    END IF;

    -- Registro profissional antigo deixou de ser requerido; a placa continua validada abaixo.
  ELSE
    IF coalesce(p.avatar_url,'') !~ '^https://' THEN
      v := array_append(v,'PHOTO');
    END IF;

    IF coalesce(btrim(p.full_name),'')
       !~ '^\S{2,}(\s+\S+)+$' THEN
      v := array_append(v,'FULL_NAME');
    END IF;
  END IF;

  IF length(btrim(coalesce(p.vehicle_brand,'')))=0
     OR length(btrim(coalesce(p.vehicle_description,'')))=0
  THEN
    v := array_append(v,'VEHICLE_MODEL');
  END IF;

  IF length(btrim(coalesce(p.vehicle_color,'')))=0 THEN
    v := array_append(v,'VEHICLE_COLOR');
  END IF;

  v_plate := upper(
    regexp_replace(
      coalesce(p.vehicle_plate,''),
      '[^A-Za-z0-9]','','g'
    )
  );

  IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$'
  THEN
    v := array_append(v,'PLATE');
  END IF;

  IF p_vehicle_type NOT IN ('CAR','MOTO')
     OR p_vehicle_type IS NULL
     OR lower(coalesce(p.vehicle_type,''))
        IS DISTINCT FROM lower(p_vehicle_type)
  THEN
    v := array_append(v,'VEHICLE_TYPE');
  ELSIF p_vehicle_type='CAR'
    AND (
      p_car_category NOT IN
        ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')
      OR p_car_category IS NULL
    )
  THEN
    v := array_append(v,'CAR_CATEGORY');
  END IF;

  IF p_seats IS NULL
     OR p_seats<1 OR p_seats>7
     OR p.vehicle_seats IS NULL
     OR (p_vehicle_type='MOTO'
        AND (p_seats<>1 OR p.vehicle_seats<>1))
     OR (p_vehicle_type='CAR'
        AND (p.vehicle_seats<1 OR p.vehicle_seats>3))
     OR (p_vehicle_type='CAR'
        AND p_car_category IN ('HATCH','SEDAN','PICKUP')
        AND p_seats>4)
     OR (p_vehicle_type='CAR'
        AND p_car_category='SUV' AND p_seats>6)
  THEN
    v := array_append(v,'SEATS');
  END IF;

  RETURN v;
END;
$function$;
CREATE OR REPLACE FUNCTION public.submit_simple_mototaxi_access(p_first_name text, p_last_name text, p_whatsapp text, p_region text, p_registration_number text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_photo text;
  v_name text;
  v_id uuid;
  v_snapshot jsonb;
  v_missing text[];
  v_avatar_path text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Confirme seu e-mail para concluir o cadastro'
    USING ERRCODE='42501';
  END IF;

  IF length(btrim(coalesce(p_first_name,'')))
       NOT BETWEEN 2 AND 70
     OR btrim(p_first_name) ~ '\s'
     OR length(btrim(coalesce(p_last_name,'')))
       NOT BETWEEN 2 AND 70
     OR btrim(p_last_name) ~ '\s'
  THEN
    RAISE EXCEPTION
      'Informe o primeiro nome e ultimo sobrenome'
    USING ERRCODE='22023';
  END IF;

  IF nullif(btrim(p_region),'') IS NOT NULL
     AND p_region NOT IN
       ('MACICO_BATURITE','FORTALEZA')
  THEN
    RAISE EXCEPTION 'Regiao invalida'
    USING ERRCODE='22023';
  END IF;

  -- Matrícula não é mais exigida; a validação de placa ocorre em professional_access_missing.

  v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);

  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
       WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
       WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
       WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164'
       FROM public.professional_access_requests r
       WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
       ORDER BY r.submitted_at DESC LIMIT 1)
    ) INTO v_phone;
  END IF;


  SELECT avatar_url
  INTO v_photo
  FROM public.profiles
  WHERE id=v_uid FOR UPDATE;

  v_avatar_path:=split_part(
    split_part(coalesce(v_photo,''),'/avatars/',2),
    '?',1
  );

  IF v_avatar_path !~ (
    '^'||v_uid::text||
    '/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$'
  )
  OR NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id='avatars' AND name=v_avatar_path
  ) THEN
    RAISE EXCEPTION
      'Envie uma foto de perfil valida para concluir o cadastro'
    USING ERRCODE='22023';
  END IF;

  v_name:=btrim(p_first_name)||' '||btrim(p_last_name);

  UPDATE public.profiles
  SET full_name=v_name,updated_at=now()
  WHERE id=v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de usuario indisponivel';
  END IF;

  INSERT INTO public.professional_mototaxi_profiles
    (
      user_id,first_name,last_name,
      whatsapp_e164,region_code,registration_number
    )
  VALUES (
    v_uid,btrim(p_first_name),btrim(p_last_name),
    v_phone,nullif(btrim(p_region),''),
    btrim(p_registration_number)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET first_name=EXCLUDED.first_name,
      last_name=EXCLUDED.last_name,
      whatsapp_e164=EXCLUDED.whatsapp_e164,
      region_code=coalesce(
        EXCLUDED.region_code,
        public.professional_mototaxi_profiles.region_code
      ),
      registration_number=coalesce(EXCLUDED.registration_number,public.professional_mototaxi_profiles.registration_number),
      updated_at=now();

  INSERT INTO public.caronaa_account_whatsapp
    (user_id,whatsapp_e164,contact_consent)
  VALUES (v_uid,v_phone,false)
  ON CONFLICT(user_id) DO UPDATE
  SET whatsapp_e164=EXCLUDED.whatsapp_e164,
      contact_consent=CASE
        WHEN public.caronaa_account_whatsapp.whatsapp_e164
          IS DISTINCT FROM EXCLUDED.whatsapp_e164
        THEN false
        ELSE public.caronaa_account_whatsapp.contact_consent
      END,
      updated_at=now();

  v_missing:=public.professional_access_missing(
    v_uid,'MOTO',NULL,1,p_region
  );

  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %',
      array_to_string(v_missing,',')
    USING ERRCODE='22023';
  END IF;

  v_snapshot:=jsonb_build_object(
    'full_name',v_name,
    'avatar_url',v_photo,
    'vehicle_model','',
    'vehicle_plate','',
    'vehicle_type','MOTO',
    'car_category',NULL,
    'passenger_seats',1,
    'municipality',coalesce(
      nullif(btrim(p_region),''),
      (
        SELECT m.region_code
        FROM public.professional_mototaxi_profiles m
        WHERE m.user_id=v_uid
      )
    ),
    'region_code',coalesce(
      nullif(btrim(p_region),''),
      (
        SELECT m.region_code
        FROM public.professional_mototaxi_profiles m
        WHERE m.user_id=v_uid
      )
    ),
    'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,
    'vehicle_registration_plate',(SELECT p.vehicle_plate FROM public.profiles p WHERE p.id=v_uid)
  );

  v_id:=public.professional_auto_enable(
    v_uid,'MOTO',NULL,1,
    nullif(btrim(p_region),''),
    v_snapshot,'MOTOTAXI_SIMPLE'
  );

  INSERT INTO public.user_onboarding_progress
    (
      user_id,status,current_step,region_code,
      affiliation_type,institution_code,
      usage_role,completed_at,updated_at
    )
  VALUES (
    v_uid,'BASIC_COMPLETED','DONE',
    nullif(btrim(p_region),''),
    'COMUNIDADE',NULL,'MOTORISTA',now(),now()
  )
  ON CONFLICT(user_id) DO UPDATE
  SET status='BASIC_COMPLETED',
      current_step='DONE',
      completed_at=now(),
      updated_at=now(),
      region_code=coalesce(
        EXCLUDED.region_code,
        public.user_onboarding_progress.region_code
      ),
      affiliation_type='COMUNIDADE',
      institution_code=NULL,
      usage_role='MOTORISTA'
  WHERE public.user_onboarding_progress.status='IN_PROGRESS';

  RETURN v_id;
END;
$function$;


-- List only the authenticated driver's own vehicles.
CREATE OR REPLACE FUNCTION public.get_my_professional_vehicles()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $list$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',v.id,'vehicle_type',v.vehicle_type,'brand',v.brand,'model',v.model,
   'color',v.color,'plate',v.plate,'car_category',v.car_category,
   'passenger_seats',v.passenger_seats,'approved',v.approved,
   'is_active',v.is_active) ORDER BY v.is_active DESC,v.created_at DESC)
   FROM public.professional_driver_vehicles v WHERE v.user_id=v_uid),'[]'::jsonb);
END;$list$;
REVOKE ALL ON FUNCTION public.get_my_professional_vehicles() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_professional_vehicles() TO authenticated;

-- Save a second vehicle only after the driver has an approved professional account.
-- A new vehicle is independently validated; saving never switches live dispatch mode.
CREATE OR REPLACE FUNCTION public.save_my_professional_vehicle(
 p_vehicle_type text,p_brand text,p_model text,p_color text,p_plate text,
 p_car_category text,p_passenger_seats integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $save$
DECLARE
 v_uid uuid:=auth.uid();p public.profiles%ROWTYPE;
 v_plate text:=upper(regexp_replace(coalesce(p_plate,''),'[^A-Za-z0-9]','','g'));
 v_avatar_path text;v_id uuid;v_existing_active boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND OR p.active_role<>'MOTORISTA' THEN
   RAISE EXCEPTION 'Altere para perfil motorista antes de adicionar veiculos' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users u
   WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL
     AND (u.banned_until IS NULL OR u.banned_until<=now()))
 OR NOT EXISTS(SELECT 1 FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved=true)
 OR EXISTS(SELECT 1 FROM public.professional_access_requests r
    WHERE r.user_id=v_uid AND r.status IN('REJECTED','CHANGES_REQUESTED'))
 OR EXISTS(SELECT 1 FROM public.caronaa_f07_pilot_authorization_audit a
    WHERE a.user_id=v_uid AND a.was_previously_approved=false AND a.revoked_at IS NULL)
 THEN RAISE EXCEPTION 'Habilitacao bloqueada; solicite revisao ao suporte'
   USING ERRCODE='42501'; END IF;
 IF p_vehicle_type NOT IN('CAR','MOTO') OR p_vehicle_type IS NULL
 OR length(btrim(coalesce(p_brand,''))) NOT BETWEEN 1 AND 60
 OR length(btrim(coalesce(p_model,''))) NOT BETWEEN 1 AND 160
 OR length(btrim(coalesce(p_color,''))) NOT BETWEEN 1 AND 60
 OR v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$'
 OR (p_vehicle_type='MOTO' AND (p_passenger_seats IS DISTINCT FROM 1 OR p_car_category IS NOT NULL))
 OR (p_vehicle_type='CAR' AND (p_car_category IS NULL OR p_car_category NOT IN('HATCH','SEDAN','SUV','MINIVAN','PICKUP')
       OR p_passenger_seats NOT BETWEEN 1 AND 3))
 THEN RAISE EXCEPTION 'Dados do veiculo invalidos. Confira tipo, placa, marca, modelo e vagas'
   USING ERRCODE='22023'; END IF;
 v_avatar_path:=split_part(split_part(coalesce(p.avatar_url,''),'/avatars/',2),'?',1);
 IF v_avatar_path !~ ('^'||v_uid::text||'/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
 OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='avatars' AND o.name=v_avatar_path)
 THEN RAISE EXCEPTION 'Foto profissional valida obrigatoria' USING ERRCODE='22023'; END IF;
 SELECT is_active INTO v_existing_active FROM public.professional_driver_vehicles
   WHERE user_id=v_uid AND plate=v_plate;
 IF v_existing_active IS TRUE AND (
   EXISTS(SELECT 1 FROM public.professional_presence pr WHERE pr.user_id=v_uid AND pr.is_available)
   OR EXISTS(SELECT 1 FROM public.professional_quick_rides q WHERE q.driver_id=v_uid
     AND q.accepted_at IS NOT NULL AND q.status NOT IN('COMPLETED','CANCELLED','CANCELED','EXPIRED'))
   OR EXISTS(SELECT 1 FROM public.ride_offers o WHERE o.user_id=v_uid
     AND o.status='available' AND o.ride_date >=(now() AT TIME ZONE 'America/Fortaleza')::date)
 ) THEN RAISE EXCEPTION 'Fique offline e conclua corridas e ofertas antes de editar o veiculo ativo'
   USING ERRCODE='42501'; END IF;
 INSERT INTO public.professional_driver_vehicles
   (user_id,vehicle_type,brand,model,color,plate,car_category,passenger_seats,approved,is_active)
 VALUES(v_uid,p_vehicle_type,btrim(p_brand),btrim(p_model),btrim(p_color),
    v_plate,p_car_category,p_passenger_seats,true,false)
 ON CONFLICT(user_id,plate) DO UPDATE SET
   brand=excluded.brand,model=excluded.model,color=excluded.color,
   car_category=excluded.car_category,passenger_seats=excluded.passenger_seats,
   updated_at=now()
   WHERE public.professional_driver_vehicles.vehicle_type=excluded.vehicle_type
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Placa ja registrada com outro tipo de veiculo' USING ERRCODE='22023'; END IF;
 IF v_existing_active IS TRUE THEN
   UPDATE public.profiles SET vehicle_brand=btrim(p_brand),vehicle_description=btrim(p_model),
     vehicle_color=btrim(p_color),vehicle_seats=p_passenger_seats,updated_at=now() WHERE id=v_uid;
 END IF;
 RETURN jsonb_build_object('id',v_id,'plate',v_plate,'saved',true);
END;$save$;
REVOKE ALL ON FUNCTION public.save_my_professional_vehicle(text,text,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_professional_vehicle(text,text,text,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_my_professional_vehicle(p_vehicle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $activate$
DECLARE v_uid uuid:=auth.uid();v public.professional_driver_vehicles%ROWTYPE;
 v_current public.professional_driver_authorizations%ROWTYPE;
 v_snapshot jsonb;v_request_id uuid;v_new_request boolean:=false;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_uid AND active_role='MOTORISTA' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil motorista necessario' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.professional_driver_vehicles
    WHERE id=p_vehicle_id AND user_id=v_uid AND approved=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Veiculo nao habilitado para esta conta' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_current FROM public.professional_driver_authorizations WHERE user_id=v_uid FOR UPDATE;
 IF NOT FOUND OR v_current.approved IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Autorizacao profissional suspensa' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.professional_access_requests r WHERE r.user_id=v_uid
    AND r.status IN('REJECTED','CHANGES_REQUESTED'))
 OR EXISTS(SELECT 1 FROM public.caronaa_f07_pilot_authorization_audit a
    WHERE a.user_id=v_uid AND a.was_previously_approved=false AND a.revoked_at IS NULL)
 THEN RAISE EXCEPTION 'Revise sua autorizacao com o suporte' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.professional_presence pr
      WHERE pr.user_id=v_uid AND pr.is_available)
 OR EXISTS(SELECT 1 FROM public.professional_quick_rides q
      WHERE q.driver_id=v_uid AND q.accepted_at IS NOT NULL
         AND q.status NOT IN ('COMPLETED','CANCELLED','CANCELED','EXPIRED'))
 OR EXISTS(SELECT 1 FROM public.rides r
      WHERE r.driver_user_id=v_uid AND r.status NOT IN('COMPLETED','CANCELLED','CANCELED','EXPIRED','REJECTED'))
 OR EXISTS(SELECT 1 FROM public.ride_offers o
      WHERE o.user_id=v_uid AND o.status='available' AND o.ride_date >= (now() AT TIME ZONE 'America/Fortaleza')::date)
 THEN RAISE EXCEPTION 'Fique offline e finalize corridas e ofertas antes de trocar de veiculo'
   USING ERRCODE='42501'; END IF;
 IF v.is_active AND v_current.vehicle_type=v.vehicle_type THEN
   RETURN jsonb_build_object('active',true,'vehicle_id',v.id,'plate',v.plate,'type',v.vehicle_type);
 END IF;
 UPDATE public.professional_driver_vehicles SET is_active=false,updated_at=now()
   WHERE user_id=v_uid AND is_active;
 UPDATE public.professional_driver_vehicles SET is_active=true,updated_at=now()
   WHERE user_id=v_uid AND id=v.id;
 UPDATE public.profiles SET vehicle_type=lower(v.vehicle_type),vehicle_brand=v.brand,
   vehicle_description=v.model,vehicle_color=v.color,vehicle_plate=v.plate,
   vehicle_seats=v.passenger_seats,updated_at=now() WHERE id=v_uid;
 UPDATE public.professional_driver_authorizations SET vehicle_type=v.vehicle_type,updated_at=now()
   WHERE user_id=v_uid AND approved=true;
 v_snapshot:=jsonb_build_object(
   'vehicle_type',v.vehicle_type,'vehicle_plate',v.plate,
   'vehicle_model',v.brand||' '||v.model,'car_category',v.car_category,
   'passenger_seats',v.passenger_seats,
   'full_name',(SELECT p.full_name FROM public.profiles p WHERE p.id=v_uid),
   'avatar_url',(SELECT p.avatar_url FROM public.profiles p WHERE p.id=v_uid),
   'municipality',(SELECT c.municipality FROM public.professional_driver_contacts c WHERE c.user_id=v_uid),
   'access_type','STANDARD');
 SELECT r.id INTO v_request_id FROM public.professional_access_requests r
   WHERE r.user_id=v_uid AND r.vehicle_type=v.vehicle_type AND r.status='APPROVED'
   ORDER BY r.submitted_at DESC LIMIT 1 FOR UPDATE;
 IF v_request_id IS NULL THEN
   INSERT INTO public.professional_access_requests
     (user_id,status,vehicle_type,car_category,passenger_seats,municipality,snapshot,access_type,
      reviewed_at,review_reason)
   VALUES(v_uid,'APPROVED',v.vehicle_type,v.car_category,v.passenger_seats,
     (SELECT c.municipality FROM public.professional_driver_contacts c WHERE c.user_id=v_uid),
     v_snapshot,'STANDARD',now(),'AUTO_VEICULO_ADICIONAL_VALIDADO')
   RETURNING id INTO v_request_id;
   v_new_request:=true;
 ELSE
   UPDATE public.professional_access_requests
   SET snapshot=v_snapshot,passenger_seats=v.passenger_seats,car_category=v.car_category,updated_at=now()
   WHERE id=v_request_id;
 END IF;
 IF v_new_request THEN
  INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
   VALUES(v_request_id,v_uid,'SUBMITTED','Veiculo adicional cadastrado'),
         (v_request_id,v_uid,'APPROVED','AUTO_VEICULO_ADICIONAL_VALIDADO');
 END IF;
 RETURN jsonb_build_object('active',true,'vehicle_id',v.id,'plate',v.plate,'type',v.vehicle_type);
END;$activate$;
REVOKE ALL ON FUNCTION public.activate_my_professional_vehicle(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_my_professional_vehicle(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;