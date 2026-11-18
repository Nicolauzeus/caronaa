import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync("src/routes/_authenticated/home.tsx", "utf8");
const migration = readFileSync("drizzle/migrations/0205_f07_nearby_radar_100m.sql", "utf8");

describe("F07 confirmed pickup and nearby radar regression", () => {
  it("requires explicit passenger confirmation independently of GPS accuracy", () => {
    expect(home).toContain("validPoint(plannedPickup)&&confirmedPickupKey!==pickupKey");
    expect(home).toContain("setOriginLocation({...pickupCandidate});setAppliedOriginAccuracy(null)");
    expect(home).toContain("const radarPickup=validPoint(plannedPickup)");
  });

  it("keeps public radar authorized and fresh without kilometer-scale displacement", () => {
    expect(migration).toContain("round(l.lat::numeric, 3)");
    expect(migration).toContain("round(l.lng::numeric, 3)");
    expect(migration).toContain("p.is_available");
    expect(migration).toContain("a.approved AND a.vehicle_type = p_vehicle");
    expect(migration).toContain("l.updated_at > now() - interval '90 seconds'");
    expect(migration).toContain("l.user_id <> auth.uid()");
    expect(migration).toContain("public.driver_platform_access_allowed(l.user_id)");
    expect(migration).not.toContain("round(l.lat::numeric, 2)");
  });
});
