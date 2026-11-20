-- CARONAA | LOTE UNICO AUDITADO | 2026-11-20
-- Banco conferido: migration 0220 ja instalada.
-- Instalar SOMENTE 0213 acompanhamento GPS, 0215 desembarque persistente,
-- 0221 central operacional e complemento de WhatsApp nas duas funcoes.
-- Preserva consulta enriquecida de contestações ja existente no banco.
-- Nao alterar repasses, precos, corridas concluidas ou autorizacoes.
-- Uma transacao: se qualquer etapa falhar, rollback de todo o lote.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='professional_driver_contacts'
      AND column_name='municipality' AND is_nullable='YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='professional_access_requests'
      AND column_name='municipality' AND is_nullable='YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='professional_mototaxi_profiles'
      AND column_name='region_code' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION '0220 nao foi concluida neste banco; interrompendo lote.';
  END IF;
  IF to_regclass('public.quick_ride_dropoff_reviews') IS NULL
    OR to_regclass('public.quick_ride_dropoff_interactions') IS NULL
    OR to_regclass('public.quick_ride_completion_events') IS NULL
    OR to_regprocedure('public.publish_verified_professional_position_v2(uuid,double precision,double precision,double precision,text,bigint)') IS NULL
  THEN
    RAISE EXCEPTION 'Pre-requisitos operacionais de 0213 e 0215 ausentes.';
  END IF;
END;
$preflight$;


-- ===== 0213 GPS do passageiro (ausente no banco) =====

-- 0213 | Live tracking for assigned passenger + driver only.
-- Small Realtime signals contain NO coordinates, identities or vehicle data.
-- Precise positions remain exclusively in the participant-scoped map RPC.
-- Transacao externa unica do lote

