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
  tutorial_eligible?: boolean;
  tutorial_seen_at?: string | null;
};

export function institutionForRegion(region: RegionCode): "UNIFOR" | "UNILAB" | null {
  return region === "FORTALEZA" ? "UNIFOR" : region === "MACICO_BATURITE" ? "UNILAB" : null;
}

/** Region and academic affiliation are now optional profile enrichment. */
export function canComplete(progress: Pick<Progress, "usage_role">): boolean {
  return progress.usage_role === "PASSAGEIRO" ||
    progress.usage_role === "MOTORISTA" || progress.usage_role === "AMBOS";
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

/**
 * Finish exactly once. A retry after a successful save must not restart
 * onboarding or report failure just because status is already completed.
 */
export async function completeOnboarding(progress: Progress): Promise<void> {
  const userId = await authenticatedUserId();
  if (userId !== progress.user_id) throw new Error("Cadastro pertence a outra conta.");

  const { data: latest, error: readError } = await table()
    .select("*").eq("user_id", userId).single();
  if (readError || !latest) throw new Error("Não foi possível verificar seu cadastro.");

  // Durable server state wins over stale React state after refresh/retries.
  if (latest.status === "BASIC_COMPLETED" && latest.current_step === "DONE") return;
  if (!canComplete(latest as Progress)) throw new Error("Complete as etapas essenciais.");

  const now = new Date().toISOString();
  const { data, error } = await table().update({
    status: "BASIC_COMPLETED", current_step: "DONE",
    completed_at: now, updated_at: now, tutorial_eligible: true,
  }).eq("user_id", userId).eq("status", "IN_PROGRESS")
    .select("user_id").maybeSingle();
  if (error) throw new Error("Não foi possível concluir seu perfil. Verifique se a migration de cadastro universal foi aplicada.");

  if (!data) {
    // A simultaneous request may have already committed the completion.
    const { data: confirmed, error: verifyError } = await table()
      .select("status,current_step").eq("user_id", userId).single();
    if (verifyError || confirmed?.status !== "BASIC_COMPLETED" ||
        confirmed?.current_step !== "DONE") {
      throw new Error("Não foi possível confirmar a conclusão do cadastro.");
    }
  }
}

/** Cosmetic tutorial state: never affects service permissions. */
export async function markIntroSeen(): Promise<void> {
  const userId = await authenticatedUserId();
  const { error } = await table().update({tutorial_seen_at: new Date().toISOString()})
    .eq("user_id", userId).eq("status", "BASIC_COMPLETED")
    .eq("tutorial_eligible", true);
  if (error) throw new Error("Não foi possível salvar o progresso do tutorial.");
}
