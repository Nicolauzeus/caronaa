// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import type { CaronaaStsFormData } from "./types";
import { getLeadClassification } from "./classification";
import { calculateDriverPricing } from "./pricing";
import { normalizeStsSource } from "@/lib/funnel-events";
import { ensureUuid } from "@/lib/uuid";

export type CaronaaStsSubmission = {
  source: string;
  campaign: string | null | undefined;

  intent: NonNullable<CaronaaStsFormData["intent"]>;

  campaignEvent: string;

  leadType: ReturnType<typeof getLeadClassification>["leadType"];

  activationStatus: ReturnType<typeof getLeadClassification>["activationStatus"];

  wantsToUseToday: boolean;
  wantsToSeeMatch: boolean;
  prioritizeForMatching: boolean;

  destinationNeighborhood: string;
  destinationReference: string | null;
  destinationLocation?: CaronaaStsFormData["destinationLocation"];
  originNeighborhood: string | null;
  originLocation?: CaronaaStsFormData["originLocation"];
  departureWindow: NonNullable<CaronaaStsFormData["departureWindow"]> | null;
  occupation: CaronaaStsFormData["occupation"] | null;
  occupationDetails: string | null;
  weeklyFrequency: CaronaaStsFormData["weeklyFrequency"] | null;
  eventPresenceDays: string[] | null;
  eventPresenceCustom: string | null;

  name: string;
  whatsapp: string;
  email: string | null;
  feedback: string;

  // Consentimentos e Termos estruturados
  termsAccepted: boolean;
  privacyAccepted: boolean;
  researchAccepted: boolean;
  termsVersion: string;
  consentsTimestamp: string;

  passengerCount: number | null;
  currentTransport: CaronaaStsFormData["currentTransport"] | null;
  routeCostRange: CaronaaStsFormData["routeCostRange"] | null;
  costPeriod: CaronaaStsFormData["costPeriod"] | null;
  painPoints: CaronaaStsFormData["painPoints"] | null;
  mainPainPoint: CaronaaStsFormData["mainPainPoint"] | null;
  mainPainIntensity: number | null;
  passengerInterest: CaronaaStsFormData["passengerInterest"] | null;
  passengerTrustFactors: CaronaaStsFormData["passengerTrustFactors"] | null;
  passengerPriceRange: CaronaaStsFormData["passengerPriceRange"] | null;
  passengerCommitment: CaronaaStsFormData["passengerCommitment"] | null;

  vehicleType: CaronaaStsFormData["vehicleType"] | null;
  availableSeats: number | null;
  maxDetourMinutes: number | null;
  driverTrustFactors: CaronaaStsFormData["driverTrustFactors"] | null;
  driverPrice: number | null;
  caronaaFee: number | null;
  driverNetAmount: number | null;
  familyCarCompanions: number | null;
  driverInterest: CaronaaStsFormData["driverInterest"] | null;
  driverCommitment: CaronaaStsFormData["driverCommitment"] | null;

  proposalSense: CaronaaStsFormData["proposalSense"] | null;
  driverFutureOffer: CaronaaStsFormData["driverFutureOffer"] | null;
  driverComfortFactors: CaronaaStsFormData["driverComfortFactors"] | null;
  driverGenderPreference: CaronaaStsFormData["driverGenderPreference"] | null;
  driverBarriers: CaronaaStsFormData["driverBarriers"] | null;
  driverBarriersCustom: string | null;
  driverRealValidation: CaronaaStsFormData["driverRealValidation"] | null;

  // Novos campos estruturados do Passageiro e Dual
  passengerTransports: string[] | null;
  passengerTransportsCustom: string | null;
  passengerDifficulties: string[] | null;
  passengerDifficultiesCustom: string | null;
  passengerGenderPreference: CaronaaStsFormData["passengerGenderPreference"] | null;
  passengerFairPrice: number | null;
  passengerBarriers: string[] | null;
  passengerBarriersCustom: string | null;
  passengerIntention: CaronaaStsFormData["passengerIntention"] | null;
  dualPriority: CaronaaStsFormData["dualPriority"] | null;

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

  if (!data.name?.trim() || !data.whatsapp?.trim()) {
    throw new Error("Preencha nome e WhatsApp antes de enviar.");
  }

  const classification = getLeadClassification(data);

  const includePassenger = data.intent === "PASSAGEIRO" || data.intent === "AMBOS";

  const includeDriver = data.intent === "MOTORISTA" || data.intent === "AMBOS";

  const driverPricing =
    includeDriver && data.driverPrice !== undefined
      ? calculateDriverPricing(data.driverPrice)
      : null;

  return {
    source: normalizeStsSource(data.source),

    campaign: data.campaign ?? null,

    campaignEvent: data.campaignEvent ?? "Siará Tech Summit 2026",

    intent: data.intent,

    leadType: classification.leadType,

    activationStatus: classification.activationStatus,

    wantsToUseToday: classification.wantsToUseToday,

    wantsToSeeMatch: classification.wantsToSeeMatch,

    prioritizeForMatching: classification.prioritizeForMatching,

    destinationNeighborhood: data.destinationNeighborhood.trim(),

    destinationReference: cleanString(data.destinationReference),
    destinationLocation: data.destinationLocation ?? null,

    originNeighborhood: cleanString(data.originNeighborhood),
    originLocation: data.originLocation ?? null,

    departureWindow: data.departureWindow,

    occupation: data.occupation ?? null,
    occupationDetails: cleanString(data.occupationDetails),

    weeklyFrequency: data.weeklyFrequency ?? null,
    eventPresenceDays: data.eventPresenceDays ?? null,
    eventPresenceCustom: cleanString(data.eventPresenceCustom),

    name: data.name.trim(),

    whatsapp: normalizeWhatsapp(data.whatsapp),

    email: cleanString(data.email),

    feedback: cleanString(data.feedback) ?? "",

    termsAccepted: Boolean(data.termsAccepted),
    privacyAccepted: Boolean(data.privacyAccepted),
    researchAccepted: Boolean(data.researchAccepted),
    termsVersion: data.termsVersion ?? "sts_2026_v1",
    consentsTimestamp: data.consentsTimestamp ?? new Date().toISOString(),

    passengerCount: includePassenger ? (data.passengerCount ?? null) : null,

    currentTransport: data.currentTransport ?? null,

    routeCostRange: data.routeCostRange ?? null,

    costPeriod: data.costPeriod ?? null,

    painPoints: data.painPoints ?? null,

    mainPainPoint: data.mainPainPoint ?? null,

    mainPainIntensity: data.mainPainIntensity ?? null,

    passengerInterest: includePassenger
      ? (data.passengerInterest ??
        (data.passengerIntention === "TALVEZ"
          ? "TALVEZ"
          : data.passengerIntention
            ? "USARIA_HOJE"
            : data.proposalSense === "NAO_VEJO_SENTIDO"
              ? "PROVAVELMENTE_NAO"
              : data.proposalSense === "TALVEZ_DEPENDENDO"
                ? "TALVEZ"
                : "USARIA_HOJE"))
      : null,

    passengerTrustFactors: includePassenger ? (data.passengerTrustFactors ?? null) : null,

    passengerPriceRange: includePassenger ? (data.passengerPriceRange ?? null) : null,

    passengerCommitment: includePassenger ? (data.passengerCommitment ?? null) : null,

    vehicleType: includeDriver ? (data.vehicleType ?? null) : null,

    availableSeats:
      includeDriver && data.vehicleType !== "MOTO" ? (data.availableSeats ?? null) : null,

    maxDetourMinutes:
      includeDriver && data.vehicleType !== "MOTO" ? (data.maxDetourMinutes ?? null) : null,

    driverTrustFactors: includeDriver ? (data.driverTrustFactors ?? null) : null,

    driverPrice: driverPricing?.driverPrice ?? null,

    caronaaFee: driverPricing?.caronaaFee ?? null,

    driverNetAmount: driverPricing?.driverNetAmount ?? null,

    familyCarCompanions:
      includeDriver && data.vehicleType === "CARRO_COMPARTILHADO"
        ? (data.familyCarCompanions ?? null)
        : null,

    driverInterest: includeDriver
      ? (data.driverInterest ??
        (data.driverRealValidation === "TALVEZ"
          ? "TALVEZ"
          : data.driverRealValidation === "NAO"
            ? "PROVAVELMENTE_NAO"
            : data.driverRealValidation === "COM_CERTEZA"
              ? "USARIA_HOJE"
              : data.proposalSense === "NAO_VEJO_SENTIDO"
                ? "PROVAVELMENTE_NAO"
                : data.proposalSense === "TALVEZ_DEPENDENDO"
                  ? "TALVEZ"
                  : "USARIA_HOJE"))
      : null,

    driverCommitment: includeDriver ? (data.driverCommitment ?? null) : null,

    proposalSense: data.proposalSense ?? null,
    driverFutureOffer: data.driverFutureOffer ?? null,
    driverComfortFactors: data.driverComfortFactors ?? null,
    driverGenderPreference: data.driverGenderPreference ?? null,
    driverBarriers: data.driverBarriers ?? null,
    driverBarriersCustom: cleanString(data.driverBarriersCustom),
    driverRealValidation: data.driverRealValidation ?? null,

    passengerTransports: data.passengerTransports ?? null,
    passengerTransportsCustom: cleanString(data.passengerTransportsCustom),
    passengerDifficulties: data.passengerDifficulties ?? null,
    passengerDifficultiesCustom: cleanString(data.passengerDifficultiesCustom),
    passengerGenderPreference: data.passengerGenderPreference ?? null,
    passengerFairPrice: data.passengerFairPrice ?? null,
    passengerBarriers: data.passengerBarriers ?? null,
    passengerBarriersCustom: cleanString(data.passengerBarriersCustom),
    passengerIntention: data.passengerIntention ?? null,
    dualPriority: data.dualPriority ?? null,

    submissionId: ensureUuid(data.submissionId),

    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

const duplicatedStructuredFields = new Set([
  "name",
  "whatsapp",
  "email",
  "destinationNeighborhood",
  "originNeighborhood",
  "destinationReference",
  "intent",
  "occupation",
  "weeklyFrequency",
  "departureWindow",
  "currentTransport",
  "routeCostRange",
  "costPeriod",
  "campaign",
  "source",
  "campaignEvent",
  "submissionId",
  "createdAt",
]);

const rawPayloadAllowlist = new Set([
  "campaign",
  "campaignEvent",
  "leadType",
  "activationStatus",
  "wantsToUseToday",
  "wantsToSeeMatch",
  "prioritizeForMatching",
  "passengerCount",
  "painPoints",
  "mainPainPoint",
  "mainPainIntensity",
  "passengerInterest",
  "passengerTrustFactors",
  "passengerPriceRange",
  "passengerCommitment",
  "vehicleType",
  "availableSeats",
  "maxDetourMinutes",
  "driverTrustFactors",
  "driverPrice",
  "caronaaFee",
  "driverNetAmount",
  "familyCarCompanions",
  "driverInterest",
  "driverCommitment",
  "occupationDetails",
  "eventPresenceDays",
  "eventPresenceCustom",
  "originLocation",
  "destinationLocation",
  "proposalSense",
  "driverFutureOffer",
  "driverComfortFactors",
  "driverGenderPreference",
  "driverBarriers",
  "driverBarriersCustom",
  "driverRealValidation",
  "passengerTransports",
  "passengerTransportsCustom",
  "passengerDifficulties",
  "passengerDifficultiesCustom",
  "passengerGenderPreference",
  "passengerFairPrice",
  "passengerBarriers",
  "passengerBarriersCustom",
  "passengerIntention",
  "dualPriority",
  "feedback",
  "termsAccepted",
  "privacyAccepted",
  "researchAccepted",
  "termsVersion",
  "consentsTimestamp",
]);

/** Removes PII and values already stored in dedicated form_submissions columns from new raw payloads. */
export function sanitizeSubmissionRawPayload(
  payload: CaronaaStsSubmission,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        !duplicatedStructuredFields.has(key) &&
        rawPayloadAllowlist.has(key) &&
        value !== null &&
        value !== undefined,
    ),
  );
}
