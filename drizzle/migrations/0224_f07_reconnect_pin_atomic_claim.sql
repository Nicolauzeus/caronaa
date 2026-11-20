-- 0224: reconnect-safe boarding and database-level one-driver/one-passenger concurrency.
-- Run after 0223. If historic active duplicates exist, inspect and resolve them
-- explicitly before creating indexes: never automatically delete or cancel rides.
BEGIN;

DO $check$
BEGIN
 IF EXISTS (
   SELECT passenger_id FROM public.professional_quick_rides
   WHERE status IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
   GROUP BY passenger_id HAVING count(*)>1
 ) THEN
   RAISE EXCEPTION 'F07_ACTIVE_PASSENGER_DUPLICATES: resolve conflicting active rides before 0224';
 END IF;
 IF EXISTS (
   SELECT driver_id FROM public.professional_quick_rides
   WHERE driver_id IS NOT NULL AND status IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
   GROUP BY driver_id HAVING count(*)>1
 ) THEN
   RAISE EXCEPTION 'F07_ACTIVE_DRIVER_DUPLICATES: resolve conflicting active rides before 0224';
 END IF;
END $check$;

-- Searching/expired requests may coexist historically; exactly one assigned
-- active journey per passenger is enforced. The row-level lock in both acceptance RPCs already serializes claims to the
-- SAME request. These constraints also prevent concurrent claims to DIFFERENT
-- requests by a driver/passenger, regardless of which RPC is used.
CREATE UNIQUE INDEX IF NOT EXISTS uq_f07_one_active_ride_per_passenger
 ON public.professional_quick_rides(passenger_id)
 WHERE status IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW');
CREATE UNIQUE INDEX IF NOT EXISTS uq_f07_one_active_ride_per_driver
 ON public.professional_quick_rides(driver_id)
 WHERE driver_id IS NOT NULL AND status IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW');

-- Pre-issue the OTP on ACCEPTED, BEFORE the driver announces arrival.
-- Client saves it per-ride in session storage, so an ARRIVED event can be missed
-- without holding up boarding. Never issue without authenticated passenger.
-- Keep original cryptographic hashing, attempts, expiration and reissue limits.
CREATE OR REPLACE FUNCTION public.quick_ride_issue_boarding_pin(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE q public.professional_quick_rides%ROWTYPE;
 s public.quick_ride_boarding_secrets%ROWTYPE;
 v_salt uuid:=gen_random_uuid();v_code text;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid()
   OR q.driver_id IS NULL OR q.status NOT IN ('ACCEPTED','ARRIVED') THEN
   RAISE EXCEPTION 'Boarding OTP unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.quick_ride_boarding_secrets WHERE ride_id=p_id FOR UPDATE;
 IF FOUND AND (s.consumed_at IS NOT NULL OR s.attempts>=5 OR s.reissue_count>=2) THEN
   RAISE EXCEPTION 'Boarding OTP consumed, locked or reissue limit reached'
   USING ERRCODE='42501';
 END IF;
 v_code:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%10000)::text,4,'0');
 IF s.ride_id IS NULL THEN
   INSERT INTO public.quick_ride_boarding_secrets(ride_id,pin_hash,salt,attempts,expires_at)
   VALUES(p_id,encode(sha256(convert_to(v_code||v_salt::text,'UTF8')),'hex'),
     v_salt,0,now()+interval '15 minutes');
 ELSE
   UPDATE public.quick_ride_boarding_secrets
   SET pin_hash=encode(sha256(convert_to(v_code||v_salt::text,'UTF8')),'hex'),
     salt=v_salt,expires_at=now()+interval '15 minutes',
     reissue_count=reissue_count+1
   WHERE ride_id=p_id;
 END IF;
 RETURN v_code;
END $fn$;
REVOKE ALL ON FUNCTION public.quick_ride_issue_boarding_pin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_issue_boarding_pin(uuid) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
