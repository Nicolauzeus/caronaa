import {readFileSync, mkdtempSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

// Same disposable PostgreSQL runner used by test-intelligent-match.mjs.
// Never accepts a deployment connection string or writes to a connected project.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = [
  "src/test/scheduled-readback-db-bootstrap.sql",
  "drizzle/migrations/0160_f03_scheduled_offer_readback.sql",
  "src/test/scheduled-readback.integration.sql",
].map(read).join("\n");
const directory = mkdtempSync(join(tmpdir(), "caronaa-scheduled-readback-"));
try {
  const fixture = join(directory, "integration.sql");
  writeFileSync(fixture, sql);
  const result = spawnSync("pg_virtualenv", ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", fixture], {
    encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stdout.write(result.stdout.slice(-1500));
  } else {
    console.log(`${(result.stderr.match(/NOTICE:  PASS:/g) || []).length} verificações de leitura de agendados passaram em PostgreSQL isolado.`);
  }
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, {recursive: true, force: true});
}
