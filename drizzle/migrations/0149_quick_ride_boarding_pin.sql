-- Corrida Rapida: embarque com PIN do passageiro e validacao atomica.
-- Aplicar somente depois da homologacao das migrations anteriores.
CREATE TABLE IF NOT EXISTS public.quick_ride_boarding_secrets (
 ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
 pin_hash text NOT NULL,
 salt uuid NOT NULL DEFAULT gen_random_uuid(),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_ride_boarding_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_boarding_secrets FROM PUBLIC, anon, authenticated;

-- O passageiro solicita um codigo somente depois que o motorista aceita.
-- O PIN e devolvido apenas na resposta da RPC autenticada do passageiro.
CREATE OR REPLACE FUNCTION public.quick_ride_issue_boarding_pin(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
 v_salt uuid := gen_random_uuid();
 v_code text;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() OR
    q.status NOT IN ('ACCEPTED','ARRIVED') THEN
   RAISE EXCEPTION 'Boarding PIN unavailable' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.quick_ride_boarding_secrets
    WHERE ride_id=p_id AND consumed_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Boarding PIN already consumed' USING ERRCODE='42501';
 END IF;
 -- Generate a fresh, six-digit, cryptographically unpredictable PIN.
 v_code := lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint) % 1000000)::text,6,'0');
 INSERT INTO public.quick_ride_boarding_secrets(ride_id,pin_hash,salt,attempts,expires_at)
 VALUES (p_id,encode(sha256(convert_to(v_code||v_salt::text,'UTF8')),'hex'),v_salt,0,now()+interval '15 minutes')
 ON CONFLICT(ride_id) DO UPDATE SET
  pin_hash=EXCLUDED.pin_hash,salt=EXCLUDED.salt,attempts=0,
  expires_at=EXCLUDED.expires_at
 WHERE public.quick_ride_boarding_secrets.consumed_at IS NULL;
 RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.quick_ride_verify_boarding_pin(p_id uuid,p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE;
 s public.quick_ride_boarding_secrets%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() OR q.status<>'ARRIVED' THEN
  RAISE EXCEPTION 'Ride is not ready for boarding' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.quick_ride_boarding_secrets WHERE ride_id=p_id FOR UPDATE;
 IF NOT FOUND OR s.consumed_at IS NOT NULL OR s.expires_at<=now() OR s.attempts>=5 THEN
  RAISE EXCEPTION 'Boarding PIN unavailable or locked' USING ERRCODE='42501';
 END IF;
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' OR
    encode(sha256(convert_to(p_pin||s.salt::text,'UTF8')),'hex')<>s.pin_hash THEN
  UPDATE public.quick_ride_boarding_secrets SET attempts=attempts+1 WHERE ride_id=p_id;
  RETURN false;
 END IF;
 UPDATE public.quick_ride_boarding_secrets SET consumed_at=now() WHERE ride_id=p_id;
 UPDATE public.professional_quick_rides
  SET pickup_confirmed_at=now(),status='IN_PROGRESS',updated_at=now()
  WHERE id=p_id;
 RETURN true;
END; $$;

-- Desativa o antigo bypass onde o passageiro aprovava sem PIN.
CREATE OR REPLACE FUNCTION public.quick_ride_confirm_pickup(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 RAISE EXCEPTION 'Use the protected boarding PIN flow' USING ERRCODE='42501';
END; $$;

-- Preserva cancelamento e chegada, mas bloqueia os caminhos legados
-- ARRIVED -> IN_PROGRESS e IN_PROGRESS -> COMPLETED.
CREATE OR REPLACE FUNCTION public.quick_ride_transition(p_id uuid,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE; u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (u<>q.passenger_id AND u IS DISTINCT FROM q.driver_id) THEN
  RAISE EXCEPTION 'Ride not found' USING ERRCODE='42501';
 END IF;
 IF p_status='CANCELLED' AND q.status IN ('SEARCHING','ACCEPTED','ARRIVED') THEN
  UPDATE public.professional_quick_rides SET status='CANCELLED',updated_at=now() WHERE id=p_id;
 ELSIF u=q.driver_id AND q.status='ACCEPTED' AND p_status='ARRIVED' THEN
  UPDATE public.professional_quick_rides SET status='ARRIVED',updated_at=now() WHERE id=p_id;
 ELSE
  RAISE EXCEPTION 'Use protected boarding or completion flow' USING ERRCODE='42501';
 END IF;
 RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.quick_ride_issue_boarding_pin(uuid),
 public.quick_ride_verify_boarding_pin(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_issue_boarding_pin(uuid),
 public.quick_ride_verify_boarding_pin(uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
