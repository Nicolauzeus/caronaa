-- 0219 | HOTFIX: preserve WhatsApp numbers that existed before 0218.
-- Apply after 0218. Never erase a number because an optional registration field is blank.
-- The correct UI permits edits, not deletion. All writes are transactional.
BEGIN;

DO $preflight$
BEGIN
 IF to_regclass('public.caronaa_account_whatsapp') IS NULL
    OR to_regclass('public.professional_driver_contacts') IS NULL
    OR to_regclass('public.professional_mototaxi_profiles') IS NULL
    OR to_regprocedure('public.caronaa_normalize_whatsapp(text)') IS NULL
 THEN RAISE EXCEPTION '0219 depends on migration 0218'; END IF;
END; $preflight$;

-- Backfill from both pre-existing professional phone stores, without changing
-- contacts already populated in the new table. No CRM consent is invented.
INSERT INTO public.caronaa_account_whatsapp(user_id,whatsapp_e164,contact_consent)
SELECT DISTINCT ON (user_id) user_id,whatsapp_e164,false
FROM (
  SELECT c.user_id,c.whatsapp_e164,1 AS priority
    FROM public.professional_driver_contacts c
    WHERE c.whatsapp_e164 IS NOT NULL
  UNION ALL
  SELECT m.user_id,m.whatsapp_e164,2 AS priority
    FROM public.professional_mototaxi_profiles m
    WHERE m.whatsapp_e164 IS NOT NULL
  UNION ALL
  -- Recover numbers from historical approved/requested snapshots when both
  -- current profile tables were accidentally overwritten with NULL.
  SELECT r.user_id,r.snapshot->>'whatsapp_e164',3 AS priority
    FROM public.professional_access_requests r
    WHERE r.snapshot->>'whatsapp_e164' IS NOT NULL
) legacy
WHERE whatsapp_e164 ~ '^[+]55[0-9]{11}
    SELECT 1 FROM public.caronaa_account_whatsapp a
    WHERE a.user_id=legacy.user_id AND a.whatsapp_e164 IS NOT NULL
  )
ORDER BY user_id,priority
ON CONFLICT(user_id) DO UPDATE SET
  whatsapp_e164=CASE
    WHEN public.caronaa_account_whatsapp.whatsapp_e164 IS NULL
    THEN EXCLUDED.whatsapp_e164
    ELSE public.caronaa_account_whatsapp.whatsapp_e164 END,
  updated_at=CASE
    WHEN public.caronaa_account_whatsapp.whatsapp_e164 IS NULL THEN now()
    ELSE public.caronaa_account_whatsapp.updated_at END;

-- Filtering by auth.users is required by caronaa_account_whatsapp_user_id_fkey.
-- Deleted users' source records remain intact for historical/audit review.
-- DISTINCT ON chooses one historical source per account and prevents a
-- PostgreSQL ON CONFLICT multi-update. Never changes non-null new-table values.

