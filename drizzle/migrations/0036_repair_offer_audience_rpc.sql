CREATE OR REPLACE FUNCTION public.create_ride_offer(
 p_origin text,p_destination text,p_ride_date date,p_departure_time time,
 p_available_seats integer,p_time_tolerance_minutes integer,
 p_origin_lat double precision,p_origin_lng double precision,
 p_destination_lat double precision,p_destination_lng double precision,
 p_total_price numeric,p_passenger_gender_preference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_passenger_gender_preference IS NULL OR p_passenger_gender_preference NOT IN ('ANY','FEMININO','MASCULINO') THEN RAISE EXCEPTION 'Invalid passenger preference'; END IF;
 IF nullif(btrim(p_origin),'') IS NULL OR nullif(btrim(p_destination),'') IS NULL OR length(p_origin)>160 OR length(p_destination)>160 THEN RAISE EXCEPTION 'Invalid route'; END IF;
 IF p_available_seats IS NULL OR p_available_seats NOT BETWEEN 1 AND 6 OR p_time_tolerance_minutes IS NULL OR p_time_tolerance_minutes NOT IN (5,15,30,60) THEN RAISE EXCEPTION 'Invalid capacity or tolerance'; END IF;
 IF p_total_price IS NULL OR p_total_price<0 OR p_total_price>1000 OR p_total_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid price'; END IF;
 IF p_ride_date IS NULL OR p_departure_time IS NULL OR (p_ride_date+p_departure_time) AT TIME ZONE 'America/Fortaleza'<clock_timestamp() THEN RAISE EXCEPTION 'Departure must be in the future'; END IF;
 v_id:=public.create_ride_offer(p_origin,p_destination,p_ride_date,p_departure_time,p_available_seats,p_time_tolerance_minutes,p_origin_lat,p_origin_lng,p_destination_lat,p_destination_lng,p_total_price);
 UPDATE public.ride_offers SET passenger_gender_preference=p_passenger_gender_preference WHERE offer_id=v_id AND user_id=auth.uid();
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric,text) TO authenticated;
NOTIFY pgrst,'reload schema';