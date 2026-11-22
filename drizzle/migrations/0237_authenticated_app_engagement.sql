-- 0237: Authenticated app opens/active users with separate passenger/driver metrics.
-- No retrospective opens are fabricated. Uses authenticated server identity only.
BEGIN;
CREATE TABLE IF NOT EXISTS public.caronaa_app_access_days(
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_day date NOT NULL,
  role_at_access text NOT NULL CHECK(role_at_access IN ('PASSAGEIRO','MOTORISTA')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 1 CHECK(visit_count>=1),
  PRIMARY KEY(user_id,local_day,role_at_access)
);
CREATE INDEX IF NOT EXISTS caronaa_app_access_day_idx ON public.caronaa_app_access_days(local_day,role_at_access);
ALTER TABLE public.caronaa_app_access_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.caronaa_app_access_days FROM PUBLIC,anon,authenticated;

-- New local access mark: upsert per account, day and active role. Session key is
-- never stored; five-minute server throttle bounds event inflation.
CREATE OR REPLACE FUNCTION public.record_caronaa_app_access()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $record$
DECLARE v_uid uuid:=auth.uid();v_role text;v_day date:=(now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
 IF v_uid IS NULL THEN RETURN false; END IF;
 SELECT CASE
  WHEN upper(coalesce(p.active_role,''))='MOTORISTA' THEN 'MOTORISTA'
  WHEN upper(coalesce(p.active_role,''))='PASSAGEIRO' THEN 'PASSAGEIRO'
  WHEN upper(coalesce(op.usage_role,''))='MOTORISTA' THEN 'MOTORISTA'
  ELSE 'PASSAGEIRO' END
 INTO v_role
 FROM auth.users u
 LEFT JOIN public.profiles p ON p.id=u.id
 LEFT JOIN public.user_onboarding_progress op ON op.user_id=u.id
 WHERE u.id=v_uid;
 IF v_role IS NULL THEN RETURN false; END IF;
 INSERT INTO public.caronaa_app_access_days AS a(user_id,local_day,role_at_access)
 VALUES(v_uid,v_day,v_role)
 ON CONFLICT(user_id,local_day,role_at_access)
 DO UPDATE SET last_seen_at=now(),visit_count=a.visit_count+1
 WHERE a.last_seen_at<now()-interval '5 minutes';
 RETURN true;
END;
$record$;
REVOKE ALL ON FUNCTION public.record_caronaa_app_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_caronaa_app_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_caronaa_app_engagement(p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $report$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_to-p_from>366
 THEN RAISE EXCEPTION 'Periodo invalido' USING ERRCODE='22023'; END IF;
 WITH events AS (
  SELECT user_id,local_day,role_at_access,visit_count,last_seen_at
  FROM public.caronaa_app_access_days
  WHERE local_day BETWEEN p_from AND p_to
 ), totals AS (
  SELECT count(DISTINCT user_id)::int AS unique_users,
   count(DISTINCT user_id) FILTER(WHERE role_at_access='PASSAGEIRO')::int AS passengers,
   count(DISTINCT user_id) FILTER(WHERE role_at_access='MOTORISTA')::int AS drivers,
   coalesce(sum(visit_count),0)::int AS recorded_access_signals
  FROM events
 ), day_series AS (
  SELECT d.day::date AS day,
   count(DISTINCT e.user_id)::int AS unique_users,
   count(DISTINCT e.user_id) FILTER(WHERE e.role_at_access='PASSAGEIRO')::int AS passengers,
   count(DISTINCT e.user_id) FILTER(WHERE e.role_at_access='MOTORISTA')::int AS drivers
  FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
  LEFT JOIN events e ON e.local_day=d.day::date
  GROUP BY d.day
 ), users_list AS (
  SELECT e.user_id,
   max(p.full_name) AS display_name,
   bool_or(e.role_at_access='PASSAGEIRO') AS as_passenger,
   bool_or(e.role_at_access='MOTORISTA') AS as_driver,
   count(DISTINCT e.local_day)::int AS active_days,
   sum(e.visit_count)::int AS access_signals,
   max(e.last_seen_at) AS last_seen_at
  FROM events e LEFT JOIN public.profiles p ON p.id=e.user_id
  GROUP BY e.user_id ORDER BY max(e.last_seen_at) DESC LIMIT 500
 )
 SELECT jsonb_build_object(
 'from',p_from,'to',p_to,'timezone','America/Fortaleza',
 'collection_started_at',(SELECT min(first_seen_at) FROM public.caronaa_app_access_days),
 'summary',(SELECT to_jsonb(t) FROM totals t),
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM day_series d),'[]'::jsonb),
 'users',coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.last_seen_at DESC) FROM users_list u),'[]'::jsonb),
 'note','Usuários autenticados distintos que abriram/retomaram o aplicativo após o início desta coleta; não equivale a chamadas ao Google Maps.'
 ) INTO v_result;
 RETURN v_result;
END;
$report$;
REVOKE ALL ON FUNCTION public.admin_caronaa_app_engagement(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_caronaa_app_engagement(date,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;