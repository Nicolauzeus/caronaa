import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Dedicated ephemeral database. Never connects to production.
const read = (filename) => readFileSync(
  new URL("../drizzle/migrations/" + filename, import.meta.url), "utf8",
);
const cohort = read("0108_research_launch_cohorts_profile_access.sql");
const policyStart = cohort.indexOf(
  "CREATE OR REPLACE FUNCTION public.research_launch_wait_eligible("
);
const policyEnd = cohort.indexOf(
  "CREATE OR REPLACE FUNCTION public.get_my_research_launch_state()"
);
if (policyStart < 0 || policyEnd <= policyStart) {
  throw new Error("Cannot locate established research launch cohort policy");
}
const bootstrap = [
  "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;",
  "CREATE SCHEMA auth;",
  "CREATE TABLE auth.users(id uuid PRIMARY KEY, created_at timestamptz NOT NULL);",
  "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;",
  "CREATE TABLE public.user_roles(user_id uuid NOT NULL,role text NOT NULL);",
  "CREATE TABLE public.research_forms(id uuid PRIMARY KEY,code text NOT NULL,title text NOT NULL,nature text NOT NULL,created_at timestamptz NOT NULL);",
  "CREATE TABLE public.research_form_versions(form_id uuid NOT NULL,published_at timestamptz);",
  "CREATE TABLE public.research_configurations(form_id uuid PRIMARY KEY,settings jsonb NOT NULL);",
  "CREATE TABLE public.research_launch_releases(form_id uuid PRIMARY KEY,released_at timestamptz);",
  "CREATE TABLE public.research_participation_badges(user_id uuid NOT NULL,form_id uuid NOT NULL,answer_id uuid NOT NULL,verified_at timestamptz NOT NULL DEFAULT now());",
  "CREATE TABLE public.research_journeys(answer_id uuid NOT NULL,journey jsonb NOT NULL);",
  "CREATE TABLE public.form_submissions(submission_id uuid PRIMARY KEY,user_id uuid,research_form_id uuid,created_at timestamptz NOT NULL DEFAULT now(),tipo_usuario text,origem_trajeto text,destino_trajeto text,faixa_horario text);",
  "CREATE TABLE public.form_submission_account_links(submission_id uuid NOT NULL,user_id uuid NOT NULL,confirmed_at timestamptz);",
  "CREATE OR REPLACE FUNCTION public.research_launch_participant(p_form uuid,p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT p_user IS NOT NULL AND (EXISTS (SELECT 1 FROM public.research_participation_badges b WHERE b.form_id=p_form AND b.user_id=p_user) OR EXISTS (SELECT 1 FROM public.form_submissions fs JOIN public.form_submission_account_links link ON link.submission_id=fs.submission_id WHERE fs.research_form_id=p_form AND fs.user_id=p_user AND link.user_id=p_user AND link.confirmed_at IS NOT NULL)) $$;",
  "REVOKE ALL ON FUNCTION public.research_launch_participant(uuid,uuid) FROM PUBLIC,anon,authenticated;",
].join("\n");
const sql = [
  bootstrap,
  cohort.slice(policyStart, policyEnd),
  read("0115_multi_launch_participation_visibility.sql"),
  readFileSync(new URL("../tests/research-multi-launch.integration.sql", import.meta.url), "utf8"),
].join("\n");
const result = spawnSync("pg_virtualenv", ["psql", "-X", "-v", "ON_ERROR_STOP=1"], {
  input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
