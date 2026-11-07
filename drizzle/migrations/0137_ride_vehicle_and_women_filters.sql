-- F03/F05: apply request filters before matching, preserving quote/payment RPCs.
BEGIN;
ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS vehicle_type text NOT NULL DEFAULT 'CAR'
  CHECK (vehicle_type IN ('CAR','MOTO'));
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS requested_vehicle_type text
  CHECK (requested_vehicle_type IN ('CAR','MOTO'));
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS women_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.snapshot_ride_product_filters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE filters jsonb; caller_gender text;
BEGIN
 IF TG_OP='INSERT' AND NEW.user_id=auth.uid() THEN
  filters:=coalesce(nullif(current_setting('caronaa.product_filters',true),''),'{}')::jsonb;
  IF TG_TABLE_NAME='ride_requests' THEN
   NEW.requested_vehicle_type:=coalesce(filters->>'vehicleType',NEW.requested_vehicle_type);
   NEW.women_only:=coalesce((filters->>'womenOnly')::boolean,NEW.women_only);
  ELSE
   NEW.vehicle_type:=coalesce(filters->>'vehicleType',NEW.vehicle_type);
  END IF;
 END IF;
 SELECT gender INTO caller_gender FROM public.profiles WHERE id=NEW.user_id;
 IF TG_TABLE_NAME='ride_requests' THEN
  IF NEW.women_only AND caller_gender IS DISTINCT FROM 'FEMININO' THEN RAISE EXCEPTION 'Preferência indisponível para este perfil.' USING ERRCODE='42501'; END IF;
  IF NEW.requested_vehicle_type='MOTO' AND NEW.passenger_count<>1 THEN RAISE EXCEPTION 'Moto permite apenas uma vaga.'; END IF;
  IF TG_OP='UPDATE' AND (NEW.women_only IS DISTINCT FROM OLD.women_only OR NEW.requested_vehicle_type IS DISTINCT FROM OLD.requested_vehicle_type) THEN
   RAISE EXCEPTION 'Crie um novo pedido para alterar os filtros.';
  END IF;
 ELSE
  -- Historical preferences are preserved. New female-only offers require a woman driver.
  IF (TG_OP='INSERT' OR NEW.passenger_gender_preference IS DISTINCT FROM OLD.passenger_gender_preference) AND NEW.passenger_gender_preference='FEMININO' AND caller_gender IS DISTINCT FROM 'FEMININO' THEN RAISE EXCEPTION 'Preferência indisponível para este perfil.' USING ERRCODE='42501'; END IF;
  IF NEW.vehicle_type='MOTO' AND NEW.available_seats<>1 THEN RAISE EXCEPTION 'Moto permite apenas uma vaga.'; END IF;
  IF TG_OP='UPDATE' AND NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type THEN RAISE EXCEPTION 'Publique uma nova oferta para alterar o veículo.'; END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.snapshot_ride_product_filters() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_ride_product_filters BEFORE INSERT OR UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.snapshot_ride_product_filters();
CREATE TRIGGER a_ride_product_filters BEFORE INSERT OR UPDATE ON public.ride_offers FOR EACH ROW EXECUTE FUNCTION public.snapshot_ride_product_filters();

CREATE OR REPLACE FUNCTION public.ride_product_filters_compatible(q public.ride_requests,o public.ride_offers)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (q.requested_vehicle_type IS NULL OR q.requested_vehicle_type=o.vehicle_type)
 AND (NOT q.women_only OR (o.passenger_gender_preference='FEMININO'
   AND EXISTS(SELECT 1 FROM public.profiles WHERE id=o.user_id AND gender='FEMININO')));
