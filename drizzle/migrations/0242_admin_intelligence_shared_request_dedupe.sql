-- 0242 | Make shared-ride user funnel robust to multiple ride attempts per request.
-- An F02 request is one order even if it has several matching/ride records.
BEGIN;
CREATE INDEX IF NOT EXISTS rides_request_lookup_idx ON public.rides(request_id);
CREATE OR REPLACE FUNCTION public.admin_operations_intelligence(
 p_from date,p_to date,p_service text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $intel$
DECLARE v_from timestamptz;v_to timestamptz;v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
   RAISE EXCEPTION 'Acesso restrito' USING ERRCODE='42501';
 END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_to-p_from>366
    OR p_service IS NULL OR p_service NOT IN ('all','flash','shared')
 THEN RAISE EXCEPTION 'Filtros invalidos' USING ERRCODE='22023'; END IF;
 v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza';
 v_to:=(p_to+1)::timestamp AT TIME ZONE 'America/Fortaleza';
 WITH quotes AS (
   SELECT 'flash'::text AS service,q.passenger_id AS user_id,q.issued_at AS created_at
   FROM public.caronaa_quick_fare_quotes q WHERE p_service IN('all','flash') AND q.issued_at>=v_from AND q.issued_at<v_to
   UNION ALL
   SELECT 'shared',q.user_id,q.created_at FROM public.offer_route_quotes q
   WHERE p_service IN('all','shared') AND q.created_at>=v_from AND q.created_at<v_to
 ), requests AS (
   SELECT 'flash'::text AS service,q.passenger_id AS user_id,q.requested_at AS created_at,
     (q.accepted_at IS NOT NULL) AS accepted,
     (upper(coalesce(q.status,''))='COMPLETED' AND q.completed_at IS NOT NULL) AS completed
   FROM public.professional_quick_rides q
   WHERE p_service IN('all','flash') AND q.requested_at>=v_from AND q.requested_at<v_to
   UNION ALL
   SELECT 'shared',q.user_id,q.created_at,
     coalesce(ride_flags.accepted,false),coalesce(ride_flags.completed,false)
   FROM public.ride_requests q
   LEFT JOIN LATERAL (
     SELECT bool_or(r.driver_accepted_at IS NOT NULL OR
       upper(coalesce(r.status,'')) IN ('CONFIRMED','IN_PROGRESS','ONGOING','STARTED','COMPLETED')) AS accepted,
       bool_or(upper(coalesce(r.status,''))='COMPLETED' AND r.completed_at IS NOT NULL) AS completed
     FROM public.rides r WHERE r.request_id=q.request_id
   ) ride_flags ON TRUE
   WHERE p_service IN('all','shared') AND q.created_at>=v_from AND q.created_at<v_to
 ), journey AS (
   SELECT
     (SELECT count(DISTINCT user_id) FROM public.caronaa_app_access_days
       WHERE local_day BETWEEN p_from AND p_to)::int AS authenticated_users_all_services,
     (SELECT count(DISTINCT user_id) FROM quotes)::int AS quote_users,
     (SELECT count(*) FROM quotes)::int AS quotes_generated,
     (SELECT count(DISTINCT user_id) FROM requests)::int AS request_users,
     (SELECT count(*) FROM requests)::int AS requests_created,
     (SELECT count(DISTINCT user_id) FROM requests WHERE accepted)::int AS accepted_users,
     (SELECT count(DISTINCT user_id) FROM requests WHERE completed)::int AS completed_users,
     (SELECT count(*) FROM requests WHERE NOT accepted)::int AS unaccepted_requests,
     (SELECT count(DISTINCT q.user_id) FROM quotes q WHERE EXISTS(
       SELECT 1 FROM requests r WHERE r.user_id=q.user_id AND r.service=q.service
     ))::int AS quoted_and_requested_users
 ), territories AS (
   SELECT coalesce(nullif(btrim(q.municipality),''),'Não identificado') AS municipality,
     count(*)::int AS requests,
     count(*) FILTER(WHERE q.accepted_at IS NOT NULL)::int AS accepted,
     count(*) FILTER(WHERE q.accepted_at IS NULL)::int AS unaccepted,
     count(*) FILTER(WHERE upper(coalesce(q.status,'')) IN('CANCELLED','CANCELED'))::int AS cancelled,
     count(*) FILTER(WHERE upper(coalesce(q.status,''))='COMPLETED' AND q.completed_at IS NOT NULL)::int AS completed,
     count(DISTINCT q.passenger_id)::int AS passengers
   FROM public.professional_quick_rides q
   WHERE p_service IN('all','flash') AND q.requested_at>=v_from AND q.requested_at<v_to
   GROUP BY 1 ORDER BY requests DESC,municipality LIMIT 40
 )
 SELECT jsonb_build_object(
   'from',p_from,'to',p_to,'service',p_service,'timezone','America/Fortaleza',
   'journey',(SELECT to_jsonb(j) FROM journey j),
   'territories',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.requests DESC,t.municipality) FROM territories t),'[]'::jsonb),
   'notes',jsonb_build_object(
     'visits','Aberturas autenticadas apenas após implantação da coleta de acessos; contagem global independente do filtro de serviço',
     'conversion','Pessoas únicas por evento dentro do período; não é um funil de sessões causal nem cada cotação corresponde ao mesmo pedido',
     'territory','Município cadastrado na solicitação profissional F07; origem compartilhada não foi geocodificada nem atribuída artificialmente'
   ),
   'generated_at',now()
 ) INTO v_result;
 RETURN v_result;
END;
$intel$;
REVOKE ALL ON FUNCTION public.admin_operations_intelligence(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_intelligence(date,date,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;