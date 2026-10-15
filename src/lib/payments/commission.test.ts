import { describe, expect, it } from "vitest";
import { calculateGrossSplit } from "./commission";

describe("CARONAA 15% gross commercial split", () => {
  it("fixes the driver's payout at 85% of gross before provider fees", () => {
    expect(calculateGrossSplit(10000, 9800)).toEqual({
      grossCents: 10000, platformGrossCommissionCents: 1500,
      driverFixedCents: 8500, minimumNetCents: 8500,
    });
  });
  it("ensures cents reconcile even on uneven totals", () => {
    const split = calculateGrossSplit(1851);
    expect(split.driverFixedCents + split.platformGrossCommissionCents).toBe(1851);
  });
  it("refuses invalid prices or insufficient net proceeds", () => {
    expect(() => calculateGrossSplit(0)).toThrow();
    expect(() => calculateGrossSplit(10000, 8400)).toThrow();
    expect(() => calculateGrossSplit(10000, 10100)).toThrow();
  });
});
