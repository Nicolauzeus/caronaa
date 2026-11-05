-- 0134 | Commission 16.86% on NEW rides, single-method payment lock.
-- Historical 15% obligations are immutable; payment choices cannot double-charge.
-- Asaas real checkout remains OFF; this migration creates no charge.
BEGIN;

ALTER TABLE public.driver_platform_fees
  DROP CONSTRAINT IF EXISTS driver_platform_fees_fee_rate_check;
ALTER TABLE public.driver_platform_fees
  ADD CONSTRAINT driver_platform_fees_fee_rate_check
  CHECK (fee_rate IN (0.1500, 0.1686));
ALTER TABLE public.driver_platform_fees
  ALTER COLUMN fee_rate SET DEFAULT 0.1686;
COMMENT ON COLUMN public.driver_platform_fees.fee_rate IS
  '15% for existing historical debts; 16.86% for new manual payment acknowledgements.';

CREATE TABLE IF NOT EXISTS public.ride_payment_choices (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(ride_id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('MANUAL_PIX','ASAAS_PIX')),
  selected_by uuid NOT NULL REFERENCES auth.users(id),
  selected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ride_payment_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  manual_enabled boolean NOT NULL DEFAULT true,
  asaas_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ride_payment_policy(singleton,manual_enabled,asaas_enabled)
VALUES (true,true,false) ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.ride_payment_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_payment_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ride_payment_choices, public.ride_payment_policy
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_ride_payment_choice(p_ride_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $choice$
DECLARE v_ride public.rides%ROWTYPE; v_method text; v_asaas boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_ride FROM public.rides WHERE ride_id=p_ride_id;
  IF NOT FOUND OR (auth.uid() IS DISTINCT FROM v_ride.passenger_user_id
    AND auth.uid() IS DISTINCT FROM v_ride.driver_user_id) THEN
    RAISE EXCEPTION 'Viagem indisponível' USING ERRCODE='42501';
  END IF;
  SELECT c.method INTO v_method FROM public.ride_payment_choices c WHERE c.ride_id=p_ride_id;
  IF v_method IS NULL AND EXISTS(
    SELECT 1 FROM public.manual_ride_payment_confirmations m WHERE m.ride_id=p_ride_id
  ) THEN v_method := 'MANUAL_PIX'; END IF;
  SELECT coalesce(asaas_enabled,false) INTO v_asaas
  FROM public.ride_payment_policy WHERE singleton=true;
  RETURN jsonb_build_object('method',v_method,
    'asaasAvailable',coalesce(v_asaas,false),
    'manualAvailable',true,
    'charged',EXISTS(
      SELECT 1 FROM public.asaas_checkout_intents x
      WHERE x.ride_id=p_ride_id AND x.asaas_payment_id IS NOT NULL
    ));
END $choice$;
REVOKE ALL ON FUNCTION public.get_ride_payment_choice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ride_payment_choice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.select_ride_payment_method(p_ride_id uuid,p_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $select$
DECLARE v_ride public.rides%ROWTYPE; v_current text; v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login obrigatório' USING ERRCODE='42501'; END IF;
  IF p_method NOT IN ('MANUAL_PIX','ASAAS_PIX') OR p_method IS NULL THEN
    RAISE EXCEPTION 'Método de pagamento inválido' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_ride FROM public.rides WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR v_ride.passenger_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Somente o passageiro pode escolher o pagamento' USING ERRCODE='42501';
  END IF;
  IF v_ride.status NOT IN ('CONFIRMED','IN_PROGRESS','COMPLETED') THEN
    RAISE EXCEPTION 'Viagem ainda não confirmada' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.manual_ride_payment_confirmations WHERE ride_id=p_ride_id)
    OR EXISTS(SELECT 1 FROM public.driver_platform_fees WHERE ride_id=p_ride_id) THEN
    IF p_method <> 'MANUAL_PIX' THEN
      RAISE EXCEPTION 'Esta viagem já utiliza Pix manual' USING ERRCODE='23514';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.asaas_checkout_intents WHERE ride_id=p_ride_id) AND
    p_method <> 'ASAAS_PIX' THEN
    RAISE EXCEPTION 'Existe tentativa Asaas nesta viagem; concilie antes de trocar o método'
      USING ERRCODE='23514';
  END IF;
  IF p_method='ASAAS_PIX' THEN
    SELECT asaas_enabled INTO v_allowed FROM public.ride_payment_policy WHERE singleton=true;
    IF NOT coalesce(v_allowed,false) THEN
      RAISE EXCEPTION 'Asaas em homologação; escolha Pix direto por enquanto'
        USING ERRCODE='22023';
    END IF;
  END IF;
  SELECT method INTO v_current FROM public.ride_payment_choices WHERE ride_id=p_ride_id;
  IF v_current IS NOT NULL AND v_current <> p_method THEN
    RAISE EXCEPTION 'O método da viagem já foi definido; solicite revisão financeira'
      USING ERRCODE='23514';
  END IF;
  INSERT INTO public.ride_payment_choices(ride_id,method,selected_by)
  VALUES(p_ride_id,p_method,auth.uid()) ON CONFLICT(ride_id) DO NOTHING;
  RETURN public.get_ride_payment_choice(p_ride_id);
END $select$;
REVOKE ALL ON FUNCTION public.select_ride_payment_method(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_ride_payment_method(uuid,text) TO authenticated;

-- Do not let direct RPC calls, retries or service-role writes bypass the selected method.
CREATE OR REPLACE FUNCTION public.guard_manual_pix_exclusivity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $manual$
DECLARE v_ride public.rides%ROWTYPE; v_method text;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE ride_id=NEW.ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Viagem inexistente'; END IF;
  SELECT method INTO v_method FROM public.ride_payment_choices WHERE ride_id=NEW.ride_id;
  IF v_method='ASAAS_PIX' OR EXISTS(
    SELECT 1 FROM public.asaas_checkout_intents WHERE ride_id=NEW.ride_id
  ) THEN
    RAISE EXCEPTION 'Pix manual indisponível: tentativa Asaas existente'
      USING ERRCODE='23514';
  END IF;
  IF v_method IS NULL THEN
    INSERT INTO public.ride_payment_choices(ride_id,method,selected_by)
    VALUES(NEW.ride_id,'MANUAL_PIX',v_ride.passenger_user_id)
    ON CONFLICT (ride_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $manual$;
REVOKE ALL ON FUNCTION public.guard_manual_pix_exclusivity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS manual_pix_method_guard ON public.manual_ride_payment_confirmations;
CREATE TRIGGER manual_pix_method_guard BEFORE INSERT OR UPDATE
ON public.manual_ride_payment_confirmations FOR EACH ROW
EXECUTE FUNCTION public.guard_manual_pix_exclusivity();

CREATE OR REPLACE FUNCTION public.guard_asaas_pix_exclusivity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $asaas$
DECLARE v_method text;
BEGIN
  SELECT method INTO v_method FROM public.ride_payment_choices WHERE ride_id=NEW.ride_id;
  IF v_method IS DISTINCT FROM 'ASAAS_PIX' OR EXISTS(
    SELECT 1 FROM public.manual_ride_payment_confirmations WHERE ride_id=NEW.ride_id
  ) OR EXISTS(SELECT 1 FROM public.driver_platform_fees WHERE ride_id=NEW.ride_id) THEN
    RAISE EXCEPTION 'Reserva não habilitada para Asaas; Pix manual ou método não confirmado'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $asaas$;
REVOKE ALL ON FUNCTION public.guard_asaas_pix_exclusivity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS asaas_pix_method_guard ON public.asaas_checkout_intents;
CREATE TRIGGER asaas_pix_method_guard BEFORE INSERT OR UPDATE
ON public.asaas_checkout_intents FOR EACH ROW
EXECUTE FUNCTION public.guard_asaas_pix_exclusivity();

-- Update the existing SECURITY DEFINER functions while preserving their other
-- authorization, ride-status, price-validation, lock and audit rules.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  SELECT pg_get_functiondef('public.confirm_manual_ride_payment(uuid)'::regprocedure) INTO v_def;
  IF position('round(v_gross*0.15,2)' IN v_def)=0 AND
     position('round(v_gross*0.1686,2)' IN v_def)=0 THEN
    RAISE EXCEPTION 'Manual payment function unexpectedly changed; review before applying.';
  END IF;
  v_next:=replace(v_def,'round(v_gross*0.15,2)','round(v_gross*0.1686,2)');
  v_next:=replace(v_next,
    'INSERT INTO public.driver_platform_fees(ride_id,driver_id,gross_amount,fee_amount)',
    'INSERT INTO public.driver_platform_fees(ride_id,driver_id,gross_amount,fee_amount,fee_rate)');
  v_next:=replace(v_next,
    'VALUES(p_ride_id,v_ride.driver_user_id,v_gross,greatest(0.01,round(v_gross*0.1686,2)))',
    'VALUES(p_ride_id,v_ride.driver_user_id,v_gross,greatest(0.01,round(v_gross*0.1686,2)),0.1686)');
  IF position('fee_amount,fee_rate)' IN v_next)=0 THEN
    RAISE EXCEPTION 'Manual fee rate persistence patch failed';
  END IF;
  EXECUTE v_next;

  SELECT pg_get_functiondef('public.get_my_driver_platform_fees()'::regprocedure) INTO v_def;
  IF position('''feePercent'', 15' IN v_def)>0 THEN
    EXECUTE replace(v_def,'''feePercent'', 15','''feePercent'', 16.86');
  ELSIF position('''feePercent'', 16.86' IN v_def)=0 THEN
    RAISE EXCEPTION 'Fee statement function requires manual review';
  END IF;

  SELECT pg_get_functiondef('public.get_ride_pix(uuid)'::regprocedure) INTO v_def;
  IF position('Pix manual indisponível para método Asaas' IN v_def)=0 THEN
    v_next:=replace(v_def,
      'IF r.status <> ''COMPLETED'' THEN',
      'IF EXISTS(SELECT 1 FROM public.ride_payment_choices WHERE ride_id=p_ride_id AND method=''ASAAS_PIX'') THEN ' ||
      'RAISE EXCEPTION ''Pix manual indisponível para método Asaas'' USING ERRCODE=''23514''; END IF; ' ||
      'IF r.status <> ''COMPLETED'' THEN');
    IF v_next=v_def THEN RAISE EXCEPTION 'Pix guard patch failed'; END IF;
    EXECUTE v_next;
  END IF;
END $patch$;

COMMENT ON TABLE public.ride_payment_choices IS
  'One immutable payment rail per ride. Manual confirmation and Asaas checkout intents are mutually exclusive.';
COMMENT ON TABLE public.ride_payment_policy IS
  'Asaas is intentionally disabled until sandbox, webhook, fee reconciliation and split tests pass.';
NOTIFY pgrst,'reload schema';
COMMIT;
