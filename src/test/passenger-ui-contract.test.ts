import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profile=readFileSync("src/routes/_authenticated/perfil.tsx","utf8");
const passenger=readFileSync("src/components/caronaa/PassengerAccountDashboard.tsx","utf8");
const planner=readFileSync("src/components/caronaa/shell/ShellJourneyPlanner.tsx","utf8");
const quick=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const home=readFileSync("src/routes/_authenticated/home.tsx","utf8");

describe("CARONAA passenger mobile-first UX contract",()=>{
  it("prioritizes passenger identity and keeps professional finances in driver section",()=>{
    expect(profile).toContain("<PassengerAccountDashboard");
    expect(profile).toContain("showProfessionalDashboard");
    expect(profile).toContain("<ProfessionalAccountDashboard");
    expect(passenger).toContain('aria-label="Minha identidade"');
    expect(passenger).toContain("Minhas viagens");
    expect(passenger).toContain("DriverWhatsAppSupport");
    expect(passenger).not.toContain("DriverPlatformFees");
    expect(passenger).not.toContain("DriverPixSettings");
    expect(profile).toContain('ref={galleryInputRef}');
    expect(profile).toContain('ref={cameraInputRef}');
  });
  it("does not invent Flash fares or create duplicate confirmation steps",()=>{
    expect(planner).toContain("Flash Moto");
    expect(planner).toContain("Flash Carro");
    expect(planner).toContain("Carona Na Rota");
    expect(planner).toContain("fare.customerPaysCents/100");
    expect(planner).not.toContain("Revisar e Continuar");
    expect(quick).toContain('await submitFn({data:{quoteId:currentQuote.quoteId}})');
    expect(quick).toContain("onFareChange");
    expect(quick).toContain("onDropoffPendingChange");
  });
  it("keeps desktop maps open and links account trips to real trip history",()=>{
    expect(home).toContain("flashFare={flashFare}");
    expect(home).toContain("onFareChange={setFlashFare}");
    expect(home).toMatch(/trips\s*:\s*z\.enum\(\["open"\]\)\.optional\(\)/);
    expect(home).toContain("routeLeftInset=");
    expect(readFileSync("src/components/caronaa/shell/app-navigation.ts", "utf8")).toContain('label: "Viagens"');
  });
});
