ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS travel_preferences jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS travel_preferences_consented_at timestamptz;
ALTER TABLE public.ride_offers ADD COLUMN IF NOT EXISTS travel_preferences jsonb;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS travel_preferences jsonb;
ALTER TABLE public.ride_routines ADD COLUMN IF NOT EXISTS travel_preferences jsonb;
CREATE FUNCTION public.validate_travel_preferences(p jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('conversation','music','smoking','pets','luggage')) OR coalesce(p->>'conversation','any') NOT IN ('any','quiet','chat') OR coalesce(p->>'music','any') NOT IN ('any','off','on') OR coalesce(p->>'smoking','any') NOT IN ('any','no','yes') OR coalesce(p->>'pets','any') NOT IN ('any','no','yes') OR coalesce(p->>'luggage','0') !~ '^[0-6]$' THEN RAISE EXCEPTION 'Invalid travel preferences'; END IF;
 RETURN jsonb_build_object('conversation',coalesce(p->>'conversation','any'),'music',coalesce(p->>'music','any'),'smoking',coalesce(p->>'smoking','any'),'pets',coalesce(p->>'pets','any'),'luggage',coalesce((p->>'luggage')::integer,0));
END; $$;
CREATE FUNCTION public.get_my_travel_preferences() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 RETURN (SELECT CASE WHEN travel_preferences_consented_at IS NULL THEN public.validate_travel_preferences('{}') ELSE travel_preferences END FROM public.profiles WHERE id=auth.uid());
END; $$;
CREATE FUNCTION public.save_my_travel_preferences(p_preferences jsonb,p_consent boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_consent IS NULL THEN RAISE EXCEPTION 'Consent required'; END IF;
 UPDATE public.profiles SET travel_preferences=CASE WHEN p_consent THEN public.validate_travel_preferences(p_preferences) ELSE '{}'::jsonb END,travel_preferences_consented_at=CASE WHEN p_consent THEN now() ELSE NULL END WHERE id=auth.uid();
END; $$;
CREATE FUNCTION public.ride_preferences_compatible(q jsonb,o jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT (coalesce(q->>'smoking','any')='any' OR q->>'smoking'=o->>'smoking')
 AND (coalesce(q->>'pets','any')<>'yes' OR o->>'pets'='yes')
 AND (coalesce(q->>'pets','any')<>'no' OR coalesce(o->>'pets','any')<>'yes')
 AND coalesce((q->>'luggage')::integer,0)<=coalesce((o->>'luggage')::integer,0);
$$;
CREATE FUNCTION public.travel_preference_bonus(q jsonb,o jsonb) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN coalesce(q->>'conversation','any')<>'any' AND q->>'conversation'=o->>'conversation' THEN 3 ELSE 0 END + CASE WHEN coalesce(q->>'music','any')<>'any' AND q->>'music'=o->>'music' THEN 3 ELSE 0 END;
$$;
CREATE FUNCTION public.snapshot_travel_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inherited jsonb; requested text;
BEGIN
 IF TG_OP='INSERT' AND NEW.travel_preferences IS NULL THEN
  IF TG_TABLE_NAME<>'ride_routines' AND NEW.routine_id IS NOT NULL THEN SELECT travel_preferences INTO inherited FROM public.ride_routines WHERE routine_id=NEW.routine_id;
  ELSE
   requested:=current_setting('caronaa.travel_preferences',true);
   IF requested IS NOT NULL AND requested<>'' AND NEW.user_id=auth.uid() THEN inherited:=requested::jsonb;
   ELSE SELECT CASE WHEN travel_preferences_consented_at IS NOT NULL THEN travel_preferences END INTO inherited FROM public.profiles WHERE id=NEW.user_id; END IF;
  END IF;
  NEW.travel_preferences:=public.validate_travel_preferences(coalesce(inherited,'{}'));
 END IF;
 IF NEW.travel_preferences IS NOT NULL THEN NEW.travel_preferences:=public.validate_travel_preferences(NEW.travel_preferences); END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER a_snapshot_travel_preferences BEFORE INSERT OR UPDATE OF travel_preferences ON public.ride_offers FOR EACH ROW EXECUTE FUNCTION public.snapshot_travel_preferences();
CREATE TRIGGER a_snapshot_travel_preferences BEFORE INSERT OR UPDATE OF travel_preferences ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.snapshot_travel_preferences();
CREATE TRIGGER a_snapshot_travel_preferences BEFORE INSERT OR UPDATE OF travel_preferences ON public.ride_routines FOR EACH ROW EXECUTE FUNCTION public.snapshot_travel_preferences();
CREATE FUNCTION public.create_preferred_ride(p_kind text,p_details jsonb,p_preferences jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM set_config('caronaa.travel_preferences',CASE WHEN p_preferences IS NULL THEN '' ELSE public.validate_travel_preferences(p_preferences)::text END,true);
 IF p_kind='request' THEN
 result:=public.create_ride_request(p_details->>'origin',p_details->>'destination',(p_details->>'rideDate')::date,(p_details->>'departureTime')::time,coalesce((p_details->>'passengerCount')::integer,1),coalesce((p_details->>'timeToleranceMinutes')::integer,15),(p_details->>'originLat')::float8,(p_details->>'originLng')::float8,(p_details->>'destinationLat')::float8,(p_details->>'destinationLng')::float8,(p_details->>'price')::numeric);
 ELSIF p_kind='offer' THEN
 result:=public.create_ride_offer(p_details->>'origin',p_details->>'destination',(p_details->>'rideDate')::date,(p_details->>'departureTime')::time,coalesce((p_details->>'availableSeats')::integer,1),coalesce((p_details->>'timeToleranceMinutes')::integer,15),(p_details->>'originLat')::float8,(p_details->>'originLng')::float8,(p_details->>'destinationLat')::float8,(p_details->>'destinationLng')::float8,coalesce((p_details->>'totalPrice')::numeric,30),coalesce(p_details->>'passengerGenderPreference','ANY'));
 ELSE RAISE EXCEPTION 'Invalid role'; END IF;
 PERFORM set_config('caronaa.travel_preferences','',true);
 RETURN result;
END; $$;
DO $repair$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)','AND public.ride_preferences_compatible(request_row.travel_preferences,travel_preferences) AND (passenger_gender_preference = ''ANY'' OR passenger_gender_preference = (SELECT gender FROM public.profiles WHERE id=request_row.user_id)) AND (p_preferred_offer_id IS NULL OR offer_id = p_preferred_offer_id)');
 definition:=replace(definition,'ORDER BY created_at, offer_id','ORDER BY (100 - least(20,abs(extract(epoch FROM (departure_time-request_row.departure_time))/60)/3) + public.travel_preference_bonus(request_row.travel_preferences,travel_preferences)) DESC, created_at, offer_id');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.search_available_ride_offers(text,text,date,time,integer,integer,integer,double precision,double precision,double precision,double precision)'::regprocedure) INTO definition;
 definition:=replace(definition,'AND o.seats_remaining > 0','AND public.ride_preferences_compatible(public.get_my_travel_preferences(),o.travel_preferences) AND (o.passenger_gender_preference=''ANY'' OR o.passenger_gender_preference=(SELECT gender FROM public.profiles WHERE id=auth.uid())) AND o.seats_remaining > 0');
 definition:=replace(definition,'ORDER BY o.ride_date, o.departure_time, o.created_at, o.offer_id','ORDER BY (100 - least(20,coalesce(abs(extract(epoch FROM (o.departure_time-p_departure_time))/60)/3,0)) + public.travel_preference_bonus(public.get_my_travel_preferences(),o.travel_preferences)) DESC, o.ride_date, o.departure_time, o.created_at, o.offer_id');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.save_ride_routine(jsonb,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'total_price,active)','total_price,active,travel_preferences)');
 definition:=replace(definition,'coalesce((p_definition->>''active'')::boolean,true))','coalesce((p_definition->>''active'')::boolean,true),CASE WHEN p_definition ? ''preferences'' THEN public.validate_travel_preferences(p_definition->''preferences'') ELSE NULL END)');
 definition:=replace(definition,'active=EXCLUDED.active,generated_on','active=EXCLUDED.active,travel_preferences=CASE WHEN p_definition ? ''preferences'' THEN EXCLUDED.travel_preferences ELSE ride_routines.travel_preferences END,generated_on');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.materialize_ride_routine(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'routine_id,routine_date)','routine_id,routine_date,travel_preferences)');
 definition:=replace(definition,'r.routine_id,day)','r.routine_id,day,r.travel_preferences)');
 definition:=replace(definition,'ON CONFLICT (routine_id,routine_date,travel_preferences)','ON CONFLICT (routine_id,routine_date)');
 definition:=replace(definition,'origin=EXCLUDED.origin,destination','travel_preferences=EXCLUDED.travel_preferences,origin=EXCLUDED.origin,destination');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.change_ride_routine_occurrence(text,uuid,boolean,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'SET origin=btrim(p_changes','SET travel_preferences=CASE WHEN p_changes ? ''preferences'' THEN public.validate_travel_preferences(p_changes->''preferences'') ELSE travel_preferences END,origin=btrim(p_changes');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.get_my_ride_routines()'::regprocedure) INTO definition;
 definition:=replace(definition,'''active'',r.active,','''active'',r.active,''preferences'',r.travel_preferences,');
 definition:=replace(definition,'''overridden'',s.routine_override,','''overridden'',s.routine_override,''preferences'',s.travel_preferences,');
 definition:=replace(definition,'status,routine_override FROM','status,routine_override,travel_preferences FROM');
 EXECUTE definition;
END $repair$;
REVOKE ALL ON FUNCTION public.get_my_travel_preferences(),public.save_my_travel_preferences(jsonb,boolean),public.create_preferred_ride(text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_travel_preferences(),public.save_my_travel_preferences(jsonb,boolean),public.create_preferred_ride(text,jsonb,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';