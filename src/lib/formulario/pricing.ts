export const MIN_DRIVER_PRICE = 3.5;

export type DriverPricing = {
  driverPrice: number;
  caronaaFee: number;
  driverNetAmount: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDriverPricing(driverPrice: number): DriverPricing {
  const normalizedDriverPrice = roundMoney(driverPrice);

  const caronaaFee = roundMoney(normalizedDriverPrice * 0.15);

  return {
    driverPrice: normalizedDriverPrice,
    caronaaFee,
    driverNetAmount: roundMoney(normalizedDriverPrice - caronaaFee),
  };
}
