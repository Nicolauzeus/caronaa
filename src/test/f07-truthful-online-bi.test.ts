import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql=readFileSync("drizzle/migrations/0227_f07_truthful_online_gps_bi.sql","utf8");
const panel=readFileSync("src/components/admin/F07OperationsCommandCenter.tsx","utf8");

describe("F07 truthful operational visibility",()=>{
  it("does not interpret a persisted online flag as live connectivity",()=>{
    expect(sql).toContain("AS connected_recent");
    expect(sql).toContain("fl.last_gps_at>now()-interval '90 seconds'");
    expect(sql).toContain("pr.last_seen_at>now()-interval '90 seconds'");
    expect(sql).toContain("coalesce(coalesce(fl.is_online,false)");
    expect(panel).toContain("d.connected_recent === true");
    expect(panel).not.toContain("drivers.filter(d => d.flash_online || d.presence_online)");
  });
  it("accepts independent verified GPS sources and shows real age/accuracy",()=>{
    expect(sql).toContain("AS gps_valid");
    expect(sql).toContain("AS dispatch_ready");
    expect(sql).toContain("l.sampled_at>now()-interval '90 seconds'");
    expect(sql).toContain("fl.last_sampled_at>now()-interval '90 seconds'");
    expect(panel).toContain("Precisão:");
    expect(panel).toContain("driver.gps_valid");
  });
  it("preserves admin-only server access without exposing coordinates",()=>{
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).not.toContain("AS gps_lat");
    expect(sql).not.toContain("AS gps_lng");
  });
});
