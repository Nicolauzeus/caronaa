-- CARONAA Flash passenger waitlist: independent of F07 dispatch and F03-F06 rides.
-- Only municipality-level interest is stored; never raw GPS or addresses.
BEGIN;

ALTER TABLE public.flash_waitlist
  ADD COLUMN IF NOT EXISTS seats smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reserved_entire_vehicle boolean NOT NULL DEFAULT false;

ALTER TABLE public.flash_waitlist
  DROP CONSTRAINT IF EXISTS flash_waitlist_seats_check;
ALTER TABLE public.flash_waitlist
  ADD CONSTRAINT flash_waitlist_seats_check
    CHECK (seats BETWEEN 1 AND 3);

ALTER TABLE public.flash_waitlist
  DROP CONSTRAINT IF EXISTS flash_waitlist_moto_seats_check;
ALTER TABLE public.flash_waitlist
  ADD CONSTRAINT flash_waitlist_moto_seats_check
    CHECK (vehicle_type <> 'MOTO' OR seats = 1);

CREATE OR REPLACE FUNCTION public.register_flash_waitlist(
  p_origin_municipality text,
  p_destination_municipality text,
  p_vehicle_type text,
  p_service_mode text,
  p_seats integer,
  p_reserved_entire_vehicle boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_origin text := btrim(coalesce(p_origin_municipality,''));
  v_destination text := nullif(btrim(coalesce(p_destination_municipality,'')),'');
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF length(v_origin) < 2 OR length(v_origin) > 120 OR
     (v_destination IS NOT NULL AND length(v_destination) > 120) THEN
    RAISE EXCEPTION 'MUNICIPALITY_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_type NOT IN ('CAR','MOTO') OR
     p_service_mode NOT IN ('ON_ROUTE','EXCLUSIVE') THEN
    RAISE EXCEPTION 'MODE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_seats IS NULL OR p_seats < 1 OR p_seats > 3 OR
     (p_vehicle_type = 'MOTO' AND p_seats <> 1) THEN
    RAISE EXCEPTION 'SEATS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_reserved_entire_vehicle IS NULL THEN
    RAISE EXCEPTION 'WHOLE_VEHICLE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_service_mode = 'EXCLUSIVE' AND
     (p_reserved_entire_vehicle IS NOT TRUE OR
      p_seats <> (CASE WHEN p_vehicle_type='CAR' THEN 3 ELSE 1 END)) THEN
    RAISE EXCEPTION 'EXCLUSIVE_SEATS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_service_mode = 'ON_ROUTE' AND p_reserved_entire_vehicle AND
     (p_vehicle_type <> 'CAR' OR p_seats <> 3) THEN
    RAISE EXCEPTION 'WHOLE_VEHICLE_SEATS_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.flash_waitlist
    (user_id, origin_municipality, destination_municipality,
     vehicle_type, service_mode, seats, reserved_entire_vehicle)
  VALUES
    (v_user, v_origin, v_destination, p_vehicle_type,
     p_service_mode, p_seats, p_reserved_entire_vehicle)
  ON CONFLICT (user_id, origin_municipality, vehicle_type, service_mode)
  DO UPDATE SET
    destination_municipality=EXCLUDED.destination_municipality,
    seats=EXCLUDED.seats,
    reserved_entire_vehicle=EXCLUDED.reserved_entire_vehicle,
    updated_at=now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_flash_waitlist(
  text,text,text,text,integer,boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_flash_waitlist(
  text,text,text,text,integer,boolean
) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
