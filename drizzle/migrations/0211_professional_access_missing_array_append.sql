-- 0211 | Fix PostgREST 400 / PostgreSQL 22P02 in professional registration.
-- The previous validator appended a scalar via v := v || 'PHOTO', which
-- PostgreSQL interprets as a text[] literal and raises malformed array literal.
-- Preserve all business checks, photo ownership, vehicle, suspension and fees.
-- APPLY MANUALLY in Supabase SQL Editor. No data backfill/permission grants.
BEGIN;

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
    IF coalesce(m.whatsapp_e164,'') !~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN
      v := array_append(v, 'WHATSAPP');
    END IF;
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


COMMENT ON FUNCTION public.professional_access_missing(uuid,text,text,integer,text) IS
  'Validates professional registration; appends missing field codes as scalar array elements without 22P02.';
-- Verify incomplete profiles produce codes instead of aborting. No writes.
DO $verify$
DECLARE v_missing text[];
BEGIN
  v_missing:=public.professional_access_missing('00000000-0000-0000-0000-000000000000'::uuid,
    'MOTO',NULL,1,'FORTALEZA');
  IF NOT (v_missing @> ARRAY['PHOTO','VEHICLE_MODEL','PLATE']::text[]) THEN
    RAISE EXCEPTION 'professional_access_missing regression failed: %',v_missing;
  END IF;
END;
$verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
