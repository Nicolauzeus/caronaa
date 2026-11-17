-- F07: declarations are bilateral; neither one is a bank confirmation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.quick_ride_payment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ride_id uuid NOT NULL REFERENCES public.professional_quick_rides(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL CHECK(event_type IN ('PASSENGER_DECLARED','DRIVER_ACKNOWLEDGED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(ride_id,event_type)
);
ALTER TABLE public.quick_ride_payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quick_ride_payment_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quick_ride_declare_manual_pix(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid()
    OR q.status<>'COMPLETED' THEN
  RAISE EXCEPTION 'Pagamento indisponivel' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.driver_pix_settings d
   WHERE d.user_id=q.driver_id AND length(btrim(d.pix_key))>=6) THEN
  RAISE EXCEPTION 'Motorista ainda nao cadastrou chave Pix' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.caronaa_quick_fare_quotes f
   WHERE f.ride_id=p_id AND f.customer_pays_cents>=450
     AND f.customer_pays_cents=f.driver_receives_cents+f.platform_commission_cents) THEN
  RAISE EXCEPTION 'Contrato de tarifa inconsistente' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.quick_ride_pix_declarations(ride_id,code_hash,salt,expires_at,passenger_declared_at)
 VALUES (p_id,encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),
         gen_random_uuid(),now()+interval '24 hours',now())
 ON CONFLICT(ride_id) DO UPDATE
 SET passenger_declared_at=now()
 WHERE public.quick_ride_pix_declarations.passenger_declared_at IS NULL
   AND public.quick_ride_pix_declarations.driver_acknowledged_at IS NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.quick_ride_payment_events(ride_id,actor_id,event_type)
 VALUES(p_id,auth.uid(),'PASSENGER_DECLARED') ON CONFLICT DO NOTHING;
 RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.quick_ride_acknowledge_manual_pix(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid()
    OR q.status<>'COMPLETED' THEN
  RAISE EXCEPTION 'Recebimento indisponivel' USING ERRCODE='42501';
 END IF;
 UPDATE public.quick_ride_pix_declarations SET driver_acknowledged_at=now()
 WHERE ride_id=p_id AND passenger_declared_at IS NOT NULL
   AND driver_acknowledged_at IS NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.quick_ride_payment_events(ride_id,actor_id,event_type)
 VALUES(p_id,auth.uid(),'DRIVER_ACKNOWLEDGED') ON CONFLICT DO NOTHING;
 RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.quick_ride_declare_manual_pix(uuid),
 public.quick_ride_acknowledge_manual_pix(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_declare_manual_pix(uuid),
 public.quick_ride_acknowledge_manual_pix(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
