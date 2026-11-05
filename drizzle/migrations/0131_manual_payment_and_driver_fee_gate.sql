-- 0131 | Shared-ride manual payment, bilateral confirmation and driver fee ledger.
-- Depend on 0130_manual_driver_pix.sql. No external bank integration is claimed.
-- This migration does not retroactively bill or block historical trips.
BEGIN;

CREATE TABLE IF NOT EXISTS public.manual_ride_payment_confirmations (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(ride_id) ON DELETE RESTRICT,
  passenger_confirmed_at timestamptz,
  driver_confirmed_at timestamptz,
  mutually_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_confirmation_pair CHECK (
    mutually_confirmed_at IS NULL OR
    (passenger_confirmed_at IS NOT NULL AND driver_confirmed_at IS NOT NULL)
  )
);
CREATE TABLE IF NOT EXISTS public.platform_fee_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  pix_key text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_fee_config(singleton) VALUES(true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.driver_platform_fees (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(ride_id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  gross_amount numeric(10,2) NOT NULL CHECK(gross_amount > 0),
  fee_rate numeric(5,4) NOT NULL DEFAULT 0.1500 CHECK(fee_rate = 0.1500),
  fee_amount numeric(10,2) NOT NULL CHECK(fee_amount > 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLAIMED','SETTLED')),
  claim_reference text,
  claimed_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_fee_verification CHECK(status <> 'SETTLED' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS driver_platform_fees_pending_idx ON public.driver_platform_fees(driver_id, created_at)
WHERE status <> 'SETTLED';
CREATE INDEX IF NOT EXISTS driver_platform_fees_claimed_idx ON public.driver_platform_fees(claimed_at)
WHERE status = 'CLAIMED';

ALTER TABLE public.manual_ride_payment_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_platform_fees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_ride_payment_confirmations, public.platform_fee_config,
  public.driver_platform_fees FROM PUBLIC, anon, authenticated;
-- Every operation uses participant- or finance-verified SECURITY DEFINER functions.
-- The fee and its status are never client-writable.

CREATE OR REPLACE FUNCTION public.driver_platform_access_allowed(p_driver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $access$
  SELECT p_driver IS NOT NULL AND
    (SELECT count(*) FROM public.driver_platform_fees f
      WHERE f.driver_id=p_driver AND f.status <> 'SETTLED') < 3;
$access$;
REVOKE ALL ON FUNCTION public.driver_platform_access_allowed(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_driver_platform_fees()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $status$
DECLARE v_user uuid := auth.uid(); v_open integer; v_total numeric; v_pix text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT count(*)::integer, coalesce(sum(fee_amount),0)
  INTO v_open,v_total FROM public.driver_platform_fees
  WHERE driver_id=v_user AND status <> 'SETTLED';
  SELECT pix_key INTO v_pix FROM public.platform_fee_config WHERE singleton=true;
  RETURN jsonb_build_object(
    'driverAllowed', v_open < 3, 'pendingTrips', v_open, 'limit', 3,
    'feePercent', 15, 'amountOutstanding', v_total, 'platformPixKey', v_pix,
    'dues', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'rideId',ride_id,'grossAmount',gross_amount,'feeAmount',fee_amount,
      'status',status,'claimReference',claim_reference,'createdAt',created_at
    ) ORDER BY created_at DESC)
      FROM public.driver_platform_fees WHERE driver_id=v_user),'[]'::jsonb));
END $status$;
REVOKE ALL ON FUNCTION public.get_my_driver_platform_fees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_driver_platform_fees() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_manual_ride_payment_status(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $read$
DECLARE v_ride public.rides%ROWTYPE; v_confirmation public.manual_ride_payment_confirmations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_ride FROM public.rides WHERE ride_id=p_ride_id;
  IF NOT FOUND OR (auth.uid() IS DISTINCT FROM v_ride.driver_user_id AND auth.uid() IS DISTINCT FROM v_ride.passenger_user_id) THEN
    RAISE EXCEPTION 'Ride not found' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_confirmation FROM public.manual_ride_payment_confirmations WHERE ride_id=p_ride_id;
  RETURN jsonb_build_object(
    'passengerConfirmed',v_confirmation.passenger_confirmed_at IS NOT NULL,
    'driverConfirmed',v_confirmation.driver_confirmed_at IS NOT NULL,
    'bothConfirmed',v_confirmation.mutually_confirmed_at IS NOT NULL,
    'paymentMethod','MANUAL_DRIVER_PIX','autoBankVerified',false
  );
END $read$;
REVOKE ALL ON FUNCTION public.get_manual_ride_payment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manual_ride_payment_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_manual_ride_payment(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $confirm$
DECLARE
  v_user uuid := auth.uid();
  v_ride public.rides%ROWTYPE;
  v_count integer;
  v_gross numeric(10,2);
  v_status public.manual_ride_payment_confirmations%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  -- Lock ride to serialize competing confirmations, fee accrual and access blocking.
  SELECT * INTO v_ride FROM public.rides WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR (v_user IS DISTINCT FROM v_ride.passenger_user_id
                 AND v_user IS DISTINCT FROM v_ride.driver_user_id) THEN
    RAISE EXCEPTION 'Ride not found' USING ERRCODE='42501';
  END IF;
  IF v_ride.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Conclua a viagem antes de confirmar o Pix' USING ERRCODE='22023';
  END IF;
  SELECT passenger_count INTO v_count FROM public.ride_requests
  WHERE request_id=v_ride.request_id AND user_id=v_ride.passenger_user_id;
  IF v_count NOT BETWEEN 1 AND 6 OR v_count IS NULL OR
    v_ride.passenger_price IS NULL OR v_ride.passenger_price <= 0 OR
    v_ride.passenger_group_total IS NULL THEN
    RAISE EXCEPTION 'Cotação inconsistente. Confirmação bloqueada.' USING ERRCODE='22023';
  END IF;
  v_gross := round(v_ride.passenger_price*v_count,2);
  IF v_ride.passenger_group_total IS DISTINCT FROM v_gross THEN
    RAISE EXCEPTION 'O valor não corresponde às vagas solicitadas.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.manual_ride_payment_confirmations(ride_id) VALUES(p_ride_id)
  ON CONFLICT(ride_id) DO NOTHING;
  UPDATE public.manual_ride_payment_confirmations c SET
    passenger_confirmed_at = CASE WHEN v_user=v_ride.passenger_user_id
      THEN coalesce(c.passenger_confirmed_at,now()) ELSE c.passenger_confirmed_at END,
    driver_confirmed_at = CASE WHEN v_user=v_ride.driver_user_id
      THEN coalesce(c.driver_confirmed_at,now()) ELSE c.driver_confirmed_at END
  WHERE ride_id=p_ride_id RETURNING * INTO v_status;
  IF v_status.passenger_confirmed_at IS NOT NULL AND v_status.driver_confirmed_at IS NOT NULL THEN
    UPDATE public.manual_ride_payment_confirmations
    SET mutually_confirmed_at=coalesce(mutually_confirmed_at,now())
    WHERE ride_id=p_ride_id RETURNING * INTO v_status;
    INSERT INTO public.driver_platform_fees(ride_id,driver_id,gross_amount,fee_amount)
    VALUES(p_ride_id,v_ride.driver_user_id,v_gross,round(v_gross*0.15,2))
    ON CONFLICT(ride_id) DO NOTHING;
    -- The driver is immediately removed from the quick-ride radar at the threshold,
    -- regardless of a previously active location or presence heartbeat.
    IF NOT public.driver_platform_access_allowed(v_ride.driver_user_id) THEN
      UPDATE public.professional_presence SET is_available=false,updated_at=now()
      WHERE user_id=v_ride.driver_user_id AND is_available=true;
      IF to_regclass('public.professional_driver_locations') IS NOT NULL THEN
        EXECUTE 'DELETE FROM public.professional_driver_locations WHERE user_id=$1' USING v_ride.driver_user_id;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('passengerConfirmed',v_status.passenger_confirmed_at IS NOT NULL,
    'driverConfirmed',v_status.driver_confirmed_at IS NOT NULL,
    'bothConfirmed',v_status.mutually_confirmed_at IS NOT NULL,
    'autoBankVerified',false);
END $confirm$;
REVOKE ALL ON FUNCTION public.confirm_manual_ride_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_manual_ride_payment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_driver_platform_fee(p_ride_id uuid,p_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $claim$
DECLARE v_fee public.driver_platform_fees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_fee FROM public.driver_platform_fees WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR v_fee.driver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Débito não encontrado' USING ERRCODE='42501';
  END IF;
  IF v_fee.status='SETTLED' THEN RETURN true; END IF;
  IF p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 6 AND 180 THEN
    RAISE EXCEPTION 'Informe o identificador do comprovante do Pix (6–180 caracteres)' USING ERRCODE='22023';
  END IF;
  UPDATE public.driver_platform_fees SET status='CLAIMED',
    claim_reference=btrim(p_reference),claimed_at=now()
  WHERE ride_id=p_ride_id;
  -- Claimed is NOT settled; the driver remains blocked until verified by finance.
  RETURN true;
END $claim$;
REVOKE ALL ON FUNCTION public.claim_driver_platform_fee(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_driver_platform_fee(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_driver_platform_fee(p_ride_id uuid,p_received boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $verify$
DECLARE v_fee public.driver_platform_fees%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_department_access('finance',true) THEN
    RAISE EXCEPTION 'Finance write permission required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_fee FROM public.driver_platform_fees WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR v_fee.status<>'CLAIMED' THEN
    RAISE EXCEPTION 'Repasse sem declaração pendente de validação' USING ERRCODE='22023';
  END IF;
  IF p_received IS TRUE THEN
    UPDATE public.driver_platform_fees SET status='SETTLED',verified_by=auth.uid(),verified_at=now()
    WHERE ride_id=p_ride_id;
  ELSE
    UPDATE public.driver_platform_fees SET status='OPEN',claim_reference=null,
      claimed_at=null,verified_by=null,verified_at=null WHERE ride_id=p_ride_id;
  END IF;
  RETURN true;
END $verify$;
REVOKE ALL ON FUNCTION public.verify_driver_platform_fee(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_driver_platform_fee(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_platform_fee_claims()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $admin$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_admin_department_access('finance') THEN
   RAISE EXCEPTION 'Finance access required' USING ERRCODE='42501';
 END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'rideId',ride_id,'driverId',driver_id,'gross',gross_amount,'fee',fee_amount,
   'reference',claim_reference,'claimedAt',claimed_at
 ) ORDER BY claimed_at)
 FROM public.driver_platform_fees WHERE status='CLAIMED'),'[]'::jsonb);
END $admin$;
REVOKE ALL ON FUNCTION public.admin_platform_fee_claims() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_fee_claims() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_platform_pix(p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $config$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_admin_department_access('finance',true) THEN
   RAISE EXCEPTION 'Finance write permission required' USING ERRCODE='42501';
 END IF;
 IF p_key IS NULL OR length(btrim(p_key)) NOT BETWEEN 6 AND 77 THEN
   RAISE EXCEPTION 'Informe a chave Pix da plataforma.' USING ERRCODE='22023';
 END IF;
 UPDATE public.platform_fee_config
 SET pix_key=btrim(p_key),updated_by=auth.uid(),updated_at=now()
 WHERE singleton=true;
 RETURN true;
END $config$;
REVOKE ALL ON FUNCTION public.admin_set_platform_pix(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_pix(text) TO authenticated;

-- Central, database-side enforcement; hiding buttons alone is insufficient.
CREATE OR REPLACE FUNCTION public.guard_driver_platform_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $guard$
DECLARE v_driver uuid;
BEGIN
  IF TG_TABLE_NAME='ride_offers' THEN
    v_driver:=NEW.user_id;
    IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    IF NEW.status NOT IN ('available','full') THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME='ride_routines' THEN
    IF NEW.kind<>'offer' OR NOT NEW.active THEN RETURN NEW; END IF;
    v_driver:=NEW.user_id;
  ELSIF TG_TABLE_NAME='ride_matches' THEN
    SELECT user_id INTO v_driver FROM public.ride_offers WHERE offer_id=NEW.offer_id;
  ELSIF TG_TABLE_NAME='professional_presence' THEN
    IF NOT NEW.is_available THEN RETURN NEW; END IF;
    v_driver:=NEW.user_id;
  ELSIF TG_TABLE_NAME='professional_driver_locations' THEN
    v_driver:=NEW.user_id;
  ELSIF TG_TABLE_NAME='professional_quick_rides' THEN
    IF NEW.driver_id IS NULL OR NEW.status <> 'ACCEPTED' OR
      (TG_OP='UPDATE' AND OLD.driver_id IS NOT NULL) THEN RETURN NEW; END IF;
    v_driver:=NEW.driver_id;
  ELSE
    RETURN NEW;
  END IF;
  IF NOT public.driver_platform_access_allowed(v_driver) THEN
    RAISE EXCEPTION 'Motorista com 3 repasses pendentes. Quite a comissão da plataforma para voltar a oferecer ou entrar no radar.'
    USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION public.guard_driver_platform_debt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ride_offer_driver_debt ON public.ride_offers;
CREATE TRIGGER ride_offer_driver_debt BEFORE INSERT OR UPDATE ON public.ride_offers
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_platform_debt();
DROP TRIGGER IF EXISTS ride_routine_driver_debt ON public.ride_routines;
CREATE TRIGGER ride_routine_driver_debt BEFORE INSERT OR UPDATE ON public.ride_routines
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_platform_debt();
DROP TRIGGER IF EXISTS ride_match_driver_debt ON public.ride_matches;
CREATE TRIGGER ride_match_driver_debt BEFORE INSERT ON public.ride_matches
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_platform_debt();
DROP TRIGGER IF EXISTS presence_driver_debt ON public.professional_presence;
CREATE TRIGGER presence_driver_debt BEFORE INSERT OR UPDATE ON public.professional_presence
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_platform_debt();
-- Guard the optional professional discovery pilot only when its migration is installed.
DO $optional_discovery$
BEGIN
 IF to_regclass('public.professional_driver_locations') IS NOT NULL THEN
   EXECUTE 'DROP TRIGGER IF EXISTS professional_location_driver_debt ON public.professional_driver_locations';
   EXECUTE 'CREATE TRIGGER professional_location_driver_debt BEFORE INSERT OR UPDATE ON public.professional_driver_locations FOR EACH ROW EXECUTE FUNCTION public.guard_driver_platform_debt()';
 END IF;
END $optional_discovery$;
DO $optional_quick$
BEGIN
 IF to_regclass('public.professional_quick_rides') IS NOT NULL THEN
   EXECUTE 'DROP TRIGGER IF EXISTS quick_ride_accept_driver_debt ON public.professional_quick_rides';
   EXECUTE 'CREATE TRIGGER quick_ride_accept_driver_debt BEFORE UPDATE ON public.professional_quick_rides FOR EACH ROW EXECUTE FUNCTION public.guard_driver_platform_debt()';
 END IF;
END $optional_quick$;

COMMENT ON TABLE public.driver_platform_fees IS '15% due on each mutually acknowledged completed shared ride. Three unresolved dues block new driver activity. No bank verification is inferred.';
NOTIFY pgrst,'reload schema';
COMMIT;
