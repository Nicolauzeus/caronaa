-- Guard only: no DDL/DML. Runs after 0161 and 0201 in the same migrator transaction;
-- any failed assertion rolls back the whole batch.
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_onboarding_progress'
      AND column_name='tutorial_eligible' AND is_nullable='NO' AND column_default='false') THEN
    RAISE EXCEPTION '0201 check failed: tutorial_eligible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_onboarding_progress'
      AND column_name='tutorial_seen_at' AND data_type='timestamp with time zone') THEN
    RAISE EXCEPTION '0201 check failed: tutorial_seen_at';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.user_onboarding_progress'::regclass
      AND conname='onboarding_completed_requires_fields'
      AND pg_get_constraintdef(oid) NOT LIKE '%region_code%') THEN
    RAISE EXCEPTION '0201 check failed: constraint';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_onboarding_progress'::regclass) THEN
    RAISE EXCEPTION 'RLS disabled on user_onboarding_progress';
  END IF;
  IF has_function_privilege('anon','public.admin_professional_access_queue()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.admin_professional_access_queue()','EXECUTE')
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.admin_professional_access_queue()'::regprocedure) THEN
    RAISE EXCEPTION '0161 check failed: function flags/ACL';
  END IF;
END
$verify$;