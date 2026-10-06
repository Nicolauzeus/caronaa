import type { CaronaaStsFormData } from "./types";
import type { FormStep } from "./flow";

const DRAFT_STORAGE_KEY = "caronaa-formulario-draft-v1";

export interface FormDraftState {
  data: Partial<CaronaaStsFormData>;
  step: FormStep;
  savedAt: number;
}

export function saveFormDraft(data: Partial<CaronaaStsFormData>, step: FormStep): void {
  if (typeof window === "undefined") return;

  try {
    const payload: FormDraftState = {
      data,
      step,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[DraftStorage] Não foi possível salvar o rascunho:", err);
  }
}

export function loadFormDraft(): FormDraftState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as FormDraftState;
    if (!parsed || typeof parsed !== "object" || !parsed.data) {
      return null;
    }

    // Validade do rascunho: 24 horas
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      clearFormDraft();
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[DraftStorage] Erro ao carregar rascunho:", err);
    return null;
  }
}

export function clearFormDraft(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore cleanup errors
  }
}
