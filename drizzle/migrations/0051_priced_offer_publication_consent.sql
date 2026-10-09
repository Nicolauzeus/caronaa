CREATE TABLE public.offer_route_quotes (
 quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 origin text NOT NULL, destination text NOT NULL, distance_km numeric(14,6) NOT NULL,
 passenger_price numeric(10,2) NOT NULL, tariff_reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT (now()+interval '30 minutes')
);
GRANT SELECT ON public.offer_route_quotes TO authenticated;
GRANT ALL ON public.offer_route_quotes TO service_role;
ALTER TABLE public.offer_route_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_quote_read ON public.offer_route_quotes FOR SELECT TO authenticated USING (user_id=auth.uid());
ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS accepts_quoted_fares boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS route_quote_id uuid REFERENCES public.offer_route_quotes(quote_id),
 ADD COLUMN IF NOT EXISTS route_distance_km numeric(14,6), ADD COLUMN IF NOT EXISTS passenger_price numeric(10,2);
CREATE FUNCTION public.attach_offer_publication_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.offer_route_quotes%ROWTYPE; qid text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.accepts_quoted_fares AND (NEW.origin IS DISTINCT FROM OLD.origin OR NEW.destination IS DISTINCT FROM OLD.destination OR NEW.route_quote_id IS DISTINCT FROM OLD.route_quote_id OR NEW.route_distance_km IS DISTINCT FROM OLD.route_distance_km OR NEW.passenger_price IS DISTINCT FROM OLD.passenger_price OR NEW.accepts_quoted_fares IS DISTINCT FROM OLD.accepts_quoted_fares) THEN RAISE EXCEPTION 'Publique uma nova oferta para alterar o trecho ou o preço.'; END IF;
  RETURN NEW;
 END IF;
 qid:=nullif(current_setting('caronaa.offer_route_quote',true),'');
 IF qid IS NULL THEN
  IF NEW.accepts_quoted_fares OR NEW.route_quote_id IS NOT NULL OR NEW.route_distance_km IS NOT NULL OR NEW.passenger_price IS NOT NULL THEN RAISE EXCEPTION 'Trusted publication quote required'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO q FROM public.offer_route_quotes WHERE quote_id=qid::uuid AND user_id=auth.uid() AND expires_at>clock_timestamp();
 IF NOT FOUND OR NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.origin IS DISTINCT FROM q.origin OR NEW.destination IS DISTINCT FROM q.destination THEN RAISE EXCEPTION 'Preço expirado ou trajeto alterado. Calcule novamente.'; END IF;
 IF q.distance_km<=0 OR q.distance_km::text IN ('NaN','Infinity','-Infinity') OR q.passenger_price IS DISTINCT FROM round(q.distance_km*6/11,2) OR q.tariff_reference IS DISTINCT FROM 'caronaa-km-6-per-11-v1' THEN RAISE EXCEPTION 'Invalid trusted quote'; END IF;
 NEW.accepts_quoted_fares:=true; NEW.route_quote_id:=q.quote_id; NEW.route_distance_km:=q.distance_km; NEW.passenger_price:=q.passenger_price;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.attach_offer_publication_quote() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER offer_publication_quote_guard BEFORE INSERT OR UPDATE ON public.ride_offers FOR EACH ROW EXECUTE FUNCTION public.attach_offer_publication_quote();
CREATE FUNCTION public.publish_priced_offer(p_details jsonb,p_quote_id uuid,p_preferences jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM set_config('caronaa.offer_route_quote',p_quote_id::text,true);
 result:=public.create_preferred_ride('offer',p_details,p_preferences);
 PERFORM set_config('caronaa.offer_route_quote','',true);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.publish_priced_offer(jsonb,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_priced_offer(jsonb,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.accept_published_offer_fare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status='MATCHED' AND OLD.route_distance_km IS NULL AND NEW.route_distance_km IS NOT NULL
 AND OLD.driver_accepted_at IS NULL AND EXISTS(SELECT 1 FROM public.ride_offers WHERE offer_id=NEW.offer_id AND user_id=NEW.driver_user_id AND accepts_quoted_fares) THEN
  NEW.driver_accepted_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accept_published_offer_fare() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_accept_published_offer_fare BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.accept_published_offer_fare();
NOTIFY pgrst,'reload schema';