CREATE OR REPLACE FUNCTION public.get_my_caronaa_whatsapp()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $get$
DECLARE
 v_uid uuid:=auth.uid();
 v_contact public.caronaa_account_whatsapp%ROWTYPE;
 v_phone text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_contact FROM public.caronaa_account_whatsapp WHERE user_id=v_uid;
 SELECT coalesce(
   nullif(v_contact.whatsapp_e164,''),
   (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
     WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
   (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
     WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
   (SELECT r.snapshot->>'whatsapp_e164' FROM public.professional_access_requests r
     WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
     ORDER BY r.submitted_at DESC LIMIT 1)
 ) INTO v_phone;
 RETURN jsonb_build_object('whatsapp',v_phone,
   'contact_consent',coalesce(v_contact.contact_consent,false));
END;$get$;

CREATE OR REPLACE FUNCTION public.set_my_caronaa_whatsapp(
 p_whatsapp text,p_contact_consent boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $set$
DECLARE
 v_uid uuid:=auth.uid();
 v_phone text;
 v_consent boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponivel' USING ERRCODE='42501'; END IF;
 -- Edits only: never interpret missing input as a deletion.
 IF p_whatsapp IS NULL OR nullif(btrim(p_whatsapp),'') IS NULL THEN
   RAISE EXCEPTION 'Informe o novo numero para alterar seu WhatsApp'
     USING ERRCODE='22023';
 END IF;
 v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
 v_consent:=coalesce(p_contact_consent,false);
 INSERT INTO public.caronaa_account_whatsapp(user_id,whatsapp_e164,contact_consent)
 VALUES(v_uid,v_phone,v_consent)
 ON CONFLICT(user_id) DO UPDATE SET
   whatsapp_e164=EXCLUDED.whatsapp_e164,
   contact_consent=EXCLUDED.contact_consent,updated_at=now();
 UPDATE public.professional_driver_contacts
   SET whatsapp_e164=v_phone,updated_at=now() WHERE user_id=v_uid;
 UPDATE public.professional_mototaxi_profiles
   SET whatsapp_e164=v_phone,updated_at=now() WHERE user_id=v_uid;
 RETURN jsonb_build_object('whatsapp',v_phone,'contact_consent',v_consent);
END;$set$;
REVOKE ALL ON FUNCTION public.get_my_caronaa_whatsapp() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_caronaa_whatsapp() TO authenticated;
REVOKE ALL ON FUNCTION public.set_my_caronaa_whatsapp(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_caronaa_whatsapp(text,boolean) TO authenticated;

-- Existing registration functions are replaced in-place, preserving all other
-- business rules from 0218 and using existing contact on empty input.

CREATE OR REPLACE FUNCTION public.complete_professional_driver_registration(
 p_full_name text,p_whatsapp text,p_municipality text,p_vehicle_type text,
 p_vehicle_brand text,p_vehicle_model text,p_vehicle_color text,
 p_vehicle_plate text,p_car_category text,p_vehicle_seats integer,
 p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $register$
DECLARE
  v_uid uuid:=auth.uid();
  v_phone text;
  v_name text:=btrim(coalesce(p_full_name,''));
  v_city text:=btrim(coalesce(p_municipality,''));
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
  -- On an empty registration field, retain the verified account contact,
  -- falling back to the two legacy stores. Never turn an existing phone into NULL.
  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
        WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
        WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
        WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164' FROM public.professional_access_requests r
        WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
        ORDER BY r.submitted_at DESC LIMIT 1)
    ) INTO v_phone;
  END IF;
  IF length(v_city) NOT BETWEEN 2 AND 120
    OR upper(v_city) IN ('MACICO_BATURITE','OUTRA_REGIAO') THEN
    RAISE EXCEPTION 'Dados pendentes: MUNICIPALITY' USING ERRCODE='22023';
  END IF;
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
  SET full_name=v_name,city=v_city,vehicle_type=lower(p_vehicle_type),
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
    municipality=EXCLUDED.municipality,
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
    'municipality',v_city,'whatsapp_e164',v_phone,
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
$register$;

CREATE OR REPLACE FUNCTION public.submit_simple_mototaxi_access(
  p_first_name text, p_last_name text, p_whatsapp text,
  p_region text, p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $submit$
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
  IF p_region NOT IN ('MACICO_BATURITE','FORTALEZA') OR p_region IS NULL THEN
    RAISE EXCEPTION 'Regiao invalida' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_registration_number,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe a matricula/registro' USING ERRCODE='22023';
  END IF;
  v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
  -- On an empty registration field, retain the verified account contact,
  -- falling back to the two legacy stores. Never turn an existing phone into NULL.
  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
        WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
        WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
        WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164' FROM public.professional_access_requests r
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
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,p_region,
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=EXCLUDED.region_code,
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
    'municipality',p_region,'region_code',p_region,'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  -- The platform enables a complete verified account immediately. This is
  -- not a driver's self-declared permission: the authorization row is granted
  -- atomically by the DB after every existing profile/photograph check.
  v_id := public.professional_auto_enable(
    v_uid,'MOTO',NULL,1,p_region,v_snapshot,'MOTOTAXI_SIMPLE'
  );
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

NOTIFY pgrst,'reload schema';
COMMIT;

  -- Old professional records may outlive deleted auth accounts. Keep those
  -- historical records untouched, but never insert an orphan FK into the new table.
  AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id=legacy.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.caronaa_account_whatsapp a
    WHERE a.user_id=legacy.user_id AND a.whatsapp_e164 IS NOT NULL
  )
ORDER BY user_id,priority
ON CONFLICT(user_id) DO UPDATE SET
  whatsapp_e164=CASE
    WHEN public.caronaa_account_whatsapp.whatsapp_e164 IS NULL
    THEN EXCLUDED.whatsapp_e164
    ELSE public.caronaa_account_whatsapp.whatsapp_e164 END,
  updated_at=CASE
    WHEN public.caronaa_account_whatsapp.whatsapp_e164 IS NULL THEN now()
    ELSE public.caronaa_account_whatsapp.updated_at END;

-- DISTINCT ON chooses one historical source per account and prevents a
-- PostgreSQL ON CONFLICT multi-update. Never changes non-null new-table values.

CREATE OR REPLACE FUNCTION public.get_my_caronaa_whatsapp()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $get$
DECLARE
 v_uid uuid:=auth.uid();
 v_contact public.caronaa_account_whatsapp%ROWTYPE;
 v_phone text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_contact FROM public.caronaa_account_whatsapp WHERE user_id=v_uid;
 SELECT coalesce(
   nullif(v_contact.whatsapp_e164,''),
   (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
     WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
   (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
     WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
   (SELECT r.snapshot->>'whatsapp_e164' FROM public.professional_access_requests r
     WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
     ORDER BY r.submitted_at DESC LIMIT 1)
 ) INTO v_phone;
 RETURN jsonb_build_object('whatsapp',v_phone,
   'contact_consent',coalesce(v_contact.contact_consent,false));
END;$get$;

CREATE OR REPLACE FUNCTION public.set_my_caronaa_whatsapp(
 p_whatsapp text,p_contact_consent boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $set$
DECLARE
 v_uid uuid:=auth.uid();
 v_phone text;
 v_consent boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponivel' USING ERRCODE='42501'; END IF;
 -- Edits only: never interpret missing input as a deletion.
 IF p_whatsapp IS NULL OR nullif(btrim(p_whatsapp),'') IS NULL THEN
   RAISE EXCEPTION 'Informe o novo numero para alterar seu WhatsApp'
     USING ERRCODE='22023';
 END IF;
 v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
 v_consent:=coalesce(p_contact_consent,false);
 INSERT INTO public.caronaa_account_whatsapp(user_id,whatsapp_e164,contact_consent)
 VALUES(v_uid,v_phone,v_consent)
 ON CONFLICT(user_id) DO UPDATE SET
   whatsapp_e164=EXCLUDED.whatsapp_e164,
   contact_consent=EXCLUDED.contact_consent,updated_at=now();
 UPDATE public.professional_driver_contacts
   SET whatsapp_e164=v_phone,updated_at=now() WHERE user_id=v_uid;
 UPDATE public.professional_mototaxi_profiles
   SET whatsapp_e164=v_phone,updated_at=now() WHERE user_id=v_uid;
 RETURN jsonb_build_object('whatsapp',v_phone,'contact_consent',v_consent);
END;$set$;
REVOKE ALL ON FUNCTION public.get_my_caronaa_whatsapp() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_caronaa_whatsapp() TO authenticated;
REVOKE ALL ON FUNCTION public.set_my_caronaa_whatsapp(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_caronaa_whatsapp(text,boolean) TO authenticated;

-- Existing registration functions are replaced in-place, preserving all other
-- business rules from 0218 and using existing contact on empty input.

CREATE OR REPLACE FUNCTION public.complete_professional_driver_registration(
 p_full_name text,p_whatsapp text,p_municipality text,p_vehicle_type text,
 p_vehicle_brand text,p_vehicle_model text,p_vehicle_color text,
 p_vehicle_plate text,p_car_category text,p_vehicle_seats integer,
 p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $register$
DECLARE
  v_uid uuid:=auth.uid();
  v_phone text;
  v_name text:=btrim(coalesce(p_full_name,''));
  v_city text:=btrim(coalesce(p_municipality,''));
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
  -- On an empty registration field, retain the verified account contact,
  -- falling back to the two legacy stores. Never turn an existing phone into NULL.
  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
        WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
        WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
        WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164' FROM public.professional_access_requests r
        WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
        ORDER BY r.submitted_at DESC LIMIT 1)
    ) INTO v_phone;
  END IF;
  IF length(v_city) NOT BETWEEN 2 AND 120
    OR upper(v_city) IN ('MACICO_BATURITE','OUTRA_REGIAO') THEN
    RAISE EXCEPTION 'Dados pendentes: MUNICIPALITY' USING ERRCODE='22023';
  END IF;
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
  SET full_name=v_name,city=v_city,vehicle_type=lower(p_vehicle_type),
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
    municipality=EXCLUDED.municipality,
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
    'municipality',v_city,'whatsapp_e164',v_phone,
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
$register$;

CREATE OR REPLACE FUNCTION public.submit_simple_mototaxi_access(
  p_first_name text, p_last_name text, p_whatsapp text,
  p_region text, p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $submit$
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
  IF p_region NOT IN ('MACICO_BATURITE','FORTALEZA') OR p_region IS NULL THEN
    RAISE EXCEPTION 'Regiao invalida' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_registration_number,''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Informe a matricula/registro' USING ERRCODE='22023';
  END IF;
  v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
  -- On an empty registration field, retain the verified account contact,
  -- falling back to the two legacy stores. Never turn an existing phone into NULL.
  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
        WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
        WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
        WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164' FROM public.professional_access_requests r
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
  VALUES (v_uid,btrim(p_first_name),btrim(p_last_name),v_phone,p_region,
          btrim(p_registration_number))
  ON CONFLICT (user_id) DO UPDATE SET
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
    whatsapp_e164=EXCLUDED.whatsapp_e164, region_code=EXCLUDED.region_code,
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
    'municipality',p_region,'region_code',p_region,'access_type','MOTOTAXI_SIMPLE',
    'whatsapp_e164',v_phone,'registration_number',btrim(p_registration_number)
  );

  -- The platform enables a complete verified account immediately. This is
  -- not a driver's self-declared permission: the authorization row is granted
  -- atomically by the DB after every existing profile/photograph check.
  v_id := public.professional_auto_enable(
    v_uid,'MOTO',NULL,1,p_region,v_snapshot,'MOTOTAXI_SIMPLE'
  );
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

NOTIFY pgrst,'reload schema';
COMMIT;
