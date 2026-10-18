import { supabase } from "@/integrations/supabase/client";
import {
  parseResearchConfiguration,
  validateJourney,
  type PublicResearchConfiguration,
  type ResearchConfiguration,
  type ResearchJourney,
} from "./research-configuration";
import type { Answers } from "./research-schema";

// The new migration is additive; keep casts at this boundary until types are regenerated.
const db = supabase as unknown as {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};
export async function getPublicResearchConfiguration(
  code: string,
): Promise<PublicResearchConfiguration | null> {
  const { data, error } = await db.rpc("get_public_research_configuration", { p_code: code });
  if (error) throw new Error("Não foi possível carregar a configuração da pesquisa.");
  return data as PublicResearchConfiguration | null;
}
export async function saveResearchConfiguration(
  formId: string,
  settings: ResearchConfiguration,
  revision: number,
) {
  const { data, error } = await db.rpc("save_research_configuration", {
    p_form_id: formId,
    p_settings: parseResearchConfiguration(settings),
    p_expected_revision: revision,
  });
  if (error) throw new Error(error.message);
  return Number(data);
}
export async function submitConfiguredResearch(input: {
  formId: string;
  versionId: string;
  submissionKey: string;
  answers: Answers;
  config: PublicResearchConfiguration;
  journey: ResearchJourney;
  researchConsent: boolean;
}) {
  if (!input.researchConsent) throw new Error("Confirme o consentimento para pesquisa.");
  const { data, error } = await db.rpc("submit_configured_research_answer", {
    p_form_id: input.formId,
    p_version_id: input.versionId,
    p_submission_key: input.submissionKey,
    p_answers: input.answers,
    p_revision: input.config.revision,
    p_journey: validateJourney(input.journey, input.config.settings),
    p_research_consent: true,
  });
  if (error)
    throw new Error(
      error.code === "40001"
        ? "A configuração mudou. Recarregue a pesquisa antes de enviar."
        : "Não foi possível registrar a resposta. Confira os dados e tente novamente.",
    );
  if (data !== true) throw new Error("O registro da resposta não foi confirmado.");
}
export async function registerResearchInterest(
  formId: string,
  receipt: string,
  profile: "PASSAGEIRO" | "MOTORISTA",
  consent: boolean,
  journey?: ResearchJourney,
) {
  if (!consent) throw new Error("Confirme a autorização para registrar este interesse.");
  const { data, error } = await db.rpc("register_research_interest", {
    p_form_id: formId,
    p_submission_key: receipt,
    p_profile: profile,
    p_consent: true,
    ...(journey ? { p_journey: journey } : {}),
  });
  if (error) throw new Error("Não foi possível registrar o interesse. Tente novamente.");
  if (data !== "INTERESSE_REGISTRADO" && data !== "DISPONIBILIDADE_REGISTRADA")
    throw new Error("Registro não confirmado.");
  return data;
}
export type ConfiguredSummaryRow = {
  version_id: string;
  version_number?: number;
  semantic_code: string;
  category: string | null;
  eligible: number;
  answered: number;
  total: number;
};
export async function getConfiguredResearchSummary(filters: Record<string, string>) {
  const { data, error } = await db.rpc("get_configured_research_summary", {
    p_filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")),
  });
  if (error) throw new Error("Não foi possível carregar os indicadores desta coorte.");
  return data as ConfiguredSummaryRow[];
}
