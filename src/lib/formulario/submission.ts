import type { CaronaaStsFormData } from "./types";
import { getLeadClassification } from "./classification";

export type CaronaaStsSubmission = {
  source: "sts-2026";

  intent: CaronaaStsFormData["intent"];

  leadType: ReturnType<typeof getLeadClassification>["leadType"];

  activationStatus: ReturnType<typeof getLeadClassification>["activationStatus"];

  wantsToUseToday: boolean;
  wantsToSeeMatch: boolean;
  prioritizeForMatching: boolean;

  destinationNeighborhood: string;
  destinationReference: string | null;
  departureWindow: CaronaaStsFormData["departureWindow"] | null;

  name: string;
  whatsapp: string;

  passengerCount: number | null;
  currentTransport: CaronaaStsFormData["currentTransport"] | null;
  passengerTrustFactors: CaronaaStsFormData["passengerTrustFactors"] | null;
  passengerPriceRange: CaronaaStsFormData["passengerPriceRange"] | null;
  passengerCommitment: CaronaaStsFormData["passengerCommitment"] | null;

  vehicleType: CaronaaStsFormData["vehicleType"] | null;
  availableSeats: number | null;
  maxDetourMinutes: number | null;
  driverTrustFactors: CaronaaStsFormData["driverTrustFactors"] | null;
  driverPriceRange: CaronaaStsFormData["driverPriceRange"] | null;
  driverCommitment: CaronaaStsFormData["driverCommitment"] | null;

  submissionId: string;
  createdAt: string;
};

function cleanString(value?: string): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeWhatsapp(value: string): string {
  return value.replace(/\D/g, "");
}

function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function prepareSubmission(data: CaronaaStsFormData): CaronaaStsSubmission {
  if (!data.intent) {
    throw new Error("Não é possível preparar a submissão sem intenção.");
  }

  if (!data.destinationNeighborhood?.trim()) {
    throw new Error("Não é possível preparar a submissão sem destino.");
  }

  if (!data.departureWindow) {
    throw new Error("Não é possível preparar a submissão sem horário de saída.");
  }

  if (!data.name?.trim()) {
    throw new Error("Não é possível preparar a submissão sem nome.");
  }

  if (!data.whatsapp?.trim()) {
    throw new Error("Não é possível preparar a submissão sem WhatsApp.");
  }

  const classification = getLeadClassification(data);

  const includePassenger = data.intent === "PASSAGEIRO" || data.intent === "AMBOS";

  const includeDriver = data.intent === "MOTORISTA" || data.intent === "AMBOS";

  return {
    source: "sts-2026",

    intent: data.intent,

    leadType: classification.leadType,

    activationStatus: classification.activationStatus,

    wantsToUseToday: classification.wantsToUseToday,

    wantsToSeeMatch: classification.wantsToSeeMatch,

    prioritizeForMatching: classification.prioritizeForMatching,

    destinationNeighborhood: data.destinationNeighborhood.trim(),

    destinationReference: cleanString(data.destinationReference),

    departureWindow: data.departureWindow,

    name: data.name.trim(),

    whatsapp: normalizeWhatsapp(data.whatsapp),

    passengerCount: includePassenger ? (data.passengerCount ?? null) : null,

    currentTransport: includePassenger ? (data.currentTransport ?? null) : null,

    passengerTrustFactors: includePassenger ? (data.passengerTrustFactors ?? null) : null,

    passengerPriceRange: includePassenger ? (data.passengerPriceRange ?? null) : null,

    passengerCommitment: includePassenger ? (data.passengerCommitment ?? null) : null,

    vehicleType: includeDriver ? (data.vehicleType ?? null) : null,

    availableSeats:
      includeDriver && data.vehicleType !== "MOTO" ? (data.availableSeats ?? null) : null,

    maxDetourMinutes:
      includeDriver && data.vehicleType !== "MOTO" ? (data.maxDetourMinutes ?? null) : null,

    driverTrustFactors: includeDriver ? (data.driverTrustFactors ?? null) : null,

    driverPriceRange: includeDriver ? (data.driverPriceRange ?? null) : null,

    driverCommitment: includeDriver ? (data.driverCommitment ?? null) : null,

    submissionId: data.submissionId ?? createSubmissionId(),

    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}
