-- 0263 | F09 audience diagnostics, explicit denominator and unknown coverage.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_audience_diagnostics(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $audience$
DECLARE v_from timestamptz; v_until timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared') THEN
  RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 IF p_service='shared' THEN RETURN NULL; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH orders AS MATERIALIZED (
  SELECT * FROM public.caronaa_operational_order_facts(v_from,v_until,'flash')
 ), facts AS (
  SELECT o.id,(NOT o.accepted AND (o.cancelled OR o.expired)) AS unserved,
   cardinality(s.driver_ids) AS candidates,
   EXISTS(SELECT 1 FROM public.caronaa_flash_queue_signal_history h WHERE h.request_id=o.id::uuid) AS has_queue_signal,
   (SELECT count(*) FROM public.caronaa_flash_radar_client_ack a WHERE a.request_id=o.id::uuid) AS app_acks
  FROM orders o LEFT JOIN public.caronaa_flash_creation_candidates s ON s.request_id=o.id::uuid
 ), totals AS (
  SELECT count(*) AS flash_orders,count(candidates) AS snapshot_known,
   count(*) FILTER(WHERE candidates IS NULL) AS snapshot_unknown,
   count(*) FILTER(WHERE candidates=0) AS snapshot_zero,
   count(*) FILTER(WHERE candidates>0) AS snapshot_with_candidates,
   count(*) FILTER(WHERE unserved AND candidates=0) AS unserved_snapshot_zero,
   count(*) FILTER(WHERE unserved AND candidates>0) AS unserved_snapshot_with_candidates,
   count(*) FILTER(WHERE unserved AND candidates IS NULL) AS unserved_snapshot_unknown,
   count(*) FILTER(WHERE has_queue_signal) AS orders_with_queue_signal,
   count(*) FILTER(WHERE app_acks>0) AS orders_with_app_ack,
   coalesce(sum(app_acks),0) AS app_ack_driver_order_pairs
  FROM facts
 )
 SELECT to_jsonb(t) INTO v_result FROM totals t;
 RETURN v_result;
END;
$audience$;
REVOKE ALL ON FUNCTION public.admin_operational_audience_diagnostics(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_audience_diagnostics(date,date,text) TO authenticated;
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
  'diagnostics',public.admin_operational_diagnostics(p_from,p_to,p_service),
  'audience',public.admin_operational_audience_diagnostics(p_from,p_to,p_service));
END;
$overview$;
REVOKE ALL ON FUNCTION public.admin_operational_overview(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_overview(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
