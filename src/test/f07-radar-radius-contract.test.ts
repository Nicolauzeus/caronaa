import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUICK_RADAR_RADIUS_KM } from "@/lib/quick-rides/quick-radar-markers";

const dir="drizzle/migrations";
const sql=readdirSync(dir).filter(f=>f.endsWith(".sql")).map(f=>readFileSync(`${dir}/${f}`,"utf8"))
  .find(s=>s.includes("p_radius_km double precision"))??"";

describe("F07 radar por raio geográfico",()=>{
  it("usa raio de 15 km em torno do embarque",()=>{
    expect(QUICK_RADAR_RADIUS_KM).toBe(15);
    expect(sql).toContain("least(greatest(coalesce(p_radius_km, 15.0), 1.0), 30.0)");
    expect(sql).toContain("d_dist <= v_radius");
  });
  it("mantém região aceita, aprovação, débitos, GPS de 90s e exclusão própria",()=>{
    for(const rule of ["r.public_discovery_enabled","a.approved AND a.vehicle_type = p_vehicle",
      "public.driver_platform_access_allowed(l.user_id)","l.updated_at > now() - interval '90 seconds'",
      "l.user_id <> auth.uid()","round(l.lat::numeric, 2)"]) expect(sql).toContain(rule);
    expect(sql).not.toContain("l.municipality=btrim(p_municipality)");
  });
});
