import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");
const page=read("src/components/caronaa/ProfessionalAvailabilityPage.tsx");
const sync=read("src/components/caronaa/ProfessionalRadarSync.tsx");
const hook=read("src/hooks/use-flash-driver-presence.ts");
const server=read("src/lib/professional-radar.functions.ts");

describe("F07 GPS fast activation and safety contract",()=>{
  it("warms Flash GPS in parallel, checks true sample age, and rolls back confirmed presence only",()=>{
    expect(hook).toContain("Promise.allSettled");
    expect(hook).toContain("maximumAge:10000");
    expect(hook).toContain("at:pos.timestamp");
    expect(hook).toContain("age>10000");
    expect(hook).toContain("if(serverActivated)void setFlashDriverOffline()");
    expect(hook).toContain('phase:"publishing"');
    expect(hook).toContain('phase:"online"');
  });
  it("begins professional GPS at tap before presence RPC and guards publication",()=>{
    const toggle=page.slice(page.indexOf("async function toggleOnline(next:boolean)"));
    expect(toggle.indexOf("startGps(municipality,pilotVehicle,userId)"))
      .toBeLessThan(toggle.indexOf('rpc("set_professional_presence",{\n        p_available:true'));
    expect(page).toContain("queuedInitialFix.current=position");
    expect(page).toContain("if(!presenceConfirmed.current)");
    expect(page).toContain('setActivationStage("publishing")');
    expect(page).toContain('setActivationStage("online")');
  });
  it("coordinates publishers across tabs and leaves SQL as the final gate",()=>{
    expect(page).toContain("tryAcquireProfessionalRadarLease(userId)");
    expect(sync).toContain("tryAcquireProfessionalRadarLease(userId)");
    expect(page).not.toContain("lastAttempt.current=Date.now()+20000");
    expect(server).toContain("professional_radar_location_rate_gate");
  });
  it("caches only successful server-verified civic fixes with a conservative distance",()=>{
    expect(server).toContain("civicDistanceM");
    expect(server).toContain("CIVIC_CACHE_TTL_MS=180000");
    expect(server).toContain("CIVIC_CACHE_MAX_DISTANCE_M=150");
    expect(server).toContain("cachedCivic(context.userId,data.lat,data.lng)");
    expect(server).toContain("rememberCivic(context.userId,city,data.lat,data.lng)");
    expect(server).toContain("municipalityFromProfessionalGps(geo)");
    expect(server).toContain('rpc("publish_verified_professional_position_v2"');
  });
});
