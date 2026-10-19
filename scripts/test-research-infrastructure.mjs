import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// pg_virtualenv creates and destroys a local cluster and overrides connection variables.
// No deployment credentials or production database URL are read by this test.
const read = (name) =>
  readFileSync(new URL(`../drizzle/migrations/${name}`, import.meta.url), "utf8");
const bootstrap = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111',now()),('22222222-2222-4222-8222-222222222222',now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.has_role(id uuid,role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(id='11111111-1111-4111-8111-111111111111'::uuid AND role='admin',false) $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
CREATE TABLE public.form_submissions(submission_id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.crm_leads(id uuid,source_form_id uuid);
CREATE TABLE public.partner_pilots(id uuid,research_form_id uuid);
`;
const names = [
  "0065_research_forms_catalog.sql",
  "0066_research_form_draft_edit_permissions.sql",
  "0070_research_answers.sql",
  "0072_research_response_validation.sql",
  "0076_research_answer_idempotency.sql",
  "0077_research_public_availability.sql",
  "0079_research_duplicate_form.sql",
];
const functions = read("0089_research_builder_branding_atomic_publish.sql").split(
  "CREATE OR REPLACE FUNCTION public.publish_research_form",
)[1];
const sql =
  bootstrap +
  names.map(read).join("\n") +
  "\nCREATE OR REPLACE FUNCTION public.publish_research_form" +
  functions +
  read("0092_research_publication_and_safe_removal.sql") +
  read("0093_research_smart_validation_participation_badges.sql") +
  read("0095_reusable_research_infrastructure.sql") +
  readFileSync(
    new URL("../tests/research-infrastructure.integration.sql", import.meta.url),
    "utf8",
  ) +
  // The corporate-only RLS migration is tested in the same disposable cluster.
  // No production endpoint/credentials are used, and 0099 preserves 0097/0098 BI semantics.
  read("0099_corporate_internal_research_access.sql") +
  readFileSync(
    new URL("../tests/research-corporate-access.integration.sql", import.meta.url),
    "utf8",
  );
const result = spawnSync("pg_virtualenv", ["psql", "-X", "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
