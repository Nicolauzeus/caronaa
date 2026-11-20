-- CARONAA F02/F07 | 0220: driver registered home region is optional.
-- Apply AFTER 0219_whatsapp_preservar_existentes.sql, BEFORE publishing matching UI.
-- GPS-based operating municipality, coverage/dispatch, 15 km radius, authorizations,
-- safety, financial controls and the existing WhatsApp-preservation logic are retained.
-- Does not update historic rides, authorize suspended drivers or settle payments.
BEGIN;

ALTER TABLE public.professional_access_requests ALTER COLUMN municipality DROP NOT NULL;
ALTER TABLE public.professional_driver_contacts ALTER COLUMN municipality DROP NOT NULL;
ALTER TABLE public.professional_mototaxi_profiles ALTER COLUMN region_code DROP NOT NULL;

-- professional_access_missing
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
  SELECT full_name, avatar_url, vehicle_brand, vehicle_description,
         vehicle_color, vehicle_plate, vehicle_type, vehicle_seats
    INTO p FROM public.profiles WHERE id=p_user;
  SELECT first_name,last_name,whatsapp_e164,region_code,registration_number
    INTO m FROM public.professional_mototaxi_profiles WHERE user_id=p_user;

  v_simple :=
    p_vehicle_type='MOTO' AND p_car_category IS NULL AND p_seats=1
    AND EXISTS (SELECT 1 FROM public.professional_mototaxi_profiles s WHERE s.user_id=p_user);

  IF v_simple THEN
    IF length(btrim(coalesce(m.first_name,'')))<2
       OR length(btrim(coalesce(m.last_name,'')))<2
       OR btrim(coalesce(p.full_name,'')) IS DISTINCT FROM
         (btrim(m.first_name)||' '||btrim(m.last_name)) THEN
      v := array_append(v, 'FULL_NAME');
    END IF;
    v_avatar_path := split_part(split_part(coalesce(p.avatar_url,''),'/avatars/',2),'?',1);
    IF v_avatar_path !~ ('^'||p_user::text||'/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id='avatars' AND name=v_avatar_path
       ) THEN v := array_append(v, 'PHOTO'); END IF;
    IF length(btrim(coalesce(m.registration_number,'')))<2 THEN
      v := array_append(v, 'REGISTRATION');
    END IF;
  ELSE
    IF coalesce(p.avatar_url,'') !~ '^https://' THEN v := array_append(v, 'PHOTO'); END IF;
    IF coalesce(btrim(p.full_name),'') !~ '^\S{2,}(\s+\S+)+$' THEN
      v := array_append(v, 'FULL_NAME');
    END IF;
  END IF;

  -- Mandatory for BOTH registration paths. The old simplified exception
  -- must never turn empty vehicle fields into a valid professional profile.
  IF length(btrim(coalesce(p.vehicle_brand,'')))=0
     OR length(btrim(coalesce(p.vehicle_description,'')))=0 THEN
    v := array_append(v, 'VEHICLE_MODEL');
  END IF;
  IF length(btrim(coalesce(p.vehicle_color,'')))=0 THEN
    v := array_append(v, 'VEHICLE_COLOR');
  END IF;
  v_plate := upper(regexp_replace(coalesce(p.vehicle_plate,''),'[^A-Za-z0-9]','','g'));
  IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$' THEN
    v := array_append(v, 'PLATE');
  END IF;

  IF p_vehicle_type NOT IN ('CAR','MOTO') OR p_vehicle_type IS NULL
     OR lower(coalesce(p.vehicle_type,'')) IS DISTINCT FROM lower(p_vehicle_type) THEN
    v := array_append(v, 'VEHICLE_TYPE');
  ELSIF p_vehicle_type='CAR'
     AND (p_car_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')
          OR p_car_category IS NULL) THEN
    v := array_append(v, 'CAR_CATEGORY');
  END IF;

  IF p_seats IS NULL OR p_seats<1 OR p_seats>7
     OR p.vehicle_seats IS NULL
     OR (p_vehicle_type='MOTO' AND (p_seats<>1 OR p.vehicle_seats<>1))
     OR (p_vehicle_type='CAR' AND (p.vehicle_seats<1 OR p.vehicle_seats>3))
     OR (p_vehicle_type='CAR' AND p_car_category IN ('HATCH','SEDAN','PICKUP') AND p_seats>4)
     OR (p_vehicle_type='CAR' AND p_car_category='SUV' AND p_seats>6) THEN
    v := array_append(v, 'SEATS');
  END IF;
  RETURN v;
END;
$function$;

