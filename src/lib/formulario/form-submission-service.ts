import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { getAnonymousSessionId } from "@/lib/funnel-events";

import type { CaronaaStsSubmission } from "./submission";
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

function buildFormSubmissionRow(
  payload: CaronaaStsSubmission,
  userId: string | null,
): FormSubmissionInsert {
  return {
    submission_id: payload.submissionId,
    user_id: userId,
    anonymous_session_id: userId ? null : getAnonymousSessionId(),
    source: payload.source,
    campaign: payload.campaign,
    campaign_event: "Siará Tech Summit 2026",
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
    intencao_passageiro: normalizeInterest(payload.passengerInterest),
    intencao_motorista: normalizeInterest(payload.driverInterest),
    nome: payload.name,
    whatsapp: payload.whatsapp,
    email: payload.email,
    consentimento: true,
    raw_payload: payload,
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

export async function saveFormSubmission(payload: CaronaaStsSubmission, userId: string | null) {
  const { error: submissionError } = await supabase
    .from("form_submissions")
    .insert(buildFormSubmissionRow(payload, userId));

  if (submissionError) {
    throw new Error(`Não foi possível salvar sua resposta: ${submissionError.message}`);
  }

  const { error: painError } = await supabase
    .from("form_submission_pain_points")
    .insert(buildPainPointRows(payload));

  if (painError) {
    throw new Error(`Não foi possível salvar as dores da resposta: ${painError.message}`);
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
