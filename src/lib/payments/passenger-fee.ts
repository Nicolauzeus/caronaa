import { calculateGrossSplit } from "./commission";

/** All values are integer BRL cents; the processing fee is supplied by trusted server configuration. */
export type PassengerFeeQuote = {
  rideFareCents: number;
  processingFeeCents: number;
  passengerTotalCents: number;
  driverFixedCents: number;
  platformTargetNetCents: number;
  minimumNetCents: number;
};

export function quotePassengerPaysProcessingFee(
  rideFareCents: number,
  processingFeeCents: number,
): PassengerFeeQuote {
  if (!Number.isSafeInteger(processingFeeCents) || processingFeeCents < 0)
    throw new Error("Tarifa de processamento inválida");
  const split = calculateGrossSplit(rideFareCents);
  const passengerTotalCents = rideFareCents + processingFeeCents;
  if (!Number.isSafeInteger(passengerTotalCents))
    throw new Error("Valor total fora do limite");
  return {
    rideFareCents,
    processingFeeCents,
    passengerTotalCents,
    driverFixedCents: split.driverFixedCents,
    platformTargetNetCents: split.platformGrossCommissionCents,
    minimumNetCents: rideFareCents,
  };
}

/** Call after independently retrieving the Asaas payment's actual netValue. */
export function reconcilePassengerFeeQuote(
  quote: PassengerFeeQuote,
  asaasChargeCents: number,
  asaasNetCents: number,
) {
  if (!Number.isSafeInteger(asaasChargeCents) ||
      !Number.isSafeInteger(asaasNetCents) ||
      asaasChargeCents !== quote.passengerTotalCents ||
      asaasNetCents < 0 || asaasNetCents > asaasChargeCents)
    throw new Error("Valores Asaas divergentes da cotação persistida");
  const actualFeeCents = asaasChargeCents - asaasNetCents;
  const platformNetCents = asaasNetCents - quote.driverFixedCents;
  return {
    actualFeeCents,
    platformNetCents,
    driverFixedCents: quote.driverFixedCents,
    reconciled: platformNetCents === quote.platformTargetNetCents,
    differenceCents: platformNetCents - quote.platformTargetNetCents,
  };
}
