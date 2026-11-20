-- CARONAA 0221 - Centro de Operacoes F07 com leitura autorizada e trilha de auditoria
-- Depende das estruturas F07 existentes. Aplicar apos 0220, antes de publicar o frontend.
-- Nenhum status de corrida em andamento e alterado automaticamente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.caronaa_f07_operations_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES public.professional_quick_rides(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN
    ('GPS','ACEITE','EMBARQUE','DESEMBARQUE','CADASTRO','COBERTURA','OUTRO')),
  priority text NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 12 AND 2000),
  resolution_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT f07_ops_subject_required CHECK (ride_id IS NOT NULL OR driver_id IS NOT NULL),
  CONSTRAINT f07_ops_resolution_note_length CHECK
    (resolution_note IS NULL OR length(btrim(resolution_note)) BETWEEN 12 AND 2000)
);
CREATE INDEX IF NOT EXISTS f07_ops_incident_status_idx
  ON public.caronaa_f07_operations_incidents(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS f07_ops_incident_driver_idx
  ON public.caronaa_f07_operations_incidents(driver_id,created_at DESC);
CREATE INDEX IF NOT EXISTS f07_ops_incident_ride_idx
  ON public.caronaa_f07_operations_incidents(ride_id,created_at DESC);
ALTER TABLE public.caronaa_f07_operations_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_f07_operations_incidents FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.caronaa_f07_operations_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.caronaa_f07_operations_incidents(id) ON DELETE RESTRICT,
  ride_id uuid REFERENCES public.professional_quick_rides(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN
    ('INCIDENT_OPENED','INCIDENT_STARTED','INCIDENT_RESOLVED',
    'SEARCH_EXPIRED','STALE_ASSIGNMENT_CANCELLED')),
  previous_status text,
  new_status text,
  detail text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS f07_ops_audit_time_idx
  ON public.caronaa_f07_operations_audit(occurred_at DESC);
ALTER TABLE public.caronaa_f07_operations_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_f07_operations_audit FROM PUBLIC,anon,authenticated;

-- Sem GPS preciso; somente municipio, precisao aproximada e idade do sinal.
-- Mesmo autenticado, somente o papel administrativo pode receber a lista.
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
            WHEN coalesce(fl.is_online,false)=false OR coalesce(pr.is_available,false)=false
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
            WHEN sr.municipality IS NULL OR sr.dispatch_enabled IS DISTINCT FROM true
              OR sr.public_discovery_enabled IS DISTINCT FROM true
              OR cm.municipality IS NULL
              OR (a.vehicle_type='CAR' AND cm.car_enabled IS DISTINCT FROM true)
              OR (a.vehicle_type='MOTO' AND cm.moto_enabled IS DISTINCT FROM true)
              THEN 'OUTSIDE_COVERAGE'
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

CREATE OR REPLACE FUNCTION public.admin_f07_open_incident(
  p_ride_id uuid DEFAULT NULL,
  p_driver_id uuid DEFAULT NULL,
  p_category text DEFAULT 'OUTRO',
  p_priority text DEFAULT 'MEDIUM',
  p_description text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ops$
DECLARE v_id uuid; v_ride_driver uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF (p_ride_id IS NULL AND p_driver_id IS NULL)
      OR p_category NOT IN ('GPS','ACEITE','EMBARQUE','DESEMBARQUE','CADASTRO','COBERTURA','OUTRO')
      OR p_priority NOT IN ('LOW','MEDIUM','HIGH')
      OR length(btrim(coalesce(p_description,''))) NOT BETWEEN 12 AND 2000 THEN
    RAISE EXCEPTION 'Dados invalidos da ocorrencia' USING ERRCODE='22023';
  END IF;
  IF p_ride_id IS NOT NULL THEN
    SELECT q.driver_id INTO v_ride_driver
    FROM public.professional_quick_rides q WHERE q.id=p_ride_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Corrida nao encontrada' USING ERRCODE='22023';
    END IF;
    IF p_driver_id IS NOT NULL AND p_driver_id IS DISTINCT FROM v_ride_driver THEN
      RAISE EXCEPTION 'Motorista nao pertence a corrida' USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.professional_driver_authorizations a WHERE a.user_id=p_driver_id
    UNION
    SELECT 1 FROM public.professional_presence p WHERE p.user_id=p_driver_id
    UNION
    SELECT 1 FROM public.flash_driver_presence f WHERE f.user_id=p_driver_id
  ) THEN
    RAISE EXCEPTION 'Motorista nao encontrado' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.caronaa_f07_operations_incidents (
    ride_id,driver_id,category,priority,description,created_by
  ) VALUES (
    p_ride_id,coalesce(p_driver_id,v_ride_driver),p_category,p_priority,
    btrim(p_description),auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.caronaa_f07_operations_audit (
    incident_id,ride_id,actor_id,action,previous_status,new_status,detail
  ) VALUES (
    v_id,p_ride_id,auth.uid(),'INCIDENT_OPENED',NULL,'OPEN',btrim(p_description)
  );
  RETURN v_id;
END;
$ops$;

CREATE OR REPLACE FUNCTION public.admin_f07_update_incident(
  p_incident_id uuid,
  p_status text,
  p_resolution text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ops$
DECLARE v_incident public.caronaa_f07_operations_incidents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_status NOT IN ('OPEN','IN_PROGRESS','RESOLVED') OR p_status IS NULL THEN
    RAISE EXCEPTION 'Status invalido' USING ERRCODE='22023';
  END IF;
  IF p_status='RESOLVED'
     AND length(btrim(coalesce(p_resolution,''))) NOT BETWEEN 12 AND 2000 THEN
    RAISE EXCEPTION 'Informe a solucao (12 a 2000 caracteres)'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_incident FROM public.caronaa_f07_operations_incidents
    WHERE id=p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ocorrencia nao encontrada' USING ERRCODE='22023'; END IF;
  IF v_incident.status='RESOLVED' THEN
    RAISE EXCEPTION 'Ocorrencia ja resolvida; abra uma nova se necessario'
      USING ERRCODE='23514';
  END IF;
  IF p_status='OPEN' AND v_incident.status<>'OPEN' THEN
    RAISE EXCEPTION 'Use nova ocorrencia para reabrir um atendimento'
      USING ERRCODE='23514';
  END IF;
  IF v_incident.status=p_status THEN RETURN true; END IF;

  UPDATE public.caronaa_f07_operations_incidents
  SET status=p_status,
      resolution_note=CASE WHEN p_status='RESOLVED' THEN btrim(p_resolution) ELSE resolution_note END,
      resolved_by=CASE WHEN p_status='RESOLVED' THEN auth.uid() ELSE resolved_by END,
      resolved_at=CASE WHEN p_status='RESOLVED' THEN now() ELSE resolved_at END,
      updated_at=now()
  WHERE id=p_incident_id;
  INSERT INTO public.caronaa_f07_operations_audit
    (incident_id,ride_id,actor_id,action,previous_status,new_status,detail)
  VALUES (
    p_incident_id,v_incident.ride_id,auth.uid(),
    CASE WHEN p_status='RESOLVED' THEN 'INCIDENT_RESOLVED'
         ELSE 'INCIDENT_STARTED' END,
    v_incident.status,p_status,
    CASE WHEN p_status='RESOLVED' THEN btrim(p_resolution)
         ELSE 'Atendimento assumido pela operacao' END
  );
  RETURN true;
END;
$ops$;

-- So buscas sem motorista e com prazo realmente vencido podem ser expiradas.
-- Nao altera corridas aceitas, em andamento, em revisao, pagamentos ou taxas.
CREATE OR REPLACE FUNCTION public.admin_f07_expire_stale_search(
  p_ride_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ops$
DECLARE v_ride public.professional_quick_rides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_ride FROM public.professional_quick_rides
  WHERE id=p_ride_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corrida nao encontrada' USING ERRCODE='22023'; END IF;
  IF v_ride.status='EXPIRED' THEN RETURN false; END IF;
  IF v_ride.status<>'SEARCHING' OR v_ride.driver_id IS NOT NULL
    OR v_ride.expires_at>now() THEN
    RAISE EXCEPTION 'Apenas buscas vencidas e nao atribuidas podem ser expiradas'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.professional_quick_rides
  SET status='EXPIRED',updated_at=now()
  WHERE id=v_ride.id AND status='SEARCHING' AND driver_id IS NULL;

  INSERT INTO public.caronaa_f07_operations_audit
    (ride_id,actor_id,action,previous_status,new_status,detail)
  VALUES (v_ride.id,auth.uid(),'SEARCH_EXPIRED','SEARCHING','EXPIRED',
    'Busca vencida sem motorista regularizada pelo Centro de Operacoes');
  RETURN true;
END;
$ops$;


-- Atribuicao anterior ao embarque, sem progresso por 15 min ou mais:
-- cancelamento excepcional so pelo administrador, com justificativa e auditoria.
-- Nunca cancelar IN_PROGRESS nem viagem paga/embarque confirmado.
CREATE OR REPLACE FUNCTION public.admin_f07_cancel_stale_assignment(
  p_ride_id uuid, p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ops$
DECLARE v_ride public.professional_quick_rides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Informe justificativa de 20 a 2000 caracteres'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_ride FROM public.professional_quick_rides
  WHERE id=p_ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corrida nao encontrada' USING ERRCODE='22023';
  END IF;
  IF v_ride.status NOT IN ('ACCEPTED','ARRIVED')
     OR v_ride.driver_id IS NULL
     OR v_ride.pickup_confirmed_at IS NOT NULL
     OR v_ride.in_trip_at IS NOT NULL
     OR v_ride.updated_at>now()-interval '15 minutes'
     OR coalesce(v_ride.payment_status,'PENDING')<>'PENDING' THEN
    RAISE EXCEPTION 'Atribuicao ativa ou com viagem/pagamento: somente revisao manual'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.professional_quick_rides
  SET status='CANCELLED', updated_at=now()
  WHERE id=v_ride.id;
  INSERT INTO public.caronaa_f07_operations_audit
    (ride_id,actor_id,action,previous_status,new_status,detail)
  VALUES (v_ride.id,auth.uid(),'STALE_ASSIGNMENT_CANCELLED',
    v_ride.status,'CANCELLED',btrim(p_reason));
  RETURN true;
END;
$ops$;

REVOKE ALL ON FUNCTION public.admin_f07_operations_snapshot() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_f07_open_incident(uuid,uuid,text,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_f07_update_incident(uuid,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_f07_expire_stale_search(uuid)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_f07_cancel_stale_assignment(uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_f07_operations_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_f07_open_incident(uuid,uuid,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_f07_update_incident(uuid,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_f07_expire_stale_search(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_f07_cancel_stale_assignment(uuid,text)
  TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
