import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quoteProposedCaronaaFare, type FarePolicyConfig } from "./caronaa-fare-engine";
import { flashRouteFixedFareCents } from "./flash-route-fixed-fares";

const config: FarePolicyConfig = {
  standardCommissionBps: 2000, macicoSharedCarMinimumCents: null, friendExtraSeatDiscountBps: 0,
  exclusiveCar: { baseCents: 500, perKmCents: 200, perMinuteCents: 30, minimumCents: 1000 },
  exclusiveMotoOutside: { baseCents: 0, perKmCents: 0, perMinuteCents: 0, minimumCents: 0 },
  processingFeeCents: 0,
};
const base = { distanceKm: 23, durationMinutes: 30, region: "MACICO_BATURITE" as const,
  occupiedSeats: 1, party: "INDIVIDUAL" as const, quotedAt: "2026-11-24T14:00:00Z" };

describe("F07 fixed R$30 Flash fare to Barreira", () => {
  it("Acarape → Barreira is R$30", () => expect(flashRouteFixedFareCents("Acarape", "Barreira")).toBe(3000));
  it("Redenção → Barreira is R$30", () => expect(flashRouteFixedFareCents("Redenção", "Barreira")).toBe(3000));
  it("return Barreira → Acarape/Redenção keeps existing pricing", () => {
    expect(flashRouteFixedFareCents("Barreira", "Acarape")).toBeUndefined();
    expect(flashRouteFixedFareCents("Barreira", "Redenção")).toBeUndefined();
  });
  it("Acarape → Redenção is not changed by this rule", () =>
    expect(flashRouteFixedFareCents("Acarape", "Redenção")).toBeUndefined());
  it("CAR and MOTO quotes charge 3000 regardless of distance, keeping 20% commission", () => {
    for (const mode of ["EXCLUSIVE_CAR", "EXCLUSIVE_MOTO"] as const) {
      const q = quoteProposedCaronaaFare({ ...base, mode, routeFixedFareCents: 3000 }, config);
      expect(q.customerPaysCents).toBe(3000);
      expect(q.commissionBps).toBe(2000);
      expect(q.driverReceivesCents).toBe(2400);
    }
  });
  it("rejects the fixed fare for shared F03 rides", () =>
    expect(() => quoteProposedCaronaaFare({ ...base, mode: "SHARED_CAR", routeFixedFareCents: 3000 }, config)).toThrow());
  it("server quote uses verified origin and destination municipalities", () => {
    const server = readFileSync("src/lib/quick-rides/quick-ride.functions.ts", "utf8");
    expect(server).toContain("flashRouteFixedFareCents(coverage.municipality,destinationCity.municipality)");
  });
});
