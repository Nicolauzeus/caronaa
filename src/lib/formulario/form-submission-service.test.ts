import { describe, expect, it } from "vitest";

import { assertPainPointIntegrity } from "./form-submission-service";

const validRows = [
  { selecionada: true, principal: true, intensidade: 4 },
  { selecionada: true, principal: false, intensidade: null },
  { selecionada: false, principal: false, intensidade: null },
] as const;

describe("form pain payload integrity", () => {
  it("accepts selected pains with exactly one principal pain", () => {
    expect(() => assertPainPointIntegrity(validRows as unknown as never[])).not.toThrow();
  });

  it("accepts no principal when no pain is selected", () => {
    expect(() =>
      assertPainPointIntegrity(
        validRows.map((row) => ({
          ...row,
          selecionada: false,
          principal: false,
          intensidade: null,
        })) as never[],
      ),
    ).not.toThrow();
  });

  it("rejects two principal pains", () => {
    expect(() =>
      assertPainPointIntegrity([
        { ...validRows[0]!, principal: true },
        { ...validRows[1]!, principal: true },
      ] as never[]),
    ).toThrow();
  });

  it("rejects selected pains without a principal pain", () => {
    expect(() =>
      assertPainPointIntegrity(validRows.map((row) => ({ ...row, principal: false })) as never[]),
    ).toThrow();
  });

  it("rejects a principal pain that was not selected", () => {
    expect(() =>
      assertPainPointIntegrity([{ ...validRows[0]!, selecionada: false }] as never[]),
    ).toThrow();
  });

  it("rejects a principal pain without a valid intensity", () => {
    expect(() =>
      assertPainPointIntegrity([{ ...validRows[0]!, intensidade: 6 }] as never[]),
    ).toThrow();
  });
});

describe("buildFormSubmissionRow RPC compatibility", () => {
  const basePayload = {
    submissionId: "00000000-0000-0000-0000-000000000001",
    source: "sts-2026",
    campaign: null,
    campaignEvent: "Siará Tech Summit 2026",
    createdAt: new Date().toISOString(),
    name: "Aceltino",
    whatsapp: "85999999999",
    email: "aceltino@example.com",
    destinationNeighborhood: "Centro de Eventos do Ceará",
    destinationReference: null,
    originNeighborhood: "Aldeota",
    departureWindow: "08:00 - 09:00",
    occupation: "ESTUDANTE_UNIVERSITARIO" as const,
    occupationDetails: null,
    weeklyFrequency: "DIARIAMENTE" as const,
    eventPresenceDays: ["DIA_1"],
    eventPresenceCustom: null,
    termsAccepted: true,
    privacyAccepted: true,
    researchAccepted: false,
    termsVersion: "sts_2026_v1",
    consentsTimestamp: new Date().toISOString(),
    feedback: "",
    leadType: "VALIDATION_LEAD" as const,
    activationStatus: "ACTIVE" as const,
    wantsToUseToday: true,
    wantsToSeeMatch: true,
    prioritizeForMatching: true,
    currentTransport: "ONIBUS" as const,
    routeCostRange: "ATE_10" as const,
    costPeriod: "POR_TRECHO" as const,
    painPoints: ["DOR_01" as const],
    mainPainPoint: "DOR_01" as const,
    mainPainIntensity: 4,
    passengerCount: 1,
    passengerTrustFactors: null,
    passengerPriceRange: null,
    passengerCommitment: null,
    vehicleType: null,
    availableSeats: null,
    maxDetourMinutes: null,
    driverTrustFactors: null,
    driverPrice: null,
    caronaaFee: null,
    driverNetAmount: null,
    familyCarCompanions: null,
    driverInterest: null,
    driverCommitment: null,
    proposalSense: null,
    driverFutureOffer: null,
    driverComfortFactors: null,
    driverGenderPreference: null,
    driverBarriers: null,
    driverBarriersCustom: null,
    driverRealValidation: null,
    passengerTransports: null,
    passengerTransportsCustom: null,
    passengerDifficulties: null,
    passengerDifficultiesCustom: null,
    passengerGenderPreference: null,
    passengerFairPrice: null,
    passengerBarriers: null,
    passengerBarriersCustom: null,
    passengerIntention: null,
    dualPriority: null,
  };

  it("sets passengerInterest, passenger_interest, and intencao_passageiro for PASSAGEIRO", async () => {
    const { buildFormSubmissionRow } = await import("./form-submission-service");
    const row = buildFormSubmissionRow({
      ...basePayload,
      intent: "PASSAGEIRO",
      passengerInterest: null,
    });

    // Validates that both SQL table column and RPC 0017 aliases are set to a valid form_intencao
    expect(row.intencao_passageiro).toBe("HOJE");
    expect(row.passengerInterest).toBe("HOJE");
    expect(row.passenger_interest).toBe("HOJE");
    expect(row.intencao_motorista).toBeNull();
    expect(row.driverInterest).toBeNull();

    // Validates other aliases
    expect(row.departureWindow).toBe("08:00 - 09:00");
    expect(row.departure_window).toBe("08:00 - 09:00");
    expect(row.costPeriod).toBe("TRECHO");
    expect(row.cost_period).toBe("TRECHO");
  });

  it("sets driverInterest, driver_interest, and intencao_motorista for MOTORISTA", async () => {
    const { buildFormSubmissionRow } = await import("./form-submission-service");
    const row = buildFormSubmissionRow({
      ...basePayload,
      intent: "MOTORISTA",
      driverInterest: null,
      driverRealValidation: "COM_CERTEZA",
    });

    expect(row.intencao_motorista).toBe("HOJE");
    expect(row.driverInterest).toBe("HOJE");
    expect(row.driver_interest).toBe("HOJE");
    expect(row.intencao_passageiro).toBeNull();
    expect(row.passengerInterest).toBeNull();
  });

  it("sets both interests for AMBOS", async () => {
    const { buildFormSubmissionRow } = await import("./form-submission-service");
    const row = buildFormSubmissionRow({
      ...basePayload,
      intent: "AMBOS",
      passengerInterest: "TALVEZ",
      driverInterest: "USARIA_HOJE",
    });

    expect(row.intencao_passageiro).toBe("TALVEZ");
    expect(row.passengerInterest).toBe("TALVEZ");
    expect(row.passenger_interest).toBe("TALVEZ");
    expect(row.intencao_motorista).toBe("HOJE");
    expect(row.driverInterest).toBe("HOJE");
    expect(row.driver_interest).toBe("HOJE");
  });
});
