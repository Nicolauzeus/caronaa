import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quoteProposedCaronaaFare, type FarePolicyConfig } from "./caronaa-fare-engine";

const config: FarePolicyConfig = {
  standardCommissionBps: 2000,
  macicoSharedCarMinimumCents: null,
  friendExtraSeatDiscountBps: 0,
  exclusiveCar: { baseCents: 700, perKmCents: 180, perMinuteCents: 25, minimumCents: 950 },
  exclusiveMotoOutside: { baseCents: 450, perKmCents: 100, perMinuteCents: 10, minimumCents: 500 },
  processingFeeCents: 199,
};
const base = {
  distanceKm: 4, durationMinutes: 12, mode: "EXCLUSIVE_MOTO" as const,
  region: "MACICO_BATURITE" as const, occupiedSeats: 1,
  party: "INDIVIDUAL" as const, quotedAt: "2026-11-20T14:00:00Z",
};
const migration=readFileSync("drizzle/migrations/0213_macico_local_commission_waiver.sql","utf8");
const server=readFileSync("src/lib/quick-rides/quick-ride.functions.ts","utf8");

describe("temporary Macico intra-municipal commission waiver",()=>{
  it("keeps fare unchanged and pays full fare to driver on verified local Macico ride",()=>{
    const q=quoteProposedCaronaaFare({...base,waiveLocalMacicoCommission:true},config);
    expect(q.customerPaysCents).toBe(750);
    expect(q.driverReceivesCents).toBe(750);
    expect(q.platformGrossCommissionCents).toBe(0);
    expect(q.commissionBps).toBe(0);
    expect(q.processingFeeCents).toBe(0);
  });
  it("does not waive another region or unmarked intercity Macico ride",()=>{
    const intercity=quoteProposedCaronaaFare(base,{...config,processingFeeCents:0});
    expect(intercity.commissionBps).toBe(2000);
    const fortaleza=quoteProposedCaronaaFare({...base,region:"OUTSIDE_MACICO",waiveLocalMacicoCommission:true},{...config,processingFeeCents:0});
    expect(fortaleza.commissionBps).toBe(2000);
  });
  it("derives local status from server-verified destination municipality",()=>{
    expect(server).toContain('destinationCity.municipality===coverage.municipality');
    expect(server).toContain('coverage.region==="MACICO_BATURITE"');
    expect(server).toContain('waiveLocalMacicoCommission,');
  });
  it("allows fee-free completion with no new debt and preserves other fees",()=>{
    expect(migration).toContain("v_quote.destination_municipality = v_quote.municipality");
    expect(migration).toContain("v_quote.commission_bps = 0");
    expect(migration).toContain("IF v_quote.platform_commission_cents = 0 THEN RETURN NEW");
    expect(migration).not.toMatch(/UPDATE\s+public\.caronaa_quick_driver_fees/i);
  });
});
