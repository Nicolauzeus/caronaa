/**
 * Version-independent administrative classification by the immutable question
 * semanticCode. These rules never change stored answers or survey schemas.
 * Unknown/custom questions fall back to their published label and remain readable.
 */
export type CrmAnswerCategory =
  | "identity" | "duplicate" | "routine" | "fit"
  | "pain" | "primary" | "barrier" | "other";

export type CrmSemanticRule = {
  category: CrmAnswerCategory;
  label?: string;
  money?: boolean;
};

const identity: CrmSemanticRule = { category: "identity" };
const vehicle: CrmSemanticRule = { category: "duplicate" };
const pain: CrmSemanticRule = { category: "pain" };
const primary: CrmSemanticRule = { category: "primary" };

export const CRM_SEMANTIC_RULES: Readonly<Record<string, CrmSemanticRule>> = {
  // Stable identity and questions already represented by the CRM contact.
  ACADEMIC_PARTICIPANT_NAME: identity,
  MOBILITY_PARTICIPANT_NAME: identity,
  ACADEMIC_ROLE: identity,
  MOBILITY_AFFILIATION: identity,
  RESEARCH_PARTICIPANT_ROLE: identity,
  JOURNEY_PROFILE: identity,
  NAME: identity, EMAIL: identity, PHONE: identity,

  // Route and vehicle values are taken from the per-participation journey when
  // present. Keep the declared answer only if a journey field is absent.
  URBAN_OFFER_VEHICLE: vehicle,
  REGIONAL_OFFER_VEHICLE: vehicle,
  ACADEMIC_VEHICLE_MODEL: vehicle,
  SEATS_AVAILABLE: vehicle,
  JOURNEY_ORIGIN: vehicle,
  JOURNEY_DESTINATION: vehicle,
  JOURNEY_DEPARTURE_TIME: vehicle,

  TRANSPORT_MODE: { category: "routine", label: "Transporte atual" },
  MOBILITY_MODE: { category: "routine", label: "Modalidade de deslocamento" },
  WAIT_TIME: { category: "routine", label: "Tempo de espera declarado", },
  TRAVEL_TIME: { category: "routine", label: "Tempo no deslocamento" },
  COST_PER_TRIP: { category: "routine", label: "Gasto habitual por trecho", money: true },
  TRAVEL_FREQUENCY: { category: "routine", label: "Frequência de deslocamento" },
  NORMALIZED_DEPARTURE_TIME: { category: "routine", label: "Horário declarado" },
  COMPANY_DRIVING_FREQUENCY: { category: "routine", label: "Frequência ao dirigir" },
  WORK_SHIFT: { category: "routine", label: "Turno de trabalho" },
  DRIVER_MONTHLY_COST: { category: "routine", label: "Custo mensal declarado", money: true },

  MOBILITY_PAINS: pain,
  MOBILITY_PRIMARY_PAIN: primary,
  URBAN_PRIMARY_PAIN: primary,
  REGIONAL_PRIMARY_PAIN: primary,
  MOBILITY_OTHER_PAIN: { category: "pain", label: "Outra dificuldade" },
  REGIONAL_BARRIER: { category: "barrier", label: "Maior receio/barreira" },
  TRUST_BARRIERS: { category: "barrier", label: "Barreira de confiança" },
  DRIVER_BARRIERS: { category: "barrier", label: "Barreiras do motorista" },

  REGIONAL_SERVICE_PREFERENCE: { category: "fit", label: "Interesse" },
  ADOPTION_INTENT: { category: "fit", label: "Disposição de uso" },
  ACCEPTABLE_FARE_RANGE: { category: "fit", label: "Orçamento por trecho" },
  WILLINGNESS_TO_PAY: { category: "fit", label: "Disposição a pagar" },
  QUOTE_ACCEPTANCE_INTENT: { category: "fit", label: "Interesse em cotação" },
  LAUNCH_PARTICIPATION_INTENT: { category: "fit", label: "Alerta de lançamento" },
  BOOKING_INTENT: { category: "fit", label: "Interesse em preparar trajeto" },
  RIDE_OFFER_INTENT: { category: "fit", label: "Interesse em oferecer carona" },
  URBAN_OFFER_POSSIBLE: { category: "fit", label: "Disponibilidade para oferecer" },
  REGIONAL_OFFER_POSSIBLE: { category: "fit", label: "Disponibilidade para oferecer" },
  REGIONAL_PROFESSIONAL_INTEREST: { category: "fit", label: "Interesse profissional declarado" },
  REGIONAL_PROFESSIONAL_ROLE: { category: "fit", label: "Atividade profissional declarada" },
  ACADEMIC_PASSENGER_PRIORITY: { category: "fit", label: "Prioridade ao viajar" },
  ACADEMIC_DRIVER_PRIORITY: { category: "fit", label: "Prioridade ao dirigir" },
  TRUST_FACTORS: { category: "fit", label: "Critério de decisão" },
  URBAN_DRIVER_MOTIVATION: { category: "fit", label: "Motivação para oferecer" },
  COMPANY_MAX_DETOUR: { category: "fit", label: "Desvio máximo declarado" },
  COMPANY_DRIVES_CAR: { category: "fit", label: "Dirige para o trabalho" },
  CORP_DRIVES_CAR: { category: "fit", label: "Dirige para o trabalho" },
  LAUNCH_PREFERENCE: { category: "fit", label: "Preferência no lançamento" },
  ACQUISITION_SOURCE: { category: "other", label: "Como conheceu o CARONAA" },

  EVENT_OFFER_POSSIBLE: { category: "fit", label: "Pode oferecer carona" },
  EVENT_INTEREST: { category: "fit", label: "Interesse declarado" },
};

export function crmSemanticRule(code: unknown): CrmSemanticRule | null {
  if (typeof code !== "string") return null;
  return CRM_SEMANTIC_RULES[code.trim().toUpperCase()] ?? null;
}

const TECHNICAL_KEYS = new Set([
  "answers_raw", "raw_payload", "answers_structured", "journey", "version", "form",
  "formId", "submissionId", "submissionKey", "receipt", "receiptId", "uuid",
  "hash", "termsAccepted", "privacyAccepted", "researchAccepted", "termsVersion",
  "consentsTimestamp", "createdAt", "updatedAt", "created_at", "updated_at",
  "metadata", "providerId", "userId", "user_id", "lat", "lng", "latitude",
  "longitude", "originLat", "originLng", "destinationLat", "destinationLng",
]);

export function isTechnicalCrmField(key: string): boolean {
  return TECHNICAL_KEYS.has(key) ||
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(key) ||
    /(?:_id|Id|_hash|Hash|_token|Token)$/.test(key);
}
