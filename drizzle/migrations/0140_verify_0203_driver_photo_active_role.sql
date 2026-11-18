-- Read-only verification after the sole authorized pending migration 0203.
-- No application data, grants, policies or professional authorizations are modified.
DO $verify$
DECLARE
  v_function oid := to_regprocedure('public.prevent_driver_avatar_removal()');
  v_avatar smallint;
  v_role smallint;
BEGIN
  IF v_function IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = v_function
      AND p.prorettype = 'trigger'::regtype AND p.pronargs = 0
      AND p.prosecdef AND p.provolatile = 'v'
      AND p.proconfig = ARRAY['search_path=""']::text[]
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND md5(p.prosrc) = 'daf1c41b56a046dc301e510f8dabb5a5'
      AND p.proacl::text = '{postgres=X/postgres,service_role=X/postgres}'
  ) THEN
    RAISE EXCEPTION '0203 verification failed: guard definition or permissions mismatch';
  END IF;
  SELECT attnum INTO v_avatar FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attname = 'avatar_url' AND NOT attisdropped;
  SELECT attnum INTO v_role FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attname = 'active_role' AND NOT attisdropped;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.profiles'::regclass
      AND t.tgname = 'profile_driver_avatar_required' AND NOT t.tgisinternal
      AND t.tgfoid = v_function AND t.tgtype = 19 AND t.tgenabled = 'O'
      AND t.tgattr::text = v_avatar::text || ' ' || v_role::text AND t.tgqual IS NULL
      AND obj_description(t.oid, 'pg_trigger') =
        'Foto obrigatória no papel MOTORISTA e nos cadastros profissionais; troca permitida, remoção impedida.'
  ) THEN
    RAISE EXCEPTION '0203 verification failed: trigger mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid = 'public.profiles'::regclass
      AND c.relrowsecurity AND NOT c.relforcerowsecurity
      AND pg_get_userbyid(c.relowner) = 'postgres'
      AND c.relacl::text = '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,sandbox_exec=ar/postgres}'
  ) OR (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.profiles'::regclass) <> 3 THEN
    RAISE EXCEPTION '0203 verification failed: profile security changed';
  END IF;
  IF (SELECT count(*) FROM public.profiles) <> 84 THEN
    RAISE EXCEPTION '0203 verification failed: profile count differs from preflight';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_active_role_check' AND convalidated
      AND pg_get_constraintdef(oid) = 'CHECK ((active_role = ANY (ARRAY[''PASSAGEIRO''::text, ''MOTORISTA''::text])))'
  ) THEN
    RAISE EXCEPTION '0203 verification failed: active role constraint mismatch';
  END IF;
END;
$verify$;