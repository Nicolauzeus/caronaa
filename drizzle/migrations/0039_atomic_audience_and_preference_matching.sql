DO $repair$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text)'::regprocedure) INTO d;
 d:=replace(d,'v_id:=public.create_ride_offer(p_origin,p_destination,p_ride_date,p_departure_time,p_available_seats,p_time_tolerance_minutes,p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng,p_total_price);','INSERT INTO public.ride_offers(user_id,origin,destination,ride_date,departure_time,available_seats,seats_remaining,time_tolerance_minutes,origin_lat,origin_lng,destination_lat,destination_lng,total_price,passenger_gender_preference) VALUES(auth.uid(),btrim(p_origin),btrim(p_destination),p_ride_date,p_departure_time,p_available_seats,p_available_seats,p_time_tolerance_minutes,p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng,p_total_price,p_passenger_gender_preference) RETURNING offer_id INTO v_id;');
 EXECUTE d;
 SELECT pg_get_functiondef('public.request_available_ride_offer(uuid,integer)'::regprocedure) INTO d;
 d:=replace(d,'departure_time, passenger_count, target_offer_id)','departure_time, passenger_count, target_offer_id,origin_lat,origin_lng,destination_lat,destination_lng)');
 d:=replace(d,'offer_row.departure_time, p_passenger_count, p_offer_id)','offer_row.departure_time, p_passenger_count, p_offer_id,offer_row.origin_lat,offer_row.origin_lng,offer_row.destination_lat,offer_row.destination_lng)');
 EXECUTE d;
END $repair$;
NOTIFY pgrst,'reload schema';