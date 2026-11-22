-- 0236 | Admin operational Google Maps API usage reporting.
-- Uses original Google API audit events; no synthetic billing or web-client calls.
BEGIN;
CREATE INDEX IF NOT EXISTS google_api_usage_created_service_idx
  ON public.google_api_usage(created_at,api_service);

CREATE OR REPLACE FUNCTION public.admin_google_api_usage_report(
  p_from date,p_to date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $report$
DECLARE
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from>p_to
     OR (p_to-p_from)>366 OR p_to>(now() AT TIME ZONE 'America/Fortaleza')::date+1 THEN
    RAISE EXCEPTION 'Intervalo invalido' USING ERRCODE='22023';
  END IF;
  v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
  v_to:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
  WITH entries AS (
    SELECT (u.created_at AT TIME ZONE 'America/Fortaleza')::date AS local_date,
      extract(hour FROM u.created_at AT TIME ZONE 'America/Fortaleza')::integer AS hour,
      u.api_service,u.caller_function,coalesce(u.success,false) AS success,
      u.error_code
    FROM public.google_api_usage u
    WHERE u.created_at>=v_from AND u.created_at<v_to
  ), totals AS (
    SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE api_service='places')::integer AS places,
      count(*) FILTER (WHERE api_service='routes')::integer AS routes,
      count(*) FILTER (WHERE api_service NOT IN ('places','routes'))::integer AS other,
      count(*) FILTER (WHERE success)::integer AS success,
      count(*) FILTER (WHERE NOT success)::integer AS errors
    FROM entries
  ), days AS (
    SELECT d.day::date AS day,count(e.local_date)::integer AS total,
      count(e.local_date) FILTER(WHERE e.api_service='places')::integer AS places,
      count(e.local_date) FILTER(WHERE e.api_service='routes')::integer AS routes,
      count(e.local_date) FILTER(WHERE NOT e.success)::integer AS errors
    FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
    LEFT JOIN entries e ON e.local_date=d.day::date
    GROUP BY d.day
  ), methods AS (
    SELECT api_service,caller_function,count(*)::integer AS total,
      count(*) FILTER(WHERE NOT success)::integer AS errors
    FROM entries
    GROUP BY api_service,caller_function
  ), hours AS (
    SELECT h.hour::integer AS hour,count(e.hour)::integer AS total
    FROM generate_series(0,23) h(hour)
    LEFT JOIN entries e ON e.hour=h.hour
    GROUP BY h.hour
  )
  SELECT jsonb_build_object(
    'from',p_from,'to',p_to,'timezone','America/Fortaleza',
    'source','caronaa_internal_google_api_usage',
    'scope_note','Chamadas registradas pelo servidor CARONAA; nao inclui necessariamente Maps JavaScript no navegador nem faturamento Google Cloud',
    'summary',(SELECT to_jsonb(t) FROM totals t),
    'daily',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM days d),'[]'::jsonb),
    'callers',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.total DESC,m.api_service,m.caller_function) FROM methods m),'[]'::jsonb),
    'hours',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.hour) FROM hours h),'[]'::jsonb),
    'generated_at',now()
  ) INTO v_result;
  RETURN v_result;
END;
$report$;
REVOKE ALL ON FUNCTION public.admin_google_api_usage_report(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_google_api_usage_report(date,date) TO authenticated;
COMMENT ON FUNCTION public.admin_google_api_usage_report(date,date) IS
'Admin-only Google wrapper usage. Days from created_at in America/Fortaleza. Does not imply billed requests.';
NOTIFY pgrst,'reload schema';
COMMIT;