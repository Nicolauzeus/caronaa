export const CARONAA_COMMISSION_BASIS_POINTS = 1686;
export const DRIVER_SHARE_BASIS_POINTS = 8314;
export type GrossSplit = {
  grossCents: number;
  platformGrossCommissionCents: number;
  driverFixedCents: number;
  minimumNetCents: number;
};
/** Asaas fixedValue pays the driver from netValue; the platform absorbs Asaas fees. */
export function calculateGrossSplit(grossCents: number, estimatedNetCents?: number): GrossSplit {
  if (!Number.isSafeInteger(grossCents) || grossCents <= 0)
    throw new Error("Valor bruto inválido");
  const platformGrossCommissionCents = Math.round(grossCents * CARONAA_COMMISSION_BASIS_POINTS / 10000);
  const driverFixedCents = grossCents - platformGrossCommissionCents;
  if (estimatedNetCents !== undefined &&
      (!Number.isSafeInteger(estimatedNetCents) || estimatedNetCents < driverFixedCents || estimatedNetCents > grossCents))
    throw new Error("Saldo líquido insuficiente para o repasse do motorista");
  return { grossCents, platformGrossCommissionCents, driverFixedCents, minimumNetCents: driverFixedCents };
}
