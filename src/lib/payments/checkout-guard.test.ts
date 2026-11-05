import { describe, expect, it } from "vitest";
import { validateCheckoutPreflight, type CheckoutPreflight } from "./checkout-guard";

const valid: CheckoutPreflight = {
  reservationId:"ride-1", payerUserId:"passenger", authenticatedUserId:"passenger",
  reservationStatus:"ACCEPTED", rideFareCents:10000,
  verifiedProcessingFeeCents:199, feeSource:"ASAAS_ACCOUNT_VERIFIED",
  acceptedTotalCents:10199, acceptedAt:"2026-10-15T03:00:00Z",
  driverWalletId:"wallet-verified",driverUserId:"driver", environment:"sandbox",
  chargesEnabled:true,
};
describe("Asaas checkout guard", () => {
  it("allows only a fully verified sandbox quote", () => {
    expect(validateCheckoutPreflight(valid)).toMatchObject({
      passengerTotalCents:10199, platformTargetNetCents:1686, driverFixedCents:8314,
    });
  });
  it.each([
    [{chargesEnabled:false},"desativadas"],
    [{environment:"production"},"produção"],
    [{authenticatedUserId:"someone"},"autorização"],
    [{driverUserId:"passenger"},"autorização"],
    [{reservationStatus:"PENDING"},"confirmação"],
    [{feeSource:"UNVERIFIED"},"não verificada"],
    [{verifiedProcessingFeeCents:null},"não verificada"],
    [{driverWalletId:null},"carteira"],
    [{acceptedAt:null},"aceitou"],
    [{acceptedTotalCents:10000},"aceitou"],
  ] as const)("rejects unsafe checkout state: %j", (change, error) => {
    expect(() => validateCheckoutPreflight({...valid,...change})).toThrow(error);
  });
});
