-- CARONAA 0234 | Operational daily, weekly, monthly email summary orchestration.
-- Additive only. No emails are sent by the migration.
-- Requires 0233; the private service-role job must be triggered by a configured external scheduler.
BEGIN;

CREATE TABLE IF NOT EXISTS public.caronaa_ops_report_schedules (
  cadence text PRIMARY KEY CHECK(cadence IN ('daily','weekly','monthly')),
  enabled boolean NOT NULL DEFAULT false,
  recipients text[] NOT NULL DEFAULT ARRAY[]::text[],
  local_hour smallint NOT NULL DEFAULT 8 CHECK(local_hour BETWEEN 0 AND 23),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT recipients_limit CHECK(cardinality(recipients)<=10)
);
INSERT INTO public.caronaa_ops_report_schedules(cadence)
VALUES ('daily'),('weekly'),('monthly') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.caronaa_ops_report_deliveries (
  cadence text NOT NULL REFERENCES public.caronaa_ops_report_schedules(cadence),
  window_start date NOT NULL,
  window_end date NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL CHECK(status IN ('SENDING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_code text,
  PRIMARY KEY(cadence,window_start,window_end,recipient),
  CHECK(window_end>=window_start)
);
CREATE INDEX IF NOT EXISTS caronaa_ops_deliveries_recent_idx
  ON public.caronaa_ops_report_deliveries(updated_at DESC);
ALTER TABLE public.caronaa_ops_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caronaa_ops_report_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_ops_report_schedules,public.caronaa_ops_report_deliveries
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_caronaa_report_schedules()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $ops$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object(
    'schedules',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'cadence',s.cadence,'enabled',s.enabled,'recipients',s.recipients,
        'local_hour',s.local_hour,'updated_at',s.updated_at
      ) ORDER BY CASE s.cadence WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 ELSE 3 END)
      FROM public.caronaa_ops_report_schedules s
    ),'[]'::jsonb),
    'deliveries',coalesce((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.updated_at DESC)
      FROM (
        SELECT d.cadence,d.window_start,d.window_end,d.status,
          d.updated_at,d.sent_at,d.error_code
        FROM public.caronaa_ops_report_deliveries d
        ORDER BY d.updated_at DESC LIMIT 30
      ) e
    ),'[]'::jsonb)
  );
END;
$ops$;

CREATE OR REPLACE FUNCTION public.admin_save_caronaa_report_schedule(
  p_cadence text,p_enabled boolean,p_recipients text[],p_local_hour smallint DEFAULT 8
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $ops$
DECLARE v_recipients text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_cadence IS NULL OR p_cadence NOT IN ('daily','weekly','monthly')
     OR p_enabled IS NULL OR p_local_hour NOT BETWEEN 0 AND 23 OR p_local_hour IS NULL
     OR p_recipients IS NULL OR cardinality(p_recipients)>10 THEN
    RAISE EXCEPTION 'Configuracao invalida' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(array_agg(x.email ORDER BY x.email),ARRAY[]::text[])
    INTO v_recipients FROM (
      SELECT DISTINCT lower(btrim(raw)) AS email FROM unnest(p_recipients) AS raw
    ) x WHERE x.email<>'';
  IF EXISTS(SELECT 1 FROM unnest(v_recipients) addr
      WHERE length(addr)>254 OR addr !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,63}$')
     OR (p_enabled AND cardinality(v_recipients)=0) THEN
    RAISE EXCEPTION 'Destinatarios invalidos' USING ERRCODE='22023';
  END IF;
  UPDATE public.caronaa_ops_report_schedules SET
    enabled=p_enabled,recipients=v_recipients,local_hour=p_local_hour,
    updated_at=now(),updated_by=auth.uid()
  WHERE cadence=p_cadence;
  RETURN FOUND;
END;
$ops$;

-- Read-only service-role jobs; next trigger may be late (>= configured hour).
-- Cron invoked hourly; logs and send idempotency prevent duplicate deliveries.
CREATE OR REPLACE FUNCTION public.service_caronaa_report_jobs()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $ops$
DECLARE v_today date:=(now() AT TIME ZONE 'America/Fortaleza')::date;
  v_hour integer:=extract(hour from now() AT TIME ZONE 'America/Fortaleza')::int;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('cadence',s.cadence,
      'window_start',CASE s.cadence
        WHEN 'daily' THEN v_today-1
        WHEN 'weekly' THEN v_today-7
        ELSE (date_trunc('month',v_today::timestamp)-interval '1 month')::date END,
      'window_end',v_today-1,
      'recipients',s.recipients,
      'local_hour',s.local_hour))
    FROM public.caronaa_ops_report_schedules s
    WHERE s.enabled=true AND cardinality(s.recipients)>0 AND v_hour>=s.local_hour
      AND (s.cadence='daily' OR (s.cadence='weekly' AND extract(isodow from v_today)=1)
      OR (s.cadence='monthly' AND extract(day from v_today)=1))
  ),'[]'::jsonb);
END;
$ops$;

