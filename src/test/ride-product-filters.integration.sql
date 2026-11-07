-- Isolated regression fixture, never run against production data.
BEGIN;
DO $$
DECLARE male uuid:=gen_random_uuid(); female uuid:=gen_random_uuid(); passenger uuid:=gen_random_uuid(); unknown_user uuid:=gen_random_uuid();
 male_offer uuid; female_offer uuid; moto_offer uuid; quote uuid; request uuid; chosen uuid; failed boolean;
BEGIN
 INSERT INTO auth.users(id,email) VALUES (male,'male-filter@test.local'),(female,'female-filter@test.local'),(passenger,'passenger-filter@test.local'),(unknown_user,'unknown-filter@test.local');
 UPDATE public.profiles SET gender='MASCULINO' WHERE id=male;
 UPDATE public.profiles SET gender='FEMININO' WHERE id IN (female,passenger);
 PERFORM set_config('request.jwt.claim.sub',male::text,true);
 failed:=false;
 BEGIN
  PERFORM public.create_preferred_ride('offer',jsonb_build_object('origin','Filter A','destination','Filter B','originLat',-3.73,'originLng',-38.52,'destinationLat',-3.75,'destinationLng',-38.50,'rideDate',current_date+2,'departureTime','09:00','availableSeats',3,'passengerGenderPreference','FEMININO'));
 EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Male driver could publish female-only ride'; END IF;
 PERFORM set_config('request.jwt.claim.sub',unknown_user::text,true);
 failed:=false;
 BEGIN
  PERFORM public.create_preferred_ride('offer',jsonb_build_object('origin','Filter A','destination','Filter B','originLat',-3.73,'originLng',-38.52,'destinationLat',-3.75,'destinationLng',-38.50,'rideDate',current_date+2,'departureTime','09:00','availableSeats',3,'passengerGenderPreference','FEMININO'));
 EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Unknown gender could publish female-only ride'; END IF;
 PERFORM set_config('request.jwt.claim.sub',male::text,true);
 male_offer:=public.create_preferred_ride('offer',jsonb_build_object('origin','Filter A','destination','Filter B','originLat',-3.73,'originLng',-38.52,'destinationLat',-3.75,'destinationLng',-38.50,'rideDate',current_date+2,'departureTime','09:00','availableSeats',3,'passengerGenderPreference','ANY'));
 failed:=false;
 BEGIN UPDATE public.ride_offers SET passenger_gender_preference='FEMININO' WHERE offer_id=male_offer;
 EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Male driver bypassed eligibility by updating an offer'; END IF;
 PERFORM set_config('request.jwt.claim.sub',female::text,true);
 female_offer:=public.create_preferred_ride('offer',jsonb_build_object('origin','Filter A','destination','Filter B','originLat',-3.73,'originLng',-38.52,'destinationLat',-3.75,'destinationLng',-38.50,'rideDate',current_date+2,'departureTime','09:00','availableSeats',3,'passengerGenderPreference','FEMININO'));
 PERFORM set_config('caronaa.product_filters','{"vehicleType":"MOTO"}',true);
 moto_offer:=public.create_preferred_ride('offer',jsonb_build_object('origin','Filter A','destination','Filter B','originLat',-3.73,'originLng',-38.52,'destinationLat',-3.75,'destinationLng',-38.50,'rideDate',current_date+2,'departureTime','09:00','availableSeats',1,'passengerGenderPreference','ANY'));
 PERFORM set_config('caronaa.product_filters','',true);
 IF NOT EXISTS(SELECT 1 FROM public.ride_offers WHERE offer_id=moto_offer AND vehicle_type='MOTO') THEN RAISE EXCEPTION 'Motorcycle selection was not persisted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',passenger::text,true);
 INSERT INTO public.offer_route_quotes(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,passenger_price,tariff_reference)
 VALUES(passenger,'Filter A','Filter B',-3.73,-38.52,-3.75,-38.50,22,12,'caronaa-km-6-per-11-v1') RETURNING quote_id INTO quote;
 request:=public.create_filtered_priced_ride_request(quote,current_date+2,'09:00',1,15,NULL,'CAR',true);
 SELECT offer_id INTO chosen FROM public.ride_matches WHERE request_id=request;
 IF chosen IS DISTINCT FROM female_offer THEN RAISE EXCEPTION 'Women-only matching chose an incompatible offer: %',chosen; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ride_requests WHERE request_id=request AND women_only AND requested_vehicle_type='CAR' AND passenger_price=12) THEN RAISE EXCEPTION 'Filters or trusted price not persisted'; END IF;
 IF public.create_filtered_priced_ride_request(quote,current_date+2,'09:00',1,15,NULL,'CAR',true) IS DISTINCT FROM request THEN RAISE EXCEPTION 'Identical retry lost idempotency'; END IF;
 failed:=false;
 BEGIN PERFORM public.create_filtered_priced_ride_request(quote,current_date+2,'09:00',1,15,NULL,'MOTO',false);
 EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Changed filters reused an existing request quote'; END IF;
 INSERT INTO public.offer_route_quotes(user_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,passenger_price,tariff_reference)
 VALUES(passenger,'Filter A','Filter B',-3.73,-38.52,-3.75,-38.50,11,6,'caronaa-km-6-per-11-v1') RETURNING quote_id INTO quote;
 request:=public.create_filtered_priced_ride_request(quote,current_date+2,'09:00',1,15,NULL,'MOTO',false);
 SELECT offer_id INTO chosen FROM public.ride_matches WHERE request_id=request;
 IF chosen IS DISTINCT FROM moto_offer THEN RAISE EXCEPTION 'Moto request matched a car: %',chosen; END IF;
 failed:=false;
 BEGIN PERFORM public.create_filtered_priced_ride_request(quote,current_date+2,'09:00',2,15,NULL,'MOTO',false);
 EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Moto accepted two passengers'; END IF;
 PERFORM set_config('request.jwt.claim.sub',male::text,true);
 failed:=false;
 BEGIN PERFORM public.create_filtered_priced_ride_request(gen_random_uuid(),current_date+2,'09:00',1,15,NULL,'CAR',true);
 EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Male passenger could request women-only'; END IF;
 RAISE NOTICE 'PASS: gender restrictions, vehicle persistence, candidate filtering, trusted fare and idempotency';
END;$$;
ROLLBACK;
