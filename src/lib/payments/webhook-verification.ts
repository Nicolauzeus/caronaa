import { z } from "zod";
import { classifyAsaasPaymentEvent, type PaymentEventDecision } from "./asaas-events";

/** The provider GET response is the trusted source; webhook payload alone never marks a charge paid. */
const providerPayment = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  externalReference: z.string().min(1),
  value: z.number().finite().positive(),
  netValue: z.number().finite().nonnegative().optional(),
  status: z.string().min(1),
});

export type AsaasCheckoutSnapshot = {
  id: string;
  asaasPaymentId: string;
  passengerTotalCents: number;
  driverFixedCents: number;
  platformTargetNetCents: number;
};

export type VerifiedWebhook = {
  decision: Exclude<PaymentEventDecision, { type: "IGNORE" }>;
  providerStatus: string;
  netCents: number | null;
  reconciliation: "MATCHED" | "DIVERGENT" | "PENDING";
};

/** Pure, server-side validation for independently fetched Asaas payment data. */
export function verifyAsaasWebhookPayment(
  webhookPayload: unknown,
  providerPayload: unknown,
  checkout: AsaasCheckoutSnapshot,
): VerifiedWebhook | null {
  const decision = classifyAsaasPaymentEvent(webhookPayload);
  if (decision.type === "IGNORE") return null;
  const provider = providerPayment.parse(providerPayload);
  const chargedCents = Math.round(provider.value * 100);
  if (provider.id !== decision.paymentId ||
      provider.id !== checkout.asaasPaymentId ||
      provider.externalReference !== checkout.id ||
      decision.reference !== checkout.id ||
      chargedCents !== checkout.passengerTotalCents)
    throw new Error("Cobrança Asaas não corresponde à reserva registrada");
  if (decision.type === "PAYMENT_RECEIVED") {
    if (!["RECEIVED", "CONFIRMED"].includes(provider.status)) {
      throw new Error("Asaas ainda não confirmou recebimento");
    }
    if (decision.amountCents !== chargedCents) throw new Error("Valor do evento divergente");
  }
  const netCents = provider.netValue === undefined ? null : Math.round(provider.netValue * 100);
  const reconciliation: VerifiedWebhook["reconciliation"] =
    netCents === null ? "PENDING"
      : netCents - checkout.driverFixedCents === checkout.platformTargetNetCents ? "MATCHED" : "DIVERGENT";
  return { decision, providerStatus: provider.status, netCents, reconciliation };
}
