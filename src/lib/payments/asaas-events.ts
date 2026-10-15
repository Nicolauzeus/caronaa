import { z } from "zod";

const webhookEvent = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payment: z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    value: z.number().finite().nonnegative(),
    externalReference: z.string().nullable().optional(),
  }),
  additionalInfo: z.object({ splitId: z.string().optional() }).optional(),
});

export type PaymentEventDecision =
  | { type: "PAYMENT_RECEIVED"; eventId: string; paymentId: string; reference: string; amountCents: number }
  | { type: "SPLIT_SETTLED"; eventId: string; paymentId: string; reference: string; splitId: string }
  | { type: "PAYMENT_REVERSED"; eventId: string; paymentId: string; reference: string }
  | { type: "IGNORE"; eventId: string };

/** Parses a verified Asaas webhook. Does NOT update payment state.
 * The caller must authenticate the webhook token, deduplicate event IDs,
 * compare payment/amount against a persisted booking, and confirm provider state.
 */
export function classifyAsaasPaymentEvent(input: unknown): PaymentEventDecision {
  const value = webhookEvent.parse(input);
  const shared = { eventId: value.id, paymentId: value.payment.id };
  const reference = value.payment.externalReference;
  if (!reference) return { type: "IGNORE", eventId: value.id };
  if (value.event === "PAYMENT_SPLIT_DONE") {
    const splitId = value.additionalInfo?.splitId;
    if (!splitId) return { type: "IGNORE", eventId: value.id };
    return { type: "SPLIT_SETTLED", ...shared, reference, splitId };
  }
  if (value.event === "PAYMENT_RECEIVED" || value.event === "PAYMENT_CONFIRMED") {
    if (!["RECEIVED", "CONFIRMED"].includes(value.payment.status))
      return { type: "IGNORE", eventId: value.id };
    return {
      type: "PAYMENT_RECEIVED", ...shared, reference,
      amountCents: Math.round(value.payment.value * 100),
    };
  }
  if (["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_DELETED"].includes(value.event))
    return { type: "PAYMENT_REVERSED", ...shared, reference };
  return { type: "IGNORE", eventId: value.id };
}

/** Use only on the server boundary, before parsing any webhook payload. */
export function validWebhookToken(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected || expected.length < 24 || received.length !== expected.length) return false;
  // Constant-time comparison for valid equal-length UTF-8 token strings.
  let different = 0;
  for (let i = 0; i < expected.length; i++) different |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return different === 0;
}
