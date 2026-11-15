-- 0154 | F07/F08 post-acceptance: 4-digit boarding OTP and declared Pix reconciliation.
-- Requires 0149-0153. Never treats a passenger declaration as bank settlement.
BEGIN;

-- Existing locked rides retain their previous secret; new codes are four digits.
CREATE OR REPLACE FUNCTION public.quick_ride_issue_boarding_pin(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE; v_salt uuid:=gen_random_uuid(); v_code text;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid()
    OR q.status NOT IN ('ACCEPTED','ARRIVED') THEN
  RAISE EXCEPTION 'Boarding OTP unavailable' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.quick_ride_boarding_secrets WHERE ride_id=p_id) THEN
  RAISE EXCEPTION 'Boarding OTP already issued; contact support if lost or expired' USING ERRCODE='42501';
 END IF;
 v_code:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%10000)::text,4,'0');
 INSERT INTO public.quick_ride_boarding_secrets(ride_id,pin_hash,salt,attempts,expires_at)
 VALUES(p_id,encode(sha256(convert_to(v_code||v_salt::text,'UTF8')),'hex'),
        v_salt,0,now()+interval '15 minutes');
 RETURN v_code;
END; $fn$;

-- Validate four digits for new trips; allow legacy six-digit secrets for already-issued trips.
CREATE OR REPLACE FUNCTION public.quick_ride_start_with_code(p_id uuid,p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE; s public.quick_ride_boarding_secrets%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid()
    OR q.status<>'ARRIVED' THEN
  RAISE EXCEPTION 'Boarding not available' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.quick_ride_boarding_secrets WHERE ride_id=p_id FOR UPDATE;
 IF NOT FOUND OR s.consumed_at IS NOT NULL OR s.expires_at<=now() OR s.attempts>=5 THEN
  RAISE EXCEPTION 'Boarding OTP expired or locked' USING ERRCODE='42501';
 END IF;
 IF p_code IS NULL OR p_code !~ '^([0-9]{4}|[0-9]{6})$'
    OR encode(sha256(convert_to(p_code||s.salt::text,'UTF8')),'hex')<>s.pin_hash THEN
  UPDATE public.quick_ride_boarding_secrets SET attempts=attempts+1 WHERE ride_id=p_id;
  RETURN false;
 END IF;
 UPDATE public.quick_ride_boarding_secrets SET consumed_at=now() WHERE ride_id=p_id;
 UPDATE public.professional_quick_rides
    SET pickup_confirmed_at=now(),status='IN_PROGRESS',updated_at=now() WHERE id=p_id;
 RETURN true;
END; $fn$;

-- Do not bypass the passenger's 30-second review. Completion requested != completed.
CREATE OR REPLACE FUNCTION public.quick_ride_complete_ride(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RETURN public.quick_ride_request_dropoff(p_id);
END; $fn$;

CREATE TABLE IF NOT EXISTS public.quick_ride_pix_declarations (
 ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
 code_hash text NOT NULL,
 salt uuid NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 passenger_declared_at timestamptz,
 driver_acknowledged_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_ride_pix_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_pix_declarations FROM PUBLIC,anon,authenticated;

-- Driver-only confirmation code; not a receipt or evidence of bank settlement.
CREATE OR REPLACE FUNCTION public.quick_ride_issue_payment_code(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE; v_salt uuid:=gen_random_uuid(); v_code text;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid()
    OR q.status<>'COMPLETED' THEN
  RAISE EXCEPTION 'Payment code unavailable' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.quick_ride_pix_declarations WHERE ride_id=p_id) THEN
  RAISE EXCEPTION 'Payment code already issued; contact support if lost' USING ERRCODE='42501';
 END IF;
 v_code:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%10000)::text,4,'0');
 INSERT INTO public.quick_ride_pix_declarations(ride_id,code_hash,salt,expires_at)
 VALUES(p_id,encode(sha256(convert_to(v_code||v_salt::text,'UTF8')),'hex'),
        v_salt,now()+interval '24 hours');
 RETURN v_code;
END; $fn$;

CREATE OR REPLACE FUNCTION public.quick_ride_confirm_payment_code(p_id uuid,p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE; d public.quick_ride_pix_declarations%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid()
   OR q.status<>'COMPLETED' THEN
  RAISE EXCEPTION 'Payment confirmation unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM public.quick_ride_pix_declarations WHERE ride_id=p_id FOR UPDATE;
 IF NOT FOUND OR d.expires_at<=now() OR d.attempts>=5
    OR d.passenger_declared_at IS NOT NULL THEN
  RAISE EXCEPTION 'Payment confirmation expired, locked, or already submitted' USING ERRCODE='42501';
 END IF;
 IF p_code IS NULL OR p_code !~ '^[0-9]{4}$'
    OR encode(sha256(convert_to(p_code||d.salt::text,'UTF8')),'hex')<>d.code_hash THEN
  UPDATE public.quick_ride_pix_declarations SET attempts=attempts+1 WHERE ride_id=p_id;
  RETURN false;
 END IF;
 UPDATE public.quick_ride_pix_declarations SET passenger_declared_at=now() WHERE ride_id=p_id;
 RETURN true;
END; $fn$;

CREATE OR REPLACE FUNCTION public.quick_ride_payment_declaration_state(p_id uuid)
RETURNS TABLE(passenger_declared_at timestamptz,driver_acknowledged_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT d.passenger_declared_at,d.driver_acknowledged_at
 FROM public.quick_ride_pix_declarations d
 JOIN public.professional_quick_rides q ON q.id=d.ride_id
 WHERE q.id=p_id AND q.status='COMPLETED'
   AND auth.uid() IN (q.driver_id,q.passenger_id);
$fn$;

-- Prevent bypassing the four-digit OTP through the earlier six-digit RPC.
CREATE OR REPLACE FUNCTION public.quick_ride_verify_boarding_pin(p_id uuid,p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RETURN public.quick_ride_start_with_code(p_id,p_pin);
END; $fn$;

REVOKE ALL ON FUNCTION public.quick_ride_start_with_code(uuid,text),
 public.quick_ride_complete_ride(uuid),public.quick_ride_issue_payment_code(uuid),
 public.quick_ride_confirm_payment_code(uuid,text),
 public.quick_ride_payment_declaration_state(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_start_with_code(uuid,text),
 public.quick_ride_complete_ride(uuid),public.quick_ride_issue_payment_code(uuid),
 public.quick_ride_confirm_payment_code(uuid,text),
 public.quick_ride_payment_declaration_state(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
