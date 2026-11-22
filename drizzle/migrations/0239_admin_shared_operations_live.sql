-- 0239 | Shared-ride operational map for the authenticated admin cockpit.
-- Read-only, admin-only. Never publish shared GPS or exact user identity to public radar.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_shared_operations_live()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $shared$
DECLARE v_day date:=(now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
   RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
   'generated_at',now(),
   'offers',coalesce((
     SELECT jsonb_agg(to_jsonb(x) ORDER BY x.departure_at ASC)
     FROM (
       SELECT o.offer_id AS id,'offer'::text AS kind,
         o.origin_lat AS lat,o.origin_lng AS lng,
         o.origin AS origin_label,o.destination AS destination_label,
         o.ride_date::text AS date,o.departure_time::text AS time,
         o.seats_remaining AS seats,o.status AS status,
         (o.ride_date + o.departure_time) AS departure_at
       FROM public.ride_offers o
       WHERE o.status='available' AND o.ride_date>=v_day
         AND o.seats_remaining>0
         AND o.origin_lat BETWEEN -90 AND 90 AND o.origin_lng BETWEEN -180 AND 180
         AND o.origin_lat<>0 AND o.origin_lng<>0
       ORDER BY o.ride_date,o.departure_time LIMIT 150
     ) x
   ),'[]'::jsonb),
   'requests',coalesce((
     SELECT jsonb_agg(to_jsonb(x) ORDER BY x.departure_at ASC)
     FROM (
       SELECT r.request_id AS id,'request'::text AS kind,
         r.origin_lat AS lat,r.origin_lng AS lng,
         r.origin AS origin_label,r.destination AS destination_label,
         r.ride_date::text AS date,r.departure_time::text AS time,
         r.passenger_count AS seats,r.status AS status,
         (r.ride_date + r.departure_time) AS departure_at
       FROM public.ride_requests r
       WHERE r.status IN ('open','matched') AND r.ride_date>=v_day
         AND r.origin_lat BETWEEN -90 AND 90 AND r.origin_lng BETWEEN -180 AND 180
         AND r.origin_lat<>0 AND r.origin_lng<>0
       ORDER BY r.ride_date,r.departure_time LIMIT 150
     ) x
   ),'[]'::jsonb)
 );
END;
$shared$;
REVOKE ALL ON FUNCTION public.admin_shared_operations_live() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_shared_operations_live() TO authenticated;
COMMENT ON FUNCTION public.admin_shared_operations_live() IS 'Admin-only shared offer/request map with real persisted meeting coordinates; does not alter ride matching.';
NOTIFY pgrst,'reload schema';
COMMIT;