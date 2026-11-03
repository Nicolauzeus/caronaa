-- F07 phase 2: guarded quick-ride requests and atomic dispatch primitives.
-- No region is activated by this migration. No payments are performed.
CREATE TABLE IF NOT EXISTS public.professional_quick_rides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 passenger_id uuid NOT NULL REFERENCES auth.users(id),
 driver_id uuid REFERENCES auth.users(id),
 municipality text NOT NULL REFERENCES public.professional_service_regions(municipality),
 vehicle_type text NOT NULL CHECK(vehicle_type IN ('CAR','MOTO')),
 origin_label text NOT NULL CHECK(length(btrim(origin_label)) BETWEEN 3 AND 180),
 destination_label text NOT NULL CHECK(length(btrim(destination_label)) BETWEEN 3 AND 180),
 origin_lat double precision NOT NULL CHECK(origin_lat BETWEEN -90 AND 90),
 origin_lng double precision NOT NULL CHECK(origin_lng BETWEEN -180 AND 180),
 destination_lat double precision NOT NULL CHECK(destination_lat BETWEEN -90 AND 90),
 destination_lng double precision NOT NULL CHECK(destination_lng BETWEEN -180 AND 180),
 status text NOT NULL DEFAULT 'SEARCHING' CHECK(status IN ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '2 minutes'),
 accepted_at timestamptz,
 completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT different_ride_participants CHECK(driver_id IS NULL OR driver_id <> passenger_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS professional_quick_ride_active_passenger_idx ON public.professional_quick_rides(passenger_id)
 WHERE status IN ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS');
CREATE UNIQUE INDEX IF NOT EXISTS professional_quick_ride_active_driver_idx ON public.professional_quick_rides(driver_id)
 WHERE driver_id IS NOT NULL AND status IN ('ACCEPTED','ARRIVED','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS professional_quick_ride_search_idx ON public.professional_quick_rides(municipality,requested_at)
 WHERE status='SEARCHING';
ALTER TABLE public.professional_quick_rides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_quick_rides FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.quick_ride_request(
 p_municipality text,p_vehicle_type text,
 p_origin_label text,p_destination_label text,
 p_origin_lat double precision,p_origin_lng double precision,
 p_destination_lat double precision,p_destination_lng double precision
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid; v_user uuid := auth.uid();
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.professional_service_regions
   WHERE municipality=btrim(p_municipality) AND dispatch_enabled AND public_discovery_enabled) THEN
   RAISE EXCEPTION 'Quick rides are not enabled in this region' USING ERRCODE='42501';
 END IF;
 IF p_vehicle_type NOT IN ('CAR','MOTO') OR
    length(btrim(coalesce(p_origin_label,''))) NOT BETWEEN 3 AND 180 OR
    length(btrim(coalesce(p_destination_label,''))) NOT BETWEEN 3 AND 180 OR
    p_origin_lat IS NULL OR p_origin_lng IS NULL OR p_destination_lat IS NULL OR p_destination_lng IS NULL OR
    NOT (p_origin_lat BETWEEN -90 AND 90 AND p_origin_lng BETWEEN -180 AND 180 AND
         p_destination_lat BETWEEN -90 AND 90 AND p_destination_lng BETWEEN -180 AND 180) THEN
   RAISE EXCEPTION 'Invalid quick ride request';
 END IF;
 -- Invalidate an expired search before applying the unique active passenger constraint.
 UPDATE public.professional_quick_rides SET status='EXPIRED',updated_at=now()
 WHERE passenger_id=v_user AND status='SEARCHING' AND expires_at<now();
 INSERT INTO public.professional_quick_rides(passenger_id,municipality,vehicle_type,origin_label,destination_label,
  origin_lat,origin_lng,destination_lat,destination_lng)
 VALUES(v_user,btrim(p_municipality),p_vehicle_type,btrim(p_origin_label),btrim(p_destination_label),
  p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;

CREATE OR REPLACE FUNCTION public.quick_ride_my_requests()
RETURNS TABLE(id uuid,role text,municipality text,vehicle_type text,origin_label text,
 destination_label text,status text,requested_at timestamptz,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT q.id,
 CASE WHEN q.passenger_id=auth.uid() THEN 'PASSENGER' ELSE 'DRIVER' END,
 q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
 CASE WHEN q.status='SEARCHING' AND q.expires_at<now() THEN 'EXPIRED' ELSE q.status END,
 q.requested_at,q.expires_at
 FROM public.professional_quick_rides q
 WHERE q.passenger_id=auth.uid() OR q.driver_id=auth.uid()
 ORDER BY q.requested_at DESC LIMIT 40;
$$;

CREATE OR REPLACE FUNCTION public.quick_ride_driver_queue(p_municipality text)
RETURNS TABLE(id uuid, vehicle_type text,origin_label text,destination_label text,requested_at timestamptz,expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.professional_driver_authorizations a
 JOIN public.professional_presence p ON p.user_id=a.user_id
 JOIN public.professional_driver_locations l ON l.user_id=a.user_id
 JOIN public.professional_service_regions r ON r.municipality=l.municipality
 WHERE a.user_id=auth.uid() AND a.approved AND p.is_available
 AND p.last_seen_at>now()-interval '90 seconds' AND l.updated_at>now()-interval '90 seconds'
 AND l.municipality=btrim(p_municipality) AND r.dispatch_enabled
 ) THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,q.vehicle_type,q.origin_label,q.destination_label,q.requested_at,q.expires_at
 FROM public.professional_quick_rides q
 WHERE q.municipality=btrim(p_municipality) AND q.status='SEARCHING'
 AND q.expires_at>now() AND q.passenger_id<>auth.uid()
 ORDER BY q.requested_at LIMIT 30;
END;$$;

CREATE OR REPLACE FUNCTION public.quick_ride_accept(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_driver uuid:=auth.uid(); v_region text; v_passenger uuid;
BEGIN
 IF v_driver IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 -- Serialize all accept attempts by one driver in this transaction.
 PERFORM 1 FROM public.professional_driver_authorizations
 WHERE user_id=v_driver AND approved FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Professional driver not authorized' USING ERRCODE='42501'; END IF;
 UPDATE public.professional_quick_rides q SET driver_id=v_driver,status='ACCEPTED',accepted_at=now(),updated_at=now()
 WHERE q.id=p_id AND q.status='SEARCHING' AND q.expires_at>now() AND q.passenger_id<>v_driver
 AND EXISTS(
 SELECT 1 FROM public.professional_presence p
 JOIN public.professional_driver_locations l ON l.user_id=p.user_id
 JOIN public.professional_service_regions r ON r.municipality=l.municipality
 WHERE p.user_id=v_driver AND p.is_available
 AND p.last_seen_at>now()-interval '90 seconds' AND l.updated_at>now()-interval '90 seconds'
 AND l.municipality=q.municipality AND r.dispatch_enabled
 )
 RETURNING q.municipality,q.passenger_id INTO v_region,v_passenger;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN unique_violation THEN RETURN false;
END;$$;

CREATE OR REPLACE FUNCTION public.quick_ride_transition(p_id uuid,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE; u uuid:=auth.uid();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (u<>q.passenger_id AND u IS DISTINCT FROM q.driver_id) THEN
  RAISE EXCEPTION 'Ride not found' USING ERRCODE='42501'; END IF;
 IF p_status='CANCELLED' AND q.status IN ('SEARCHING','ACCEPTED','ARRIVED') THEN
  UPDATE public.professional_quick_rides SET status='CANCELLED',updated_at=now() WHERE id=p_id;
 ELSIF u=q.driver_id AND ((q.status='ACCEPTED' AND p_status='ARRIVED') OR
                          (q.status='ARRIVED' AND p_status='IN_PROGRESS') OR
                          (q.status='IN_PROGRESS' AND p_status='COMPLETED')) THEN
  UPDATE public.professional_quick_rides SET status=p_status,updated_at=now(),
   completed_at=CASE WHEN p_status='COMPLETED' THEN now() ELSE completed_at END WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid or unauthorized ride state transition' USING ERRCODE='42501';
 END IF;
 RETURN true;
END;$$;

REVOKE ALL ON FUNCTION public.quick_ride_request(text,text,text,text,double precision,double precision,double precision,double precision),
 public.quick_ride_my_requests(),public.quick_ride_driver_queue(text),public.quick_ride_accept(uuid),
 public.quick_ride_transition(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_request(text,text,text,text,double precision,double precision,double precision,double precision),
 public.quick_ride_my_requests(),public.quick_ride_driver_queue(text),public.quick_ride_accept(uuid),
 public.quick_ride_transition(uuid,text) TO authenticated;
COMMENT ON TABLE public.professional_quick_rides IS 'Professional quick ride lifecycle gate. No fare/payment and OFF until region dispatch_enabled approved.';
NOTIFY pgrst,'reload schema';
