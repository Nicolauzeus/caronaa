-- Temporary Macico de Baturite local quick-ride commission waiver.
-- Applies to NEW intramunicipal Macico F07 rides and Acarape <-> Redencao rides.
-- Existing quotes, debt, pricing tables and payment history remain untouched.
-- Requires applied migrations 0140 and destination_municipality (0143/0147).
BEGIN;

CREATE OR REPLACE FUNCTION public.caronaa_accrue_completed_quick_ride_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fee$
DECLARE v_quote public.caronaa_quick_fare_quotes%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM 'COMPLETED' OR
     OLD.status IS NOT DISTINCT FROM 'COMPLETED' THEN RETURN NEW; END IF;
  IF NEW.driver_id IS NULL THEN
    RAISE EXCEPTION 'Completed quick ride has no assigned driver';
  END IF;
  SELECT * INTO v_quote FROM public.caronaa_quick_fare_quotes
  WHERE ride_id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN
    -- A legacy pilot ride created BEFORE the quoted-dispatch release has no
    -- monetary contract; do not fabricate a debt from an invented fare.
    RETURN NEW;
  END IF;
  IF v_quote.passenger_id IS DISTINCT FROM NEW.passenger_id OR
     v_quote.vehicle_type IS DISTINCT FROM NEW.vehicle_type OR
     v_quote.municipality IS DISTINCT FROM NEW.municipality OR
     v_quote.platform_commission_cents < 0 OR
     (v_quote.platform_commission_cents = 0 AND NOT (
       v_quote.pricing_region = 'MACICO_BATURITE'
       AND (
         v_quote.destination_municipality = v_quote.municipality
         OR (v_quote.municipality IN ('Acarape','Redenção')
             AND v_quote.destination_municipality IN ('Acarape','Redenção'))
       )
       AND v_quote.commission_bps = 0
       AND v_quote.driver_receives_cents = v_quote.customer_pays_cents
     )) THEN
    RAISE EXCEPTION 'Quick ride fare snapshot mismatch; financial review required';
  END IF;
  -- Zero commission creates no platform debt or statement item.
  IF v_quote.platform_commission_cents = 0 THEN RETURN NEW; END IF;
  INSERT INTO public.caronaa_quick_driver_fees(
    ride_id,quote_id,driver_id,gross_cents,fee_cents,commission_bps
  ) VALUES(
    NEW.id,v_quote.id,NEW.driver_id,v_quote.customer_pays_cents,
    v_quote.platform_commission_cents,v_quote.commission_bps
  ) ON CONFLICT(ride_id) DO NOTHING;
  -- Invalidate active discovery immediately when the third unsettled
  -- obligation is accrued; do not rely on a later GPS heartbeat to notice it.
  IF NOT public.driver_platform_access_allowed(NEW.driver_id) THEN
    UPDATE public.professional_presence SET is_available=false
      WHERE user_id=NEW.driver_id AND is_available=true;
    DELETE FROM public.professional_driver_locations WHERE user_id=NEW.driver_id;
  END IF;
  RETURN NEW;
END $fee$;

COMMIT;
