import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const page=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
const style=readFileSync("src/components/caronaa/professional-cockpit.css","utf8");

describe("driver financial block UX regression",()=>{
  it("reads the authoritative fee gate instead of assuming an unpaid debt",()=>{
    expect(page).toContain('rpc("get_my_driver_platform_fees")');
    expect(page).toContain("typeof fees.data?.driverAllowed");
    expect(page).toContain("setBlocked(fees.data.driverAllowed!==true)");
    expect(page).toContain("setFeeUnavailable(true)");
    expect(page).toContain("setBlocked(false)");
    expect(page).toContain("sem presumir dívida");
  });
  it("shows the verified pending count and amount with a route to reconcile",()=>{
    expect(page).toContain("pending:Number(fees.data.pendingTrips)");
    expect(page).toContain("outstanding:Number(fees.data.amountOutstanding)");
    expect(page).toContain('hash="comissoes-caronaa"');
    expect(page).toContain("Atualizar situação");
    expect(style).toContain(".professional-cockpit__availability-button:disabled");
  });
  it("does not show an invented map point while offline without GPS",()=>{
    expect(page).toContain("mapFix ? <GoogleMapSurface");
    expect(page).toContain("Nenhum ponto foi confirmado.");
    expect(page).not.toContain('points={mapFix ?');
  });
});
