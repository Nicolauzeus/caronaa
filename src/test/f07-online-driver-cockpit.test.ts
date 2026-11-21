import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const ui=readFileSync("src/components/admin/F07OperationsCockpit.tsx","utf8");
const drivers=readFileSync("src/components/admin/F07OnlineDrivers.tsx","utf8");
const sql=readFileSync("drizzle/migrations/0231_f07_online_driver_profiles.sql","utf8");
const availability=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
const hook=readFileSync("src/hooks/use-flash-driver-presence.ts","utf8");
const onlineSql=readFileSync("drizzle/migrations/0232_online_without_readiness_gate.sql","utf8");
const flash=readFileSync("src/components/caronaa/shell/DriverFlashPlanner.tsx","utf8");

describe("online driver cockpit and presence",()=>{
  it("shows a third Motoristas tab without replacing Google Maps/tracking",()=>{
    expect(ui).toContain('|"drivers"');
    expect(ui).toContain(">Motoristas");
    expect(ui).toContain("<OnlineDriverDirectory");
    expect(ui).toContain("<OnlineDriverDetails");
    expect(ui).toContain('onFocus={followDriver}');
    expect(ui).toContain("mapTab===\\\"drivers\\\"");
    expect(ui).toContain("GoogleMapSurface");
  });
  it("shows real identity data and privacy-safe details only to admin",()=>{
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("'online_drivers'");
    expect(sql).toContain("last_seen_at");
    expect(sql).toContain("avatar_url");
    expect(sql).toContain("vehicle_plate");
    expect(sql).toContain("contact_consent=true");
    expect(sql).toContain("has_pix");
    expect(sql).not.toContain("pix_key AS");
    expect(drivers).toContain("GPS válido");
    expect(drivers).toContain("Pix cadastrado");
    expect(drivers).toContain("Ver no mapa");
    expect(drivers).toContain("Registrar problema");
  });
  it("separates going online from authorization to accept rides",()=>{
    expect(onlineSql).toContain("driver_presence_ping");
    expect(onlineSql).toContain("GRANT EXECUTE ON FUNCTION public.set_flash_driver_online");
    expect(onlineSql).toContain("Queue and acceptance RPCs continue to require");
    expect(hook).toContain("await setFlashDriverOnline(input)");
    expect(hook).toContain("setState(s=>({...s,online:true,gpsConnected:false");
    expect(hook).toContain("pingFlashDriverPresence");
    expect(flash).toContain('effectiveMode:FlashDriverMode=mode==="ON_ROUTE"?"EXCLUSIVE":mode');
    expect(availability).toContain("setEnabled(presence.data?.is_available===true)");
    expect(availability).toContain("online={enabled && authorized}");
    expect(availability).not.toContain("if(next && !authorized && !pilotEnabled)");
  });
});
