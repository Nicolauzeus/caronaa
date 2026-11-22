-- 0237: complete the PostGIS spatial_ref_sys ACL remediation as its owner.
-- IMPORTANT: On Lovable Cloud this table is owned by supabase_admin.
-- Running REVOKE as an unrelated postgres role may succeed without changing
-- grants issued by supabase_admin. This migration MUST fail closed in that case.
-- Execute as table owner supabase_admin or via the provider's privileged migration runner.
BEGIN;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon,authenticated,PUBLIC;
DO $verify_acl$
DECLARE v_priv text; v_role text;
BEGIN
 FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOREACH v_priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
     IF has_table_privilege(v_role,'public.spatial_ref_sys',v_priv) THEN
       RAISE EXCEPTION 'ACL_REVOKE_NOT_EFFECTIVE: % retains % on spatial_ref_sys. Execute as supabase_admin (table owner).',
         v_role,v_priv USING ERRCODE='42501';
     END IF;
   END LOOP;
 END LOOP;
END;
$verify_acl$;
COMMIT;
