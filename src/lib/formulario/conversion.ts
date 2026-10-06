import type { CaronaaStsFormData } from "./types";

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
      submissionId: data.submissionId ?? null,
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
      source: data.source,
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
    return JSON.parse(item) as FormConversionDraft;
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
