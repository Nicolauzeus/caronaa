-- Road feasibility is issued by the server after participant-authorized reads.
-- Bind it to the exact offer inventory, passenger quote/request and a short TTL.
CREATE TABLE public.ride_road_assessments(
 assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 offer_id uuid NOT NULL REFERENCES public.ride_offers(offer_id),quote_id uuid REFERENCES public.offer_route_quotes(quote_id),
 request_id uuid REFERENCES public.ride_requests(request_id),inventory_version text NOT NULL,
 added_duration_minutes numeric NOT NULL CHECK(added_duration_minutes BETWEEN 0 AND 15),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes',
 CHECK(num_nonnulls(quote_id,request_id)=1)
);
ALTER TABLE public.ride_road_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ride_road_assessments FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ride_road_assessments TO service_role;
CREATE INDEX ride_road_assessment_lookup ON public.ride_road_assessments(user_id,offer_id,expires_at);

CREATE FUNCTION public.ride_route_inventory_version(p_offer_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT md5(coalesce((SELECT jsonb_build_array(o.seats_remaining,o.status,
   (SELECT jsonb_agg(jsonb_build_array(r.ride_id,r.request_id,r.status) ORDER BY r.ride_id)
    FROM public.rides r WHERE r.offer_id=o.offer_id AND r.status IN ('MATCHED','CONFIRMED','IN_PROGRESS'))
 )::text FROM public.ride_offers o WHERE o.offer_id=p_offer_id),''));
$$;
REVOKE ALL ON FUNCTION public.ride_route_inventory_version(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.get_opportunity_route_context(p_offer_id uuid,p_quote_id uuid DEFAULT NULL,p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ride_offers%ROWTYPE; q jsonb; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR num_nonnulls(p_quote_id,p_request_id)<>1 THEN RAISE EXCEPTION 'Route access denied' USING ERRCODE='42501'; END IF;
 IF p_quote_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.ride_requests r WHERE r.route_quote_id=p_quote_id AND r.user_id=auth.uid() AND r.target_offer_id=p_offer_id) THEN
   RETURN '{"alreadyRequested":true}'::jsonb;
 END IF;
 IF p_request_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.ride_requests r JOIN public.ride_matches m ON m.request_id=r.request_id
   WHERE r.request_id=p_request_id AND r.user_id=auth.uid() AND m.offer_id=p_offer_id AND m.status='created') THEN
   RETURN '{"alreadyRequested":true}'::jsonb;
 END IF;
 PERFORM public.expire_ride_match_proposals();
 SELECT * INTO o FROM public.ride_offers WHERE offer_id=p_offer_id AND status='available'
   AND (ride_date+departure_time) AT TIME ZONE 'America/Fortaleza'>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
 IF p_quote_id IS NOT NULL THEN
   SELECT to_jsonb(quote)||jsonb_build_object('passenger_count',1) INTO q FROM public.offer_route_quotes quote
    WHERE quote_id=p_quote_id AND user_id=auth.uid();
   IF q IS NOT NULL AND (q->>'expires_at')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Passenger route quote is invalid or expired'; END IF;
 ELSE
   SELECT to_jsonb(r) INTO q FROM public.ride_requests r WHERE request_id=p_request_id AND user_id=auth.uid() AND status='open';
 END IF;
 IF q IS NULL THEN RAISE EXCEPTION 'Route access denied' USING ERRCODE='42501'; END IF;
 q := q||jsonb_build_object('user_id',auth.uid(),'gender',(SELECT gender FROM public.profiles WHERE id=auth.uid()),
   'travel_preferences',coalesce(q->'travel_preferences',public.get_my_travel_preferences()));
 IF public.evaluate_ride_candidate(q,o) IS NULL THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
 RETURN jsonb_build_object('offerId',o.offer_id,'origin',jsonb_build_object('lat',o.origin_lat,'lng',o.origin_lng),
   'destination',jsonb_build_object('lat',o.destination_lat,'lng',o.destination_lng),
   'routePath',o.route_path,'durationMinutes',o.route_duration_minutes,'distanceKm',o.route_distance_km,
   'pickup',jsonb_build_object('lat',(q->>'origin_lat')::float8,'lng',(q->>'origin_lng')::float8),
   'dropoff',jsonb_build_object('lat',(q->>'destination_lat')::float8,'lng',(q->>'destination_lng')::float8),
   'inventoryVersion',public.ride_route_inventory_version(o.offer_id));
END $$;
REVOKE ALL ON FUNCTION public.get_opportunity_route_context(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_opportunity_route_context(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.require_opportunity_road_assessment(p_offer_id uuid,p_quote_id uuid,p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.ride_road_assessments a WHERE a.user_id=auth.uid() AND a.offer_id=p_offer_id
   AND a.quote_id IS NOT DISTINCT FROM p_quote_id AND a.request_id IS NOT DISTINCT FROM p_request_id
   AND a.expires_at>clock_timestamp() AND a.inventory_version=public.ride_route_inventory_version(p_offer_id)) THEN
   RAISE EXCEPTION 'Recalcule o trajeto por estrada antes de solicitar esta oportunidade.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.require_opportunity_road_assessment(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Existing strict legacy requests remain available; every explicitly adjusted
-- opportunity must carry a fresh trusted assessment. Advisory lock also protects
-- the inventory fingerprint between verification and the actual allocation.
DO $road_guards$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.request_intelligent_ride_segment(uuid,uuid,date,time,integer,integer,boolean,timestamptz)'::regprocedure) INTO definition;
 IF position('IF (fit->>''requiresAdjustment'')::boolean THEN' IN definition)=0 THEN RAISE EXCEPTION 'Missing adjustment guard'; END IF;
 -- Run after consent validation, and for compatible explicit selections too.
 definition := replace(definition,'result := public.request_available_ride_segment(',
   'PERFORM public.require_opportunity_road_assessment(p_offer_id,p_quote_id,NULL); result := public.request_available_ride_segment(');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.choose_ride_opportunity(uuid,uuid,timestamptz)'::regprocedure) INTO definition;
 IF position('pickup := p_expected_pickup AT TIME ZONE' IN definition)=0 THEN RAISE EXCEPTION 'Missing opportunity choice guard'; END IF;
 definition := replace(definition,'pickup := p_expected_pickup AT TIME ZONE',
   'PERFORM public.require_opportunity_road_assessment(p_offer_id,NULL,p_request_id); pickup := p_expected_pickup AT TIME ZONE');
 EXECUTE definition;
END $road_guards$;
-- Assessments are ephemeral; keep one day for diagnostics and bound storage
-- through the same periodic/on-demand expiration path used by reservations.
DO $assessment_cleanup$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.expire_ride_match_proposals()'::regprocedure) INTO definition;
 IF position('PERFORM pg_advisory_xact_lock(74120391);' IN definition)=0 THEN RAISE EXCEPTION 'Missing expiration lock'; END IF;
 definition := replace(definition,'PERFORM pg_advisory_xact_lock(74120391);',
   'PERFORM pg_advisory_xact_lock(74120391); DELETE FROM public.ride_road_assessments WHERE expires_at<clock_timestamp()-interval ''1 day'';');
 EXECUTE definition;
END $assessment_cleanup$;
NOTIFY pgrst,'reload schema';
