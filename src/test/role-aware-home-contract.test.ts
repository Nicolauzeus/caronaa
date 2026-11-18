import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(path,"utf8");

describe("CARONAA role-aware Home contracts",()=>{
  it("directs professional drivers into the guarded availability cockpit",()=>{
    const home=source("src/routes/_authenticated/home.tsx");
    const shell=source("src/components/caronaa/AppShell.tsx");
    expect(home).toContain('to:"/disponibilidade-profissional"');
    expect(home).toContain('roleRow?.active_role==="MOTORISTA"');
    expect(home).toContain('access?.authorized===true');
    expect(home).toContain('const activityIntent=');
    expect(shell).toContain('homeSurface={homeSurface}');
  });

  it("keeps shared drivers in their own inbox, not passenger search",()=>{
    const home=source("src/routes/_authenticated/home.tsx");
    const dashboard=source("src/components/caronaa/shell/DriverHomeDashboard.tsx");
    expect(home).toContain('driverRole&&driverHomeOpen?<DriverHomeDashboard');
    expect(home).toContain('setServiceType("AGENDADA")');
    expect(home).toContain("caronaa:driver-home");
    expect(dashboard).toContain("getDriverScheduledTrips");
    expect(dashboard).toContain("getDriverScheduledOpportunities");
    expect(dashboard).toContain("acceptDriverScheduledRequest");
    expect(dashboard).not.toContain("professional_location_start");
  });

  it("separates driver trips and passenger trips in navigation",()=>{
    const shell=source("src/components/caronaa/AppShell.tsx");
    const nav=source("src/components/caronaa/shell/app-navigation.ts");
    expect(nav).toContain("sharedDriverNav");
    expect(shell).toContain('label==="Viagens"?{trips:"open"}:{intent:"offer"}');
    expect(shell).toContain("professionalNav");
    expect(shell).toContain("authenticatedNav");
  });
});
