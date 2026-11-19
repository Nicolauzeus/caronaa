import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql=readFileSync("drizzle/migrations/0209_f07_accept_queue_event_schema_and_radius.sql","utf8");
const driver=readFileSync("src/components/caronaa/QuickRideDriverQueue.tsx","utf8");
const cockpit=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
const passenger=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const passengerSheet=readFileSync("src/components/caronaa/shell/FlashPassengerLiveSheet.tsx","utf8");
const legacy=readFileSync("src/components/caronaa/QuickRideExperience.tsx","utf8");
const driverHistory=readFileSync("src/routes/_authenticated/viagens-profissionais.tsx","utf8");
const passengerHistory=readFileSync("src/components/caronaa/QuickRideTripHistory.tsx","utf8");
const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");

describe("F07 atomic accept and bounded passenger waiting",()=>{
  it("does not write obsolete event columns, while preserving the safe trigger",()=>{
    expect(sql).toContain("caronaa_quick_queue_realtime_event");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.quick_ride_accept(p_id uuid)");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.respond_flash_order(p_ride_id uuid,p_accept boolean)");
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.caronaa_quick_queue_events\s*\(\s*ride_id\s*,/i);
    expect(sql).toContain("UPDATE public.professional_quick_rides");
    expect(sql).toContain("AND status='SEARCHING' AND expires_at>now()");
    expect(sql).toContain("NOTIFY pgrst,'reload schema'");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("the offered pickup radius and GPS expiry match guarded SQL acceptance",()=>{
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.quick_ride_driver_queue(p_municipality text)");
    expect(sql).toContain("l.accuracy_m<=150");
    expect(sql).toContain("l.sampled_at>now()-interval '90 seconds'");
    expect(sql).toContain("l.updated_at>now()-interval '90 seconds'");
    expect(sql).toContain("l.municipality=p.municipality");
    expect(sql).toContain("q.expires_at>now()");
    expect(sql).toContain(")))<=15");
    expect(sql).toContain("IF v_distance_m>15000 THEN RETURN false; END IF;");
    expect(sql).toContain("public.driver_platform_access_allowed");
  });

  it("driver never accepts expired offers and surfaces specific GPS feedback",()=>{
    expect(driver).toContain("visibleQueue.map(ride");
    expect(driver).toContain("Date.parse(offer.expires_at)<=Date.now()");
    expect(driver).toContain("VERIFIED_GPS_REQUIRED");
    expect(driver).toContain("Acesso profissional ou repasses pendentes");
    expect(driver).toContain("gpsReady");
    expect(driver).toContain("15000");
    expect(cockpit).toContain("at:new Date(sampledAtMs)");
  });

  it("passenger polls their own status because the driver-only channel cannot notify them",()=>{
    expect(passenger).toContain('rpc("quick_ride_my_requests")');
    expect(passenger).toContain('liveRide.status==="SEARCHING"?3000');
    expect(passenger).toContain('["ACCEPTED","ARRIVED"].includes(liveRide.status)?5000:12000');
    expect(passenger).toContain('liveRide.status!=="SEARCHING"');
    expect(passenger).toContain("searchDeadlinePassed");
    expect(passenger).toContain("Busca encerrada");
    expect(passenger).toContain("Tentar outra corrida");
    expect(passengerSheet).toContain("Cancelar pedido");
    expect(legacy).toContain('activeRide.status==="SEARCHING"?5000:10000');
  });
  it("returns both roles to their normal screens after completed rides",()=>{
    expect(passenger).not.toContain("Nova corrida");
    expect(driver).not.toContain("Liberar tela para novos chamados");
    expect(passenger).toContain('onRidePhaseChange?.(liveRide?.status??null)');
    expect(driver).toContain("active?7000:15000");
    expect(home).toContain('else if(wasActive&&!status)');
    expect(driver).toContain('onHasPendingChange?.(visibleQueue.length>0)');
    expect(driverHistory).toContain("QuickRideDriverSettlement");
    expect(driverHistory).toContain("Consultar cobrança e recebimento Pix");
    expect(passengerHistory).toContain("QuickRidePixCard");
  });

});
