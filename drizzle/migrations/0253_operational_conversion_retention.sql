-- 0253 | F09: quote attribution and observed passenger retention.
-- No changes to pricing, dispatch, payment or source records.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_operational_conversion_retention(
 p_from date,p_to date,p_service text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $analytics$
DECLARE v_from timestamptz; v_until timestamptz; v_previous timestamptz; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared') THEN
  RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023';
 END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 v_previous:=(p_from-(p_to-p_from+1))::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH quotes AS MATERIALIZED (
  SELECT 'flash'::text AS service,q.id AS quote_id,q.passenger_id AS user_id,q.issued_at AS issued_at,
   EXISTS(SELECT 1 FROM public.professional_quick_rides r WHERE r.id=q.ride_id
    AND r.passenger_id=q.passenger_id AND r.requested_at>=q.issued_at AND r.requested_at<=now()) AS linked_request,
   false AS linked_offer
  FROM public.caronaa_quick_fare_quotes q
  WHERE p_service IN ('all','flash') AND q.issued_at>=v_from AND q.issued_at<v_until AND q.issued_at<=now()
  UNION ALL
  SELECT 'shared',q.quote_id,q.user_id,q.created_at,
   EXISTS(SELECT 1 FROM public.ride_requests r WHERE r.route_quote_id=q.quote_id
    AND r.user_id=q.user_id AND r.created_at>=q.created_at AND r.created_at<=now()),
   EXISTS(SELECT 1 FROM public.ride_offers r WHERE r.route_quote_id=q.quote_id
    AND r.user_id=q.user_id AND r.created_at>=q.created_at AND r.created_at<=now())
  FROM public.offer_route_quotes q
  WHERE p_service IN ('all','shared') AND q.created_at>=v_from AND q.created_at<v_until AND q.created_at<=now()
 ), quote_totals AS (
  SELECT s.service,count(q.quote_id) AS issued,
   count(q.quote_id) FILTER(WHERE q.linked_request) AS linked_to_request,
   count(q.quote_id) FILTER(WHERE q.linked_offer) AS linked_to_offer,
   count(q.quote_id) FILTER(WHERE q.linked_request AND q.linked_offer) AS linked_to_both,
   count(q.quote_id) FILTER(WHERE NOT q.linked_request AND NOT q.linked_offer) AS no_persisted_link,
   round(100.0*count(q.quote_id) FILTER(WHERE q.linked_request)/nullif(count(q.quote_id),0),2) AS request_link_pct
  FROM (VALUES ('flash'),('shared')) s(service)
  LEFT JOIN quotes q ON q.service=s.service
  WHERE p_service IN ('all',s.service) GROUP BY s.service
 ), activity AS MATERIALIZED (
  SELECT o.passenger_id,count(*) AS requests,count(*) FILTER(WHERE o.completed) AS completed
  FROM public.caronaa_operational_order_facts(v_from,v_until,p_service) o
  WHERE o.passenger_id IS NOT NULL GROUP BY o.passenger_id
 ), previous AS MATERIALIZED (
  SELECT DISTINCT o.passenger_id FROM public.caronaa_operational_order_facts(v_previous,v_from,p_service) o
  WHERE o.passenger_id IS NOT NULL
 ), first_seen AS (
  SELECT a.passenger_id,EXISTS(
    SELECT 1 FROM public.professional_quick_rides r WHERE p_service IN ('all','flash')
    AND r.passenger_id=a.passenger_id AND r.requested_at<v_from
   UNION ALL
    SELECT 1 FROM public.ride_requests r WHERE p_service IN ('all','shared')
    AND r.user_id=a.passenger_id AND r.created_at<v_from
  ) AS has_prior_order
  FROM activity a
 ), retention AS (
  SELECT count(*) AS current_passengers,
   count(*) FILTER(WHERE NOT f.has_prior_order) AS first_observed_in_period,
   count(*) FILTER(WHERE f.has_prior_order AND p.passenger_id IS NOT NULL) AS retained_from_previous,
   count(*) FILTER(WHERE f.has_prior_order AND p.passenger_id IS NULL) AS returned_after_gap,
   count(*) FILTER(WHERE a.requests>=2) AS repeated_in_period,
   count(*) FILTER(WHERE a.completed>0) AS completed_passengers,
   (SELECT count(*) FROM previous) AS previous_passengers,
   (SELECT count(*) FROM previous p0 WHERE NOT EXISTS(SELECT 1 FROM activity a0 WHERE a0.passenger_id=p0.passenger_id)) AS previous_not_returned,
   round(100.0*count(*) FILTER(WHERE p.passenger_id IS NOT NULL)/nullif((SELECT count(*) FROM previous),0),2) AS previous_cohort_retention_pct
  FROM activity a JOIN first_seen f USING(passenger_id) LEFT JOIN previous p USING(passenger_id)
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
  'generated_at',now(),'previous_from',(v_previous AT TIME ZONE 'America/Fortaleza')::date,
  'previous_to',p_from-1,'quote_conversion',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.service) FROM quote_totals t),'[]'::jsonb),
  'retention',(SELECT to_jsonb(r) FROM retention r),
  'notes',jsonb_build_object(
   'quotes','Quote issuance cohort; persisted same-owner request/offer links only, including links after selected period up to now. No causal inference from matching users or time.',
   'shared','Shared quotes include driver offer quotes; request_link_pct is fraction of all issued quotes with a request link, not a passenger-only conversion rate.',
   'unlinked','No persisted link does not prove abandonment or price rejection.',
   'retention','Observed request activity, not app visits or account creation; previous interval has equal calendar length; returned_after_gap means absent only in immediately preceding interval.',
   'coverage','Current outcomes and retained database history, not an as-of reconstruction.'))
 INTO v_result;
 RETURN v_result;
END;
$analytics$;
REVOKE ALL ON FUNCTION public.admin_operational_conversion_retention(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operational_conversion_retention(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
