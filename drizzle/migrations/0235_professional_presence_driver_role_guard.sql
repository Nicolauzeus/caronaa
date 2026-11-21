-- 0235: Keep live driver presence truthful without reviving approval/GPS blocks.
-- Driver role is required; no municipal, payment or admin approval gate is added.
BEGIN;
CREATE OR REPLACE FUNCTION public.set_professional_presence(p_available boolean, p_municipality text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF coalesce(p_available,false) AND NOT EXISTS (
   SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active_role='MOTORISTA'
 ) THEN
   RAISE EXCEPTION 'DRIVER_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- Availability may not be self-declared by unverified professionals once verification workflow is enabled.
 INSERT INTO public.professional_presence(user_id,is_available,last_seen_at,municipality,updated_at)
 VALUES(auth.uid(),p_available,now(),left(nullif(btrim(p_municipality),''),120),now())
 ON CONFLICT(user_id) DO UPDATE SET is_available=EXCLUDED.is_available,last_seen_at=now(),
 municipality=coalesce(EXCLUDED.municipality,professional_presence.municipality),updated_at=now();
END $function$;
REVOKE ALL ON FUNCTION public.set_professional_presence(boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_professional_presence(boolean,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
