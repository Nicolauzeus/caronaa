import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const sql=readFileSync("drizzle/migrations/0217_f07_cross_municipality_radius_dispatch.sql","utf8");
const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");
describe("F07 cross-city radius dispatch",()=>{
  it("no longer requires driver city to match pickup city in the queue",()=>{
    expect(sql).not.toContain("AND q.municipality=l.municipality");
    expect(sql).toContain("l.municipality=btrim(p_municipality)");
    expect(sql).toContain("pickup_city.municipality=q.municipality");
    expect(sql).toContain("driver_city.municipality=l.municipality");
    expect(sql).toContain(")))<=15");
  });
  it("verifies both municipalities and vehicle type before showing ride cards",()=>{
    expect(sql).toContain("pickup_region.dispatch_enabled AND pickup_region.public_discovery_enabled");
    expect(sql).toContain("driver_city.moto_enabled");
    expect(sql).toContain("pickup_city.moto_enabled");
    expect(sql).toContain("quick_ride_view_request");
    expect(sql).not.toContain("AND f.current_municipality=v_ride.municipality");
  });
  it("passenger radar uses pickup-centered coordinates and never city-only discovery",()=>{
    expect(home).toContain("p_radius_km:QUICK_RADAR_RADIUS_KM");
    expect(home).not.toContain("p_municipality:quickMunicipality,p_vehicle:type");
    expect(sql).toContain("least(greatest(coalesce(p_radius_km,15),1),15)");
    expect(sql).toContain("cm.municipality=l.municipality");
  });
});
