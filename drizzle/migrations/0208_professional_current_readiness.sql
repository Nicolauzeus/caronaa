-- Unifica a validação atual dos motoristas profissionais de carro/moto,
-- inclusive no cadastro simplificado de mototaxista.
-- Não apaga autorizações passadas; deixa a habilitação operacional pendente
-- enquanto informações obrigatórias estiverem incompletas.
CREATE OR REPLACE FUNCTION public.professional_access_missing(
  p_user uuid, p_vehicle_type text, p_car_category text,
  p_seats integer, p_municipality text
) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $validator$
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
      v := v || 'FULL_NAME';
    END IF;
    v_avatar_path := split_part(split_part(coalesce(p.avatar_url,''),'/avatars/',2),'?',1);
    IF v_avatar_path !~ ('^'||p_user::text||'/[A-Za-z0-9-]+[.](jpg|jpeg|png|webp)$')
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects
         WHERE bucket_id='avatars' AND name=v_avatar_path
       ) THEN v:=v||'PHOTO'; END IF;
    IF coalesce(m.whatsapp_e164,'') !~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
      v:=v||'WHATSAPP';
    END IF;
    IF length(btrim(coalesce(m.registration_number,'')))<2 THEN
      v:=v||'REGISTRATION';
    END IF;
    IF m.region_code NOT IN ('MACICO_BATURITE','FORTALEZA') THEN
      v:=v||'REGION';
    END IF;
  ELSE
    IF coalesce(p.avatar_url,'') !~ '^https://' THEN v:=v||'PHOTO'; END IF;
    IF coalesce(btrim(p.full_name),'') !~ '^\S{2,}(\s+\S+)+$' THEN
      v:=v||'FULL_NAME';
    END IF;
  END IF;

  -- Mandatory for BOTH registration paths. The old simplified exception
  -- must never turn empty vehicle fields into a valid professional profile.
  IF length(btrim(coalesce(p.vehicle_brand,'')))=0
     OR length(btrim(coalesce(p.vehicle_description,'')))=0 THEN
    v:=v||'VEHICLE_MODEL';
  END IF;
  IF length(btrim(coalesce(p.vehicle_color,'')))=0 THEN
    v:=v||'VEHICLE_COLOR';
  END IF;
  v_plate := upper(regexp_replace(coalesce(p.vehicle_plate,''),'[^A-Za-z0-9]','','g'));
  IF v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$' THEN
    v:=v||'PLATE';
  END IF;

  IF p_vehicle_type NOT IN ('CAR','MOTO') OR p_vehicle_type IS NULL
     OR lower(coalesce(p.vehicle_type,'')) IS DISTINCT FROM lower(p_vehicle_type) THEN
    v:=v||'VEHICLE_TYPE';
  ELSIF p_vehicle_type='CAR'
     AND (p_car_category NOT IN ('HATCH','SEDAN','SUV','MINIVAN','PICKUP')
          OR p_car_category IS NULL) THEN
    v:=v||'CAR_CATEGORY';
  END IF;

  IF p_seats IS NULL OR p_seats<1 OR p_seats>7
     OR p.vehicle_seats IS NULL
     OR (p_vehicle_type='MOTO' AND (p_seats<>1 OR p.vehicle_seats<>1))
     OR (p_vehicle_type='CAR' AND (p.vehicle_seats<1 OR p.vehicle_seats>3))
     OR (p_vehicle_type='CAR' AND p_car_category IN ('HATCH','SEDAN','PICKUP') AND p_seats>4)
     OR (p_vehicle_type='CAR' AND p_car_category='SUV' AND p_seats>6) THEN
    v:=v||'SEATS';
  END IF;
  IF NOT v_simple AND length(btrim(coalesce(p_municipality,'')))<2 THEN
    v:=v||'MUNICIPALITY';
  END IF;
  RETURN v;
END
$validator$;

REVOKE ALL ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text)
  FROM PUBLIC,anon,authenticated;

-- Keep historic approval decisions visible, but do not return authorized=true
-- for a currently incomplete applicant. The server radar preflight uses this.
CREATE OR REPLACE FUNCTION public.get_my_professional_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $myaccess$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  v_missing text[];
  v_approved boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.professional_access_requests
    WHERE user_id=v_uid ORDER BY submitted_at DESC,id DESC LIMIT 1;

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
$myaccess$;

REVOKE ALL ON FUNCTION public.get_my_professional_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_professional_access() TO authenticated;
COMMENT ON FUNCTION public.get_my_professional_access() IS
  'Aptidão profissional atual depende de autorização histórica e cadastro completo; não libera F07 com campos faltantes.';
NOTIFY pgrst,'reload schema';
