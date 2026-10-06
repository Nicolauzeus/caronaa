export const MIN_DRIVER_PRICE = 3.5;

export type DriverPricing = {
  driverPrice: number;
  caronaaFee: number;
  driverNetAmount: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCaronaaFee(driverPrice: number): number {
  return roundMoney(driverPrice * 0.25);
}

export function calculateDriverNet(driverPrice: number): number {
  return roundMoney(driverPrice - calculateCaronaaFee(driverPrice));
}

export function calculateDriverPricing(driverPrice: number): DriverPricing {
  const normalizedDriverPrice = roundMoney(driverPrice);

  const caronaaFee = calculateCaronaaFee(normalizedDriverPrice);

  return {
    driverPrice: normalizedDriverPrice,
    caronaaFee,
    driverNetAmount: calculateDriverNet(normalizedDriverPrice),
  };
}
