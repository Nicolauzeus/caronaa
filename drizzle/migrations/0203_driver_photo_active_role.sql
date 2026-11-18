-- Extend mandatory-driver-photo guard to the active CARONAA driver role.
-- Existing photo replacements remain permitted. This does not authorize F07.
CREATE OR REPLACE FUNCTION public.prevent_driver_avatar_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $guard$
DECLARE
  v_driver boolean;
BEGIN
  v_driver :=
    OLD.active_role = 'MOTORISTA' OR NEW.active_role = 'MOTORISTA'
    OR EXISTS (
      SELECT 1 FROM public.user_onboarding_progress op
      WHERE op.user_id = OLD.id AND op.usage_role IN ('MOTORISTA','AMBOS')
    )
    OR EXISTS (
      SELECT 1 FROM public.professional_mototaxi_profiles mp WHERE mp.user_id = OLD.id
    )
    OR EXISTS (
      SELECT 1 FROM public.professional_driver_authorizations pa WHERE pa.user_id = OLD.id
    )
    OR EXISTS (
      SELECT 1 FROM public.professional_access_requests ar WHERE ar.user_id = OLD.id
    );

  IF v_driver AND NULLIF(btrim(coalesce(NEW.avatar_url, '')), '') IS NULL
     AND (
       NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
       OR NEW.active_role IS DISTINCT FROM OLD.active_role AND NEW.active_role = 'MOTORISTA'
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
BEFORE UPDATE OF avatar_url, active_role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_driver_avatar_removal();

COMMENT ON TRIGGER profile_driver_avatar_required ON public.profiles IS
  'Foto obrigatória no papel MOTORISTA e nos cadastros profissionais; troca permitida, remoção impedida.';
