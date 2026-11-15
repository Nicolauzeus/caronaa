REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys FROM anon, authenticated;
GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated;
DO $$ BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Reference data readable" ON public.spatial_ref_sys FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'not owner; write privileges revoked instead';
END $$;