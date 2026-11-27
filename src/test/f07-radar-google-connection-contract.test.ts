import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");
const google=readFileSync("src/lib/google-request.server.ts","utf8");
const quick=readFileSync("src/lib/quick-rides/quick-ride.functions.ts","utf8");
const markers=readFileSync("src/lib/quick-rides/quick-radar-markers.ts","utf8");

describe("CARONAA F07 Google Routes and public radar integration",()=>{
  it("passes authorized, approximate positions through the passenger map",()=>{
    expect(home).toContain('rpc("discover_caronaa_quick_drivers"');
    expect(home).toContain("p_radius_km:QUICK_RADAR_RADIUS_KM");
    expect(home).toContain('(["CAR","MOTO"] as const).map(async type=>');
    expect(home).toContain("p_vehicle:type");
    expect(home).toContain("mapQuickRadarDrivers(data,type)");
    expect(home).toContain("Promise.allSettled");
    expect(home).toContain("setQuickDriverCounts(previous=>");
    expect(home).not.toContain("p_vehicle:quickVehicle");
    expect(home).toContain('professionalDrivers={quickDrivers}');
    expect(home).toContain('setQuickDrivers([])');
    expect(markers).toContain("entry.simulated === true");
    expect(markers).toContain("entry.is_self === true");
    expect(markers).not.toContain("navigator.geolocation");
    expect(markers).not.toContain("municipalityCenter");
  });
  it("uses bounded timeout and safe server diagnostics without raw exception logs",()=>{
    expect(google).toContain("GOOGLE_TIMEOUT_MS");
    expect(google).toContain('console.error("[CARONAA][GOOGLE_REQUEST]"');
    expect(google).not.toContain("Falha na requisição:");
    expect(google).not.toMatch(/console\.(?:error|warn)\([^\n]*cause\)/);
    expect(quick).toContain("getDrivingRoute([data.origin,data.destination]");
    expect(quick).toContain("[CARONAA][F07][QUOTE_ROUTE]");
  });
});
