import type { CaronaaIntent, CaronaaStsFormData, CommitmentLevel, InterestLevel } from "./types";

export type LeadType = "POTENCIAL_MOTORISTA" | "POTENCIAL_PASSAGEIRO" | "AMBOS" | "INTERESSADO";

export type StsActivationStatus =
  "QUER_USAR_HOJE" | "QUER_VER_MATCH" | "NAO_USA_HOJE" | "INDEFINIDO";

export function classifyLeadType(intent?: CaronaaIntent): LeadType {
  switch (intent) {
    case "MOTORISTA":
      return "POTENCIAL_MOTORISTA";

    case "PASSAGEIRO":
      return "POTENCIAL_PASSAGEIRO";

    case "AMBOS":
      return "AMBOS";

    default:
      return "INTERESSADO";
  }
}

function classifyCommitment(commitment?: CommitmentLevel): StsActivationStatus {
  switch (commitment) {
    case "SIM_HOJE":
      return "QUER_USAR_HOJE";

    case "QUERO_VER_MATCH":
      return "QUER_VER_MATCH";

    case "NAO_HOJE":
      return "NAO_USA_HOJE";

    default:
      return "INDEFINIDO";
  }
}

function classifyInterest(interest?: InterestLevel): StsActivationStatus {
  switch (interest) {
    case "USARIA_HOJE":
      return "QUER_USAR_HOJE";

    case "PROVAVELMENTE_USARIA":
    case "TALVEZ":
      return "QUER_VER_MATCH";

    case "PROVAVELMENTE_NAO":
    case "NAO_USARIA":
      return "NAO_USA_HOJE";

    default:
      return "INDEFINIDO";
  }
}

export function getStsActivationStatus(data: CaronaaStsFormData): StsActivationStatus {
  if (data.intent === "PASSAGEIRO") {
    return classifyInterest(data.passengerInterest) !== "INDEFINIDO"
      ? classifyInterest(data.passengerInterest)
      : classifyCommitment(data.passengerCommitment);
  }

  if (data.intent === "MOTORISTA") {
    return classifyInterest(data.driverInterest) !== "INDEFINIDO"
      ? classifyInterest(data.driverInterest)
      : classifyCommitment(data.driverCommitment);
  }

  if (data.intent === "AMBOS") {
    const passengerStatus =
      classifyInterest(data.passengerInterest) !== "INDEFINIDO"
        ? classifyInterest(data.passengerInterest)
        : classifyCommitment(data.passengerCommitment);

    const driverStatus =
      classifyInterest(data.driverInterest) !== "INDEFINIDO"
        ? classifyInterest(data.driverInterest)
        : classifyCommitment(data.driverCommitment);

    if (passengerStatus === "QUER_USAR_HOJE" || driverStatus === "QUER_USAR_HOJE") {
      return "QUER_USAR_HOJE";
    }

    if (passengerStatus === "QUER_VER_MATCH" || driverStatus === "QUER_VER_MATCH") {
      return "QUER_VER_MATCH";
    }

    if (passengerStatus === "NAO_USA_HOJE" && driverStatus === "NAO_USA_HOJE") {
      return "NAO_USA_HOJE";
    }

    return "INDEFINIDO";
  }

  return "INDEFINIDO";
}

export function wantsToUseToday(data: CaronaaStsFormData): boolean {
  return getStsActivationStatus(data) === "QUER_USAR_HOJE";
}

export function wantsToSeeMatch(data: CaronaaStsFormData): boolean {
  const status = getStsActivationStatus(data);

  return status === "QUER_USAR_HOJE" || status === "QUER_VER_MATCH";
}

export function shouldPrioritizeForMatching(data: CaronaaStsFormData): boolean {
  if (!data.intent) {
    return false;
  }

  if (!data.destinationNeighborhood) {
    return false;
  }

  if (!data.departureWindow) {
    return false;
  }

  return wantsToSeeMatch(data);
}

export function getLeadClassification(data: CaronaaStsFormData) {
  return {
    leadType: classifyLeadType(data.intent),
    activationStatus: getStsActivationStatus(data),
    wantsToUseToday: wantsToUseToday(data),
    wantsToSeeMatch: wantsToSeeMatch(data),
    prioritizeForMatching: shouldPrioritizeForMatching(data),
  };
}
