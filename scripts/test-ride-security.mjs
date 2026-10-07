import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort())
    apply(join("drizzle/migrations", file));
  console.log("Migrations aplicadas em PostgreSQL isolado.");
  const result = apply("src/test/ride-security.integration.sql");
  const assertions = (result.stderr.match(/NOTICE:  PASS:/g) || []).length;
  console.log(`${assertions} verificacoes de seguranca passaram em PostgreSQL real.`);
  if (process.argv.includes("--routines")) {
    const routines = apply("src/test/ride-routines.integration.sql");
    console.log(
      `${(routines.stderr.match(/NOTICE:  PASS:/g) || []).length} verificacoes de rotinas passaram em PostgreSQL real.`,
    );
  }
} finally {
  if (started) run("pg_ctl", ["-D", database, "-m", "fast", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
