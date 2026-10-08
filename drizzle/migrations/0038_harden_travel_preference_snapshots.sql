CREATE OR REPLACE FUNCTION public.snapshot_travel_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inherited jsonb; requested text;
BEGIN
 IF TG_OP='INSERT' AND NEW.travel_preferences IS NULL THEN
  IF TG_TABLE_NAME <> 'ride_routines' THEN
   IF NEW.routine_id IS NOT NULL THEN SELECT travel_preferences INTO inherited FROM public.ride_routines WHERE routine_id=NEW.routine_id; END IF;
  END IF;
  IF inherited IS NULL THEN
   requested:=current_setting('caronaa.travel_preferences',true);
   IF requested IS NOT NULL AND requested<>'' AND NEW.user_id=auth.uid() THEN inherited:=requested::jsonb;
   ELSE SELECT CASE WHEN travel_preferences_consented_at IS NOT NULL THEN travel_preferences END INTO inherited FROM public.profiles WHERE id=NEW.user_id; END IF;
  END IF;
  NEW.travel_preferences:=public.validate_travel_preferences(coalesce(inherited,'{}'));
 END IF;
 IF NEW.travel_preferences IS NOT NULL THEN NEW.travel_preferences:=public.validate_travel_preferences(NEW.travel_preferences); END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.ride_preferences_compatible(q jsonb,o jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT (coalesce(q->>'smoking','any')='any' OR coalesce(q->>'smoking','any')=coalesce(o->>'smoking','any'))
 AND (coalesce(q->>'pets','any')<>'yes' OR coalesce(o->>'pets','any')='yes')
 AND (coalesce(q->>'pets','any')<>'no' OR coalesce(o->>'pets','any')<>'yes')
 AND coalesce((q->>'luggage')::integer,0)<=coalesce((o->>'luggage')::integer,0);
$$;
CREATE FUNCTION public.get_offer_preference_bonuses(p_offer_ids uuid[]) RETURNS TABLE(offer_id uuid,bonus integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF cardinality(p_offer_ids)>30 THEN RAISE EXCEPTION 'Too many offers'; END IF;
 RETURN QUERY SELECT o.offer_id,public.travel_preference_bonus(public.get_my_travel_preferences(),o.travel_preferences) FROM public.ride_offers o WHERE o.offer_id=ANY(p_offer_ids) AND o.status='available' AND o.user_id<>auth.uid() AND public.ride_preferences_compatible(public.get_my_travel_preferences(),o.travel_preferences);
END; $$;
REVOKE ALL ON FUNCTION public.get_offer_preference_bonuses(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_offer_preference_bonuses(uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';