/**
 * Centralized ride cost and automatic splitting logic for CARONAA.
 *
 * Rules:
 * - Driver defines (or system defaults) the total ride cost (in BRL).
 * - Total cost is strictly divided equally among confirmed passengers.
 * - All calculations are normalized to cents to prevent floating point inaccuracies.
 * - If confirmed passengers is 0, passenger contribution is 0 (prevents division by zero/NaN/Infinity).
 * - Price updates are permitted strictly before ride confirmation (e.g. status MATCHED).
 *   Once CONFIRMED or IN_PROGRESS, price alterations are blocked.
 */

export type RideCostCalculationInput = {
  totalCost: number;
  confirmedPassengers: number;
};

export type RideCostCalculationResult = {
  totalCost: number;
  totalCostCents: number;
  confirmedPassengers: number;
  passengerContribution: number;
  passengerContributionCents: number;
  driverReceives: number;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function calculateRideCostSplit(
  input: RideCostCalculationInput,
): RideCostCalculationResult {
  const { totalCost, confirmedPassengers } = input;

  if (typeof totalCost !== "number" || !Number.isFinite(totalCost) || totalCost < 0) {
    throw new Error(
      "O valor total da viagem deve ser um número não-negativo válido.",
    );
  }

  if (
    typeof confirmedPassengers !== "number" ||
    !Number.isFinite(confirmedPassengers) ||
    confirmedPassengers < 0 ||
    !Number.isInteger(confirmedPassengers)
  ) {
    throw new Error(
      "A quantidade de passageiros confirmados deve ser um número inteiro maior ou igual a zero.",
    );
  }

  const totalCostCents = toCents(totalCost);
  const normalizedTotal = fromCents(totalCostCents);

  if (confirmedPassengers === 0) {
    return {
      totalCost: normalizedTotal,
      totalCostCents,
      confirmedPassengers: 0,
      passengerContribution: 0,
      passengerContributionCents: 0,
      driverReceives: 0,
    };
  }

  // Divisão com arredondamento exato em centavos
  const passengerContributionCents = Math.round(
    totalCostCents / confirmedPassengers,
  );
  const passengerContribution = fromCents(passengerContributionCents);
  const driverReceives = fromCents(
    passengerContributionCents * confirmedPassengers,
  );

  return {
    totalCost: normalizedTotal,
    totalCostCents,
    confirmedPassengers,
    passengerContribution,
    passengerContributionCents,
    driverReceives,
  };
}

export function recalculateCostAfterPassengerChange(
  currentTotalCost: number,
  newConfirmedPassengers: number,
): RideCostCalculationResult {
  return calculateRideCostSplit({
    totalCost: currentTotalCost,
    confirmedPassengers: newConfirmedPassengers,
  });
}

export function canUpdateRideCost(status: string): boolean {
  return status === "MATCHED" || status === "open" || status === "available";
}

export function validateRideCostUpdate(
  status: string,
  nextTotalCost: number,
): number {
  if (!canUpdateRideCost(status)) {
    throw new Error(
      `Não é permitido alterar o valor de uma viagem com status '${status}'. Alterações de valor só são permitidas antes da confirmação da corrida.`,
    );
  }

  if (
    typeof nextTotalCost !== "number" ||
    !Number.isFinite(nextTotalCost) ||
    nextTotalCost < 0
  ) {
    throw new Error(
      "O valor da viagem deve ser um número positivo ou zero válido.",
    );
  }

  return roundMoney(nextTotalCost);
}

export function formatBrl(value: number): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

