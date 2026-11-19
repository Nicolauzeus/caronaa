-- 0218 | F02/F07/F09: account-owned optional WhatsApp with editable contact/CRM consent.
-- Apply manually AFTER migrations 0211 and 0216, before publishing matching frontend.
BEGIN;
DO $preflight$ BEGIN
 IF to_regclass('public.professional_driver_contacts') IS NULL
    OR to_regclass('public.professional_mototaxi_profiles') IS NULL
    OR to_regprocedure('public.complete_professional_driver_registration(text,text,text,text,text,text,text,text,text,integer,text)') IS NULL
 THEN RAISE EXCEPTION 'Missing prerequisites: 0211 / 0216'; END IF;
END; $preflight$;

ALTER TABLE public.professional_driver_contacts ALTER COLUMN whatsapp_e164 DROP NOT NULL;
ALTER TABLE public.professional_mototaxi_profiles ALTER COLUMN whatsapp_e164 DROP NOT NULL;

-- No carrier/WhatsApp lookup: validates format only. +55 and DDD 55 are distinct.
CREATE OR REPLACE FUNCTION public.caronaa_normalize_whatsapp(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $normalize$ DECLARE
 v_digits text:=regexp_replace(coalesce(p_value,''),'[^0-9]','','g');
 v_ddd text;
BEGIN
 IF nullif(btrim(coalesce(p_value,'')),'') IS NULL THEN RETURN NULL; END IF;
 IF length(p_value)>40 THEN RAISE EXCEPTION 'WhatsApp muito longo' USING ERRCODE='22023'; END IF;
 IF length(v_digits)=13 AND left(v_digits,2)='55' THEN v_digits:=substr(v_digits,3); END IF;
 v_ddd:=left(v_digits,2);
 IF v_digits !~ '^[0-9]{11}$' OR substr(v_digits,3,1)<>'9'
    OR v_ddd NOT IN (
      '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
      '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
      '51','53','54','55','61','62','63','64','65','66','67','68','69',
      '71','73','74','75','77','79','81','82','83','84','85','86','87','88','89',
      '91','92','93','94','95','96','97','98','99')
 THEN RAISE EXCEPTION 'Informe um celular brasileiro com DDD e nove digitos, comecando por 9'
  USING ERRCODE='22023'; END IF;
 RETURN '+55'||v_digits;
END; $normalize$;
REVOKE ALL ON FUNCTION public.caronaa_normalize_whatsapp(text) FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.caronaa_account_whatsapp(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 whatsapp_e164 text NULL CHECK(whatsapp_e164 ~ '^[+]55[0-9]{11}$'),
 contact_consent boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caronaa_account_whatsapp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_account_whatsapp FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.caronaa_account_whatsapp TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_caronaa_whatsapp()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $get$ DECLARE
 v_uid uuid:=auth.uid(); v_contact public.caronaa_account_whatsapp%ROWTYPE;
 v_legacy text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_contact FROM public.caronaa_account_whatsapp WHERE user_id=v_uid;
 IF FOUND THEN RETURN jsonb_build_object('whatsapp',v_contact.whatsapp_e164,
   'contact_consent',v_contact.contact_consent); END IF;
 SELECT whatsapp_e164 INTO v_legacy
  FROM public.professional_driver_contacts WHERE user_id=v_uid;
 IF v_legacy IS NULL THEN SELECT whatsapp_e164 INTO v_legacy
  FROM public.professional_mototaxi_profiles WHERE user_id=v_uid; END IF;
 RETURN jsonb_build_object('whatsapp',v_legacy,'contact_consent',false);
END; $get$;
REVOKE ALL ON FUNCTION public.get_my_caronaa_whatsapp() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_caronaa_whatsapp() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_caronaa_whatsapp(
 p_whatsapp text,p_contact_consent boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $set$ DECLARE
 v_uid uuid:=auth.uid(); v_phone text; v_consent boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessao necessaria' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponivel' USING ERRCODE='42501'; END IF;
 v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);
 v_consent:=coalesce(p_contact_consent,false) AND v_phone IS NOT NULL;
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
END; $set$;
REVOKE ALL ON FUNCTION public.set_my_caronaa_whatsapp(text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_caronaa_whatsapp(text,boolean) TO authenticated;

-- Incremental updates to preexisting professional eligibility and registration functions.

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
    AND m.region_code IS NOT NULL AND m.region_code=p_municipality;

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
    IF m.region_code NOT IN ('MACICO_BATURITE','FORTALEZA') THEN
      v := array_append(v, 'REGION');
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
  IF NOT v_simple AND length(btrim(coalesce(p_municipality,'')))<2 THEN
    v := array_append(v, 'MUNICIPALITY');
  END IF;
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.professional_auto_enable(
  p_uid uuid, p_vehicle_type text, p_car_category text, p_seats integer,
  p_municipality text, p_snapshot jsonb, p_access_type text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $automatic$
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
      OR p_municipality NOT IN ('MACICO_BATURITE','FORTALEZA')
      OR NOT EXISTS (
        SELECT 1 FROM public.professional_mototaxi_profiles
        WHERE user_id=v_uid AND region_code=p_municipality
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

  -- Municipality is required; WhatsApp is a private optional CRM contact.
  -- MOTOTAXI_SIMPLE already verifies the region via its own profile above.
  IF p_access_type='STANDARD' AND NOT EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved IS TRUE
  ) AND NOT EXISTS (
    SELECT 1 FROM public.professional_driver_contacts c
    WHERE c.user_id=v_uid
      AND lower(btrim(c.municipality))=lower(btrim(p_municipality))
      AND length(btrim(c.municipality))>=2
  ) THEN
    RAISE EXCEPTION 'Dados pendentes: MUNICIPALITY' USING ERRCODE='22023';
  END IF;

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
          municipality=p_municipality,snapshot=p_snapshot,access_type=p_access_type,
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
        SET municipality=p_municipality,car_category=p_car_category,
            passenger_seats=p_seats,snapshot=p_snapshot,updated_at=now()
        WHERE id=v_id
          AND (municipality,car_category,passenger_seats,snapshot)
               IS DISTINCT FROM (p_municipality,p_car_category,p_seats,p_snapshot);
    ELSE
      INSERT INTO public.professional_access_requests
        (user_id,status,vehicle_type,car_category,passenger_seats,
         municipality,snapshot,access_type,reviewed_by,reviewed_at,review_reason)
      VALUES
        (v_uid,'APPROVED',p_vehicle_type,p_car_category,p_seats,
         p_municipality,p_snapshot,p_access_type,NULL,now(),'AUTO_CADASTRO_COMPLETO_F02')
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
$automatic$;

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

DO $verify$ BEGIN
 IF to_regprocedure('public.get_my_caronaa_whatsapp()') IS NULL
   OR to_regprocedure('public.set_my_caronaa_whatsapp(text,boolean)') IS NULL
 THEN RAISE EXCEPTION '0218 RPCs were not installed'; END IF;
 IF public.caronaa_normalize_whatsapp('(55) 99999-1234')<>'+5555999991234'
 OR public.caronaa_normalize_whatsapp('+55 (85) 99999-1234')<>'+5585999991234'
 OR public.caronaa_normalize_whatsapp(NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'Phone normalization failed'; END IF;
END;$verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
