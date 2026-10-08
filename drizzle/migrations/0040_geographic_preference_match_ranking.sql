CREATE FUNCTION public.travel_route_score(qolat float8,qolng float8,qdlat float8,qdlng float8,oolat float8,oolng float8,odlat float8,odlng float8,qt time,ot time) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT greatest(55,100-CASE WHEN qolat IS NOT NULL AND qolng IS NOT NULL AND qdlat IS NOT NULL AND qdlng IS NOT NULL AND oolat IS NOT NULL AND oolng IS NOT NULL AND odlat IS NOT NULL AND odlng IS NOT NULL THEN least(30,round(7*(least(public.distance_km(qolat,qolng,oolat,oolng),public.distance_point_to_segment_km(qolat,qolng,oolat,oolng,odlat,odlng))+least(public.distance_km(qdlat,qdlng,odlat,odlng),public.distance_point_to_segment_km(qdlat,qdlng,oolat,oolng,odlat,odlng)))))::integer ELSE 12 END-least(20,round(coalesce(abs(extract(epoch FROM (ot-qt)))/60,0)/3))::integer);
$$;
DO $rank$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure) INTO d;
 d:=replace(d,'100 - least(20,abs(extract(epoch FROM (departure_time-request_row.departure_time))/60)/3)','public.travel_route_score(request_row.origin_lat,request_row.origin_lng,request_row.destination_lat,request_row.destination_lng,origin_lat,origin_lng,destination_lat,destination_lng,request_row.departure_time,departure_time)');
 EXECUTE d;
 SELECT pg_get_functiondef('public.search_available_ride_offers(text,text,date,time,integer,integer,integer,double precision,double precision,double precision,double precision)'::regprocedure) INTO d;
 d:=replace(d,'100 - least(20,coalesce(abs(extract(epoch FROM (o.departure_time-p_departure_time))/60)/3,0))','public.travel_route_score(p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng,o.origin_lat,o.origin_lng,o.destination_lat,o.destination_lng,p_departure_time,o.departure_time)');
 EXECUTE d;
END $rank$;
NOTIFY pgrst,'reload schema';