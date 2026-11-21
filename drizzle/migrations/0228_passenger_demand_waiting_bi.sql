-- 0228: Passenger demand BI and persistent 30-minute quoted search.
-- Passenger intent is opt-in through a foreground heartbeat. No GPS coordinates are stored here.
BEGIN;
CREATE TABLE IF NOT EXISTS public.caronaa_passenger_demand_presence(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK(vehicle_type IN ('CAR','MOTO')),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caronaa_passenger_demand_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_passenger_demand_presence FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.caronaa_passenger_demand_heartbeat(p_vehicle text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $pulse$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login requerido' USING ERRCODE='42501'; END IF;
 IF p_vehicle NOT IN ('CAR','MOTO') THEN RAISE EXCEPTION 'Veiculo invalido' USING ERRCODE='22023'; END IF;
 INSERT INTO public.caronaa_passenger_demand_presence(user_id,vehicle_type,last_seen_at)
 VALUES(auth.uid(),p_vehicle,now())
 ON CONFLICT(user_id) DO UPDATE SET vehicle_type=EXCLUDED.vehicle_type,last_seen_at=now();
END $pulse$;
REVOKE ALL ON FUNCTION public.caronaa_passenger_demand_heartbeat(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.caronaa_passenger_demand_heartbeat(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.caronaa_quick_submit_quoted(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $submit$
DECLARE
  q public.caronaa_quick_fare_quotes%ROWTYPE;
  r_id uuid;
  v_destination text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.caronaa_quick_fare_quotes
    WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR q.passenger_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE='42501';
  END IF;
  -- Idempotent re-submission does not create a second ride.
  IF q.ride_id IS NOT NULL THEN RETURN q.ride_id; END IF;
  IF q.expires_at <= now() THEN
    RAISE EXCEPTION 'Quote expired';
  END IF;

  v_destination := q.destination_municipality;
  IF v_destination IS NULL THEN
    -- A legacy same-city destination may only be supplied after the
    -- authenticated server re-verifies its stored destination coordinates.
    SELECT v.destination_municipality INTO v_destination
      FROM public.caronaa_quick_legacy_destination_verifications v
      WHERE v.quote_id=q.id
        AND v.destination_municipality=q.municipality
        AND v.verified_at >= q.issued_at;
    IF v_destination IS NULL THEN
      RAISE EXCEPTION 'Quote destination is not verified';
    END IF;
  END IF;

  IF NOT public.caronaa_f07_test_dispatch_allowed() THEN
    RAISE EXCEPTION 'Pilot dispatch window has ended' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_service_municipalities o
    JOIN public.professional_service_regions r ON r.municipality=o.municipality
    JOIN public.caronaa_quick_tariff_policies t
      ON t.pricing_region=o.pricing_region AND t.vehicle_type=q.vehicle_type
    WHERE o.municipality=q.municipality AND o.pricing_region=q.pricing_region
      AND r.public_discovery_enabled AND r.dispatch_enabled AND t.published
      AND CASE WHEN q.vehicle_type='MOTO' THEN o.moto_enabled ELSE o.car_enabled END
      AND (v_destination=o.municipality OR t.intermunicipal_enabled)
  ) THEN
    RAISE EXCEPTION 'Origin, tariff or intermunicipal dispatch unavailable'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caronaa_service_municipalities d
    JOIN public.professional_service_regions r ON r.municipality=d.municipality
    WHERE d.municipality=v_destination
      AND r.public_discovery_enabled AND r.dispatch_enabled
      AND CASE WHEN q.vehicle_type='MOTO' THEN d.moto_enabled ELSE d.car_enabled END
  ) THEN
    RAISE EXCEPTION 'Destination not approved for this mode' USING ERRCODE='42501';
  END IF;
  -- Keep the original atomic dispatch and its one-request-per-passenger rules.
  r_id := public.quick_ride_request(
    q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
    q.origin_lat,q.origin_lng,q.destination_lat,q.destination_lng
  );
  -- Allow an explicit waiting window for a passenger even with no driver online.
  -- The existing atomic request guard still prevents duplicate active requests.
  UPDATE public.professional_quick_rides
    SET expires_at=now()+interval '30 minutes',updated_at=now()
    WHERE id=r_id AND passenger_id=auth.uid() AND status='SEARCHING';
  UPDATE public.caronaa_quick_fare_quotes SET ride_id=r_id WHERE id=q.id;
  RETURN r_id;
END;
$submit$;
CREATE OR REPLACE FUNCTION public.admin_f07_operations_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $ops$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;

  RETURN jsonb_build_object(
    'generated_at',now(),
    'passenger_demand',jsonb_build_object(
      'preparing',(
        SELECT count(*) FROM public.caronaa_passenger_demand_presence h
        WHERE h.last_seen_at>now()-interval '90 seconds'
          AND NOT EXISTS (
            SELECT 1 FROM public.professional_quick_rides q
            WHERE q.passenger_id=h.user_id AND q.status IN
              ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')
              AND (q.status<>'SEARCHING' OR q.expires_at>now())
          )
      ),
      'waiting',(
        SELECT count(*) FROM public.professional_quick_rides q
        WHERE q.status='SEARCHING' AND q.expires_at>now()
      ),
      'waiting_passengers',(
        SELECT count(DISTINCT q.passenger_id) FROM public.professional_quick_rides q
        WHERE q.status='SEARCHING' AND q.expires_at>now()
      ),
      'oldest_waiting_at',(
        SELECT min(q.requested_at) FROM public.professional_quick_rides q
        WHERE q.status='SEARCHING' AND q.expires_at>now()
      ),
      'generated_at',now()
    ),
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
          (coalesce(coalesce(fl.is_online,false) AND fl.last_gps_at>now()-interval '90 seconds',false) OR coalesce(coalesce(pr.is_available,false) AND pr.last_seen_at>now()-interval '90 seconds',false)) AS connected_recent,
          (coalesce(fl.last_sampled_at>now()-interval '90 seconds' AND fl.last_gps_at>now()-interval '90 seconds' AND fl.last_accuracy_m>0 AND fl.last_accuracy_m<=150 AND fl.last_lat BETWEEN -90 AND 90 AND fl.last_lng BETWEEN -180 AND 180,false) OR coalesce(l.sampled_at>now()-interval '90 seconds' AND l.updated_at>now()-interval '90 seconds' AND l.accuracy_m>0 AND l.accuracy_m<=150 AND l.lat BETWEEN -90 AND 90 AND l.lng BETWEEN -180 AND 180,false)) AS gps_valid,
          (coalesce(coalesce(fl.is_online,false) AND fl.last_gps_at>now()-interval '90 seconds',false) OR coalesce(coalesce(pr.is_available,false) AND pr.last_seen_at>now()-interval '90 seconds',false)) AND (coalesce(fl.last_sampled_at>now()-interval '90 seconds' AND fl.last_gps_at>now()-interval '90 seconds' AND fl.last_accuracy_m>0 AND fl.last_accuracy_m<=150 AND fl.last_lat BETWEEN -90 AND 90 AND fl.last_lng BETWEEN -180 AND 180,false) OR coalesce(l.sampled_at>now()-interval '90 seconds' AND l.updated_at>now()-interval '90 seconds' AND l.accuracy_m>0 AND l.accuracy_m<=150 AND l.lat BETWEEN -90 AND 90 AND l.lng BETWEEN -180 AND 180,false)) AND coalesce(a.approved,false)
            AND public.driver_platform_access_allowed(c.user_id) AS dispatch_ready,
          coalesce(l.municipality,pr.municipality,fl.current_municipality) AS gps_municipality,
          CASE WHEN fl.last_sampled_at>now()-interval '90 seconds'
                      AND fl.last_gps_at>now()-interval '90 seconds'
                      AND fl.last_accuracy_m BETWEEN 0.0001 AND 150
                      AND (l.sampled_at IS NULL OR fl.last_sampled_at>=l.sampled_at)
               THEN fl.last_sampled_at ELSE l.sampled_at END AS gps_sampled_at,
          CASE WHEN fl.last_sampled_at>now()-interval '90 seconds'
                      AND fl.last_gps_at>now()-interval '90 seconds'
                      AND fl.last_accuracy_m BETWEEN 0.0001 AND 150
                      AND (l.sampled_at IS NULL OR fl.last_sampled_at>=l.sampled_at)
               THEN fl.last_accuracy_m ELSE l.accuracy_m END AS gps_accuracy_m,
          greatest(fl.last_gps_at,pr.last_seen_at,l.updated_at) AS last_seen_at,
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
            WHEN NOT (coalesce(coalesce(fl.is_online,false) AND fl.last_gps_at>now()-interval '90 seconds',false) OR coalesce(coalesce(pr.is_available,false) AND pr.last_seen_at>now()-interval '90 seconds',false)) THEN 'OFFLINE'
            WHEN NOT (coalesce(fl.last_sampled_at>now()-interval '90 seconds' AND fl.last_gps_at>now()-interval '90 seconds' AND fl.last_accuracy_m>0 AND fl.last_accuracy_m<=150 AND fl.last_lat BETWEEN -90 AND 90 AND fl.last_lng BETWEEN -180 AND 180,false) OR coalesce(l.sampled_at>now()-interval '90 seconds' AND l.updated_at>now()-interval '90 seconds' AND l.accuracy_m>0 AND l.accuracy_m<=150 AND l.lat BETWEEN -90 AND 90 AND l.lng BETWEEN -180 AND 180,false)) THEN 'GPS_STALE'
            WHEN NOT public.driver_platform_access_allowed(c.user_id) THEN 'RESTRICTED'
            ELSE 'READY'
          END AS status_code
        FROM candidates c
        LEFT JOIN public.profiles p ON p.id=c.user_id
        LEFT JOIN public.professional_driver_authorizations a ON a.user_id=c.user_id
        LEFT JOIN public.professional_presence pr ON pr.user_id=c.user_id
        LEFT JOIN public.flash_driver_presence fl ON fl.user_id=c.user_id
        LEFT JOIN public.professional_driver_locations l ON l.user_id=c.user_id
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
REVOKE ALL ON FUNCTION public.admin_f07_operations_snapshot(),public.caronaa_quick_submit_quoted(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_f07_operations_snapshot(),public.caronaa_quick_submit_quoted(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
