-- Read-only post-migration acceptance checks for 0236 + owner-only 0237.
-- Secure output: boolean flags only, no personal data.
SELECT
  NOT has_table_privilege('anon','public.spatial_ref_sys','SELECT') AS spatial_anon_isolated,
  NOT has_table_privilege('authenticated','public.spatial_ref_sys','SELECT') AS spatial_authenticated_isolated,
  NOT has_table_privilege('anon','public.spatial_ref_sys','INSERT') AS spatial_anon_cannot_write,
  NOT has_function_privilege('anon','public.find_on_route_matches(double precision,double precision,double precision,double precision,date,time without time zone,integer,boolean)','EXECUTE') AS route_anon_revoked,
  has_function_privilege('authenticated','public.find_on_route_matches(double precision,double precision,double precision,double precision,date,time without time zone,integer,boolean)','EXECUTE') AS route_auth_granted,
  NOT has_function_privilege('anon','public.is_driver_ready(uuid)','EXECUTE') AS driver_readiness_anon_revoked,
  NOT has_function_privilege('anon','public.get_form_pain_analysis(timestamptz,timestamptz,text,text,text,public.form_tipo_usuario,text,text,numeric,numeric,numeric,numeric)','EXECUTE') AS analysis_anon_revoked,
  NOT has_function_privilege('anon','public.confirm_form_account_activation(uuid,jsonb)','EXECUTE') AS activation_anon_revoked,
  position('AND user_id=auth.uid()' in pg_get_functiondef('public.confirm_form_account_activation(uuid,jsonb)'::regprocedure))>0 AS activation_owner_update_guard,
  position('Acesso negado: restrito a administradores.' in pg_get_functiondef('public.get_form_pain_analysis(timestamptz,timestamptz,text,text,text,public.form_tipo_usuario,text,text,numeric,numeric,numeric,numeric)'::regprocedure))>0 AS analysis_admin_barrier;
-- ALL ten flags must be true before declaring full security remediation complete.
