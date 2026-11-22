-- 0238: Cotacoes de preco geradas, com filtro por periodo e modalidade.
-- Cada id de cotacao conta uma vez. Consultas Places nao sao cotacoes.
BEGIN;
CREATE INDEX IF NOT EXISTS quick_fare_quotes_issued_at_idx ON public.caronaa_quick_fare_quotes(issued_at);
CREATE INDEX IF NOT EXISTS offer_route_quotes_created_at_idx ON public.offer_route_quotes(created_at);

CREATE OR REPLACE FUNCTION public.admin_caronaa_price_quotes_report(
 p_from date,p_to date,p_service text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $quote$
DECLARE v_from timestamptz;v_until timestamptz;v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from
 OR (p_to-p_from)>366 OR p_service IS NULL OR p_service NOT IN ('all','flash','shared')
 THEN RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_until:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH quotes AS (
  SELECT q.id AS quote_id,q.passenger_id AS user_id,q.issued_at AS generated_at,'flash'::text AS service
  FROM public.caronaa_quick_fare_quotes q
  WHERE p_service IN ('all','flash') AND q.issued_at>=v_from AND q.issued_at<v_until
  UNION ALL
  SELECT q.quote_id,q.user_id,q.created_at,'shared'::text
  FROM public.offer_route_quotes q
  WHERE p_service IN ('all','shared') AND q.created_at>=v_from AND q.created_at<v_until
 ), stats AS (
  SELECT count(*)::int AS quotes_generated,
   count(DISTINCT user_id)::int AS unique_quoters,
   count(*) FILTER(WHERE service='flash')::int AS flash_quotes,
   count(*) FILTER(WHERE service='shared')::int AS shared_quotes
  FROM quotes
 ), daily AS (
  SELECT d.day::date AS day,count(q.quote_id)::int AS quotes_generated,
   count(DISTINCT q.user_id)::int AS unique_quoters,
   count(q.quote_id) FILTER(WHERE q.service='flash')::int AS flash_quotes,
   count(q.quote_id) FILTER(WHERE q.service='shared')::int AS shared_quotes
  FROM generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)
  LEFT JOIN quotes q ON (q.generated_at AT TIME ZONE 'America/Fortaleza')::date=d.day::date
  GROUP BY d.day
 )
 SELECT jsonb_build_object(
  'from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
  'summary',(SELECT to_jsonb(s) FROM stats s),
  'daily',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM daily d),'[]'::jsonb),
  'generated_at',now()
 ) INTO v_result;
 RETURN v_result;
END;
$quote$;
REVOKE ALL ON FUNCTION public.admin_caronaa_price_quotes_report(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_caronaa_price_quotes_report(date,date,text) TO authenticated;
COMMENT ON FUNCTION public.admin_caronaa_price_quotes_report(date,date,text) IS 'Distinct issued price-quote rows (F07 and F04), not destination searches or confirmed rides, in Fortaleza local date bounds.';
NOTIFY pgrst,'reload schema';
COMMIT;