import { describe, expect, it } from "vitest";
import { quotePassengerPaysProcessingFee, reconcilePassengerFeeQuote } from "./passenger-fee";

describe("passenger pays Asaas processing fee", () => {
  it("preserves 83.14/16.86 of fare when provider charges quoted fee", () => {
    const q = quotePassengerPaysProcessingFee(10000, 199);
    expect(q).toEqual({
      rideFareCents: 10000, processingFeeCents: 199, passengerTotalCents: 10199,
      driverFixedCents: 8314, platformTargetNetCents: 1686, minimumNetCents: 10000,
    });
    expect(reconcilePassengerFeeQuote(q, 10199, 10000)).toEqual({
      actualFeeCents: 199, platformNetCents: 1686, driverFixedCents: 8314,
      reconciled: true, differenceCents: 0,
    });
  });
  it("detects when the actual provider fee differs from the disclosed fee", () => {
    const q = quotePassengerPaysProcessingFee(10000, 199);
    expect(reconcilePassengerFeeQuote(q, 10199, 9990)).toMatchObject({
      actualFeeCents: 209, platformNetCents: 1676, reconciled: false, differenceCents: -10,
    });
  });
  it("rejects invalid fee, overflowing amount, or inconsistent Asaas values", () => {
    expect(() => quotePassengerPaysProcessingFee(10000, -1)).toThrow();
    expect(() => quotePassengerPaysProcessingFee(10000, 1.5)).toThrow();
    expect(() => quotePassengerPaysProcessingFee(Number.MAX_SAFE_INTEGER, 199)).toThrow();
    const q = quotePassengerPaysProcessingFee(10000, 199);
    expect(() => reconcilePassengerFeeQuote(q, 10000, 9801)).toThrow();
    expect(() => reconcilePassengerFeeQuote(q, 10199, 11000)).toThrow();
  });
  it("reconciles rounding for odd fare amounts", () => {
    const q = quotePassengerPaysProcessingFee(1851, 199);
    expect(q.driverFixedCents + q.platformTargetNetCents).toBe(q.rideFareCents);
    expect(q.passengerTotalCents).toBe(2050);
  });
});
