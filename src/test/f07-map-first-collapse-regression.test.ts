import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const source=(path:string)=>readFileSync(path,"utf8");
const shell=source("src/components/caronaa/shell/InteractiveBottomSheet.tsx");
const sheetCss=source("src/components/caronaa/shell/interactive-bottom-sheet.css");
const pro=source("src/components/caronaa/ProfessionalAvailabilityPage.tsx");
const proCss=source("src/components/caronaa/professional-cockpit.css");
const map=source("src/components/caronaa/QuickRideOperationalMap.tsx");
const home=source("src/routes/_authenticated/home.tsx");

describe("F07 map-first ride controls on Android and iPhone",()=>{
  it("fully collapses the shared drawer in one downward gesture",()=>{
    expect(shell).toContain('rideActive&&delta>32');
    expect(shell).toContain('change("peek")');
    expect(shell).toContain('rideActive&&snap==="peek"?"calc(64px + env(safe-area-inset-bottom, 0px))"');
    expect(sheetCss).toContain('height: calc(64px + env(safe-area-inset-bottom, 0px)) !important');
    expect(sheetCss).toContain('display: none !important');
    expect(home).toContain('rideStageLabel={driverFlashRide?');
  });
  it("collapses the separate Android professional cockpit into a narrow tab",()=>{
    expect(pro).toContain('data-active-ride={activeRide?"true":"false"}');
    expect(pro).toContain('setSheetExpanded(last<start)');
    expect(proCss).toContain('flex: 0 0 56px');
    expect(proCss).toContain('max-height: 56px');
    expect(proCss).toContain('data-active-ride="true"');
    expect(proCss).toContain("max-width: 767px");
  });
  it("avoids duplicate map overlays and free space while a ride is active",()=>{
    expect(map).toContain('showControls={!immersive}');
    expect(map).toContain('Rota por voz');
    expect(map).not.toContain('top-20 z-10 max-w-sm space-y-1');
    expect(map).toContain('GPS atrasado');
    expect(sheetCss).toContain('nav[aria-label="Navegação principal mobile"]');
    expect(proCss).toContain('nav[aria-label="Navegação profissional mobile"]');
  });
});
