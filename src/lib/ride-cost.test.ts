import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calculateRideCostSplit,
  recalculateCostAfterPassengerChange,
  validateRideCostUpdate,
  canUpdateRideCost,
  formatBrl,
  toCents,
  fromCents,
} from "./ride-cost";

describe("automatic ride cost splitting", () => {
  it("calculates cost split correctly for 1 passenger", () => {
    const result = calculateRideCostSplit({
      totalCost: 30,
      confirmedPassengers: 1,
    });

    expect(result.totalCost).toBe(30.0);
    expect(result.confirmedPassengers).toBe(1);
    expect(result.passengerContribution).toBe(30.0);
    expect(result.passengerContributionCents).toBe(3000);
    expect(result.driverReceives).toBe(30.0);
    expect(formatBrl(result.passengerContribution)).toContain("30,00");
  });

  it("calculates cost split correctly for 2 passengers", () => {
    const result = calculateRideCostSplit({
      totalCost: 30,
      confirmedPassengers: 2,
    });

    expect(result.totalCost).toBe(30.0);
    expect(result.confirmedPassengers).toBe(2);
    expect(result.passengerContribution).toBe(15.0);
    expect(result.passengerContributionCents).toBe(1500);
    expect(result.driverReceives).toBe(30.0);
    expect(formatBrl(result.passengerContribution)).toContain("15,00");
  });

  it("calculates cost split correctly for 3 passengers", () => {
    const result = calculateRideCostSplit({
      totalCost: 30,
      confirmedPassengers: 3,
    });

    expect(result.totalCost).toBe(30.0);
    expect(result.confirmedPassengers).toBe(3);
    expect(result.passengerContribution).toBe(10.0);
    expect(result.passengerContributionCents).toBe(1000);
    expect(result.driverReceives).toBe(30.0);
    expect(formatBrl(result.passengerContribution)).toContain("10,00");
  });

  it("recalculates cost when a passenger cancels", () => {
    // Inicialmente 2 passageiros dividindo R$ 30,00 = R$ 15,00 cada
    const initial = calculateRideCostSplit({
      totalCost: 30,
      confirmedPassengers: 2,
    });
    expect(initial.passengerContribution).toBe(15.0);

    // 1 passageiro cancela: sobrou 1 passageiro confirmado
    const afterOneCancels = recalculateCostAfterPassengerChange(30, 1);
    expect(afterOneCancels.confirmedPassengers).toBe(1);
    expect(afterOneCancels.passengerContribution).toBe(30.0);
    expect(afterOneCancels.driverReceives).toBe(30.0);

    // Se o passageiro restante também cancelar: 0 passageiros
    const afterAllCancel = recalculateCostAfterPassengerChange(30, 0);
    expect(afterAllCancel.confirmedPassengers).toBe(0);
    expect(afterAllCancel.passengerContribution).toBe(0.0);
    expect(afterAllCancel.driverReceives).toBe(0.0);
  });

  it("handles values with fractional cents accurately", () => {
    const result = calculateRideCostSplit({
      totalCost: 35.5,
      confirmedPassengers: 2,
    });

    expect(result.totalCost).toBe(35.5);
    expect(result.confirmedPassengers).toBe(2);
    expect(result.passengerContribution).toBe(17.75);
    expect(result.passengerContributionCents).toBe(1775);
    expect(result.driverReceives).toBe(35.5);
    expect(formatBrl(result.passengerContribution)).toContain("17,75");
  });

  it("handles rounding with indivisible cent remainder without recurring decimals", () => {
    // R$ 10,00 divididos entre 3 passageiros = 1000 / 3 = 333 centavos = R$ 3,33
    const result10 = calculateRideCostSplit({
      totalCost: 10,
      confirmedPassengers: 3,
    });

    expect(result10.passengerContribution).toBe(3.33);
    expect(result10.passengerContributionCents).toBe(333);
    expect(Number.isFinite(result10.passengerContribution)).toBe(true);
    expect(formatBrl(result10.passengerContribution)).toContain("3,33");

    // R$ 20,00 divididos entre 3 passageiros = 2000 / 3 = 667 centavos = R$ 6,67
    const result20 = calculateRideCostSplit({
      totalCost: 20,
      confirmedPassengers: 3,
    });
    expect(result20.passengerContribution).toBe(6.67);
    expect(result20.passengerContributionCents).toBe(667);
    expect(formatBrl(result20.passengerContribution)).toContain("6,67");
  });

  it("handles zero passengers without NaN, Infinity or division by zero", () => {
    const result = calculateRideCostSplit({
      totalCost: 30,
      confirmedPassengers: 0,
    });

    expect(result.totalCost).toBe(30.0);
    expect(result.confirmedPassengers).toBe(0);
    expect(result.passengerContribution).toBe(0.0);
    expect(result.passengerContributionCents).toBe(0);
    expect(result.driverReceives).toBe(0.0);
    expect(Number.isNaN(result.passengerContribution)).toBe(false);
    expect(Number.isFinite(result.passengerContribution)).toBe(true);
    expect(formatBrl(result.passengerContribution)).toContain("0,00");
  });

  it("prevents negative values or invalid numbers", () => {
    expect(() =>
      calculateRideCostSplit({ totalCost: -10, confirmedPassengers: 2 }),
    ).toThrow("não-negativo");

    expect(() =>
      calculateRideCostSplit({ totalCost: NaN, confirmedPassengers: 2 }),
    ).toThrow("não-negativo");

    expect(() =>
      calculateRideCostSplit({ totalCost: Infinity, confirmedPassengers: 2 }),
    ).toThrow("não-negativo");

    expect(() =>
      calculateRideCostSplit({ totalCost: 30, confirmedPassengers: -1 }),
    ).toThrow("maior ou igual a zero");
  });

  it("permits cost update before confirmation (status MATCHED)", () => {
    expect(canUpdateRideCost("MATCHED")).toBe(true);
    expect(canUpdateRideCost("open")).toBe(true);
    expect(canUpdateRideCost("available")).toBe(true);

    const updatedCost = validateRideCostUpdate("MATCHED", 45.5);
    expect(updatedCost).toBe(45.5);

    // Recalcula contribuição com o novo valor antes de confirmar
    const result = calculateRideCostSplit({
      totalCost: updatedCost,
      confirmedPassengers: 2,
    });
    expect(result.passengerContribution).toBe(22.75);
  });

  it("strictly rejects cost update after CONFIRMED, IN_PROGRESS, or terminal statuses", () => {
    expect(canUpdateRideCost("CONFIRMED")).toBe(false);
    expect(canUpdateRideCost("IN_PROGRESS")).toBe(false);
    expect(canUpdateRideCost("COMPLETED")).toBe(false);
    expect(canUpdateRideCost("CANCELLED")).toBe(false);

    expect(() => validateRideCostUpdate("CONFIRMED", 40)).toThrow(
      "Não é permitido alterar o valor de uma viagem com status 'CONFIRMED'",
    );

    expect(() => validateRideCostUpdate("IN_PROGRESS", 40)).toThrow(
      "Não é permitido alterar o valor de uma viagem com status 'IN_PROGRESS'",
    );

    expect(() => validateRideCostUpdate("COMPLETED", 40)).toThrow(
      "Não é permitido alterar o valor de uma viagem com status 'COMPLETED'",
    );
  });

  it("ensures consistency between displayed BRL text and calculated cents", () => {
    const input = { totalCost: 30, confirmedPassengers: 2 };
    const result = calculateRideCostSplit(input);

    const formattedTrip = formatBrl(result.totalCost);
    const formattedContribution = formatBrl(result.passengerContribution);

    expect(formattedTrip).toContain("30,00");
    expect(formattedContribution).toContain("15,00");

    // Conversão de centavos reversível
    expect(fromCents(toCents(result.passengerContribution))).toBe(15.0);
  });

  it("verifies migration 0027 contracts for cost persistence, recalculation and immutability", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "drizzle/migrations/0027_automatic_ride_cost_splitting.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS total_price numeric(10,2)");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS passenger_contribution numeric(10,2)",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.recalculate_ride_cost_split(p_offer_id uuid)",
    );
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.update_ride_total_cost",
    );
    // Imutabilidade estrita no banco
    expect(migration).toContain("IF ride_row.status NOT IN ('MATCHED') THEN");
    expect(migration).toContain(
      "Cannot update ride cost after confirmation. Current status:",
    );
    // Recálculo ao cancelar
    expect(migration).toContain("IF p_next_status IN ('CANCELLED', 'NO_SHOW') THEN");
    expect(migration).toContain(
      "PERFORM public.recalculate_ride_cost_split(ride_row.offer_id);",
    );
  });
});

