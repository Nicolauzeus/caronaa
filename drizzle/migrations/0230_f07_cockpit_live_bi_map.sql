-- 0230: A single admin-only F07 cockpit source. Counts are unpaginated.
-- Map coordinates are available ONLY to authenticated admins; never to public users.
-- Read-only, no ride lifecycle, pricing, Pix or permissions are modified.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_f07_cockpit_live()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $ops$
DECLARE
  v_base jsonb;
  v_ready integer;
  v_map_drivers jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito ao centro de operações' USING ERRCODE='42501';
  END IF;

  -- Use the same server-proven presence/readiness fields as the admin registry.
  v_base:=public.admin_f07_operations_snapshot();

  WITH candidates AS (
    SELECT user_id FROM public.professional_driver_authorizations
    UNION SELECT user_id FROM public.professional_presence
    UNION SELECT user_id FROM public.flash_driver_presence
  ), signals AS (
    SELECT c.user_id,a.vehicle_type,
      coalesce(fl.is_online,false) AND fl.last_gps_at>now()-interval '90 seconds'
        AND fl.last_sampled_at>now()-interval '90 seconds'
        AND fl.last_accuracy_m BETWEEN 0.0001 AND 150
        AND fl.last_lat BETWEEN -90 AND 90 AND fl.last_lng BETWEEN -180 AND 180 AS fresh_flash,
      coalesce(p.is_available,false) AND p.last_seen_at>now()-interval '90 seconds'
        AND l.sampled_at>now()-interval '90 seconds'
        AND l.updated_at>now()-interval '90 seconds'
        AND l.accuracy_m BETWEEN 0.0001 AND 150
        AND l.lat BETWEEN -90 AND 90 AND l.lng BETWEEN -180 AND 180 AS fresh_professional,
      fl.last_lat,fl.last_lng,fl.last_sampled_at,
      l.lat,l.lng,l.sampled_at,
      coalesce(a.approved,false) AS approved,
      coalesce(fl.is_online,false) AND fl.last_gps_at>now()-interval '90 seconds' AS flash_connected,
      coalesce(p.is_available,false) AND p.last_seen_at>now()-interval '90 seconds' AS professional_connected
    FROM candidates c
    LEFT JOIN public.professional_driver_authorizations a ON a.user_id=c.user_id
    LEFT JOIN public.flash_driver_presence fl ON fl.user_id=c.user_id
    LEFT JOIN public.professional_presence p ON p.user_id=c.user_id
    LEFT JOIN public.professional_driver_locations l ON l.user_id=c.user_id
  ), eligible AS (
    SELECT s.*,
      (coalesce(s.flash_connected,false) OR coalesce(s.professional_connected,false))
       AND (coalesce(s.fresh_flash,false) OR coalesce(s.fresh_professional,false))
       AND s.approved
       AND public.driver_platform_access_allowed(s.user_id) AS ready
    FROM signals s
  )
  SELECT coalesce(count(*) FILTER (WHERE ready),0)::integer,
         coalesce((
           SELECT jsonb_agg(to_jsonb(t) ORDER BY t.seen_at DESC)
           FROM (
             SELECT e.user_id::text AS id,
               CASE WHEN coalesce(e.fresh_flash,false) AND
                 (NOT coalesce(e.fresh_professional,false) OR e.last_sampled_at>=e.sampled_at)
                  THEN e.last_lat ELSE e.lat END AS lat,
               CASE WHEN coalesce(e.fresh_flash,false) AND
                 (NOT coalesce(e.fresh_professional,false) OR e.last_sampled_at>=e.sampled_at)
                  THEN e.last_lng ELSE e.lng END AS lng,
               CASE WHEN coalesce(e.fresh_flash,false) AND
                 (NOT coalesce(e.fresh_professional,false) OR e.last_sampled_at>=e.sampled_at)
                  THEN e.last_sampled_at ELSE e.sampled_at END AS seen_at,
               e.vehicle_type,
               EXISTS (SELECT 1 FROM public.professional_quick_rides q
                 WHERE q.driver_id=e.user_id AND q.status='IN_PROGRESS') AS in_trip,
               e.ready
             FROM eligible e
             WHERE (coalesce(e.fresh_flash,false) OR coalesce(e.fresh_professional,false))
               AND (coalesce(e.flash_connected,false) OR coalesce(e.professional_connected,false))
             ORDER BY greatest(e.last_sampled_at,e.sampled_at) DESC NULLS LAST
             LIMIT 80
           ) t
         ),'[]'::jsonb)
  INTO v_ready,v_map_drivers
  FROM eligible;

  RETURN jsonb_build_object(
    'generated_at',now(),
    'kpis',jsonb_build_object(
      'waiting',(SELECT count(*) FROM public.professional_quick_rides q
                 WHERE q.status='SEARCHING' AND q.expires_at>now()),
      'ready_drivers',v_ready,
      'in_progress',(SELECT count(*) FROM public.professional_quick_rides q WHERE q.status='IN_PROGRESS'),
      'critical',(
        SELECT count(*) FROM (
          SELECT 'ride:'||q.id::text AS key
            FROM public.professional_quick_rides q WHERE q.status='PENDING_REVIEW'
          UNION
          SELECT CASE WHEN i.ride_id IS NOT NULL THEN 'ride:'||i.ride_id::text
                    ELSE 'incident:'||i.id::text END
            FROM public.caronaa_f07_operations_incidents i WHERE i.status<>'RESOLVED'
        ) alerts
      ),
      'completed_today',(
        SELECT count(*) FROM public.professional_quick_rides q
        WHERE q.status='COMPLETED' AND q.completed_at IS NOT NULL
          AND q.completed_at >= (date_trunc('day',now() AT TIME ZONE 'America/Fortaleza') AT TIME ZONE 'America/Fortaleza')
      )
    ),
    'passenger_demand',v_base->'passenger_demand',
    'drivers',v_base->'drivers',
    'map_drivers',v_map_drivers,
    'waiting',coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.requested_at ASC)
      FROM (
        SELECT q.id,q.passenger_id,q.driver_id,q.vehicle_type,q.status,q.municipality,
          q.origin_label,q.destination_label,q.origin_lat,q.origin_lng,
          q.destination_lat,q.destination_lng,q.requested_at,q.expires_at,
          q.payment_status,
          coalesce(pp.full_name,'Passageiro') AS passenger_name,
          CASE WHEN pw.contact_consent=true THEN pw.whatsapp_e164 ELSE NULL END AS passenger_whatsapp,
          fq.customer_pays_cents
        FROM public.professional_quick_rides q
        LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
        LEFT JOIN public.caronaa_account_whatsapp pw ON pw.user_id=q.passenger_id
        LEFT JOIN public.caronaa_quick_fare_quotes fq ON fq.ride_id=q.id
        WHERE q.status='SEARCHING' AND q.expires_at>now()
        ORDER BY q.requested_at ASC LIMIT 100
      ) t
    ),'[]'::jsonb),
    'active',coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.requested_at DESC)
      FROM (
        SELECT q.id,q.passenger_id,q.driver_id,q.vehicle_type,q.status,q.municipality,
          q.origin_label,q.destination_label,q.origin_lat,q.origin_lng,
          q.destination_lat,q.destination_lng,q.requested_at,q.accepted_at,q.expires_at,
          q.payment_status,
          coalesce(pp.full_name,'Passageiro') AS passenger_name,
          coalesce(dp.full_name,'Motorista') AS driver_name,
          CASE WHEN pw.contact_consent=true THEN pw.whatsapp_e164 ELSE NULL END AS passenger_whatsapp,
          fq.customer_pays_cents
        FROM public.professional_quick_rides q
        LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
        LEFT JOIN public.profiles dp ON dp.id=q.driver_id
        LEFT JOIN public.caronaa_account_whatsapp pw ON pw.user_id=q.passenger_id
        LEFT JOIN public.caronaa_quick_fare_quotes fq ON fq.ride_id=q.id
        WHERE q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
        ORDER BY q.requested_at DESC LIMIT 100
      ) t
    ),'[]'::jsonb),
    'recent',coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.closed_at DESC)
      FROM (
        SELECT q.id,q.vehicle_type,q.status,q.origin_label,q.destination_label,
          q.completed_at,q.updated_at,coalesce(q.completed_at,q.updated_at) AS closed_at,
          coalesce(pp.full_name,'Passageiro') AS passenger_name,
          coalesce(dp.full_name,'Não atribuído') AS driver_name,
          fq.customer_pays_cents,q.payment_status
        FROM public.professional_quick_rides q
        LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
        LEFT JOIN public.profiles dp ON dp.id=q.driver_id
        LEFT JOIN public.caronaa_quick_fare_quotes fq ON fq.ride_id=q.id
        WHERE q.status IN ('COMPLETED','CANCELLED')
        ORDER BY coalesce(q.completed_at,q.updated_at) DESC LIMIT 12
      ) t
    ),'[]'::jsonb)
  );
END;
$ops$;
REVOKE ALL ON FUNCTION public.admin_f07_cockpit_live() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_f07_cockpit_live() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
