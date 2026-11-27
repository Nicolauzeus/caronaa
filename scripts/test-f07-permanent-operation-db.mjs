import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Disposable local cluster only; NEVER connect to deployment or existing DB.
if (process.getuid?.() === 0) throw new Error("Run as a normal user, not root.");
const root = fileURLToPath(new URL("../", import.meta.url));
const bin = process.env["POSTGRES_BIN"] || "/bin";
const dir = mkdtempSync(join(tmpdir(), "caronaa-f07-permanent-"));
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
  sql(readFileSync(join(root, "scripts/tests/f07-permanent-operation.setup.sql"), "utf8"));
  const migration = readFileSync(join(root, "scripts/sql/f07-public-operation-permanent.proposed.sql"), "utf8");
  sql(migration);
  const assertions = readFileSync(join(root, "scripts/tests/f07-permanent-operation.assertions.sql"), "utf8");
  sql(assertions);
  // A reapply must abort before changing controls rather than silently resetting suspension.
  const repeat = spawnSync(join(bin, "psql"), ["-X", "-h", dir, "-p", "55439", "-U", userInfo().username, "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { cwd: root, env, input: migration, encoding: "utf8" });
  if (repeat.status === 0 || !repeat.stderr.includes("Operation control already exists")) throw new Error("Repeat migration did not fail safely");
  const count = (assertions.match(/SELECT public\.fixture_(assert|reject)\(/g) || []).length + 1;
  console.log(`PASS: ${count} local SQL assertions: permanent default, 34 coverage combinations, zero-driver quoted request/30min/idempotence, admin roles/audit/suspension, unchanged snapshots, quote expiry and retired shortcuts. Minimal schema with real commercial function bodies; underlying request engine is a fixture, not a full production E2E.`);
} finally {
  if (started) run("pg_ctl", ["-D", join(dir, "data"), "-m", "fast", "-w", "stop"]);
  rmSync(dir, { recursive: true, force: true });
}
