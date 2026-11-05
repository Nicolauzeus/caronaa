import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calculateGrossSplit } from "@/lib/payments/commission";
import { estimateAsaasPixProcessing } from "@/lib/payments/asaas-fee-estimate";
import { quotePassengerPaysProcessingFee, reconcilePassengerFeeQuote } from "@/lib/payments/passenger-fee";

const migration = readFileSync(
  "drizzle/migrations/0134_payment_method_exclusivity_commission_1686.sql", "utf8",
);
const chooser = readFileSync("src/components/caronaa/RidePaymentChoices.tsx","utf8");
const safety = readFileSync("src/components/caronaa/RideSafetyPanel.tsx","utf8");
const preview = readFileSync("src/lib/payments/checkout-preview.functions.ts","utf8");

describe("16.86% platform share and manual/Asaas exclusive rails", () => {
  it("charges the new share only for future settlements and preserves historical 15% rows", () => {
    expect(migration).toContain("CHECK (fee_rate IN (0.1500, 0.1686))");
    expect(migration).toContain("ALTER COLUMN fee_rate SET DEFAULT 0.1686");
    expect(migration).toContain("round(v_gross*0.1686,2)");
    expect(migration).toContain("fee_amount,fee_rate");
    expect(calculateGrossSplit(10000)).toMatchObject({
      platformGrossCommissionCents:1686,driverFixedCents:8314,
    });
  });
  it("exclusively locks payment method at database boundary", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.ride_payment_choices");
    expect(migration).toContain("guard_manual_pix_exclusivity");
    expect(migration).toContain("guard_asaas_pix_exclusivity");
    expect(migration).toContain("manual_pix_method_guard");
    expect(migration).toContain("asaas_pix_method_guard");
    expect(migration).toContain("ON CONFLICT(ride_id) DO NOTHING");
    expect(migration).toContain("asaas_enabled boolean NOT NULL DEFAULT false");
    expect(safety).toContain("<RidePaymentChoices rideId={rideId} role={role} />");
    expect(chooser).toContain("select_ride_payment_method");
    expect(chooser).not.toContain('p_method: "ASAAS_PIX"');
  });
  it("calculates provider's fixed and variable costs, with no automatic charges", () => {
    const estimated=estimateAsaasPixProcessing(215);
    const q=quotePassengerPaysProcessingFee(215,estimated.processingFeeCents);
    expect(q.passengerTotalCents).toBe(255);
    expect(q.driverFixedCents).toBe(179);
    expect(q.platformTargetNetCents).toBe(36);
    const reconciliation=reconcilePassengerFeeQuote(q,255,215);
    expect(reconciliation.platformNetCents).toBe(36);
    expect(reconciliation.reconciled).toBe(true);
    expect(preview).toContain("checkoutReady:false");
    expect(preview).toContain('feeSource: "ESTIMATED_UNVERIFIED"');
  });
});
