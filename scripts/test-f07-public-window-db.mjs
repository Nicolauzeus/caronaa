import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// LOCAL disposable cluster only. Never use a deployment URL or existing DB.
if (process.getuid?.() === 0) throw new Error("Run as a normal user, not root.");
const root = fileURLToPath(new URL("../", import.meta.url));
const bin = process.env["POSTGRES_BIN"] || "/bin";
const dir = mkdtempSync(join(tmpdir(), "caronaa-f07-public-"));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG")));
const run = (name, args, input) => {
  const result = spawnSync(join(bin, name), args, { cwd: root, env, input, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return result;
};
const sql = text => run("psql", ["-X", "-h", dir, "-p", "55439", "-U", userInfo().username, "-d", "postgres", "-v", "ON_ERROR_STOP=1"], text);
let started = false;
try {
  run("initdb", ["-D", join(dir, "data"), "--auth=trust", "--no-locale", "--encoding=UTF8"]);
  run("pg_ctl", ["-D", join(dir, "data"), "-l", join(dir, "log"), "-o", `-F -k "${dir}" -c listen_addresses='' -p 55439`, "-w", "start"]);
  started = true;
  sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.caronaa_f07_pilot_control(id boolean PRIMARY KEY,enabled boolean,updated_at timestamptz);
    INSERT INTO public.caronaa_f07_pilot_control VALUES(true,true,now());
    CREATE FUNCTION public.caronaa_f07_test_dispatch_allowed() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT now() $$;
    GRANT EXECUTE ON FUNCTION public.caronaa_f07_pilot_activate_driver(uuid,text) TO service_role;
    CREATE FUNCTION public.caronaa_f07_test_self_radar(uuid,text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE TABLE public.caronaa_f07_simulated_driver_positions(id integer);
    INSERT INTO public.caronaa_f07_simulated_driver_positions VALUES(1);
    GRANT ALL ON public.caronaa_f07_simulated_driver_positions TO service_role;
    CREATE FUNCTION public.fixture_region_allowed() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT public.caronaa_f07_test_dispatch_allowed() $$;
    GRANT EXECUTE ON FUNCTION public.fixture_region_allowed() TO authenticated;
  `);
  sql(readFileSync(join(root, "scripts/sql/f07-public-operation-90-days.proposed.sql"), "utf8"));
  sql(`
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM public.caronaa_f07_operation_control WHERE enabled AND expires_at=activated_at+interval '90 days') THEN RAISE EXCEPTION '90-day rule failed'; END IF;
      IF NOT public.caronaa_f07_test_dispatch_allowed() THEN RAISE EXCEPTION 'Public window not enabled'; END IF;
      IF EXISTS(SELECT 1 FROM public.caronaa_f07_pilot_control WHERE enabled) THEN RAISE EXCEPTION 'Old switch active'; END IF;
      IF has_table_privilege('authenticated','public.caronaa_f07_operation_control','UPDATE') OR has_table_privilege('anon','public.caronaa_f07_operation_control','SELECT') THEN RAISE EXCEPTION 'Client can access control'; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.caronaa_f07_operation_control'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'RLS missing'; END IF;
      IF has_function_privilege('service_role','public.caronaa_f07_pilot_activate_driver(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Temporary activation callable'; END IF;
      IF has_function_privilege('service_role','public.caronaa_f07_test_self_radar(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Diagnostic callable'; END IF;
      IF has_table_privilege('service_role','public.caronaa_f07_simulated_driver_positions','INSERT') THEN RAISE EXCEPTION 'Simulation writable'; END IF;
      IF (SELECT count(*) FROM public.caronaa_f07_simulated_driver_positions)<>1 THEN RAISE EXCEPTION 'Archive deleted'; END IF;
    END $$;
    SET ROLE authenticated;
    DO $$ BEGIN IF NOT public.fixture_region_allowed() THEN RAISE EXCEPTION 'Authenticated caller lost coverage wrapper'; END IF; END $$;
    RESET ROLE;
    UPDATE public.caronaa_f07_operation_control SET enabled=false;
    DO $$ BEGIN IF public.caronaa_f07_test_dispatch_allowed() THEN RAISE EXCEPTION 'Disabled window allowed'; END IF; END $$;
    UPDATE public.caronaa_f07_operation_control SET enabled=true,activated_at=now()-interval '2 days',expires_at=now()-interval '1 day';
    DO $$ BEGIN IF public.caronaa_f07_test_dispatch_allowed() THEN RAISE EXCEPTION 'Expired window allowed'; END IF; END $$;
    DELETE FROM public.caronaa_f07_operation_control;
    DO $$ BEGIN IF public.caronaa_f07_test_dispatch_allowed() THEN RAISE EXCEPTION 'Missing window allowed'; END IF; END $$;
  `);
  console.log("PASS: public 90-day window, closed disabled/expired/missing states, authenticated compatibility, RLS/grants, retired shortcuts and preserved archive (local minimal schema only).");
} finally {
  if (started) run("pg_ctl", ["-D", join(dir, "data"), "-m", "fast", "-w", "stop"]);
  rmSync(dir, { recursive: true, force: true });
}