-- 0216 | Cadastro profissional único: WhatsApp e município na entrada.
-- Executar MANUALMENTE após 0204 e 0211, antes do deploy da interface.
-- Sem permissão de GPS, presença ou tarifas nesta migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.professional_driver_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^\+55[1-9][0-9]9[0-9]{8}$'),
  municipality text NOT NULL CHECK (
    length(btrim(municipality)) BETWEEN 2 AND 120
    AND upper(btrim(municipality)) NOT IN ('MACICO_BATURITE','OUTRA_REGIAO')
  ),
  registration_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_driver_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS professional_driver_contacts_read_own
 ON public.professional_driver_contacts;
CREATE POLICY professional_driver_contacts_read_own
 ON public.professional_driver_contacts FOR SELECT TO authenticated
 USING (user_id=auth.uid());
REVOKE ALL ON public.professional_driver_contacts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.professional_driver_contacts TO authenticated;

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

  -- New professional admissions must have a verified WhatsApp and exact city.
  -- Keep previously approved drivers authorized, while all existing suspension
  -- and reversal safeguards below remain effective.
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations a
    WHERE a.user_id=v_uid AND a.approved IS TRUE
  ) AND NOT EXISTS (
    SELECT 1 FROM public.professional_driver_contacts c
    WHERE c.user_id=v_uid
      AND c.whatsapp_e164 ~ '^\+55[1-9][0-9]9[0-9]{8}$'
      AND lower(btrim(c.municipality))=lower(btrim(p_municipality))
      AND length(btrim(c.municipality))>=2
  ) THEN
    RAISE EXCEPTION 'Dados pendentes: WHATSAPP,MUNICIPALITY'
      USING ERRCODE='22023';
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

REVOKE ALL ON FUNCTION public.professional_auto_enable(
  uuid,text,text,integer,text,jsonb,text
) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.complete_professional_driver_registration(
 p_full_name text,p_whatsapp text,p_municipality text,p_vehicle_type text,
 p_vehicle_brand text,p_vehicle_model text,p_vehicle_color text,
 p_vehicle_plate text,p_car_category text,p_vehicle_seats integer,
 p_registration_number text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $register$
DECLARE
  v_uid uuid:=auth.uid();
  v_digits text:=regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
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
  IF length(v_digits)=13 AND left(v_digits,2)='55' THEN
    v_digits:=substr(v_digits,3);
  END IF;
  IF v_digits !~ '^[1-9][0-9]9[0-9]{8}$' THEN
    RAISE EXCEPTION 'Dados pendentes: WHATSAPP' USING ERRCODE='22023';
  END IF;
  v_phone:='+55'||v_digits;
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
REVOKE ALL ON FUNCTION public.complete_professional_driver_registration(
 text,text,text,text,text,text,text,text,text,integer,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_professional_driver_registration(
 text,text,text,text,text,text,text,text,text,text,integer,text
) TO authenticated;
COMMENT ON FUNCTION public.complete_professional_driver_registration(
 text,text,text,text,text,text,text,text,text,text,integer,text
) IS 'Cadastro unificado e habilitacao atomica; nenhum consentimento GPS ou presenca implicito.';
NOTIFY pgrst,'reload schema';
COMMIT;