-- Per-recipient claim: one active SENDING job, retry after 15 min up to 5 times.
-- Claimed sending and external Resend API share one stable per-period idempotency key.
CREATE OR REPLACE FUNCTION public.service_caronaa_report_claim(
  p_cadence text,p_start date,p_end date,p_recipient text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $ops$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.caronaa_ops_report_schedules s
    WHERE s.cadence=p_cadence AND s.enabled=true
      AND lower(p_recipient)=ANY(s.recipients)) THEN RETURN false; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR (p_end-p_start)>32
     OR p_end>(now() AT TIME ZONE 'America/Fortaleza')::date THEN RETURN false; END IF;
  INSERT INTO public.caronaa_ops_report_deliveries
    (cadence,window_start,window_end,recipient,status)
  VALUES(p_cadence,p_start,p_end,lower(p_recipient),'SENDING')
  ON CONFLICT(cadence,window_start,window_end,recipient) DO UPDATE
  SET status='SENDING',
      attempts=public.caronaa_ops_report_deliveries.attempts+1,
      error_code=NULL,updated_at=now()
  WHERE public.caronaa_ops_report_deliveries.status<>'SENT'
    AND public.caronaa_ops_report_deliveries.attempts<5
    AND public.caronaa_ops_report_deliveries.updated_at<now()-interval '15 minutes';
  RETURN FOUND;
END;
$ops$;

CREATE OR REPLACE FUNCTION public.service_caronaa_report_finish(
  p_cadence text,p_start date,p_end date,p_recipient text,p_success boolean,
  p_error_code text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $ops$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF p_success IS NULL OR length(coalesce(p_error_code,''))>40 THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';
  END IF;
  UPDATE public.caronaa_ops_report_deliveries SET
    status=CASE WHEN p_success THEN 'SENT' ELSE 'FAILED' END,
    sent_at=CASE WHEN p_success THEN now() ELSE sent_at END,
    error_code=CASE WHEN p_success THEN NULL ELSE coalesce(p_error_code,'ERROR') END,
    updated_at=now()
  WHERE cadence=p_cadence AND window_start=p_start AND window_end=p_end
    AND recipient=lower(p_recipient) AND status='SENDING';
  RETURN FOUND;
END;
$ops$;

-- A separate role-scoped aggregate never returns passengers, GPS, WhatsApp, Pix,
-- personal identifiers, or raw records in unattended reports.
CREATE OR REPLACE FUNCTION public.service_caronaa_report_summary(
  p_from date,p_to date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $ops$
DECLARE v_start timestamptz;v_end timestamptz;v_result jsonb;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR (p_to-p_from)>32 THEN
    RAISE EXCEPTION 'Invalid period' USING ERRCODE='22023';
  END IF;
  v_start:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
  v_end:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
  WITH orders AS (
    SELECT q.requested_at AS requested_at,q.passenger_id,
      q.accepted_at IS NOT NULL AS accepted,
      q.status='COMPLETED' AND q.completed_at IS NOT NULL AS completed,
      q.status IN ('CANCELLED','CANCELED') AS cancelled,
      coalesce(f.customer_pays_cents,q.estimated_fare_cents) AS fare_cents
    FROM public.professional_quick_rides q
    LEFT JOIN public.caronaa_quick_fare_quotes f ON f.ride_id=q.id
    WHERE q.requested_at>=v_start AND q.requested_at<v_end
    UNION ALL
    SELECT rr.created_at,rr.user_id,
      r.driver_accepted_at IS NOT NULL OR upper(coalesce(r.status,'')) IN
        ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','COMPLETED'),
      upper(coalesce(r.status,''))='COMPLETED' AND r.completed_at IS NOT NULL,
      upper(coalesce(r.status,rr.status,'')) IN ('CANCELLED','CANCELED'),
      coalesce(round(rr.passenger_price*100)::integer,
        round(r.passenger_contribution*100)::integer)
    FROM public.ride_requests rr
    LEFT JOIN public.rides r ON r.request_id=rr.request_id
    WHERE rr.created_at>=v_start AND rr.created_at<v_end
  ), by_hour AS (
    SELECT extract(hour FROM requested_at AT TIME ZONE 'America/Fortaleza')::integer AS hour,
      count(*)::integer AS orders
    FROM orders GROUP BY 1 ORDER BY orders DESC,hour ASC LIMIT 1
  )
  SELECT jsonb_build_object('from',p_from,'to',p_to,
    'orders',count(*)::integer,
    'passengers',count(DISTINCT o.passenger_id)::integer,
    'accepted',count(*) FILTER(WHERE accepted)::integer,
    'unaccepted',count(*) FILTER(WHERE NOT accepted)::integer,
    'completed',count(*) FILTER(WHERE completed)::integer,
    'cancelled',count(*) FILTER(WHERE cancelled)::integer,
    'completed_fares_cents',coalesce(sum(o.fare_cents) FILTER(WHERE completed),0)::bigint,
    'peak_hour',(SELECT hour FROM by_hour),
    'peak_orders',(SELECT orders FROM by_hour)
  ) INTO v_result FROM orders o;
  RETURN v_result;
END;
$ops$;

REVOKE ALL ON FUNCTION
  public.admin_caronaa_report_schedules(),
  public.admin_save_caronaa_report_schedule(text,boolean,text[],smallint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
  public.admin_caronaa_report_schedules(),
  public.admin_save_caronaa_report_schedule(text,boolean,text[],smallint)
  TO authenticated;

REVOKE ALL ON FUNCTION
  public.service_caronaa_report_jobs(),
  public.service_caronaa_report_claim(text,date,date,text),
  public.service_caronaa_report_finish(text,date,date,text,boolean,text),
  public.service_caronaa_report_summary(date,date)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
  public.service_caronaa_report_jobs(),
  public.service_caronaa_report_claim(text,date,date,text),
  public.service_caronaa_report_finish(text,date,date,text,boolean,text),
  public.service_caronaa_report_summary(date,date)
  TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;