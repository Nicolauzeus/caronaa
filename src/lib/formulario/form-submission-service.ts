import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { getAnonymousSessionId } from "@/lib/funnel-events";

import type { CaronaaStsSubmission } from "./submission";
import { sanitizeSubmissionRawPayload } from "./submission";
import type { InterestLevel, PainPointCode } from "./types";

const stablePainCodes = ["DOR_01", "DOR_02", "DOR_03", "DOR_04", "DOR_05", "DOR_06"] as const;

type StablePainCode = (typeof stablePainCodes)[number];

type FormSubmissionInsert = TablesInsert<"form_submissions">;
type FormPainInsert = TablesInsert<"form_submission_pain_points">;
type FormStartInsert = TablesInsert<"form_starts">;

export type FormSubmissionRow = Tables<"form_submissions"> & {
  pain_points: Tables<"form_submission_pain_points">[];
};

export type RegisterFormStartInput = {
  userId: string | null;
  source?: string;
  campaign?: string | null;
  campaignEvent?: string;
  tipoUsuario?: FormStartInsert["tipo_usuario"];
  ocupacao?: string | null;
  rawPayload?: FormStartInsert["raw_payload"];
};

function isStablePainCode(value: PainPointCode | null | undefined): value is StablePainCode {
  return stablePainCodes.includes(value as StablePainCode);
}

function normalizeCostPeriod(value: CaronaaStsSubmission["costPeriod"]) {
  if (value === "POR_TRECHO") return "TRECHO";
  if (value === "POR_DIA") return "DIA";
  return null;
}

function normalizeInterest(value: InterestLevel | null) {
  switch (value) {
    case "USARIA_HOJE":
      return "HOJE";
    case "PROVAVELMENTE_USARIA":
      return "PROVAVELMENTE";
    case "TALVEZ":
      return "TALVEZ";
    case "PROVAVELMENTE_NAO":
      return "PROVAVELMENTE_NAO";
    case "NAO_USARIA":
      return "NAO";
    default:
      return null;
  }
}

function buildFormSubmissionRow(payload: CaronaaStsSubmission): FormSubmissionInsert {
  return {
    submission_id: payload.submissionId,
    source: payload.source,
    campaign: payload.campaign,
    campaign_event: payload.campaignEvent,
    created_at: payload.createdAt,
    tipo_usuario: payload.intent,
    ocupacao: payload.occupation,
    origem_trajeto: payload.originNeighborhood,
    destino_trajeto: payload.destinationNeighborhood,
    faixa_horario: payload.departureWindow,
    frequencia_semanal: payload.weeklyFrequency,
    transporte_atual: payload.currentTransport,
    custo_atual_faixa: payload.routeCostRange,
    custo_referencia: normalizeCostPeriod(payload.costPeriod),
    intencao_passageiro: normalizeInterest(payload.passengerInterest ?? null),
    intencao_motorista: normalizeInterest(payload.driverInterest ?? null),
    nome: payload.name,
    whatsapp: payload.whatsapp,
    email: payload.email,
    consentimento: true,
    raw_payload: sanitizeSubmissionRawPayload(payload),
  };
}

function buildPainPointRows(payload: CaronaaStsSubmission): FormPainInsert[] {
  const selectedPainCodes = new Set((payload.painPoints ?? []).filter(isStablePainCode));
  const mainPainCode = isStablePainCode(payload.mainPainPoint) ? payload.mainPainPoint : null;

  return stablePainCodes.map((codigoDor) => ({
    submission_id: payload.submissionId,
    codigo_dor: codigoDor,
    selecionada: selectedPainCodes.has(codigoDor),
    principal: mainPainCode === codigoDor,
    intensidade: mainPainCode === codigoDor ? payload.mainPainIntensity : null,
  }));
}

/** Mirrors the database's deferred constraint so invalid requests fail early. */
export function assertPainPointIntegrity(rows: FormPainInsert[]) {
  const selectedRows = rows.filter((row) => row.selecionada);
  const principalRows = rows.filter((row) => row.principal);

  if (selectedRows.length === 0 && principalRows.length === 0) return;

  if (
    principalRows.length !== 1 ||
    !principalRows[0]?.selecionada ||
    !Number.isInteger(principalRows[0]?.intensidade) ||
    (principalRows[0]?.intensidade ?? 0) < 1 ||
    (principalRows[0]?.intensidade ?? 0) > 5
  ) {
    throw new Error("As dores selecionadas exigem uma única dor principal com intensidade de 1 a 5.");
  }
}

export async function saveFormSubmission(payload: CaronaaStsSubmission, userId: string | null) {
  // The RPC obtains auth.uid() itself; a client cannot choose another user_id.
  const painPoints = buildPainPointRows(payload);
  assertPainPointIntegrity(painPoints);

  const { error } = await supabase.rpc("submit_form_response", {
    p_submission: buildFormSubmissionRow(payload),
    p_pain_points: painPoints,
    p_anonymous_session_id: userId ? null : getAnonymousSessionId(),
  });

  if (error) {
    throw new Error(`Não foi possível salvar sua resposta: ${error.message}`);
  }
}

export async function registerFormStart({
  userId,
  source = "sts-2026",
  campaign = null,
  campaignEvent = "Siará Tech Summit 2026",
  tipoUsuario = null,
  ocupacao = null,
  rawPayload = {},
}: RegisterFormStartInput) {
  const deduplicationKey = [
    "caronaa-form-start",
    source,
    campaign ?? "",
    campaignEvent,
  ].join(":");

  if (typeof window !== "undefined" && window.localStorage.getItem(deduplicationKey) === "1") {
    return;
  }

  const row: FormStartInsert = {
    user_id: userId,
    anonymous_session_id: userId ? null : getAnonymousSessionId(),
    source,
    campaign,
    campaign_event: campaignEvent,
    tipo_usuario: tipoUsuario,
    ocupacao,
    raw_payload: rawPayload,
  };

  const { error } = await supabase.from("form_starts").insert(row);

  if (error) {
    throw new Error(`Não foi possível registrar o início do formulário: ${error.message}`);
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(deduplicationKey, "1");
  }
}

export async function listFormSubmissions() {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*, pain_points:form_submission_pain_points(*)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar as respostas: ${error.message}`);
  }

  return (data ?? []) as FormSubmissionRow[];
}

export async function getFormSubmission(submissionId: string) {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*, pain_points:form_submission_pain_points(*)")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar a resposta: ${error.message}`);
  }

  return data as FormSubmissionRow | null;
}
