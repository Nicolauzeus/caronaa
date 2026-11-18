-- Keep a driver's existing profile photo non-empty.
-- Does not grant professional dispatch permission or auto-approve applications.
-- Compatible with incomplete legacy profiles: unrelated profile edits remain possible.
CREATE OR REPLACE FUNCTION public.prevent_driver_avatar_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $guard$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     AND NULLIF(btrim(coalesce(NEW.avatar_url, '')), '') IS NULL
     AND (
       EXISTS (
         SELECT 1 FROM public.user_onboarding_progress op
         WHERE op.user_id = OLD.id AND op.usage_role IN ('MOTORISTA','AMBOS')
       )
       OR EXISTS (
         SELECT 1 FROM public.professional_mototaxi_profiles mp
         WHERE mp.user_id = OLD.id
       )
       OR EXISTS (
         SELECT 1 FROM public.professional_driver_authorizations pa
         WHERE pa.user_id = OLD.id
       )
       OR EXISTS (
         SELECT 1 FROM public.professional_access_requests ar
         WHERE ar.user_id = OLD.id
       )
     )
  THEN
    RAISE EXCEPTION 'A foto é obrigatória para motoristas; substitua por uma nova foto.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.prevent_driver_avatar_removal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profile_driver_avatar_required ON public.profiles;
CREATE TRIGGER profile_driver_avatar_required
BEFORE UPDATE OF avatar_url ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_driver_avatar_removal();

COMMENT ON TRIGGER profile_driver_avatar_required ON public.profiles IS
  'Motorista pode substituir foto, mas nunca apagá-la. Não confere autorização profissional.';
