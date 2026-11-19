import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const file=(path:string)=>readFileSync(path,"utf8");
const home=file("src/routes/_authenticated/home.tsx");
const driver=file("src/components/caronaa/shell/DriverFlashPlanner.tsx");
const driverSheet=file("src/components/caronaa/shell/FlashDriverActiveSheet.tsx");
const passenger=file("src/components/caronaa/QuickRideHomePanel.tsx");
const passengerSheet=file("src/components/caronaa/shell/FlashPassengerLiveSheet.tsx");
const shell=file("src/components/caronaa/shell/ShellJourneyPlanner.tsx");
const drawer=file("src/components/caronaa/shell/InteractiveBottomSheet.tsx");
const css=file("src/components/caronaa/shell/interactive-bottom-sheet.css");
const incoming=file("src/components/caronaa/shell/FlashIncomingOrderCard.tsx");
const postTrip=file("src/components/caronaa/QuickRidePostTripFlow.tsx");
const flashApi=file("src/services/flash-driver-service.ts");

describe("F07 map-first mobile operational drawers",()=>{
  it("uses a real 30s incoming-call drawer with fixed decision actions",()=>{
    expect(incoming).toContain('role="dialog"');
    expect(incoming).toContain('00:{String(remaining).padStart(2,"0")}');
    expect(incoming).toContain('data-testid="flash-request-drawer"');
    expect(incoming).toContain("Aceitar corrida");
    // A driver has 30 seconds and must not scroll to reach either decision.
    expect(incoming).toContain('data-no-scroll-acceptance="true"');
    expect(incoming).toContain('overflow-hidden overscroll-none');
    expect(incoming).toContain('height:"min(510px, 90dvh)"');
    expect(incoming).toContain('<footer className="grid shrink-0');
    expect(incoming).not.toContain("overflow-y-auto");
    expect(incoming).toContain("Dispensar");
    expect(incoming).toContain("stopLoop(order.id)");
    expect(flashApi).toContain("x.service_mode??x.mode??x.booking_mode");
    expect(flashApi).toContain('record(data)?.action==="SKIPPED"');
  });
  it("never overlays planning controls on an active driver's navigation",()=>{
    expect(driver).toContain('!active&&snap==="peek"');
    expect(driver).toContain("<FlashDriverActiveSheet");
    expect(driver).toContain('onSnapChange(ride.status==="ARRIVED"?"half":"peek")');
    expect(driver).toContain('if(phase!==priorRidePhase.current)onRideRef.current?.(ride)');
    expect(driverSheet).toContain("data-ride-active");
    expect(driverSheet).toContain("onSnapChange(\"peek\")");
    expect(driverSheet).toContain("Validar PIN e iniciar");
  });
  it("keeps passenger live controls visible when sheet is in map peek",()=>{
    expect(shell).toContain('snap!=="peek"||flashRideActive');
    expect(shell).toContain('flashRideActive?"min-h-0 flex-1 overflow-hidden"');
    expect(passenger).toContain("<FlashPassengerLiveSheet");
    expect(passengerSheet).toContain('Seu código de embarque');
    expect(passengerSheet).toContain("<QuickRideSearchActivity");
    expect(passengerSheet).toContain("onFollowMap");
    expect(home).toContain('setSheetSnap("peek")');
    expect(home).toContain('setSheetSnap("half")');
    expect(home).toContain('if(status===previous)return;');
  });
  it("avoids iOS input zoom and keeps checkout actions accessible",()=>{
    expect(drawer).toContain('rideActive&&snap==="peek"?"calc(64px + env(safe-area-inset-bottom, 0px))"');
    expect(css).toContain("font-size: 16px !important");
    expect(css).toContain('[data-trip-route-details="true"]');
    expect(postTrip).toContain("min-h-0 flex-1 space-y-3 overflow-y-auto");
    expect(postTrip).toContain('className="shrink-0 space-y-1 border-t');
    expect(driver).toContain('<QuickRidePostTripFlow role="DRIVER"');
  });
});
