import { quotePassengerPaysProcessingFee } from "./passenger-fee";

/** Server-side preflight only. This does NOT create a payment or reserve seats. */
export type CheckoutPreflight = {
  reservationId: string;
  payerUserId: string;
  authenticatedUserId: string;
  reservationStatus: "ACCEPTED" | "PENDING" | "CANCELLED" | "COMPLETED";
  rideFareCents: number;
  verifiedProcessingFeeCents: number | null;
  feeSource: "ASAAS_ACCOUNT_VERIFIED" | "UNVERIFIED";
  acceptedTotalCents: number | null;
  acceptedAt: string | null;
  driverWalletId: string | null;
  driverUserId: string;
  environment: "sandbox" | "production";
  chargesEnabled: boolean;
};

export function validateCheckoutPreflight(input: CheckoutPreflight) {
  if (!input.chargesEnabled) throw new Error("Cobranças Asaas ainda estão desativadas");
  if (input.environment !== "sandbox") throw new Error("Pagamento de produção não habilitado");
  if (!input.reservationId || !input.authenticatedUserId ||
      input.payerUserId !== input.authenticatedUserId ||
      input.driverUserId === input.payerUserId) throw new Error("Reserva sem autorização");
  if (input.reservationStatus !== "ACCEPTED") throw new Error("Reserva sem confirmação de ambas as partes");
  if (input.feeSource !== "ASAAS_ACCOUNT_VERIFIED" || input.verifiedProcessingFeeCents === null)
    throw new Error("Tarifa Asaas ainda não verificada");
  if (!input.driverWalletId?.trim()) throw new Error("Motorista sem carteira Asaas validada");
  const quote = quotePassengerPaysProcessingFee(input.rideFareCents, input.verifiedProcessingFeeCents);
  if (!input.acceptedAt || !Number.isFinite(Date.parse(input.acceptedAt)) ||
      input.acceptedTotalCents !== quote.passengerTotalCents)
    throw new Error("O passageiro ainda não aceitou o valor completo da cobrança");
  return quote;
}
