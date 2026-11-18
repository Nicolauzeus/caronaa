import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("drizzle/migrations/0206_f07_gps_quality_flash_contracts.sql","utf8");
describe("F07 GPS SQL guardrails",()=>{
  it("runs as one explicit transaction, with no automatic DDL",()=>{
    expect((sql.match(/^BEGIN;$/gm)??[]).length).toBe(1);
    expect((sql.match(/^COMMIT;$/gm)??[]).length).toBe(1);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });
  it("never inserts latitude/longitude into the old professional schema",()=>{
    expect(sql).not.toContain("professional_driver_locations (user_id,latitude");
    expect(sql).toContain("last_sampled_at timestamptz");
    expect(sql).toContain("publish_verified_professional_position_v2");
    expect(sql).toContain("update_flash_driver_heartbeat_gps_v2");
    expect(sql).toContain("TO service_role");
  });
  it("separates public approximate positions from exact participant-only positions",()=>{
    expect(sql).toContain("round(l.lat::numeric,3)");
    expect(sql).toContain("l.user_id<>auth.uid()");
    expect(sql).toContain("l.accuracy_m<=150");
    expect(sql).toContain("l.sampled_at>now()-interval '90 seconds'");
    expect(sql).toContain("q.passenger_id<>auth.uid()");
  });
  it("prevents false arrival and does not leak pickup PIN during acceptance",()=>{
    expect(sql).toContain("l.accuracy_m<=50");
    expect(sql).toContain("interval '45 seconds'");
    expect(sql).toContain(")))<=75");
    expect(sql).not.toContain("'start_pin',v_pin");
    expect(sql).toContain("Legacy professional-driver queue remains operational independently");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.quick_ride_accept");
    expect(sql).toContain("COALESCE");
  });
});
