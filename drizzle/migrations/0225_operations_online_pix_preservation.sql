-- 0225: correct online BI status and preserve existing Pix keys.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_f07_operations_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $ops$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;

  RETURN jsonb_build_object(
    'generated_at',now(),
    'drivers',coalesce((
      WITH candidates AS (
        SELECT user_id FROM public.professional_driver_authorizations
        UNION SELECT user_id FROM public.professional_presence
        UNION SELECT user_id FROM public.flash_driver_presence
        UNION SELECT driver_id AS user_id
          FROM public.professional_quick_rides
          WHERE driver_id IS NOT NULL AND status IN
            ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
      )
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.display_name)
      FROM (
        SELECT
          c.user_id,
          coalesce(p.full_name,'Motorista sem nome') AS display_name,
          coalesce(a.vehicle_type,latest_access.vehicle_type) AS vehicle_type,
          coalesce(a.approved,false) AS approved,
          coalesce(fl.is_online,false) AS flash_online,
          coalesce(pr.is_available,false) AS presence_online,
          coalesce(l.municipality,pr.municipality) AS gps_municipality,
          l.sampled_at AS gps_sampled_at,
          l.accuracy_m AS gps_accuracy_m,
          pr.last_seen_at AS last_seen_at,
          ar.id AS active_ride_id,
          ar.status AS active_ride_status,
          ar.updated_at AS active_ride_updated_at,
          EXISTS (
            SELECT 1 FROM public.professional_quick_rides review
            WHERE review.driver_id=c.user_id AND review.status='PENDING_REVIEW'
          ) AS has_review,
          (SELECT count(*) FROM public.caronaa_f07_operations_incidents i
             WHERE i.driver_id=c.user_id AND i.status<>'RESOLVED') AS open_incidents,
          CASE
            WHEN ar.status='IN_PROGRESS' THEN 'IN_TRIP'
            WHEN ar.status IN ('ACCEPTED','ARRIVED') THEN 'TO_PICKUP'
            WHEN coalesce(a.approved,false)=false THEN 'NOT_AUTHORIZED'
            WHEN coalesce(fl.is_online,false)=false AND coalesce(pr.is_available,false)=false
              THEN 'OFFLINE'
            WHEN fl.last_gps_at IS NULL
              OR fl.last_gps_at<=now()-interval '90 seconds'
              OR fl.last_sampled_at IS NULL
              OR fl.last_sampled_at<=now()-interval '90 seconds'
              OR l.sampled_at IS NULL
              OR l.sampled_at<=now()-interval '90 seconds'
              OR l.updated_at<=now()-interval '90 seconds'
              OR pr.last_seen_at<=now()-interval '90 seconds'
              OR coalesce(l.accuracy_m,99999)>150
              OR coalesce(fl.last_accuracy_m,99999)>150
              THEN 'GPS_STALE'
            WHEN NOT public.driver_platform_access_allowed(c.user_id)
              THEN 'RESTRICTED'
            ELSE 'READY'
          END AS status_code
        FROM candidates c
        LEFT JOIN public.profiles p ON p.id=c.user_id
        LEFT JOIN public.professional_driver_authorizations a ON a.user_id=c.user_id
        LEFT JOIN public.professional_presence pr ON pr.user_id=c.user_id
        LEFT JOIN public.flash_driver_presence fl ON fl.user_id=c.user_id
        LEFT JOIN public.professional_driver_locations l ON l.user_id=c.user_id
        LEFT JOIN public.professional_service_regions sr ON sr.municipality=l.municipality
        LEFT JOIN public.caronaa_service_municipalities cm ON cm.municipality=l.municipality
        LEFT JOIN LATERAL (
          SELECT vehicle_type
          FROM public.professional_access_requests a2 WHERE a2.user_id=c.user_id
          ORDER BY submitted_at DESC LIMIT 1
        ) latest_access ON true
        LEFT JOIN LATERAL (
          SELECT id,status,updated_at FROM public.professional_quick_rides ar2
          WHERE ar2.driver_id=c.user_id
            AND ar2.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
          ORDER BY requested_at DESC LIMIT 1
        ) ar ON true
        ORDER BY
          CASE WHEN ar.id IS NOT NULL THEN 0
               WHEN coalesce(fl.is_online,false) THEN 1 ELSE 2 END,
          p.full_name NULLS LAST
        LIMIT 500
      ) d
    ),'[]'::jsonb),
    'rides',coalesce((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.requested_at DESC)
      FROM (
        SELECT
          q.id,q.driver_id,q.status,q.municipality,q.vehicle_type,
          q.requested_at,q.updated_at,q.expires_at,
          q.accepted_at,q.completed_at,q.payment_status,
          coalesce(pp.full_name,'Passageiro') AS passenger_name,
          coalesce(dp.full_name,'Aguardando motorista') AS driver_name,
          CASE
            WHEN q.status='SEARCHING' AND q.expires_at<=now()
              THEN 'SEARCH_EXPIRED'
            WHEN q.status='PENDING_REVIEW' THEN 'REVIEW_PENDING'
            WHEN q.status IN ('ACCEPTED','ARRIVED')
              AND q.updated_at<now()-interval '15 minutes' THEN 'NO_PROGRESS'
            WHEN q.status='IN_PROGRESS'
              AND q.updated_at<now()-interval '90 minutes' THEN 'LONG_TRIP'
            ELSE NULL
          END AS issue_code,
          (SELECT count(*) FROM public.caronaa_f07_operations_incidents i
           WHERE i.ride_id=q.id AND i.status<>'RESOLVED') AS open_incidents
        FROM public.professional_quick_rides q
        LEFT JOIN public.profiles pp ON pp.id=q.passenger_id
        LEFT JOIN public.profiles dp ON dp.id=q.driver_id
        WHERE q.status IN ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
           OR q.requested_at>now()-interval '7 days'
        ORDER BY CASE WHEN q.status IN
          ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
          THEN 0 ELSE 1 END, q.requested_at DESC
        LIMIT 400
      ) r
    ),'[]'::jsonb),
    'incidents',coalesce((
      SELECT jsonb_agg(to_jsonb(i) ORDER BY i.updated_at DESC)
      FROM (
        SELECT
          x.id,x.ride_id,x.driver_id,x.category,x.priority,x.status,
          x.description,x.resolution_note,x.created_at,x.updated_at,
          x.resolved_at,coalesce(p.full_name,'Motorista') AS driver_name
        FROM public.caronaa_f07_operations_incidents x
        LEFT JOIN public.profiles p ON p.id=x.driver_id
        WHERE x.status<>'RESOLVED' OR x.updated_at>now()-interval '30 days'
        ORDER BY CASE WHEN x.status='RESOLVED' THEN 1 ELSE 0 END,
          x.updated_at DESC
        LIMIT 250
      ) i
    ),'[]'::jsonb),
    'audit',coalesce((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.occurred_at DESC)
      FROM (
        SELECT e.id,e.incident_id,e.ride_id,e.action,e.previous_status,
          e.new_status,e.detail,e.occurred_at
        FROM public.caronaa_f07_operations_audit e
        ORDER BY e.occurred_at DESC LIMIT 80
      ) a
    ),'[]'::jsonb)
  );
END;
$ops$;
CREATE OR REPLACE FUNCTION public.save_my_pix_key(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $pix$
DECLARE v_key text:=btrim(coalesce(p_key,''));
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 -- Only strip CPF/CNPJ formatting, never punctuation in e-mail or random keys.
 IF v_key ~ '^[0-9. /-]+$' THEN
   v_key:=regexp_replace(v_key,'[^0-9]','','g');
 END IF;
 IF v_key='' THEN
   RAISE EXCEPTION 'Chave Pix vazia. Cadastro existente preservado.' USING ERRCODE='22023';
 END IF;
 IF length(v_key)>77 OR v_key !~ '^(\+[0-9]{10,15}|[0-9]{11}|[0-9]{14}|[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+)$' THEN
   RAISE EXCEPTION 'Chave Pix invalida' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.driver_pix_settings(user_id,pix_key,updated_at)
 VALUES(auth.uid(),v_key,now())
 ON CONFLICT(user_id) DO UPDATE SET pix_key=EXCLUDED.pix_key,updated_at=now();
END $pix$;
REVOKE ALL ON FUNCTION public.save_my_pix_key(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_pix_key(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
