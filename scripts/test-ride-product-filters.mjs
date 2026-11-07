import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// A disposable PostgreSQL cluster, never the connected deployment. Apply the real
// ride migrations; an old repair omitted existing defaults (PostgreSQL rejects
// that CREATE OR REPLACE). Preserve those defaults only in this local fixture.
// The STS and QR alternatives duplicate tables created by the canonical later
// ride migrations; exclude those alternatives in this clean-cluster fixture.
const migrations = readdirSync(new URL("../drizzle/migrations", import.meta.url))
  .filter((name) => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 63 && !["0037_sts_first_publication.sql", "0038_ride_qr_confirmations.sql"].includes(name))
  .sort().map((name) => {
    const sql = read("src/test/ride-security-db-bootstrap.sql") + `
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
` + migrations + read("drizzle/migrations/0137_ride_vehicle_and_women_filters.sql") +
  read("src/test/ride-product-filters.integration.sql");
const directory = mkdtempSync(join(tmpdir(), "caronaa-product-filters-"));
const fixture = join(directory, "integration.sql");
writeFileSync(fixture, sql);
const result = spawnSync("pg_virtualenv", ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", fixture], {
  encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
});
rmSync(directory, { recursive: true, force: true });
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr.split("\n").filter((line) => /ERROR|FAIL|CONTEXT|DETAIL|LINE|NOTICE:  PASS:/.test(line)).join("\n") + "\n");
  process.stdout.write(result.stdout.slice(-1500));
} else {
  const checks = (result.stderr.match(/NOTICE:  PASS:/g) || []).length;
  console.log(`${checks} grupos de verificações de gênero, veículo, tarifa e idempotência passaram em PostgreSQL isolado.`);
}
process.exitCode = result.status ?? 1;

