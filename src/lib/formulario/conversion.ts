import type { CaronaaStsFormData } from "./types";
import { normalizeStsSource } from "@/lib/funnel-events";
import { uuidSchema } from "@/lib/uuid";

export const FORM_CONVERSION_STORAGE_KEY = "caronaa-form-conversion-payload";

export interface FormConversionDraft {
  submissionId?: string | null;
  name?: string;
  whatsapp?: string;
  email?: string;
  intent?: CaronaaStsFormData["intent"];
  originNeighborhood?: string;
  destinationNeighborhood?: string;
  departureWindow?: CaronaaStsFormData["departureWindow"];
  preferences?: {
    genderPreference?: string;
    driverSeats?: number;
    passengerCount?: number;
    dualPriority?: string;
    comfortFactors?: string[];
  };
  source?: string;
  campaign?: string | null;
  campaignEvent?: string;
  timestamp?: number;
}

export function saveFormConversionDraft(data: Partial<CaronaaStsFormData>): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    const payload: FormConversionDraft = {
      submissionId: uuidSchema.safeParse(data.submissionId).success ? data.submissionId : null,
      name: data.name?.trim(),
      whatsapp: data.whatsapp?.trim(),
      email: data.email?.trim(),
      intent: data.intent,
      originNeighborhood: data.originNeighborhood,
      destinationNeighborhood: data.destinationNeighborhood,
      departureWindow: data.departureWindow,
      preferences: {
        genderPreference: data.driverGenderPreference || data.passengerGenderPreference,
        driverSeats: data.availableSeats,
        passengerCount: data.passengerCount,
        dualPriority: data.dualPriority,
        comfortFactors: data.driverComfortFactors,
      },
      source: normalizeStsSource(data.source),
      campaign: data.campaign,
      campaignEvent: data.campaignEvent,
      timestamp: Date.now(),
    };

    window.sessionStorage.setItem(FORM_CONVERSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[FormConversion] Erro ao salvar rascunho de conversão:", err);
  }
}

export function getFormConversionDraft(): FormConversionDraft | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  try {
    const item = window.sessionStorage.getItem(FORM_CONVERSION_STORAGE_KEY);
    if (!item) return null;
    const draft = JSON.parse(item) as FormConversionDraft;
    if (draft.submissionId && !uuidSchema.safeParse(draft.submissionId).success) {
      // A conversion refers to an existing row: never invent a replacement foreign key.
      draft.submissionId = null;
      window.sessionStorage.setItem(FORM_CONVERSION_STORAGE_KEY, JSON.stringify(draft));
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearFormConversionDraft(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    window.sessionStorage.removeItem(FORM_CONVERSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
