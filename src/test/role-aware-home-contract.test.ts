import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(path,"utf8");

describe("CARONAA role-aware Home contracts",()=>{
  it("directs all drivers into the guarded availability cockpit by default",()=>{
    const home=source("src/routes/_authenticated/home.tsx");
    const shell=source("src/components/caronaa/AppShell.tsx");
    expect(home).toContain('to:"/disponibilidade-profissional"');
    expect(home).toContain('roleRow?.active_role==="MOTORISTA"');
    expect(home).not.toContain('if(!accessError&&access?.authorized===true)');
    expect(home).toContain('(location.search as {trips?:string}).trips!=="open"');
    const vehicle=source("src/routes/_authenticated/cadastro-veiculo.tsx");
    expect(vehicle).toContain('else await navigate({to:"/disponibilidade-profissional",replace:true})');
    expect(home).toContain('const activityIntent=');
    expect(shell).toContain('homeSurface={homeSurface}');
  });

  it("preserves the scheduled ride inbox as an explicit secondary activity",()=>{
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
    expect(shell).toContain('professionalOnly: !roleRow.error && activeRole === "MOTORISTA"');
    const drawer=source("src/components/caronaa/MobileAccountDrawer.tsx");
    expect(drawer).toContain("Oferecer carona agendada");
    expect(shell).toContain("authenticatedNav");
  });
});
