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
    let sql = read(`drizzle/migrations/${name}`);
    if (name === "0036_repair_offer_audience_rpc.sql") {
      for (const [parameter, type, fallback] of [
        ["p_time_tolerance_minutes", "integer", "15"],
        ["p_origin_lat", "double precision", "NULL"], ["p_origin_lng", "double precision", "NULL"],
        ["p_destination_lat", "double precision", "NULL"], ["p_destination_lng", "double precision", "NULL"],
        ["p_total_price", "numeric", "30"], ["p_passenger_gender_preference", "text", "'ANY'"],
      ]) sql = sql.replace(`${parameter} ${type}`, `${parameter} ${type} DEFAULT ${fallback}`);
    }
    return `\n-- Fixture: ${name}\n${sql}`;
  }).join("\n");
let sql = read("src/test/ride-security-db-bootstrap.sql") + `
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
` + migrations + read("drizzle/migrations/0106_intelligent_ride_opportunities.sql") + read("drizzle/migrations/0107_verified_opportunity_road_assessments.sql") +
  read("src/test/intelligent-match.integration.sql");
if (process.argv.includes("--regression")) {
  for (const name of ["partial-ride-request.integration.sql", "travel-preferences.integration.sql", "ride-fare-quote.integration.sql"]) {
    sql += "\nDROP FUNCTION IF EXISTS pg_temp.assert_true(boolean,text); DROP FUNCTION IF EXISTS pg_temp.expect_error(text,text);\n" + read(`src/test/${name}`);
  }
}
const directory = mkdtempSync(join(tmpdir(), "caronaa-intelligent-"));
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
  console.log(`${checks} verificações de match inteligente passaram em PostgreSQL isolado.`);
}
process.exitCode = result.status ?? 1;
