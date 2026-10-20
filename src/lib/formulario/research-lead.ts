import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as {
  rpc(name: string, args?: Record<string, unknown>):
    PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeResearchEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function validResearchEmail(email: string): boolean {
  const value = normalizeResearchEmail(email);
  return value.length >= 6 && value.length <= 180 && emailPattern.test(value);
}

/** Allows the new flow only after the matching migration is actually available. */
export async function researchLeadCaptureEnabled(formId: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("research_contact_capture_enabled", { p_form_id: formId });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function captureResearchLead(input: {
  formId: string; receipt: string; email: string;
  linkageConsent: boolean; marketingConsent: boolean;
}): Promise<void> {
  if (!validResearchEmail(input.email)) throw new Error("Confira o formato do e-mail.");
  if (!input.linkageConsent) throw new Error("Confirme o tratamento do e-mail para reconhecer sua participação.");
  const { data, error } = await db.rpc("capture_research_lead", {
    p_form_id: input.formId,
    p_submission_key: input.receipt,
    p_email: normalizeResearchEmail(input.email),
    p_linkage_consent: true,
    p_marketing_consent: input.marketingConsent,
  });
  if (error || !["captured", "already_captured"].includes(String(data)))
    throw new Error("Sua resposta foi salva, mas não foi possível registrar o e-mail. Tente novamente.");
}

export type ResearchLeadStatus =
  | "SEM_CADASTRO" | "CADASTRO_NAO_CONFIRMADO" | "CONTA_CONFIRMADA";
export type ResearchLeadRow = {
  email: string; form_id: string; form_title: string; source_code: string;
  captured_at: string; marketing_consent: boolean;
  registration_status: ResearchLeadStatus; total_count: number;
};
export type ResearchLeadMetrics = {
  contacts: number;
  withoutAccount: number;
  pendingConfirmation: number;
  confirmedAccounts: number;
  marketingOptIn: number;
};
export async function getAdminResearchLeadMetrics(formId?: string): Promise<ResearchLeadMetrics> {
  const { data, error } = await db.rpc("get_admin_research_lead_metrics", { p_form_id: formId || null });
  if (error || !data || typeof data !== "object")
    throw new Error("Indicadores da captação indisponíveis. Confira a migration 0103.");
  const value = data as Record<string, unknown>;
  return {
    contacts: Number(value.contacts) || 0,
    withoutAccount: Number(value.withoutAccount) || 0,
    pendingConfirmation: Number(value.pendingConfirmation) || 0,
    confirmedAccounts: Number(value.confirmedAccounts) || 0,
    marketingOptIn: Number(value.marketingOptIn) || 0,
  };
}
export async function getAdminResearchLeads(input: {
  limit: number; offset: number; status: ResearchLeadStatus | "ALL";
  formId?: string; marketingOnly?: boolean;
}): Promise<{ rows: ResearchLeadRow[]; total: number }> {
  const { data, error } = await db.rpc("get_admin_research_leads", {
    p_limit: Math.min(100, Math.max(1, input.limit)),
    p_offset: Math.max(0, input.offset),
    p_status: input.status,
    p_form_id: input.formId || null,
    p_marketing_only: Boolean(input.marketingOnly),
  });
  if (error || !Array.isArray(data)) throw new Error("Não foi possível consultar os leads das pesquisas.");
  const rows = data as ResearchLeadRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export type ResearchLeadSource = {
  form_id: string; form_title: string; source_code: string; contact_count: number;
};
export async function getAdminResearchLeadSources(): Promise<ResearchLeadSource[]> {
  const { data, error } = await db.rpc("get_admin_research_lead_sources");
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar os formulários de origem.");
  return data as ResearchLeadSource[];
}
