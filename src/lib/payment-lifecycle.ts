export const paymentStatuses = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

const allowedPaymentTransitions: Partial<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  PENDING: ["PROCESSING", "FAILED", "CANCELLED"],
  PROCESSING: ["PAID", "FAILED", "CANCELLED"],
  PAID: ["REFUNDED"],
};

export function transitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
  trustedProviderSource: boolean,
): PaymentStatus {
  if (from === to) return from;
  if (to === "PAID" && !trustedProviderSource) {
    throw new Error("Only a trusted payment provider may confirm payment");
  }
  if (!allowedPaymentTransitions[from]?.includes(to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
  return to;
}
