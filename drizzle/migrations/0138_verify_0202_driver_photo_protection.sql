-- Verification only: executes after the authorized pending migration 0202.
-- Does not modify application data, grants, policies or professional authorization.
DO $verify$
DECLARE
  v_function oid := to_regprocedure('public.prevent_driver_avatar_removal()');
  v_avatar_attnum smallint;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION '0202 verification failed: guard function missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = v_function
      AND p.prorettype = 'trigger'::regtype AND p.pronargs = 0
      AND p.prosecdef AND p.provolatile = 'v'
      AND p.proconfig = ARRAY['search_path=""']::text[]
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND md5(p.prosrc) = 'c6d0080ed94b7dbe261de2d0a08c3c96'
  ) THEN
    RAISE EXCEPTION '0202 verification failed: function definition or security mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = v_function AND a.privilege_type = 'EXECUTE'
      AND (a.grantee = 0 OR a.grantee IN (
        SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
      ))
  ) THEN
    RAISE EXCEPTION '0202 verification failed: unexpected callable guard grant';
  END IF;
  SELECT attnum INTO v_avatar_attnum FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attname = 'avatar_url' AND NOT attisdropped;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.profiles'::regclass
      AND t.tgname = 'profile_driver_avatar_required' AND NOT t.tgisinternal
      AND t.tgfoid = v_function AND t.tgtype = 19 AND t.tgenabled = 'O'
      AND t.tgattr::text = v_avatar_attnum::text AND t.tgqual IS NULL
      AND obj_description(t.oid, 'pg_trigger') =
        'Motorista pode substituir foto, mas nunca apagá-la. Não confere autorização profissional.'
  ) THEN
    RAISE EXCEPTION '0202 verification failed: trigger mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid = 'public.profiles'::regclass
      AND c.relrowsecurity AND NOT c.relforcerowsecurity
      AND pg_get_userbyid(c.relowner) = 'postgres'
      AND c.relacl::text = '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,sandbox_exec=ar/postgres}'
  ) OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.profiles'::regclass) <> 3 THEN
    RAISE EXCEPTION '0202 verification failed: profile security changed';
  END IF;
  IF (SELECT count(*) FROM public.profiles) <> 84 THEN
    RAISE EXCEPTION '0202 verification failed: profile count differs from preflight';
  END IF;
END;
$verify$;