$$;
REVOKE ALL ON FUNCTION public.ride_product_filters_compatible(public.ride_requests,public.ride_offers) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_filtered_priced_ride_request(
 p_quote_id uuid,p_ride_date date,p_departure_time time,p_passenger_count integer DEFAULT 1,
 p_time_tolerance_minutes integer DEFAULT 15,p_preferences jsonb DEFAULT NULL,
 p_vehicle_type text DEFAULT 'CAR',p_women_only boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; saved public.ride_requests%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_vehicle_type IS NULL OR p_vehicle_type NOT IN ('CAR','MOTO') OR p_women_only IS NULL THEN RAISE EXCEPTION 'Filtros inválidos.'; END IF;
 IF p_women_only AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND gender='FEMININO') THEN RAISE EXCEPTION 'Preferência indisponível para este perfil.' USING ERRCODE='42501'; END IF;
 IF p_vehicle_type='MOTO' AND p_passenger_count<>1 THEN RAISE EXCEPTION 'Moto permite apenas uma vaga.'; END IF;
 PERFORM set_config('caronaa.product_filters',jsonb_build_object('vehicleType',p_vehicle_type,'womenOnly',p_women_only)::text,true);
 result:=public.create_priced_ride_request(p_quote_id,p_ride_date,p_departure_time,p_passenger_count,p_time_tolerance_minutes,p_preferences);
 SELECT * INTO saved FROM public.ride_requests WHERE request_id=result AND user_id=auth.uid();
 IF NOT FOUND OR saved.requested_vehicle_type IS DISTINCT FROM p_vehicle_type OR saved.women_only IS DISTINCT FROM p_women_only THEN RAISE EXCEPTION 'A cotação já foi usada com outros filtros.'; END IF;
 PERFORM set_config('caronaa.product_filters','',true);
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.create_filtered_priced_ride_request(uuid,date,time,integer,integer,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_filtered_priced_ride_request(uuid,date,time,integer,integer,jsonb,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_filtered_priced_offer(p_details jsonb,p_quote_id uuid,p_preferences jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; requested_vehicle text:=coalesce(p_details->>'vehicleType','CAR'); saved public.ride_offers%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF requested_vehicle NOT IN ('CAR','MOTO') OR coalesce((p_details->>'availableSeats')::integer,0) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Veículo ou vagas inválidos.'; END IF;
 IF requested_vehicle='MOTO' AND (p_details->>'availableSeats')::integer<>1 THEN RAISE EXCEPTION 'Moto permite apenas uma vaga.'; END IF;
 PERFORM set_config('caronaa.product_filters',jsonb_build_object('vehicleType',requested_vehicle)::text,true);
 result:=public.publish_priced_offer(p_details,p_quote_id,p_preferences);
 SELECT * INTO saved FROM public.ride_offers WHERE offer_id=result AND user_id=auth.uid();
 IF NOT FOUND OR saved.vehicle_type IS DISTINCT FROM requested_vehicle OR saved.passenger_gender_preference IS DISTINCT FROM coalesce(p_details->>'passengerGenderPreference','ANY') THEN RAISE EXCEPTION 'Oferta já publicada com outras preferências.'; END IF;
 PERFORM set_config('caronaa.product_filters','',true);
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.publish_filtered_priced_offer(jsonb,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_filtered_priced_offer(jsonb,uuid,jsonb) TO authenticated;

-- Restrict candidates before selecting/locking one, so incompatible offers are skipped.
-- Abort on an unknown deployed allocator instead of silently publishing ineffective filters.
DO $$
DECLARE definition text; marker text:='AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)';
BEGIN
 SELECT pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure) INTO definition;
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Allocator changed: review product filter integration before applying 0137.'; END IF;
 definition:=replace(definition,marker,
  'AND (request_row.requested_vehicle_type IS NULL OR request_row.requested_vehicle_type = vehicle_type) AND (NOT request_row.women_only OR (passenger_gender_preference = ''FEMININO'' AND EXISTS (SELECT 1 FROM public.profiles driver_profile WHERE driver_profile.id = ride_offers.user_id AND driver_profile.gender = ''FEMININO''))) '||marker);
 EXECUTE definition;
END;$$;

-- Also guard direct reservations and any alternate allocator at its persistence boundary.
CREATE OR REPLACE FUNCTION public.guard_match_product_filters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.ride_requests%ROWTYPE; o public.ride_offers%ROWTYPE;
BEGIN
 SELECT * INTO q FROM public.ride_requests WHERE request_id=NEW.request_id;
 SELECT * INTO o FROM public.ride_offers WHERE offer_id=NEW.offer_id;
 IF NOT public.ride_product_filters_compatible(q,o) THEN RAISE EXCEPTION 'Viagem incompatível com os filtros do pedido.'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.guard_match_product_filters() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_match_product_filters BEFORE INSERT OR UPDATE OF offer_id,request_id ON public.ride_matches FOR EACH ROW EXECUTE FUNCTION public.guard_match_product_filters();
NOTIFY pgrst,'reload schema';
COMMIT;