-- professional_auto_enable
CREATE OR REPLACE FUNCTION public.professional_auto_enable(p_uid uuid, p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text, p_snapshot jsonb, p_access_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_existing_approval boolean;
  v_existing_vehicle text;
  v_current public.professional_access_requests%ROWTYPE;
  v_missing text[];
  v_rows integer;
  v_standard_model text;
  v_standard_plate text;
  v_new_request boolean := false;
BEGIN
  IF v_uid IS NULL OR p_uid IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Sessao invalida para ativar motorista' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id=v_uid AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirme seu e-mail para trabalhar' USING ERRCODE='42501';
  END IF;
  -- Serialize submissions from two tabs/devices for the same account.
  PERFORM 1 FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil indisponivel. Complete seu cadastro.' USING ERRCODE='22023';
  END IF;
  IF p_access_type NOT IN ('STANDARD','MOTOTAXI_SIMPLE') OR p_vehicle_type NOT IN ('CAR','MOTO') THEN
    RAISE EXCEPTION 'Modalidade profissional invalida' USING ERRCODE='22023';
  END IF;
  IF p_access_type='MOTOTAXI_SIMPLE' AND (
      p_vehicle_type<>'MOTO' OR p_car_category IS NOT NULL OR p_seats<>1
      OR (nullif(btrim(p_municipality),'') IS NOT NULL
          AND p_municipality NOT IN ('MACICO_BATURITE','FORTALEZA'))
      OR NOT EXISTS (
        SELECT 1 FROM public.professional_mototaxi_profiles
        WHERE user_id=v_uid
      )
    ) THEN
    RAISE EXCEPTION 'Cadastro de mototaxi incompleto' USING ERRCODE='22023';
  END IF;

  -- Recheck ALL mandatory data in the DB; form completion alone is not proof.
  v_missing := public.professional_access_missing(
    v_uid,p_vehicle_type,p_car_category,p_seats,p_municipality
  );
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %',array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  -- The MOTOTAXI_SIMPLE exception must not remove vehicle obligations from
  -- the standard professional motorcycle registration.
  IF p_access_type='STANDARD' AND p_vehicle_type='MOTO' THEN
    SELECT btrim(coalesce(vehicle_brand,'')||' '||coalesce(vehicle_description,'')),
      upper(regexp_replace(coalesce(vehicle_plate,''),'[\s-]','','g'))
      INTO v_standard_model,v_standard_plate
      FROM public.profiles WHERE id=v_uid;
    IF length(coalesce(v_standard_model,''))<3 THEN
      RAISE EXCEPTION 'Dados pendentes: VEHICLE_MODEL' USING ERRCODE='22023';
    END IF;
    IF coalesce(v_standard_plate,'') !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN
      RAISE EXCEPTION 'Dados pendentes: PLATE' USING ERRCODE='22023';
    END IF;
  END IF;

  -- A profile municipality is optional; verified GPS and coverage gate dispatch.

  -- Explicit prior administrative decisions and suspensions must not be
  -- reversed by submitting a form again.
  IF EXISTS (
    SELECT 1 FROM public.professional_access_requests
    WHERE user_id=v_uid AND status IN ('REJECTED','CHANGES_REQUESTED')
  ) THEN
    RAISE EXCEPTION 'Cadastro bloqueado para revisao. Procure o suporte CARONAA.'
      USING ERRCODE='42501';
  END IF;
  SELECT approved,vehicle_type INTO v_existing_approval,v_existing_vehicle
    FROM public.professional_driver_authorizations
    WHERE user_id=v_uid FOR UPDATE;
  IF FOUND AND (v_existing_approval IS NOT TRUE OR v_existing_vehicle<>p_vehicle_type) THEN
    RAISE EXCEPTION 'Autorizacao anterior bloqueada ou de outro veiculo. Procure o suporte.'
      USING ERRCODE='42501';
  END IF;

  -- A temporary homologation authorization is not promoted into an
  -- unconditional production authorization by this operation.
  IF EXISTS (
    SELECT 1 FROM public.caronaa_f07_pilot_authorization_audit
    WHERE user_id=v_uid AND was_previously_approved IS FALSE
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Acesso de homologacao precisa de encerramento antes de habilitar.'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_current
    FROM public.professional_access_requests
    WHERE user_id=v_uid AND status='PENDING'
    ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;

  IF v_current.id IS NOT NULL THEN
    v_id := v_current.id;
    UPDATE public.professional_access_requests
      SET status='APPROVED',vehicle_type=p_vehicle_type,
          car_category=p_car_category,passenger_seats=p_seats,
          municipality=coalesce(nullif(btrim(p_municipality),''),municipality),snapshot=p_snapshot,access_type=p_access_type,
          reviewed_by=NULL,reviewed_at=now(),
          review_reason='AUTO_CADASTRO_COMPLETO_F02',updated_at=now()
      WHERE id=v_id;
  ELSE
    SELECT * INTO v_current
      FROM public.professional_access_requests
      WHERE user_id=v_uid AND status='APPROVED'
        AND vehicle_type=p_vehicle_type AND access_type=p_access_type
      ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
    IF v_current.id IS NOT NULL THEN
      v_id := v_current.id;
      -- Existing active driver editing complete data stays active. Keep the
      -- snapshot current without producing a duplicate approval event.
      UPDATE public.professional_access_requests
        SET municipality=coalesce(nullif(btrim(p_municipality),''),municipality),car_category=p_car_category,
            passenger_seats=p_seats,snapshot=p_snapshot,updated_at=now()
        WHERE id=v_id
          AND (municipality,car_category,passenger_seats,snapshot)
               IS DISTINCT FROM (coalesce(nullif(btrim(p_municipality),''),municipality),p_car_category,p_seats,p_snapshot);
    ELSE
      INSERT INTO public.professional_access_requests
        (user_id,status,vehicle_type,car_category,passenger_seats,
         municipality,snapshot,access_type,reviewed_by,reviewed_at,review_reason)
      VALUES
        (v_uid,'APPROVED',p_vehicle_type,p_car_category,p_seats,
         nullif(btrim(p_municipality),''),p_snapshot,p_access_type,NULL,now(),'AUTO_CADASTRO_COMPLETO_F02')
      RETURNING id INTO v_id;
      v_new_request := true;
    END IF;
  END IF;

  INSERT INTO public.professional_driver_authorizations
    (user_id,approved,vehicle_type,approved_at,updated_at)
  VALUES (v_uid,true,p_vehicle_type,now(),now())
  ON CONFLICT (user_id) DO UPDATE
    SET approved=true,vehicle_type=EXCLUDED.vehicle_type,
        approved_at=coalesce(public.professional_driver_authorizations.approved_at,now()),
        updated_at=now()
    WHERE public.professional_driver_authorizations.approved IS TRUE
      AND public.professional_driver_authorizations.vehicle_type=EXCLUDED.vehicle_type;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>1 THEN
    RAISE EXCEPTION 'Nao foi possivel confirmar a autorizacao profissional'
      USING ERRCODE='42501';
  END IF;

  -- Event actors are the authenticated initiator; the reason explicitly
  -- marks a server-issued automatic activation, NOT an administrator review.
  IF v_new_request THEN
    INSERT INTO public.professional_access_request_events
      (request_id,actor_id,action,reason)
    VALUES (v_id,v_uid,'SUBMITTED','Cadastro profissional completo');
  END IF;
  IF v_new_request OR v_current.id IS NULL OR v_current.status='PENDING' THEN
    INSERT INTO public.professional_access_request_events
      (request_id,actor_id,action,reason)
    VALUES (v_id,v_uid,'APPROVED','AUTO_CADASTRO_COMPLETO_F02');
  END IF;

  RETURN v_id;
END
$function$;

-- complete_professional_driver_registration
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
  v_plate text:=upper(regexp_replace(coalesce(p_vehicle_plate,''),'[^A-Za-z0-9]','','g'));
  v_photo text;
  v_avatar_path text;
  v_category text:=CASE WHEN p_vehicle_type='CAR' THEN p_car_category ELSE NULL END;
  v_registration text:=nullif(btrim(coalesce(p_registration_number,'')),'');
  v_first text;
  v_last text;
  v_request_id uuid;
  v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirme seu e-mail para concluir o cadastro'
      USING ERRCODE='42501';
  END IF;
  IF v_name !~ '^[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}' OR length(v_name)>120 THEN
    RAISE EXCEPTION 'Dados pendentes: FULL_NAME' USING ERRCODE='22023';
  END IF;
  v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
  -- Preserve a previously registered WhatsApp if this optional field is blank.
  -- Keep the 0219 protection; registration must not erase an existing contact.
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
    OR upper(v_city) IN ('MACICO_BATURITE','OUTRA_REGIAO')
  ) THEN RAISE EXCEPTION 'Municipio opcional invalido' USING ERRCODE='22023'; END IF;
  IF p_vehicle_type NOT IN ('CAR','MOTO') OR p_vehicle_type IS NULL THEN
    RAISE EXCEPTION 'Dados pendentes: VEHICLE_TYPE' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_vehicle_brand,'')))=0
    OR length(btrim(coalesce(p_vehicle_model,'')))=0
    OR length(btrim(coalesce(p_vehicle_color,'')))=0 THEN
    RAISE EXCEPTION 'Dados pendentes: VEHICLE_MODEL,VEHICLE_COLOR'
      USING ERRCODE='22023';
  END IF;
  IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$' THEN
    RAISE EXCEPTION 'Dados pendentes: PLATE' USING ERRCODE='22023';
  END IF;
  IF p_vehicle_type='CAR' AND (
     v_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')
     OR v_category IS NULL OR p_vehicle_seats NOT BETWEEN 1 AND 3
  ) THEN
    RAISE EXCEPTION 'Dados pendentes: CAR_CATEGORY,SEATS'
      USING ERRCODE='22023';
  END IF;
  IF p_vehicle_type='MOTO' AND (
     p_vehicle_seats IS DISTINCT FROM 1
     OR length(coalesce(v_registration,''))<2
  ) THEN
    RAISE EXCEPTION 'Dados pendentes: REGISTRATION,SEATS'
      USING ERRCODE='22023';
  END IF;
  SELECT avatar_url INTO v_photo FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponivel' USING ERRCODE='22023'; END IF;
  v_avatar_path:=split_part(split_part(coalesce(v_photo,''),'/avatars/',2),'?',1);
  IF v_avatar_path !~ ('^'||v_uid::text||'/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id='avatars' AND name=v_avatar_path
    ) THEN
    RAISE EXCEPTION 'Dados pendentes: PHOTO' USING ERRCODE='22023';
  END IF;
  -- Existing authorization and blocked application checks remain inside
  -- professional_auto_enable. A failed check rolls all writes back.
  UPDATE public.profiles
  SET full_name=v_name,city=coalesce(v_city,city),vehicle_type=lower(p_vehicle_type),
      vehicle_brand=btrim(p_vehicle_brand),
      vehicle_description=btrim(p_vehicle_model),
      vehicle_color=btrim(p_vehicle_color),vehicle_plate=v_plate,
      vehicle_seats=p_vehicle_seats,updated_at=now()
  WHERE id=v_uid;

  INSERT INTO public.professional_driver_contacts
    (user_id,whatsapp_e164,municipality,registration_number)
  VALUES (v_uid,v_phone,v_city,CASE WHEN p_vehicle_type='MOTO' THEN v_registration ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE SET
    whatsapp_e164=EXCLUDED.whatsapp_e164,
    municipality=coalesce(EXCLUDED.municipality,public.professional_driver_contacts.municipality),
    registration_number=EXCLUDED.registration_number,
    updated_at=now();

  INSERT INTO public.caronaa_account_whatsapp(user_id,whatsapp_e164,contact_consent)
    VALUES(v_uid,v_phone,false)
    ON CONFLICT(user_id) DO UPDATE SET
      whatsapp_e164=EXCLUDED.whatsapp_e164,
      contact_consent=CASE WHEN public.caronaa_account_whatsapp.whatsapp_e164
        IS DISTINCT FROM EXCLUDED.whatsapp_e164 THEN false
        ELSE public.caronaa_account_whatsapp.contact_consent END,
      updated_at=now();

  v_snapshot:=jsonb_build_object(
    'full_name',v_name,'avatar_url',v_photo,
    'vehicle_model',btrim(p_vehicle_brand)||' '||btrim(p_vehicle_model),
    'vehicle_plate',v_plate,'vehicle_type',p_vehicle_type,
    'car_category',v_category,'passenger_seats',p_vehicle_seats,
    'municipality',coalesce(v_city,(SELECT c.municipality FROM public.professional_driver_contacts c WHERE c.user_id=v_uid),(SELECT p.city FROM public.profiles p WHERE p.id=v_uid)),'whatsapp_e164',v_phone,
    'registration_number',CASE WHEN p_vehicle_type='MOTO' THEN v_registration ELSE NULL END,
    'access_type','STANDARD'
  );
  v_request_id:=public.professional_auto_enable(
    v_uid,p_vehicle_type,v_category,p_vehicle_seats,v_city,v_snapshot,'STANDARD'
  );
  UPDATE public.profiles SET active_role='MOTORISTA',updated_at=now()
  WHERE id=v_uid;
  INSERT INTO public.user_onboarding_progress
    (user_id,status,current_step,usage_role,completed_at,updated_at)
  VALUES (v_uid,'BASIC_COMPLETED','DONE','MOTORISTA',now(),now())
  ON CONFLICT (user_id) DO UPDATE SET
    status='BASIC_COMPLETED',current_step='DONE',usage_role='MOTORISTA',
    completed_at=coalesce(public.user_onboarding_progress.completed_at,now()),
    updated_at=now();
  RETURN v_request_id;
END
$function$;

-- submit_simple_mototaxi_access
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
    SELECT 1 FROM auth.users WHERE id=v_uid AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Confirme seu e-mail para concluir o cadastro' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_first_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_first_name) ~ '\s'
     OR length(btrim(coalesce(p_last_name,''))) NOT BETWEEN 2 AND 70
     OR btrim(p_last_name) ~ '\s' THEN
    RAISE EXCEPTION 'Informe o primeiro nome e ultimo sobrenome' USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(p_region),'') IS NOT NULL
     AND p_region NOT IN ('MACICO_BATURITE','FORTALEZA') THEN
    RAISE EXCEPTION 'Regiao invalida' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_registration_number,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe a matricula/registro' USING ERRCODE='22023';
  END IF;
  v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
  -- Preserve a previously registered WhatsApp if this optional field is blank.
  -- Keep the 0219 protection; registration must not erase an existing contact.
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

  SELECT avatar_url INTO v_photo FROM public.profiles WHERE id=v_uid FOR UPDATE;
  v_avatar_path := split_part(split_part(coalesce(v_photo,''), '/avatars/', 2), '?', 1);
  IF v_avatar_path !~ ('^' || v_uid::text || '/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects
       WHERE bucket_id = 'avatars' AND name = v_avatar_path
     ) THEN
    RAISE EXCEPTION 'Envie uma foto de perfil valida para concluir o cadastro'
      USING ERRCODE='22023';
  END IF;
  v_name := btrim(p_first_name) || ' ' || btrim(p_last_name);
  UPDATE public.profiles SET full_name=v_name, updated_at=now() WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de usuario indisponivel'; END IF;

  INSERT INTO public.professional_mototaxi_profiles
    (user_id,first_name,last_name,whatsapp_e164,region_code,registration_number)
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,nullif(btrim(p_region),''),
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=coalesce(EXCLUDED.region_code,public.professional_mototaxi_profiles.region_code),
    registration_number=EXCLUDED.registration_number, updated_at=now();

  INSERT INTO public.caronaa_account_whatsapp(user_id,whatsapp_e164,contact_consent)
    VALUES(v_uid,v_phone,false)
    ON CONFLICT(user_id) DO UPDATE SET
      whatsapp_e164=EXCLUDED.whatsapp_e164,
      contact_consent=CASE WHEN public.caronaa_account_whatsapp.whatsapp_e164
        IS DISTINCT FROM EXCLUDED.whatsapp_e164 THEN false
        ELSE public.caronaa_account_whatsapp.contact_consent END,
      updated_at=now();

  v_missing := public.professional_access_missing(v_uid,'MOTO',NULL,1,p_region);
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %', array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  v_snapshot := jsonb_build_object(
    'full_name',v_name, 'avatar_url',v_photo, 'vehicle_model','', 'vehicle_plate','',
    'vehicle_type','MOTO','car_category',NULL,'passenger_seats',1,
    'municipality',coalesce(nullif(btrim(p_region),''),(SELECT m.region_code FROM public.professional_mototaxi_profiles m WHERE m.user_id=v_uid)),
    'region_code',coalesce(nullif(btrim(p_region),''),(SELECT m.region_code FROM public.professional_mototaxi_profiles m WHERE m.user_id=v_uid)),
    'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  -- The platform enables a complete verified account immediately. This is
  -- not a driver's self-declared permission: the authorization row is granted
  -- atomically by the DB after every existing profile/photograph check.
  v_id := public.professional_auto_enable(
    v_uid,'MOTO',NULL,1,nullif(btrim(p_region),''),v_snapshot,'MOTOTAXI_SIMPLE'
  );
  INSERT INTO public.user_onboarding_progress
    (user_id,status,current_step,region_code,affiliation_type,institution_code,
     usage_role,completed_at,updated_at)
  VALUES (v_uid,'BASIC_COMPLETED','DONE',nullif(btrim(p_region),''),'COMUNIDADE',NULL,'MOTORISTA',now(),now())
  ON CONFLICT (user_id) DO UPDATE SET
    status='BASIC_COMPLETED',current_step='DONE',completed_at=now(),updated_at=now(),
    region_code=coalesce(EXCLUDED.region_code,public.user_onboarding_progress.region_code),affiliation_type='COMUNIDADE',
    institution_code=NULL,usage_role='MOTORISTA'
    WHERE public.user_onboarding_progress.status='IN_PROGRESS';
  RETURN v_id;
END
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
