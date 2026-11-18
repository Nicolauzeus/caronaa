-- 0204 | F02/F07: complete professional registration enables driving without a manual request.
-- Supersedes the approval-on-submit rule for complete, new professional applications.
-- No change to GPS consent, fees, municipal dispatch coverage or ride safeguards.
BEGIN;

-- Shared private permission gate for complete STANDARD and MOTOTAXI_SIMPLE
-- applications. Never grant this helper to authenticated clients.
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
  v_new_request boolean := false;
BEGIN
  IF v_uid IS NULL OR p_uid IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Sessao invalida para ativar motorista' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id=v_uid AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirme seu e-mail para trabalhar' USING ERRCODE='42501';
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


CREATE OR REPLACE FUNCTION public.submit_professional_access_request(
  p_vehicle_type text, p_car_category text, p_seats integer, p_municipality text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $professional$
DECLARE
  v_uid uuid := auth.uid();
  v_cat text := CASE WHEN p_vehicle_type='CAR' THEN p_car_category END;
  v_missing text[];
  v_id uuid;
  p record;
  v_snapshot jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Entre na conta para concluir o cadastro' USING ERRCODE='42501';
  END IF;
  v_missing := public.professional_access_missing(
    v_uid,p_vehicle_type,v_cat,p_seats,p_municipality
  );
  IF cardinality(v_missing)>0 THEN
    RAISE EXCEPTION 'Dados pendentes: %',array_to_string(v_missing,',') USING ERRCODE='22023';
  END IF;
  SELECT full_name,avatar_url,vehicle_brand,vehicle_description,
    upper(regexp_replace(vehicle_plate,'[\s-]','','g')) AS plate
    INTO p FROM public.profiles WHERE id=v_uid;
  v_snapshot := jsonb_build_object(
    'full_name',btrim(p.full_name),'avatar_url',p.avatar_url,
    'vehicle_model',btrim(coalesce(p.vehicle_brand,'')||' '||coalesce(p.vehicle_description,'')),
    'vehicle_plate',p.plate,'vehicle_type',p_vehicle_type,
    'car_category',v_cat,'passenger_seats',p_seats,'municipality',btrim(p_municipality)
  );
  v_id:=public.professional_auto_enable(
    v_uid,p_vehicle_type,v_cat,p_seats,btrim(p_municipality),v_snapshot,'STANDARD'
  );
  RETURN v_id;
END
$professional$;

REVOKE ALL ON FUNCTION public.submit_professional_access_request(text,text,integer,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_professional_access_request(text,text,integer,text)
  TO authenticated;


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
  IF length(v_digits)=13 AND left(v_digits,2)='55' THEN v_digits:=substr(v_digits,3); END IF;
  IF v_digits !~ '^[1-9][0-9]9[0-9]{8}$' OR length(coalesce(p_whatsapp,'')) > 40 THEN
    RAISE EXCEPTION 'WhatsApp invalido: informe DDD e numero' USING ERRCODE='22023';
  END IF;
  v_phone := '+55' || v_digits;

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


-- Idempotent backfill: previously submitted, complete PENDING applicants
-- become eligible without asking them to submit a second request. Never
-- override an explicit rejection, change request, revoked authorization or
-- an active temporary homologation grant.
DO $backfill$
DECLARE
  r record;
  v_missing text[];
  v_rows integer;
BEGIN
  FOR r IN
    SELECT q.* FROM public.professional_access_requests q
    WHERE q.status='PENDING'
    ORDER BY q.submitted_at,q.id FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.professional_access_requests prior
      WHERE prior.user_id=r.user_id
        AND prior.status IN ('REJECTED','CHANGES_REQUESTED')
    ) OR EXISTS (
      SELECT 1 FROM public.professional_driver_authorizations a
      WHERE a.user_id=r.user_id
        AND (a.approved IS NOT TRUE OR a.vehicle_type<>r.vehicle_type)
    ) OR EXISTS (
      SELECT 1 FROM public.caronaa_f07_pilot_authorization_audit pa
      WHERE pa.user_id=r.user_id AND pa.was_previously_approved IS FALSE
        AND pa.revoked_at IS NULL
    ) OR NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id=r.user_id AND u.email_confirmed_at IS NOT NULL
    ) THEN
      CONTINUE;
    END IF;
    v_missing:=public.professional_access_missing(
      r.user_id,r.vehicle_type,r.car_category,r.passenger_seats,r.municipality
    );
    IF cardinality(v_missing)>0 THEN CONTINUE; END IF;

    UPDATE public.professional_access_requests
       SET status='APPROVED',reviewed_by=NULL,reviewed_at=now(),
           review_reason='AUTO_CADASTRO_COMPLETO_F02',updated_at=now()
     WHERE id=r.id AND status='PENDING';

    INSERT INTO public.professional_driver_authorizations
      (user_id,approved,vehicle_type,approved_at,updated_at)
    VALUES (r.user_id,true,r.vehicle_type,now(),now())
    ON CONFLICT (user_id) DO UPDATE
      SET approved=true,vehicle_type=EXCLUDED.vehicle_type,
          approved_at=coalesce(public.professional_driver_authorizations.approved_at,now()),
          updated_at=now()
      WHERE public.professional_driver_authorizations.approved IS TRUE
        AND public.professional_driver_authorizations.vehicle_type=EXCLUDED.vehicle_type;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN
      RAISE EXCEPTION 'Habilitacao inconsistente no registro %',r.id;
    END IF;

    INSERT INTO public.professional_access_request_events(request_id,actor_id,action,reason)
    VALUES(r.id,r.user_id,'APPROVED','AUTO_CADASTRO_COMPLETO_F02_BACKFILL');
  END LOOP;
END
$backfill$;

COMMENT ON FUNCTION public.professional_auto_enable(uuid,text,text,integer,text,jsonb,text) IS
  'Ativa acesso F07 com cadastro completo, de forma atomica e auditavel; respeita bloqueios/revogacoes anteriores.';
COMMENT ON FUNCTION public.submit_simple_mototaxi_access(text,text,text,text,text) IS
  'Cadastro unico de mototaxista: confirma dados, ativa acesso automaticamente e retorna a autorizacao no banco.';
COMMENT ON FUNCTION public.submit_professional_access_request(text,text,integer,text) IS
  'Cadastro profissional completo de carro/moto: ativacao automatica auditada, sem analise administrativa.';
NOTIFY pgrst,'reload schema';

COMMIT;
