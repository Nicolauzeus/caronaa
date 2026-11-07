import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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
export function buildProductFilterFixture(intelligent = false) {
  const archive = read("drizzle/migrations/0106_intelligent_ride_opportunities.sql");
  // Only restore the archived evaluator/allocator in this disposable test fixture.
  // The allocator body matches the definition retrieved from the deployed database.
  const start = archive.indexOf("-- CREATE FUNCTION public.project_ride_route");
  const end = archive.indexOf("-- REVOKE ALL ON FUNCTION public.try_match_ride_request", start);
  if (start < 0 || end < 0) throw new Error("Archived intelligent fixture changed");
  const intelligentSql = archive.slice(start, end).split("\n").map(line => line.replace(/^-- ?/, "")).join("\n");
  const migration = read("drizzle/migrations/0137_ride_vehicle_and_women_filters.sql");
  return read("src/test/ride-security-db-bootstrap.sql") + `
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
` + migrations + (intelligent ? intelligentSql : "") + `
CREATE TEMP TABLE allocator_before AS SELECT pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure) AS definition;
` + migration + migration + `
DO $$
DECLARE actual text; original text; predicate text;
BEGIN
 SELECT pg_get_functiondef('public.try_match_ride_request(uuid,uuid)'::regprocedure) INTO actual;
 SELECT definition INTO original FROM allocator_before;
 predicate := ${intelligent ? "'AND public.ride_product_filters_compatible(r,candidate) '" : "'AND public.ride_product_filters_compatible(request_row,ride_offers) '"};
 IF position(predicate IN actual)=0 OR replace(actual,predicate,'') IS DISTINCT FROM original THEN
  RAISE EXCEPTION 'Allocator was replaced, duplicated or changed outside its product filter predicate';
 END IF;
 RAISE NOTICE 'PASS: allocator preserved and migration safely reapplied';
END $$;
` + read("src/test/ride-product-filters.integration.sql");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const intelligent of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), "caronaa-product-filters-"));
    const fixture = join(directory, "integration.sql");
    writeFileSync(fixture, buildProductFilterFixture(intelligent));
    const result = spawnSync("pg_virtualenv", ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", fixture], {
      encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    });
    rmSync(directory, { recursive: true, force: true });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.stderr.write(result.stderr.split("\n").filter(line => /ERROR|FAIL|CONTEXT|DETAIL|LINE|NOTICE:  PASS:/.test(line)).join("\n") + "\n");
      process.stdout.write(result.stdout.slice(-1500));
      process.exitCode = result.status ?? 1;
      break;
    }
    console.log(`${intelligent ? "Intelligent" : "Legacy"} allocator: product filters, migration replay and original allocator preservation passed.`);
  }
}
