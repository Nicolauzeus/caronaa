-- F02/F03: choosing a shared-ride role is an authenticated profile preference.
-- It does not grant professional approval, presence, dispatch or radar access.
-- Also keep this migration in drizzle/migrations, the configured project runner.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role text DEFAULT 'PASSAGEIRO'
  CHECK (active_role IN ('PASSAGEIRO', 'MOTORISTA'));

-- The legacy one-argument overload calls is_driver_ready and conflicts with
-- PostgREST calls that omit the new optional parameter. Do not use CASCADE.
DROP FUNCTION IF EXISTS public.switch_user_active_role(text);

CREATE OR REPLACE FUNCTION public.switch_user_active_role(
  target_role text DEFAULT NULL,
  p_target_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_role text := NULLIF(upper(btrim(target_role)), '');
  v_legacy_role text := NULLIF(upper(btrim(p_target_role)), '');
  v_role text := COALESCE(v_target_role, v_legacy_role);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF v_target_role IS NOT NULL AND v_legacy_role IS NOT NULL
     AND v_target_role <> v_legacy_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_MISMATCH');
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('PASSAGEIRO', 'MOTORISTA') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ROLE');
  END IF;

  -- Keep the existing owner-only profiles RLS effective. Never set
  -- is_driver_eligible or mutate any professional authorization/presence table.
  UPDATE public.profiles
  SET active_role = v_role,
      updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('success', true, 'active_role', v_role);
END;
$$;

REVOKE ALL ON FUNCTION public.switch_user_active_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_user_active_role(text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.switch_user_active_role(text, text) IS
  'F02/F03 shared-ride role preference for the authenticated profile. Accepts target_role or p_target_role; does not authorize F07 professional operation.';

NOTIFY pgrst, 'reload schema';
