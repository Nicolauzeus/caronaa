-- Correct the pending historical fare definition without editing migration history.
ALTER TABLE public.rides
 ADD COLUMN IF NOT EXISTS route_distance_km numeric(14,6),
 ADD COLUMN IF NOT EXISTS passenger_price numeric(10,2),
 ADD COLUMN IF NOT EXISTS passenger_group_total numeric(10,2),
 ADD COLUMN IF NOT EXISTS tariff_reference text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.rides'::regclass AND conname='rides_route_quote_complete_check') THEN
  ALTER TABLE public.rides ADD CONSTRAINT rides_route_quote_complete_check CHECK (
   (route_distance_km IS NULL AND passenger_price IS NULL AND passenger_group_total IS NULL AND tariff_reference IS NULL)
   OR (route_distance_km > 0 AND route_distance_km IS NOT NULL AND passenger_price >= 0 AND passenger_price IS NOT NULL AND passenger_group_total >= 0 AND passenger_group_total IS NOT NULL AND tariff_reference IS NOT NULL AND length(btrim(tariff_reference)) > 0));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.recalculate_ride_cost_split(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.rides SET total_price=0, passenger_contribution=0, updated_at=clock_timestamp()
 WHERE offer_id=p_offer_id AND status='MATCHED' AND route_distance_km IS NULL
 AND passenger_accepted_at IS NULL AND driver_accepted_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_ride_cost_split(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_ride_total_cost(uuid,numeric) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.persist_ride_route_quote(
 p_ride_id uuid,p_route_distance_km numeric,p_passenger_price numeric,p_group_total numeric,p_tariff_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.rides%ROWTYPE; passengers integer;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Trusted server operation required' USING ERRCODE='42501'; END IF;
 IF p_route_distance_km IS NULL OR p_route_distance_km <= 0 OR p_route_distance_km::text IN ('NaN','Infinity','-Infinity')
 OR p_passenger_price IS NULL OR p_passenger_price < 0 OR p_passenger_price::text IN ('NaN','Infinity','-Infinity')
 OR p_group_total IS NULL OR p_group_total < 0 OR p_group_total::text IN ('NaN','Infinity','-Infinity')
 OR p_tariff_reference IS DISTINCT FROM 'caronaa-km-6-per-11-v1' THEN RAISE EXCEPTION 'Invalid fare quote'; END IF;
 IF round(p_route_distance_km * 6 / 11,2) <> p_passenger_price THEN RAISE EXCEPTION 'Fare does not match the configured tariff'; END IF;
 SELECT * INTO r FROM public.rides WHERE ride_id=p_ride_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ride not found'; END IF;
 IF r.route_distance_km IS NOT NULL THEN RETURN false; END IF;
 IF r.status <> 'MATCHED' OR r.response_expires_at <= clock_timestamp() OR r.passenger_accepted_at IS NOT NULL OR r.driver_accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Only an unaccepted active proposal can be quoted'; END IF;
 SELECT passenger_count INTO passengers FROM public.ride_requests WHERE request_id=r.request_id FOR SHARE;
 IF passengers IS NULL OR passengers < 1 OR round(p_passenger_price * passengers,2) <> p_group_total THEN RAISE EXCEPTION 'Group fare does not match the request'; END IF;
 UPDATE public.rides SET route_distance_km=p_route_distance_km,passenger_price=p_passenger_price,
 passenger_group_total=p_group_total,tariff_reference=p_tariff_reference,total_price=p_group_total,
 passenger_contribution=p_group_total,updated_at=clock_timestamp() WHERE ride_id=p_ride_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.persist_ride_route_quote(uuid,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_ride_route_quote(uuid,numeric,numeric,numeric,text) TO service_role;
-- Guard both individual acceptance and any alternate confirmation path.
CREATE OR REPLACE FUNCTION public.guard_ride_fare_quote()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.route_distance_km IS NOT NULL AND (
 NEW.route_distance_km IS DISTINCT FROM OLD.route_distance_km OR NEW.passenger_price IS DISTINCT FROM OLD.passenger_price
 OR NEW.passenger_group_total IS DISTINCT FROM OLD.passenger_group_total OR NEW.tariff_reference IS DISTINCT FROM OLD.tariff_reference
 OR NEW.total_price IS DISTINCT FROM OLD.total_price OR NEW.passenger_contribution IS DISTINCT FROM OLD.passenger_contribution
 OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.offer_id IS DISTINCT FROM OLD.offer_id
 OR NEW.passenger_user_id IS DISTINCT FROM OLD.passenger_user_id OR NEW.driver_user_id IS DISTINCT FROM OLD.driver_user_id) THEN
 RAISE EXCEPTION 'Saved fare quote is immutable'; END IF;
 IF OLD.route_distance_km IS NULL AND NEW.route_distance_km IS NOT NULL AND
 (OLD.status <> 'MATCHED' OR OLD.passenger_accepted_at IS NOT NULL OR OLD.driver_accepted_at IS NOT NULL) THEN
 RAISE EXCEPTION 'Historical or accepted rides cannot be requoted'; END IF;
 IF OLD.status='MATCHED' AND (
 NEW.passenger_accepted_at IS DISTINCT FROM OLD.passenger_accepted_at OR NEW.driver_accepted_at IS DISTINCT FROM OLD.driver_accepted_at OR NEW.status='CONFIRMED') THEN
 IF NEW.route_distance_km IS NULL OR NEW.passenger_price IS NULL OR NEW.passenger_group_total IS NULL THEN RAISE EXCEPTION 'Calcule o preço do trecho antes de aceitar esta combinação.'; END IF;
 IF NEW.status='CONFIRMED' AND (NEW.passenger_accepted_at IS NULL OR NEW.driver_accepted_at IS NULL) THEN RAISE EXCEPTION 'Both participants must accept'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_ride_fare_quote() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE TRIGGER ride_fare_quote_guard BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.guard_ride_fare_quote();
NOTIFY pgrst,'reload schema';