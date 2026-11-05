/**
 * Estimated Asaas Pix fee under the rate currently supplied by the project owner.
 * Not proof of the merchant-specific contract. Always reconcile the provider's
 * actual netValue before recognizing revenue or settling a split.
 */
export const ASAAS_ESTIMATED_PIX_RATE_BPS = 186; // 1.86%
export const ASAAS_ESTIMATED_PIX_FIXED_CENTS = 35; // R$ 0,35

/** Charges the passenger enough to cover an estimated fee on the TOTAL charge. */
export function estimateAsaasPixProcessing(
  fareCents: number,
  rateBps = ASAAS_ESTIMATED_PIX_RATE_BPS,
  fixedCents = ASAAS_ESTIMATED_PIX_FIXED_CENTS,
) {
  if (!Number.isSafeInteger(fareCents) || fareCents < 1 ||
      !Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps >= 10000 ||
      !Number.isSafeInteger(fixedCents) || fixedCents < 0) {
    throw new Error("Tarifa ou valor da viagem inválido.");
  }
  const lowerBound = Math.ceil((fareCents + fixedCents) * 10000 / (10000 - rateBps));
  if (!Number.isSafeInteger(lowerBound)) throw new Error("Preço acima do limite permitido.");
  // Provider fees are rounded to cents. Verify that our total covers the
  // estimated percentage and fixed fee (no fee-on-fee undercollection).
  let passengerTotalCents = Math.max(fareCents, lowerBound - 1);
  while (passengerTotalCents - fareCents <
    Math.round(passengerTotalCents * rateBps / 10000) + fixedCents) {
    passengerTotalCents++;
    if (!Number.isSafeInteger(passengerTotalCents))
      throw new Error("Preço acima do limite permitido.");
  }
  return {
    fareCents,
    processingFeeCents: passengerTotalCents - fareCents,
    passengerTotalCents,
    estimatedProviderCostCents:
      Math.round(passengerTotalCents * rateBps / 10000) + fixedCents,
    rateBps,
    fixedCents,
    verified: false as const,
  };
}
