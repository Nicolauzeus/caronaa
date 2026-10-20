import { supabase } from "@/integrations/supabase/client";

export const RESEARCH_FORM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,79}$/;
export function normalizeResearchFormCode(code: string): string {
  return code.trim().toUpperCase();
}
export function validResearchFormCode(code: string): boolean {
  return RESEARCH_FORM_CODE_PATTERN.test(normalizeResearchFormCode(code));
}

/** Suggestions are never assigned silently and are always checked again on the server. */
export function suggestResearchFormCode(
  source: string, occupied: readonly string[], year = new Date().getFullYear(),
): string {
  const used = new Set(occupied.map(normalizeResearchFormCode));
  const cleaned = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const root = (cleaned || "PESQUISA").slice(0, 65).replace(/-+$/g, "");
  const base = /-20\d{2}$/.test(root) ? root : `${root}-${year}`;
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix <= 9999; suffix++) {
    const code = `${base.slice(0, 80 - String(suffix).length - 1)}-${suffix}`;
    if (!used.has(code)) return code;
  }
  throw new Error("Não foi possível sugerir um código livre. Digite outro código.");
}

export type ResearchCodeAvailability = {
  available: boolean;
  status?: string | null;
  inTrash?: boolean;
};

/** SECURITY DEFINER RPC checks every code, including archived and trashed forms. */
export async function checkResearchFormCode(code: string): Promise<ResearchCodeAvailability> {
  const normalized = normalizeResearchFormCode(code);
  if (!validResearchFormCode(normalized)) return { available: false };
  const { data, error } = await (supabase as any).rpc("get_research_form_code_availability", {
    p_code: normalized,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data.available !== "boolean") throw new Error("Consulta de código indisponível.");
  return {
    available: data.available,
    status: typeof data.status === "string" ? data.status : null,
    inTrash: data.inTrash === true,
  };
}

export function describeResearchCodeConflict(status?: string | null, inTrash = false): string {
  if (inTrash) return "Este código já pertence a um formulário na lixeira. Ele continua reservado para preservar os dados.";
  if (status === "ARQUIVADO" || status === "ENCERRADO")
    return "Este código já pertence a uma pesquisa histórica. Informe um código diferente.";
  return "Este código já pertence a outra pesquisa. Escolha um código exclusivo.";
}

/** Do not mislabel business-rule errors as missing database migrations. */
export function friendlyResearchCreationError(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  if (value?.code === "23505" || /research_forms_code_key|c[oó]digo .+j[aá] pertence/i.test(value?.message ?? ""))
    return describeResearchCodeConflict();
  const msg = error instanceof Error ? error.message : value?.message;
  if (msg && /duplicate key value/i.test(msg)) return describeResearchCodeConflict();
  return msg || "Não foi possível criar o formulário. Tente novamente.";
}
