-- Minimal, disposable source-schema fixture for migrations 0247-0258.
-- This is NOT the full production schema or a replacement for staging.
-- Run only in a freshly initialized local cluster via test-operations-db.mjs.
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT $1='00000000-0000-0000-0000-000000000001'::uuid AND $2='admin' $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.role',true),'')
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY,full_name text);
CREATE TABLE public.professional_quick_rides (
 id uuid PRIMARY KEY,passenger_id uuid NOT NULL,driver_id uuid,origin_label text,
 destination_label text,municipality text,requested_at timestamptz NOT NULL,status text NOT NULL,
 accepted_at timestamptz,arrived_at timestamptz,pickup_confirmed_at timestamptz,in_trip_at timestamptz,
 completed_at timestamptz,estimated_fare_cents integer,expires_at timestamptz,payment_status text
);
CREATE TABLE public.ride_requests (
 request_id uuid PRIMARY KEY,user_id uuid NOT NULL,origin_label text,origin text,
 destination_label text,destination text,created_at timestamptz NOT NULL,status text NOT NULL,passenger_price numeric
);
CREATE TABLE public.rides (
 ride_id uuid PRIMARY KEY,request_id uuid NOT NULL,driver_user_id uuid,passenger_user_id uuid,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,status text NOT NULL,
 driver_accepted_at timestamptz,passenger_accepted_at timestamptz,boarded_at timestamptz,
 completed_at timestamptz,passenger_contribution numeric
);
CREATE TABLE public.ride_status_history (
 ride_id uuid NOT NULL,actor_user_id uuid,created_at timestamptz,from_status text,to_status text
);
CREATE TABLE public.ride_notifications (
 notification_id uuid PRIMARY KEY,ride_id uuid NOT NULL,user_id uuid NOT NULL,
 created_at timestamptz,event_name text,read_at timestamptz
);
CREATE TABLE public.quick_ride_driver_views (
 ride_id uuid NOT NULL,driver_id uuid NOT NULL,first_viewed_at timestamptz NOT NULL,
 last_viewed_at timestamptz NOT NULL,PRIMARY KEY(ride_id,driver_id)
);
CREATE TABLE public.quick_ride_driver_cancellations (
 ride_id uuid NOT NULL,driver_id uuid NOT NULL,cancelled_at timestamptz,previous_status text,reason text
);
CREATE TABLE public.flash_order_driver_skips (ride_id uuid NOT NULL,driver_id uuid NOT NULL,skipped_at timestamptz);
CREATE TABLE public.caronaa_quick_fare_quotes (
 id uuid PRIMARY KEY,ride_id uuid,passenger_id uuid,issued_at timestamptz,customer_pays_cents integer
);
CREATE TABLE public.caronaa_operational_presence_hours (user_id uuid,kind text,hour_bucket timestamptz);
CREATE TABLE public.flash_driver_presence (user_id uuid,is_online boolean,last_gps_at timestamptz);
CREATE TABLE public.professional_presence (user_id uuid,is_available boolean,last_seen_at timestamptz);
CREATE TABLE public.caronaa_passenger_demand_presence (user_id uuid,last_seen_at timestamptz);

-- Additional source tables/columns used by advanced F09 analytics.
ALTER TABLE public.ride_requests ADD COLUMN route_quote_id uuid;
CREATE TABLE public.ride_offers (offer_id uuid PRIMARY KEY,user_id uuid NOT NULL,route_quote_id uuid,created_at timestamptz NOT NULL);
CREATE TABLE public.offer_route_quotes (quote_id uuid PRIMARY KEY,user_id uuid NOT NULL,created_at timestamptz NOT NULL);
CREATE TABLE public.caronaa_f07_operations_audit (ride_id uuid,action text,actor_id uuid,occurred_at timestamptz);
CREATE TABLE public.caronaa_f07_operations_incidents (category text,status text,created_at timestamptz);
CREATE TABLE public.quick_ride_payment_events (ride_id uuid,actor_id uuid,event_type text,created_at timestamptz);

-- Stand-in for the existing authorized radar, only for wrapper contract tests.
-- Does not reproduce or validate production GPS / eligibility logic.
CREATE FUNCTION public.get_flash_driver_radar_orders(p_max_distance_m integer DEFAULT 15000)
RETURNS TABLE(ride_id uuid, origin_label text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT q.id,q.origin_label FROM public.professional_quick_rides q
 WHERE auth.uid()='00000000-0000-0000-0000-000000000003'::uuid
 AND q.id='10000000-0000-0000-0000-000000000003'::uuid AND q.status='SEARCHING' $$;
REVOKE ALL ON FUNCTION public.get_flash_driver_radar_orders(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_flash_driver_radar_orders(integer) TO authenticated;

-- Existing privacy-safe queue trigger (0148) source contract for 0258.
CREATE TABLE public.caronaa_quick_queue_events(municipality text PRIMARY KEY,changed_at timestamptz NOT NULL);
CREATE FUNCTION public.notify_caronaa_quick_queue_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.municipality IS NOT NULL THEN
  INSERT INTO public.caronaa_quick_queue_events(municipality,changed_at)
  VALUES(NEW.municipality,clock_timestamp())
  ON CONFLICT(municipality) DO UPDATE SET changed_at=EXCLUDED.changed_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER caronaa_quick_queue_realtime_event
 AFTER INSERT OR UPDATE OF status,driver_id ON public.professional_quick_rides
 FOR EACH ROW EXECUTE FUNCTION public.notify_caronaa_quick_queue_change();
