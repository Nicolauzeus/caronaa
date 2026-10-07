-- Local Supabase platform prerequisites; application tables/functions come from real migrations.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE ROLE supabase_auth_admin;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  phone text,
  phone_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, supabase_auth_admin;
CREATE TABLE public.teste_backup_caronaa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL,
  email text,
  origem text,
  observacao text,
  criado_em timestamptz DEFAULT now()
);
