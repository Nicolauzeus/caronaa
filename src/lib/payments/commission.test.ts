import { describe, expect, it } from "vitest";
import { calculateGrossSplit } from "./commission";

describe("CARONAA 16.86% gross commercial split", () => {
  it("fixes the driver's payout at 83.14% of gross before provider fees", () => {
    expect(calculateGrossSplit(10000, 9800)).toEqual({
      grossCents: 10000, platformGrossCommissionCents: 1686,
      driverFixedCents: 8314, minimumNetCents: 8314,
    });
  });
  it("ensures cents reconcile even on uneven totals", () => {
    const split = calculateGrossSplit(1851);
    expect(split.driverFixedCents + split.platformGrossCommissionCents).toBe(1851);
  });
  it("refuses invalid prices or insufficient net proceeds", () => {
    expect(() => calculateGrossSplit(0)).toThrow();
    expect(() => calculateGrossSplit(10000, 8300)).toThrow();
    expect(() => calculateGrossSplit(10000, 10100)).toThrow();
  });
});
