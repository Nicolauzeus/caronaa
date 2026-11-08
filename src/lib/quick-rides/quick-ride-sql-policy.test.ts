import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("drizzle/migrations/0139_quick_ride_corridor_pricing_and_interest.sql","utf8");

describe("CARONAA quick ride migration security contracts",()=>{
  it("stages corridor municipalities without enabling commercial dispatch",()=>{
    for(const city of ["Fortaleza","Maracanaú","Pacatuba","Guaiúba","Redenção","Acarape","Baturité"]){
      expect(sql).toContain("'"+city+"'");
    }
    expect(sql).toContain("car_enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("moto_enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("published boolean NOT NULL DEFAULT false");
    expect(sql).toContain("intermunicipal_enabled boolean NOT NULL DEFAULT false");
  });
  it("stores immutable, participant-only quote with short expiry and idempotent request",()=>{
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.caronaa_quick_fare_quotes");
    expect(sql).toContain("expires_at timestamptz NOT NULL DEFAULT (now()+interval '3 minutes')");
    expect(sql).toContain("REVOKE ALL ON public.caronaa_quick_fare_quotes FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("IF q.ride_id IS NOT NULL THEN RETURN q.ride_id");
    expect(sql).toContain("q.passenger_id<>auth.uid()");
  });
  it("revokes legacy direct request RPC and guards mode, price and admin controls",()=>{
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.quick_ride_request(");
    expect(sql).toContain("FROM authenticated");
    expect(sql).toContain("AND p.published");
    expect(sql).toContain("admin_set_caronaa_quick_tariff");
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("minimum_platform_margin_cents");
  });
  it("publishes only approximate opted-in radar location and stores no GPS in waitlist",()=>{
    expect(sql).toContain("round(l.lat::numeric,2)");
    expect(sql).toContain("l.updated_at>now()-interval '90 seconds'");
    expect(sql).toContain("AND a.approved AND a.vehicle_type=p_vehicle");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.caronaa_coverage_interest");
    const interestTable=sql.split("CREATE TABLE IF NOT EXISTS public.caronaa_coverage_interest (")[1]?.split(");")[0];
    expect(interestTable).not.toContain("origin_lat");
  });
  it("SQL uses valid dollar quoting for every definer function",()=>{
    const opening=(sql.match(/AS \$\$/g)||[]).length;
    const closing=(sql.match(/END; \$\$;/g)||[]).length;
    expect(opening).toBeGreaterThan(5);
    const pureSqlClosing=(sql.match(/\n\$\$;/g)||[]).length;
    expect(opening).toBe(closing+pureSqlClosing);
    expect(sql).not.toMatch(/AS \$(?!\$)/);
    expect(sql).not.toMatch(/END; \$;/);
  });
  it("blocks driver acceptance when dispatch, vehicle or fare policy is switched off",()=>{
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_driver_assignment()");
    expect(sql).toContain("OLD.status='SEARCHING' AND NEW.status='ACCEPTED'");
    expect(sql).toContain("AND policy.published");
    expect(sql).toContain("caronaa_quick_guard_driver_assignment");
  });
  it("rate limits Google quote spend atomically per authenticated member",()=>{
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.caronaa_quick_quote_rate_limits");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.caronaa_quick_quote_rate_gate()");
    expect(sql).toContain("caronaa_quick_quote_rate_limits.attempts<5");
    expect(sql).toContain("ON CONFLICT(user_id) DO UPDATE SET");
  });
  it("prevents updates to monetary snapshots after issuance",()=>{
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_quote_snapshot()");
    expect(sql).toContain("caronaa_quick_quote_immutable");
    expect(sql).toContain("NEW.customer_pays_cents IS DISTINCT FROM OLD.customer_pays_cents");
  });
  it("gives authorized drivers the payout before accepting",()=>{
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.caronaa_quick_driver_queue");
    expect(sql).toContain("snapshot.driver_receives_cents");
    expect(sql).toContain("FROM public.quick_ride_driver_queue(p_municipality)");
  });
  it("stores event geofence, not just a generic active flag",()=>{
    expect(sql).toContain("caronaa_quick_official_activities");
    expect(sql).toContain("center_lat double precision");
    expect(sql).toContain("center_lng double precision");
    expect(sql).toContain("radius_m integer");
    expect(sql).toContain("published boolean");
  });
});
