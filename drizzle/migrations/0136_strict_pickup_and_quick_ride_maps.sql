-- Additive F03/F05/F07 support. Does not enable any region, payment or GPS consent.
BEGIN;
ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS allow_detours boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.ride_offers.allow_detours IS 'Historical offers retain their existing flexible behavior. New UI submits an explicit choice.';
CREATE OR REPLACE FUNCTION public.guard_offer_route_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE policy text;
BEGIN
 IF TG_OP='INSERT' THEN
  policy:=nullif(current_setting('caronaa.offer_allow_detours',true),'');
  IF policy IS NOT NULL THEN NEW.allow_detours:=policy::boolean; END IF;
 ELSIF NEW.allow_detours IS DISTINCT FROM OLD.allow_detours THEN
  RAISE EXCEPTION 'Publique uma nova oferta para alterar a política de desvios.';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.guard_offer_route_policy() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS offer_route_policy_guard ON public.ride_offers;
CREATE TRIGGER offer_route_policy_guard BEFORE INSERT OR UPDATE ON public.ride_offers
 FOR EACH ROW EXECUTE FUNCTION public.guard_offer_route_policy();

-- Preserve the established publication RPC, trusted quote, preferences and transaction.
CREATE OR REPLACE FUNCTION public.publish_priced_offer(p_details jsonb,p_quote_id uuid,p_preferences jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE result uuid; requested_policy boolean; saved_policy boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_details ? 'allowDetours' AND jsonb_typeof(p_details->'allowDetours') <> 'boolean' THEN
  RAISE EXCEPTION 'Invalid route policy';
 END IF;
 requested_policy:=coalesce((p_details->>'allowDetours')::boolean,true);
 PERFORM set_config('caronaa.offer_route_quote',p_quote_id::text,true);
 PERFORM set_config('caronaa.offer_allow_detours',requested_policy::text,true);
 result:=public.create_preferred_ride('offer',p_details,p_preferences);
 SELECT allow_detours INTO saved_policy FROM public.ride_offers WHERE offer_id=result AND user_id=auth.uid();
 IF NOT FOUND OR saved_policy IS DISTINCT FROM requested_policy THEN
  RAISE EXCEPTION 'A oferta já publicada tem outra política de trajeto. Publique uma nova oferta.';
 END IF;
 PERFORM set_config('caronaa.offer_route_quote','',true);
 PERFORM set_config('caronaa.offer_allow_detours','',true);
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.publish_priced_offer(jsonb,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_priced_offer(jsonb,uuid,jsonb) TO authenticated;

-- Precise quick-ride geometry is only available to its participants, never the public radar.
CREATE OR REPLACE FUNCTION public.quick_ride_map_context(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE q public.professional_quick_rides%ROWTYPE; driver_point jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.professional_quick_rides WHERE id=p_id;
 IF NOT FOUND OR (q.passenger_id<>auth.uid() AND q.driver_id IS DISTINCT FROM auth.uid()) THEN
  RAISE EXCEPTION 'Ride unavailable' USING ERRCODE='42501';
 END IF;
 IF q.status IN ('ACCEPTED','ARRIVED','IN_PROGRESS') THEN
  SELECT jsonb_build_object('lat',l.lat,'lng',l.lng,'seenAt',l.updated_at) INTO driver_point
  FROM public.professional_driver_locations l
  JOIN public.professional_driver_authorizations a ON a.user_id=l.user_id AND a.approved
  JOIN public.professional_presence p ON p.user_id=l.user_id AND p.is_available
  WHERE l.user_id=q.driver_id AND l.municipality=q.municipality AND p.municipality=q.municipality
   AND l.updated_at>now()-interval '90 seconds' AND p.last_seen_at>now()-interval '90 seconds';
 END IF;
 RETURN jsonb_build_object('id',q.id,'status',CASE WHEN q.status='SEARCHING' AND q.expires_at<now() THEN 'EXPIRED' ELSE q.status END,
  'origin',jsonb_build_object('lat',q.origin_lat,'lng',q.origin_lng),
  'destination',jsonb_build_object('lat',q.destination_lat,'lng',q.destination_lng),
  'driver',driver_point);
END;$$;
REVOKE ALL ON FUNCTION public.quick_ride_map_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.quick_ride_map_context(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
