CREATE FUNCTION public.get_offer_publication_prices(p_offer_ids uuid[]) RETURNS TABLE(offer_id uuid,route_distance_km numeric,passenger_price numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT o.offer_id,o.route_distance_km,o.passenger_price FROM public.ride_offers o
 WHERE auth.uid() IS NOT NULL AND o.offer_id=ANY(p_offer_ids) AND o.accepts_quoted_fares
 AND (o.user_id=auth.uid() OR (o.status='available' AND o.seats_remaining>0 AND (o.ride_date+o.departure_time) AT TIME ZONE 'America/Fortaleza'>=now()));
$$;
REVOKE ALL ON FUNCTION public.get_offer_publication_prices(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_offer_publication_prices(uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';