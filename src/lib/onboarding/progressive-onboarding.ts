import { supabase } from "@/integrations/supabase/client";

export type RegionCode = "FORTALEZA" | "MACICO_BATURITE" | "OTHER";
export type Affiliation = "ESTUDANTE" | "PROFESSOR" | "COLABORADOR" | "COMUNIDADE";
export type UsageRole = "PASSAGEIRO" | "MOTORISTA" | "AMBOS";
export type OnboardingStep = "REGION" | "AFFILIATION" | "ROLE" | "REVIEW" | "DONE";
export type Progress = {
  user_id: string;
  status: "IN_PROGRESS" | "BASIC_COMPLETED";
  current_step: OnboardingStep;
  region_code: RegionCode | null;
  affiliation_type: Affiliation | null;
  institution_code: "UNIFOR" | "UNILAB" | null;
  usage_role: UsageRole | null;
  completed_at: string | null;
};

export function institutionForRegion(region: RegionCode): "UNIFOR" | "UNILAB" | null {
  return region === "FORTALEZA" ? "UNIFOR" : region === "MACICO_BATURITE" ? "UNILAB" : null;
}

export function canComplete(progress: Pick<Progress, "region_code" | "affiliation_type" | "usage_role" | "institution_code">): boolean {
  return Boolean(progress.region_code && progress.affiliation_type && progress.usage_role &&
    (progress.affiliation_type === "COMUNIDADE" || progress.region_code === "OTHER" ||
     progress.institution_code === institutionForRegion(progress.region_code)));
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || !data.user.email_confirmed_at) {
    throw new Error("Confirme seu e-mail para continuar.");
  }
  return data.user.id;
}

// Explicit type boundary while generated Supabase types await migration 0124.
const table = () => (supabase as any).from("user_onboarding_progress");

export async function readOnboarding(): Promise<Progress | null> {
  const userId = await authenticatedUserId();
  const { data, error } = await table().select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar seu cadastro.");
  return (data as Progress | null);
}

export async function saveOnboarding(
  fields: Partial<Pick<Progress, "region_code" | "affiliation_type" | "institution_code" | "usage_role" | "current_step">>,
): Promise<Progress> {
  const userId = await authenticatedUserId();
  const { data: existing, error: loadError } = await table().select("*").eq("user_id", userId).maybeSingle();
  if (loadError) throw new Error("Não foi possível consultar o cadastro.");
  if (existing?.status === "BASIC_COMPLETED") throw new Error("Seu cadastro básico já foi concluído.");
  const next = { ...existing, ...fields, user_id: userId, status: "IN_PROGRESS",
    updated_at: new Date().toISOString() };
  if (fields.region_code) {
    next.institution_code = institutionForRegion(fields.region_code);
    // Changing region invalidates previously saved affiliation/role until reviewed.
    if (existing?.region_code && existing.region_code !== fields.region_code) {
      next.affiliation_type = null;
      next.usage_role = null;
    }
  }
  const { data, error } = await table().upsert(next, { onConflict: "user_id" }).select("*").single();
  if (error) throw new Error("Não foi possível salvar. Tente novamente.");
  return data as Progress;
}

export async function completeOnboarding(progress: Progress): Promise<void> {
  const userId = await authenticatedUserId();
  if (userId !== progress.user_id || !canComplete(progress)) throw new Error("Complete as etapas essenciais.");
  const { data: latest, error: readError } = await table().select("*").eq("user_id", userId).single();
  if (readError || !latest || !canComplete(latest as Progress)) throw new Error("Revise seu perfil antes de continuar.");
  const { data, error } = await table().update({
    status: "BASIC_COMPLETED", current_step: "DONE",
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("status", "IN_PROGRESS").select("user_id").maybeSingle();
  if (error || !data) throw new Error("Não foi possível concluir seu perfil.");
}

/**
 * Minimal passenger activation. Research surveys and the former four-step
 * onboarding are optional. Preserve any selections already stored for a user.
 * This row is account setup only; it is NOT professional driver approval.
 */
export async function ensureBasicPassengerOnboarding(): Promise<Progress> {
  const userId = await authenticatedUserId();
  const { data: existing, error: readError } = await table()
    .select("*").eq("user_id", userId).maybeSingle();
  if (readError) throw new Error("Não foi possível verificar seu cadastro.");
  if (existing?.status === "BASIC_COMPLETED") return existing as Progress;

  const region: RegionCode = existing?.region_code ?? "OTHER";
  const affiliation: Affiliation = existing?.affiliation_type ?? "COMUNIDADE";
  const role: UsageRole = existing?.usage_role ?? "PASSAGEIRO";
  const institution = institutionForRegion(region);
  const now = new Date().toISOString();
  const next = {
    ...existing,
    user_id: userId,
    region_code: region,
    affiliation_type: affiliation,
    usage_role: role,
    institution_code: institution,
    status: "BASIC_COMPLETED",
    current_step: "DONE",
    completed_at: existing?.completed_at ?? now,
    updated_at: now,
  };
  const { data, error } = await table().upsert(next, { onConflict: "user_id" })
    .select("*").single();
  if (error || !data) throw new Error("Não foi possível ativar sua conta. Tente novamente.");
  return data as Progress;
}
