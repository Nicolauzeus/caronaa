import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const dispatch=readFileSync("drizzle/migrations/0226_f07_municipality_independent_dispatch.sql","utf8");
const adminSql=readFileSync("drizzle/migrations/0229_admin_passenger_driver_contact_details.sql","utf8");
const admin=readFileSync("src/components/admin/F07OperationsCommandCenter.tsx","utf8");
const driver=readFileSync("src/components/caronaa/shell/FlashDriverActiveSheet.tsx","utf8");
const driverShell=readFileSync("src/components/caronaa/shell/DriverFlashPlanner.tsx","utf8");
const passenger=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const warning=readFileSync("src/components/caronaa/RideConnectionNotice.tsx","utf8");

describe("Caronaa consolidation",()=>{
 it("does not gate cross-municipality dispatch on equality or regional access flags",()=>{
   expect(dispatch).toContain("public.quick_ride_driver_queue");
   expect(dispatch).toContain("<=15");
   expect(dispatch).toContain("v_distance_m>15000");
   expect(dispatch).toContain("public.respond_flash_order");
   expect(dispatch).not.toContain("dispatch_enabled");
   expect(dispatch).not.toContain("p.municipality=l.municipality");
 });
 it("shows passenger and driver contact details only through admin-gated RPC with consent",()=>{
   expect(adminSql).toContain("public.has_role(auth.uid(),'admin')");
   expect(adminSql).toContain("contact_consent=true");
   expect(adminSql).toContain("preparing_details");
   expect(adminSql).toContain("passenger_whatsapp");
   expect(admin).toContain("Passageiros preparando solicitação");
   expect(admin).toContain("Solicitações aguardando motorista");
   expect(admin).toContain("WhatsApp autorizado");
 });
 it("shows a once-per-ride acknowledgement while preserving user route and trip flow",()=>{
   expect(warning).toContain("Entendi");
   expect(warning).toContain("sessionStorage.setItem");
   expect(warning).toContain("Mantenha o CARONAA aberto");
   expect(passenger).toContain('<RideConnectionNotice rideId={liveRide?.id} role="PASSENGER"/>');
   expect(driverShell).toContain('<RideConnectionNotice rideId={active?.id} role="DRIVER"/>');
   expect(warning).not.toContain("window.location");
 });
 it("uses finalization wording without bypassing the existing passenger-confirmed dropoff",()=>{
   expect(driver).toContain('"Finalizar corrida"');
   expect(driver).toContain("onDropoff()");
   expect(driverShell).toContain('rpc("quick_ride_complete_ride"');
   expect(driver).toContain("O passageiro confirmará o desembarque");
 });
});
