-- 0232 | CARONAA Operations: historical demand, no-acceptance and editable support.
-- Additive only. Deploy database migration BEFORE enabling the new UI.
-- No tariff, GPS, driver eligibility, ride status or payment mutations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.caronaa_support_config (
  singleton smallint PRIMARY KEY DEFAULT 1 CHECK (singleton=1),
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS public.caronaa_support_config_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_whatsapp text NOT NULL,
  new_whatsapp text NOT NULL
);
ALTER TABLE public.caronaa_support_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caronaa_support_config_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caronaa_support_config,public.caronaa_support_config_audit
  FROM PUBLIC,anon,authenticated;
INSERT INTO public.caronaa_support_config(singleton,whatsapp_e164)
VALUES(1,'+244944175424') ON CONFLICT(singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_caronaa_support_whatsapp()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $support$
  SELECT whatsapp_e164 FROM public.caronaa_support_config WHERE singleton=1;
$support$;

CREATE OR REPLACE FUNCTION public.admin_set_caronaa_support_whatsapp(p_number text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $support$
DECLARE
  v_number text:=btrim(coalesce(p_number,''));
  v_previous text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF v_number !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'Informe um numero internacional E.164 valido' USING ERRCODE='22023';
  END IF;
  SELECT whatsapp_e164 INTO v_previous FROM public.caronaa_support_config
    WHERE singleton=1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuracao nao instalada' USING ERRCODE='55000';
  END IF;
  IF v_previous IS DISTINCT FROM v_number THEN
    UPDATE public.caronaa_support_config
      SET whatsapp_e164=v_number,updated_at=now(),updated_by=auth.uid()
      WHERE singleton=1;
    INSERT INTO public.caronaa_support_config_audit
      (changed_by,old_whatsapp,new_whatsapp)
      VALUES(auth.uid(),v_previous,v_number);
  END IF;
  RETURN v_number;
END;
$support$;
REVOKE ALL ON FUNCTION public.get_caronaa_support_whatsapp()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_caronaa_support_whatsapp() TO anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_set_caronaa_support_whatsapp(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_caronaa_support_whatsapp(text) TO authenticated;

-- Every row in orders is exactly ONE passenger request.
-- Flash: professional_quick_rides, whether a driver accepted it or not.
-- Shared: ride_requests, left-joined to at most one operational rides row.
-- Counting rides separately would double-count conversion, so do not do that.
CREATE OR REPLACE FUNCTION public.admin_operations_history_report(
  p_from date,
  p_to date,
  p_service text DEFAULT 'all',
  p_limit integer DEFAULT 40,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $reports$
DECLARE
  v_from timestamptz;
  v_until timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to>current_date+1
     OR (p_to-p_from)>366 OR p_service NOT IN ('all','flash','shared')
     OR p_service IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_offset NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023';
  END IF;
  v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
  v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';

  WITH orders AS (
    SELECT q.id::text AS id,'flash'::text AS service,
      q.requested_at AS requested_at,q.passenger_id,q.driver_id,
      coalesce(q.origin_label,'') AS origin,
      coalesce(q.destination_label,'') AS destination,
      coalesce(q.municipality,'') AS municipality,
      upper(coalesce(q.status,'')) AS status,
      q.accepted_at IS NOT NULL AS accepted,
      (upper(q.status)='COMPLETED' AND q.completed_at IS NOT NULL) AS completed,
      (upper(q.status) IN ('CANCELLED','CANCELED')) AS cancelled,
      (upper(q.status)='EXPIRED') AS expired,
      (upper(q.status) IN ('ACCEPTED','ARRIVED','IN_PROGRESS','PENDING_REVIEW')) AS in_progress,
      coalesce(q.estimated_fare_cents,0)::integer AS fare_cents,
      coalesce(q.payment_status,'') AS payment_status
    FROM public.professional_quick_rides q
    WHERE p_service IN ('all','flash')
      AND q.requested_at>=v_from AND q.requested_at<v_until
    UNION ALL
    SELECT rr.request_id::text,'shared'::text,rr.created_at,rr.user_id,
      r.driver_user_id,
      coalesce(rr.origin_label,rr.origin,''),
      coalesce(rr.destination_label,rr.destination,''),
      ''::text,
      upper(coalesce(r.status,rr.status,'')),
      (r.driver_accepted_at IS NOT NULL OR upper(coalesce(r.status,'')) IN
        ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','COMPLETED')) AS accepted,
      (upper(coalesce(r.status,''))='COMPLETED' AND r.completed_at IS NOT NULL),
      (upper(coalesce(r.status,rr.status,'')) IN ('CANCELLED','CANCELED')),
      (upper(coalesce(r.status,rr.status,''))='EXPIRED'),
      (upper(coalesce(r.status,'')) IN
        ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','PENDING_REVIEW')),
      coalesce(round(rr.passenger_price*100)::integer,
               round(r.passenger_contribution*100)::integer,0),
      ''::text
    FROM public.ride_requests rr
    LEFT JOIN public.rides r ON r.request_id=rr.request_id
    WHERE p_service IN ('all','shared')
      AND rr.created_at>=v_from AND rr.created_at<v_until
  ), summary AS (
    SELECT count(*)::integer AS orders,
      count(*) FILTER (WHERE accepted)::integer AS accepted,
      count(*) FILTER (WHERE NOT accepted)::integer AS unaccepted,
      count(*) FILTER (WHERE completed)::integer AS completed,
      count(*) FILTER (WHERE cancelled)::integer AS cancelled,
      count(*) FILTER (WHERE expired)::integer AS expired,
      count(*) FILTER (WHERE in_progress)::integer AS in_progress,
      count(DISTINCT passenger_id)::integer AS unique_passengers,
      count(*) FILTER (WHERE service='flash')::integer AS flash_orders,
      count(*) FILTER (WHERE service='shared')::integer AS shared_orders,
      coalesce(sum(fare_cents) FILTER(WHERE completed),0)::bigint AS completed_fares_cents,
      count(*) FILTER (WHERE NOT accepted AND cancelled)::integer AS cancelled_without_acceptance,
      count(*) FILTER (WHERE NOT accepted AND expired)::integer AS expired_without_acceptance
    FROM orders
  ), hours AS (
    SELECT h.hour::integer AS hour,count(o.id)::integer AS orders,
      count(DISTINCT o.passenger_id)::integer AS passengers
    FROM generate_series(0,23) h(hour)
    LEFT JOIN orders o ON EXTRACT(HOUR FROM o.requested_at AT TIME ZONE 'America/Fortaleza')::integer=h.hour
    GROUP BY h.hour
  ), hour_days AS (
    SELECT d.day::integer AS weekday,h.hour::integer AS hour,
      count(o.id)::integer AS orders
    FROM generate_series(0,6) d(day) CROSS JOIN generate_series(0,23) h(hour)
    LEFT JOIN orders o
      ON (EXTRACT(ISODOW FROM o.requested_at AT TIME ZONE 'America/Fortaleza')::integer-1)=d.day
      AND EXTRACT(HOUR FROM o.requested_at AT TIME ZONE 'America/Fortaleza')::integer=h.hour
    GROUP BY d.day,h.hour
  )
  SELECT jsonb_build_object(
    'generated_at',now(),'timezone','America/Fortaleza',
    'from',p_from,'to',p_to,'service',p_service,
    'summary',(SELECT to_jsonb(s) FROM summary s),
    'hours',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.hour) FROM hours h),'[]'::jsonb),
    'hour_days',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.weekday,d.hour) FROM hour_days d),'[]'::jsonb),
    'active_now',jsonb_build_object(
      'drivers',(SELECT count(*)::integer FROM (
        SELECT user_id FROM public.flash_driver_presence
          WHERE is_online AND last_gps_at>now()-interval '90 seconds'
        UNION
        SELECT user_id FROM public.professional_presence
          WHERE is_available AND last_seen_at>now()-interval '90 seconds'
      ) live),
      'passengers_preparing',(SELECT count(*)::integer FROM public.caronaa_passenger_demand_presence
          WHERE last_seen_at>now()-interval '90 seconds')
    ),
    'history_of_presence_available',false,
    'total_rows',(SELECT count(*)::integer FROM orders),
    'rows',coalesce((
      SELECT jsonb_agg(to_jsonb(items) ORDER BY items.requested_at DESC,items.id DESC)
      FROM (
        SELECT o.id,o.service,o.requested_at,o.origin,o.destination,o.municipality,
          o.status,o.accepted,o.completed,o.cancelled,o.expired,
          o.fare_cents,o.payment_status,
          coalesce(nullif(btrim(p.full_name),''),'Passageiro') AS passenger_name,
          CASE WHEN o.driver_id IS NULL THEN NULL
               ELSE coalesce(nullif(btrim(d.full_name),''),'Motorista') END AS driver_name
        FROM orders o
        LEFT JOIN public.profiles p ON p.id=o.passenger_id
        LEFT JOIN public.profiles d ON d.id=o.driver_id
        ORDER BY o.requested_at DESC,o.id DESC
        LIMIT p_limit OFFSET p_offset
      ) items
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$reports$;

REVOKE ALL ON FUNCTION public.admin_operations_history_report(date,date,text,integer,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_history_report(date,date,text,integer,integer)
  TO authenticated;
COMMENT ON FUNCTION public.admin_operations_history_report(date,date,text,integer,integer)
  IS 'Admin-only per-order operational report: no double counting of shared matches, no precise GPS or Pix; creation date in America/Fortaleza.';
NOTIFY pgrst,'reload schema';
COMMIT;