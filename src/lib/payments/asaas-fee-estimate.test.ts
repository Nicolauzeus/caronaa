import { describe, expect, it } from "vitest";
import { estimateAsaasPixProcessing } from "./asaas-fee-estimate";
import { calculateGrossSplit } from "./commission";

describe("Asaas indicative Pix tariff is NOT the platform commission", () => {
  it("accounts for the R$0.35 fixed fee and the rate on total charge", () => {
    const estimate = estimateAsaasPixProcessing(215);
    expect(estimate).toMatchObject({
      fareCents:215, passengerTotalCents:255, processingFeeCents:40,
      estimatedProviderCostCents:40, verified:false,
    });
    const split = calculateGrossSplit(215);
    expect(split.platformGrossCommissionCents).toBe(36);
    expect(split.driverFixedCents).toBe(179);
    expect(estimate.passengerTotalCents - estimate.estimatedProviderCostCents -
      split.driverFixedCents).toBe(36);
  });
  it("always covers the estimated percentage plus fixed tariff, including rounding", () => {
    for (const fare of [1, 35, 99, 1851, 10000, 25000]) {
      const v=estimateAsaasPixProcessing(fare);
      expect(v.passengerTotalCents-v.fareCents).toBeGreaterThanOrEqual(
        Math.round(v.passengerTotalCents*186/10000)+35,
      );
    }
  });
  it("refuses untrusted values and invalid percent", () => {
    expect(()=>estimateAsaasPixProcessing(-1)).toThrow();
    expect(()=>estimateAsaasPixProcessing(100, 10000)).toThrow();
    expect(()=>estimateAsaasPixProcessing(1.3)).toThrow();
  });
});
