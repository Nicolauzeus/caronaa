-- 0256 | F09: quote cohort through acceptance/completion and one consistent admin snapshot.
-- Read only. All conversion stages use distinct quote IDs, not a mix of quote/order counts.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_quote_funnel(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $funnel$
DECLARE v_from timestamptz; v_until timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared') THEN
  RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH facts AS MATERIALIZED (
  SELECT * FROM public.caronaa_operational_order_facts(v_from,now()+interval '1 microsecond',p_service)
 ), quotes AS (
  SELECT 'flash'::text AS service,q.id AS quote_id,q.passenger_id AS owner_id,
   q.issued_at, f.id IS NOT NULL AS linked,coalesce(f.accepted,false) AS accepted,
   coalesce(f.completed,false) AS completed
  FROM public.caronaa_quick_fare_quotes q
  LEFT JOIN facts f ON f.service='flash' AND f.id=q.ride_id::text
   AND f.passenger_id=q.passenger_id AND f.requested_at>=q.issued_at
  WHERE p_service IN ('all','flash') AND q.issued_at>=v_from AND q.issued_at<v_until AND q.issued_at<=now()
  UNION ALL
  SELECT 'shared',q.quote_id,q.user_id,q.created_at,
   a.linked,coalesce(a.accepted,false),coalesce(a.completed,false)
  FROM public.offer_route_quotes q
  CROSS JOIN LATERAL (
   SELECT count(*)>0 AS linked,bool_or(f.accepted) AS accepted,bool_or(f.completed) AS completed
   FROM public.ride_requests r JOIN facts f ON f.service='shared' AND f.id=r.request_id::text
   WHERE r.route_quote_id=q.quote_id AND r.user_id=q.user_id AND f.requested_at>=q.created_at
  ) a
  WHERE p_service IN ('all','shared') AND q.created_at>=v_from AND q.created_at<v_until AND q.created_at<=now()
 ), totals AS (
  SELECT s.service,count(q.quote_id) AS quotes_issued,
   count(q.quote_id) FILTER(WHERE q.linked) AS quotes_with_request,
   count(q.quote_id) FILTER(WHERE q.linked AND q.accepted) AS quotes_with_acceptance,
   count(q.quote_id) FILTER(WHERE q.linked AND q.completed) AS quotes_with_completion,
   round(100.0*count(q.quote_id) FILTER(WHERE q.linked)/nullif(count(q.quote_id),0),2) AS request_pct,
   round(100.0*count(q.quote_id) FILTER(WHERE q.linked AND q.completed)/nullif(count(q.quote_id),0),2) AS completion_pct
  FROM (VALUES ('flash'),('shared')) s(service) LEFT JOIN quotes q ON q.service=s.service
  WHERE p_service IN ('all',s.service) GROUP BY s.service
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.service) FROM totals t),'[]'::jsonb),
  'notes',jsonb_build_object('unit','Distinct quote IDs in issuance cohort; several quotes can refer to one request and one shared quote may have several requests.',
   'scope','Current recorded outcomes, including requests after the selected quote issuance period up to now.',
   'shared','All shared quotes include driver-offer quotes; not a passenger-only conversion rate.',
   'unlinked','No persisted link does not prove abandonment.'))
 INTO v_result;
 RETURN v_result;
END;
$funnel$;
REVOKE ALL ON FUNCTION public.admin_operational_quote_funnel(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_quote_funnel(date,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_operational_overview(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $overview$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'kpis',public.admin_operational_order_kpis(p_from,p_to,p_service),
  'conversion',public.admin_operational_conversion_retention(p_from,p_to,p_service),
  'funnel',public.admin_operational_quote_funnel(p_from,p_to,p_service),
  'cancellations',public.admin_operational_cancellation_breakdown(p_from,p_to,p_service),
  'diagnostics',public.admin_operational_diagnostics(p_from,p_to,p_service));
END;
$overview$;
REVOKE ALL ON FUNCTION public.admin_operational_overview(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_overview(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