CREATE TABLE IF NOT EXISTS public.caronaa_quick_position_updates (
  ride_id uuid PRIMARY KEY REFERENCES public.professional_quick_rides(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caronaa_quick_position_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.caronaa_quick_position_updates
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.caronaa_quick_position_updates TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_quick_position_update(p_ride_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $access$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.professional_quick_rides q
    WHERE q.id=p_ride_id
      AND (q.passenger_id=auth.uid() OR q.driver_id=auth.uid())
      AND q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  );
$access$;
REVOKE ALL ON FUNCTION public.can_read_quick_position_update(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_quick_position_update(uuid)
  TO authenticated;
DROP POLICY IF EXISTS quick_position_participants_read
  ON public.caronaa_quick_position_updates;
CREATE POLICY quick_position_participants_read
  ON public.caronaa_quick_position_updates
  FOR SELECT TO authenticated
  USING (public.can_read_quick_position_update(ride_id));

-- A position UPDATE emits only the fact that an active ride has a new fix.
-- This never replicates driver coordinates to other customers or the radar.
CREATE OR REPLACE FUNCTION public.signal_assigned_quick_ride_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $signal$
DECLARE v_ride_id uuid;
BEGIN
  SELECT q.id INTO v_ride_id
  FROM public.professional_quick_rides q
  WHERE q.driver_id=NEW.user_id
    AND q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  ORDER BY q.accepted_at DESC
  LIMIT 1;
  IF v_ride_id IS NOT NULL THEN
    INSERT INTO public.caronaa_quick_position_updates(ride_id,changed_at)
      VALUES(v_ride_id,clock_timestamp())
    ON CONFLICT (ride_id) DO UPDATE
      SET changed_at=EXCLUDED.changed_at;
  END IF;
  RETURN NEW;
END
$signal$;
REVOKE ALL ON FUNCTION public.signal_assigned_quick_ride_position()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS quick_position_signal_on_gps
  ON public.professional_driver_locations;
CREATE TRIGGER quick_position_signal_on_gps
  AFTER INSERT OR UPDATE OF lat,lng,updated_at
  ON public.professional_driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.signal_assigned_quick_ride_position();

-- Do not leave a position signal attached to a finished ride.
CREATE OR REPLACE FUNCTION public.clear_assigned_quick_ride_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $clear$
BEGIN
  IF OLD.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
    AND NEW.status NOT IN ('ACCEPTED','ARRIVED','IN_PROGRESS') THEN
    DELETE FROM public.caronaa_quick_position_updates WHERE ride_id=NEW.id;
  END IF;
  RETURN NEW;
END
$clear$;
REVOKE ALL ON FUNCTION public.clear_assigned_quick_ride_position()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS quick_position_signal_on_completion
  ON public.professional_quick_rides;
CREATE TRIGGER quick_position_signal_on_completion
  AFTER UPDATE OF status ON public.professional_quick_rides
  FOR EACH ROW EXECUTE FUNCTION public.clear_assigned_quick_ride_position();

-- Lightweight updates between official geocoding validations.
-- An existing recently verified municipal fix + authenticated active trip
-- are mandatory. The existing validated v2 SQL enforces GPS quality, speed
-- plausibility, driver authorization, presence and service coverage.
CREATE OR REPLACE FUNCTION public.publish_active_quick_ride_gps(
  p_ride_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_sampled_at_ms bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $live$
DECLARE
  v_driver uuid := auth.uid();
  v_current public.professional_driver_locations%ROWTYPE;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_quick_rides q
    WHERE q.id=p_ride_id AND q.driver_id=v_driver
      AND q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_RIDE_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_current
  FROM public.professional_driver_locations l
  WHERE l.user_id=v_driver
    AND l.sampled_at>now()-interval '90 seconds'
    AND l.updated_at>now()-interval '90 seconds'
  FOR UPDATE;
  IF NOT FOUND THEN
    -- The full municipality-verifying GPS publication must establish the
    -- official position before faster updates are accepted.
    RETURN false;
  END IF;
  IF v_current.updated_at>now()-interval '6 seconds' THEN
    RETURN false;
  END IF;
  RETURN public.publish_verified_professional_position_v2(
    v_driver,p_lat,p_lng,p_accuracy_m,v_current.municipality,p_sampled_at_ms
  );
END
$live$;
REVOKE ALL ON FUNCTION public.publish_active_quick_ride_gps(
  uuid,double precision,double precision,double precision,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_active_quick_ride_gps(
  uuid,double precision,double precision,double precision,bigint)
  TO authenticated;

-- Idempotent Supabase Realtime publication; no private GPS table is added.
DO $publication$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS(
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public'
        AND tablename='caronaa_quick_position_updates'
    ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.caronaa_quick_position_updates;
  END IF;
END
$publication$;

COMMENT ON TABLE public.caronaa_quick_position_updates IS
  'Participant-scoped signal for new official driver GPS: never contains precise coordinates.';
COMMENT ON FUNCTION public.publish_active_quick_ride_gps(
  uuid,double precision,double precision,double precision,bigint) IS
  'Active driver only: publish trusted GPS between full city validations; v2 validates precision and movement.';
NOTIFY pgrst,'reload schema';
-- Commit realizado no fim do lote


-- ===== 0215 desembarque persistente (sem substituir consulta de contestações mais nova) =====

-- CARONAA F07 | 0215 | Passenger dropoff confirmation recovers after app reopen.
-- Built from the current bilateral participant-only functions in live Supabase
-- (not the older 0210 migration). Apply manually before publishing the frontend.
-- No automatic passenger confirmation, no automatic Pix, no fee collection.
-- Transacao externa unica do lote

DO $guard$
BEGIN
  IF to_regclass('public.quick_ride_dropoff_reviews') IS NULL OR
     to_regclass('public.quick_ride_dropoff_interactions') IS NULL OR
     to_regclass('public.quick_ride_completion_events') IS NULL OR
     NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='quick_ride_dropoff_reviews'
         AND column_name='participant_only'
     ) THEN
    RAISE EXCEPTION 'F07 bilateral dropoff schema missing. Apply existing closure migrations first.';
  END IF;
END $guard$;

-- Rescue unresolved, newly opened 2-minute requests without restarting
-- the clock and without reopening settled or administratively decided rides.
UPDATE public.quick_ride_dropoff_reviews d
SET deadline_at=greatest(d.deadline_at,d.requested_at+interval '10 minutes'),
    updated_at=now()
FROM public.professional_quick_rides q
WHERE q.id=d.ride_id AND q.status IN ('IN_PROGRESS','PENDING_REVIEW')
  AND d.passenger_response IS NULL
  -- Includes already timed-out requests with no administrator decision.
  AND d.admin_decision IS NULL
  AND d.requested_at+interval '10 minutes'>now()
  AND d.deadline_at<d.requested_at+interval '10 minutes';

-- New and repeated bilateral requests: 10 minutes without resetting
-- an active request on duplicate taps.
CREATE OR REPLACE FUNCTION public.quick_ride_request_dropoff(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_lat double precision;
  v_lng double precision;
  v_accuracy double precision;
  v_distance double precision;
  v_allowed double precision;
  v_method text := 'PARTICIPANT_REQUEST';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR q.driver_id IS DISTINCT FROM auth.uid() OR
     q.pickup_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'DROPOFF_NOT_ALLOWED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF q.status='PENDING_REVIEW' AND FOUND THEN
    RETURN d.participant_only AND d.passenger_response IS NULL
      AND d.admin_decision IS NULL;
  END IF;
  IF q.status<>'IN_PROGRESS' THEN
    RAISE EXCEPTION 'DROPOFF_NOT_ALLOWED' USING ERRCODE='42501';
  END IF;
  IF FOUND THEN
    IF d.participant_only AND d.passenger_response='NOT_YET'
       AND d.admin_decision IS NULL THEN
      -- Avoid the driver spamming the passenger with repeated requests.
      IF d.resolved_at>now()-interval '20 seconds' THEN RETURN false; END IF;
      UPDATE public.quick_ride_dropoff_reviews SET
        passenger_response=NULL,resolved_at=NULL,
        requested_at=now(),deadline_at=now()+interval '10 minutes',
        completion_request_method='PARTICIPANT_REQUEST',
        finish_distance_m=NULL,finish_accuracy_m=NULL,
        request_count=request_count+1,updated_at=now() WHERE ride_id=p_id;
      UPDATE public.professional_quick_rides
        SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
        WHERE id=p_id AND status='IN_PROGRESS';
      INSERT INTO public.quick_ride_dropoff_interactions(ride_id,actor_id,action)
      VALUES(p_id,auth.uid(),'RE_REQUESTED');
      RETURN true;
    END IF;
    RETURN d.passenger_response IS NULL AND d.admin_decision IS NULL;
  END IF;

  -- Optional server GPS evidence; insufficient GPS never blocks dropoff.
  SELECT l.lat,l.lng,l.accuracy_m INTO v_lat,v_lng,v_accuracy
  FROM public.professional_driver_locations l
  WHERE l.user_id=q.driver_id
    AND l.accuracy_m>0 AND l.accuracy_m<=150
    AND l.sampled_at>=now()-interval '90 seconds'
    AND l.sampled_at<=now()+interval '5 seconds'
    AND l.updated_at>=now()-interval '90 seconds'
  ORDER BY l.sampled_at DESC LIMIT 1;
  IF FOUND THEN
    v_distance:=6371000.0*2*asin(least(1.0,sqrt(
      power(sin(radians((v_lat-q.destination_lat)/2)),2)+
      cos(radians(v_lat))*cos(radians(q.destination_lat))*
      power(sin(radians((v_lng-q.destination_lng)/2)),2)
    )));
    v_allowed:=greatest(150.0,least(250.0,v_accuracy+100.0));
    IF v_distance<=v_allowed THEN v_method:='GPS_VERIFIED'; END IF;
  END IF;
  INSERT INTO public.quick_ride_dropoff_reviews
    (ride_id,deadline_at,participant_only,completion_request_method,
     finish_distance_m,finish_accuracy_m)
  VALUES(p_id,now()+interval '10 minutes',true,v_method,v_distance,v_accuracy);
  UPDATE public.professional_quick_rides
    SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
    WHERE id=p_id AND status='IN_PROGRESS';
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),'DROPOFF_REQUESTED','IN_PROGRESS','PENDING_REVIEW',
    'Bilateral dropoff requested; awaiting passenger')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  INSERT INTO public.quick_ride_dropoff_interactions(ride_id,actor_id,action)
  VALUES(p_id,auth.uid(),'REQUESTED');
  RETURN true;
END;
$function$;

-- Reconcile operationally released PENDING_REVIEW after timeout.
CREATE OR REPLACE FUNCTION public.quick_ride_finalize_after_timeout(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR (q.driver_id IS DISTINCT FROM auth.uid() AND
      q.passenger_id IS DISTINCT FROM auth.uid()) OR q.status NOT IN ('IN_PROGRESS','PENDING_REVIEW') THEN
    RETURN false;
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews WHERE ride_id=p_id FOR UPDATE;
  IF NOT FOUND OR d.deadline_at>now() OR d.passenger_response IS NOT NULL
     OR d.resolved_at IS NOT NULL THEN RETURN false; END IF;
  UPDATE public.quick_ride_dropoff_reviews
    SET resolved_at=now(),updated_at=now() WHERE ride_id=p_id;
  UPDATE public.professional_quick_rides
    SET status='PENDING_REVIEW',completed_at=NULL,updated_at=now()
    WHERE id=p_id AND status IN ('IN_PROGRESS','PENDING_REVIEW');
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_id,auth.uid(),'TIMEOUT_PENDING_REVIEW',
    q.status,'PENDING_REVIEW','Passenger did not respond within 10 minutes')
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$function$;

-- A participant reopening the app reconciles elapsed deadlines.
CREATE OR REPLACE FUNCTION public.quick_ride_my_requests()
 RETURNS TABLE(id uuid, role text, municipality text, vehicle_type text, origin_label text, destination_label text, status text, requested_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  FOR v_id IN
    SELECT q.id
    FROM public.professional_quick_rides q
    JOIN public.quick_ride_dropoff_reviews d ON d.ride_id=q.id
    WHERE (q.driver_id=auth.uid() OR q.passenger_id=auth.uid())
      AND q.status IN ('IN_PROGRESS','PENDING_REVIEW')
      AND d.deadline_at<=now()
      AND d.resolved_at IS NULL AND d.passenger_response IS NULL
  LOOP
    PERFORM public.quick_ride_finalize_after_timeout(v_id);
  END LOOP;
  RETURN QUERY SELECT
    q.id,
    CASE WHEN q.passenger_id=auth.uid() THEN 'PASSENGER'::text ELSE 'DRIVER'::text END,
    q.municipality,q.vehicle_type,q.origin_label,q.destination_label,
    CASE WHEN q.status='SEARCHING' AND q.expires_at<now() THEN 'EXPIRED'::text ELSE q.status END,
    q.requested_at,q.expires_at
  FROM public.professional_quick_rides q
  WHERE (q.passenger_id=auth.uid() OR q.driver_id=auth.uid())
    AND q.status IN ('SEARCHING','ACCEPTED','ARRIVED','IN_PROGRESS',
      'PENDING_REVIEW','COMPLETED','CANCELLED','EXPIRED')
  ORDER BY q.requested_at DESC
  LIMIT 20;
END;
$function$;

-- The admin list shows only contestations, elapsed deadlines or decisions.
-- Preserve the newer installed admin_quick_ride_disputes() function
-- (case_kind, passenger_dispute_reason_code, passenger_dispute_note).
CREATE OR REPLACE FUNCTION public.admin_resolve_quick_ride_dispute(p_ride_id uuid, p_decision text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.professional_quick_rides%ROWTYPE;
  d public.quick_ride_dropoff_reviews%ROWTYPE;
  v_new_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('COMPLETE','CANCEL') OR
     char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION 'Invalid decision/reason (20 to 2000 chars)' USING ERRCODE='22023';
  END IF;
  SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR q.status NOT IN ('PENDING_REVIEW','IN_PROGRESS') THEN
    RAISE EXCEPTION 'Ride is not pending review' USING ERRCODE='23514';
  END IF;
  SELECT * INTO d FROM public.quick_ride_dropoff_reviews
    WHERE ride_id=p_ride_id FOR UPDATE;
  IF NOT FOUND OR (d.resolved_at IS NULL AND NOT (
       q.status='PENDING_REVIEW' AND d.passenger_response IS NULL
       AND d.deadline_at<=now())) OR d.admin_decision IS NOT NULL
     OR (d.passenger_response IS DISTINCT FROM 'CONTESTED'
         AND (d.passenger_response IS NOT NULL OR d.deadline_at>now()))
     OR EXISTS (
       SELECT 1 FROM public.quick_ride_dispute_audit WHERE ride_id=p_ride_id
     ) THEN
    RAISE EXCEPTION 'Review missing or already decided' USING ERRCODE='23514';
  END IF;
  v_new_status:=CASE WHEN p_decision='COMPLETE' THEN 'COMPLETED' ELSE 'CANCELLED' END;
  UPDATE public.professional_quick_rides
    SET status=v_new_status,
        completed_at=CASE WHEN p_decision='COMPLETE' THEN now() ELSE NULL END,
        updated_at=now() WHERE id=p_ride_id;
  UPDATE public.quick_ride_dropoff_reviews
    SET resolved_at=coalesce(resolved_at,now()),
        admin_decision=p_decision,admin_reason=btrim(p_reason),
        admin_resolved_by=auth.uid(),admin_resolved_at=now(),updated_at=now()
    WHERE ride_id=p_ride_id;
  INSERT INTO public.quick_ride_dispute_audit
    (ride_id,actor_id,action,previous_ride_status,new_ride_status,reason)
  VALUES(p_ride_id,auth.uid(),p_decision,q.status,v_new_status,btrim(p_reason));
  INSERT INTO public.quick_ride_completion_events
    (ride_id,actor_id,event_type,previous_status,new_status,detail)
  VALUES(p_ride_id,auth.uid(),
    CASE WHEN p_decision='COMPLETE' THEN 'ADMIN_COMPLETE' ELSE 'ADMIN_CANCEL' END,
    q.status,v_new_status,btrim(p_reason))
  ON CONFLICT (ride_id,event_type) DO NOTHING;
  RETURN true;
END;
$function$;

-- One participant-scoped read, regardless of which page the passenger opens.
-- A pending request remains answerable until a passenger response or admin
-- decision; the deadline only determines when an unanswered case is reviewable.
CREATE OR REPLACE FUNCTION public.quick_ride_pending_dropoff()
RETURNS TABLE (
  ride_id uuid,
  origin_label text,
  destination_label text,
  vehicle_type text,
  ride_status text,
  requested_at timestamptz,
  deadline_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $pending$
  SELECT q.id,q.origin_label,q.destination_label,q.vehicle_type,
         q.status,d.requested_at,d.deadline_at
  FROM public.professional_quick_rides q
  JOIN public.quick_ride_dropoff_reviews d ON d.ride_id=q.id
  WHERE auth.uid() IS NOT NULL
    AND q.passenger_id=auth.uid()
    AND q.pickup_confirmed_at IS NOT NULL
    AND q.status IN ('IN_PROGRESS','PENDING_REVIEW')
    AND d.passenger_response IS NULL
    AND d.admin_decision IS NULL
  ORDER BY d.requested_at DESC
  LIMIT 1;
$pending$;

REVOKE ALL ON FUNCTION public.quick_ride_pending_dropoff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_pending_dropoff() TO authenticated;

NOTIFY pgrst,'reload schema';
-- Commit realizado no fim do lote


-- ===== 0221 painel de operacoes (ausente no banco) =====

-- CARONAA 0221 - Centro de Operacoes F07 com leitura autorizada e trilha de auditoria
-- Depende das estruturas F07 existentes. Aplicar apos 0220, antes de publicar o frontend.
-- Nenhum status de corrida em andamento e alterado automaticamente.
-- Transacao externa unica do lote

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
-- Commit realizado no fim do lote


-- ===== Complemento de WhatsApp da 0220 (2 funcoes) =====

-- A 0220 foi aplicada antes do hotfix de fallback de WhatsApp na main.
-- Atualizar SOMENTE as duas funcoes ja existentes, preservando seu corpo
-- atual, as permissoes, a validacao de perfil e os dados cadastrais.
DO $phone_patch$
DECLARE
  v_name text;
  v_def text;
  v_needle text := 'v_phone:=public.caronaa_normalize_whatsapp(p_whatsapp);';
  v_fallback text := $fallback$
  IF v_phone IS NULL THEN
    SELECT coalesce(
      (SELECT a.whatsapp_e164 FROM public.caronaa_account_whatsapp a
       WHERE a.user_id=v_uid AND a.whatsapp_e164 IS NOT NULL),
      (SELECT c.whatsapp_e164 FROM public.professional_driver_contacts c
       WHERE c.user_id=v_uid AND c.whatsapp_e164 IS NOT NULL),
      (SELECT m.whatsapp_e164 FROM public.professional_mototaxi_profiles m
       WHERE m.user_id=v_uid AND m.whatsapp_e164 IS NOT NULL),
      (SELECT r.snapshot->>'whatsapp_e164'
       FROM public.professional_access_requests r
       WHERE r.user_id=v_uid AND r.snapshot->>'whatsapp_e164' IS NOT NULL
       ORDER BY r.submitted_at DESC LIMIT 1)
    ) INTO v_phone;
  END IF;
$fallback$;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'complete_professional_driver_registration',
    'submit_simple_mototaxi_access'
  ] LOOP
    SELECT pg_get_functiondef(p.oid)
      INTO STRICT v_def
    FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND p.proname=v_name
      AND p.pronargs=CASE WHEN v_name='complete_professional_driver_registration'
                          THEN 11 ELSE 5 END;
    IF position('IF v_phone IS NULL THEN' IN v_def)>0 THEN
      CONTINUE; -- Ja atualizado, nao duplicar.
    END IF;
    IF position(v_needle IN v_def)=0 THEN
      RAISE EXCEPTION 'Trecho esperado de normalizacao nao encontrado em %',v_name;
    END IF;
    IF position(v_needle IN substring(v_def
         FROM position(v_needle IN v_def)+length(v_needle)))>0 THEN
      RAISE EXCEPTION 'Marcador duplicado em %',v_name;
    END IF;
    EXECUTE replace(v_def,v_needle,v_needle || E'\n' || v_fallback);
  END LOOP;
END;
$phone_patch$;


-- ===== Testes de existencia antes de confirmar =====

DO $verify$
BEGIN
  IF to_regclass('public.caronaa_quick_position_updates') IS NULL
    OR to_regprocedure('public.publish_active_quick_ride_gps(uuid,double precision,double precision,double precision,bigint)') IS NULL
    OR to_regprocedure('public.quick_ride_pending_dropoff()') IS NULL
    OR to_regclass('public.caronaa_f07_operations_incidents') IS NULL
    OR to_regclass('public.caronaa_f07_operations_audit') IS NULL
    OR to_regprocedure('public.admin_f07_operations_snapshot()') IS NULL
    OR to_regprocedure('public.admin_f07_cancel_stale_assignment(uuid,text)') IS NULL
  THEN
    RAISE EXCEPTION 'Lote incompleto: um ou mais objetos esperados estao ausentes.';
  END IF;
  IF (
    SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND p.proname IN (
        'complete_professional_driver_registration',
        'submit_simple_mototaxi_access'
      )
      AND position('IF v_phone IS NULL THEN' IN pg_get_functiondef(p.oid))>0
  )<>2 THEN
    RAISE EXCEPTION 'Hotfix de WhatsApp nao foi aplicado as duas funcoes.';
  END IF;
END;
$verify$;


NOTIFY pgrst,'reload schema';
COMMIT;
