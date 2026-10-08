import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { buildRideRpcRepair } from "./repair-ride-rpcs.mjs";
import { buildStsRpcRepair } from "./repair-sts-rpcs.mjs";
import { tmpdir } from "node:os";
import { userInfo } from "node:os";
import { join, resolve } from "node:path";

const bin =
  process.env["POSTGRES_BIN"] ||
  ["/usr/lib/postgresql/18/bin", "/usr/lib/postgresql/17/bin"].find((path) =>
    existsSync(join(path, "initdb")),
  );
if (!bin)
  throw new Error(
    "PostgreSQL local necessario. Defina POSTGRES_BIN com o diretorio de initdb/pg_ctl/psql.",
  );
const directory = mkdtempSync(join(tmpdir(), "caronaa-security-"));
const database = join(directory, "data");
const run = (command, args) => {
  const result = spawnSync(join(bin, command), args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0)
    throw new Error(result.stderr || result.error?.message || `Falha em ${command}`);
  return result;
};
let started = false;
try {
  run("initdb", ["-D", database, "--auth=trust", "--no-locale", "--encoding=UTF8"]);
  try {
    run("pg_ctl", [
      "-D",
      database,
      "-l",
      join(directory, "postgres.log"),
      "-o",
      `-F -k ${directory} -c listen_addresses='' -p 55432`,
      "-w",
      "start",
    ]);
  } catch (error) {
    const log = join(directory, "postgres.log");
    throw new Error(`${error.message}\n${existsSync(log) ? readFileSync(log, "utf8") : ""}`);
  }
  started = true;
  const apply = (file) => {
    try {
      return run("psql", [
        "-X",
        "-h",
        directory,
        "-p",
        "55432",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        resolve(file),
      ]);
    } catch (error) {
      throw new Error(`Falha em ${file}: ${error.message}`);
    }
  };
  apply("src/test/ride-security-db-bootstrap.sql");
  for (const file of readdirSync("drizzle/migrations")
    .filter(
      (name) =>
        /^\d+.*\.sql$/.test(name) &&
        (!process.argv.includes("--sts") || !name.startsWith("0037_")) &&
        (!process.argv.includes("--rpc-repair") || Number(name.slice(0, 4)) <= 22),
    )
    .sort())
    apply(join("drizzle/migrations", file));
  if (process.argv.includes("--rpc-repair")) {
    const repair = join(directory, "rpc-repair.sql");
    writeFileSync(repair, buildRideRpcRepair());
    apply(repair);
    // Verify recovery after RPC definitions are missing from an otherwise upgraded schema.
    run("psql", [
      "-X",
      "-h",
      directory,
      "-p",
      "55432",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "DROP FUNCTION public.create_ride_offer(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric); DROP FUNCTION public.create_ride_request(text,text,date,time,integer,integer,double precision,double precision,double precision,double precision,numeric); DROP FUNCTION public.get_admin_operation_data(); DROP FUNCTION public.refresh_ride_routine_occurrences();",
    ]);
    apply(repair);
    apply(repair);
    const application = spawnSync(process.execPath, ["scripts/repair-ride-rpcs.mjs", "--apply"], {
      encoding: "utf8",
      env: {
        ...process.env,
        LOVABLE_DB_MIGRATION_URL: "postgresql:///postgres",
        PGHOST: directory,
        PGPORT: "55432",
        PGUSER: userInfo().username,
      },
    });
    if (application.error || application.status !== 0) {
      throw new Error(
        application.stderr ||
          application.error?.message ||
          "Falha na aplicacao via driver PostgreSQL",
      );
    }
    console.log("Aplicacao via driver PostgreSQL validada em banco isolado.");
    const rpc = apply("src/test/ride-rpc-repair.integration.sql");
    console.log(
      `${(rpc.stderr.match(/NOTICE:  PASS:/g) || []).length} verificacoes de recuperacao de RPC passaram em PostgreSQL real.`,
    );
  }
  console.log("Migrations aplicadas em PostgreSQL isolado.");
  const result = apply("src/test/ride-security.integration.sql");
  const assertions = (result.stderr.match(/NOTICE:  PASS:/g) || []).length;
  console.log(`${assertions} verificacoes de seguranca passaram em PostgreSQL real.`);
  if (process.argv.includes("--sts")) {
    const repair = join(directory, "sts-repair.sql");
    writeFileSync(repair, buildStsRpcRepair());
    apply(repair);
    run("psql", ["-X", "-h", directory, "-p", "55432", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "DROP FUNCTION public.get_sts_ride_seed(); DROP FUNCTION public.publish_sts_ride(uuid,text,jsonb);"]);
    apply(repair);
    apply(repair);
    console.log("Reparo STS validado após remoção das RPCs e aplicação repetida.");
    const sts = apply("src/test/sts-publication.integration.sql");
    console.log(`${(sts.stderr.match(/NOTICE:  PASS:/g) || []).length} verificacoes STS passaram em PostgreSQL real.`);
  }
  if (process.argv.includes("--routines")) {
    const routines = apply("src/test/ride-routines.integration.sql");
    console.log(
      `${(routines.stderr.match(/NOTICE:  PASS:/g) || []).length} verificacoes de rotinas passaram em PostgreSQL real.`,
    );
  }
  if (process.argv.includes("--notifications")) {
    const notifications = apply("src/test/notification-realtime.integration.sql");
    console.log(
      `${(notifications.stderr.match(/NOTICE:  PASS:/g) || []).length} verificacoes de Realtime passaram em PostgreSQL real.`,
    );
  }
} finally {
  if (started) run("pg_ctl", ["-D", database, "-m", "fast", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
