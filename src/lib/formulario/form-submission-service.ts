// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { getAnonymousSessionId, normalizeStsSource } from "@/lib/funnel-events";
import { uuidSchema } from "@/lib/uuid";

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

export function buildFormSubmissionRow(
  payload: CaronaaStsSubmission,
): FormSubmissionInsert & Record<string, unknown> {
  const includePassenger = payload.intent === "PASSAGEIRO" || payload.intent === "AMBOS";
  const includeDriver = payload.intent === "MOTORISTA" || payload.intent === "AMBOS";

  // Derivação com múltiplos fallbacks — nunca deve restar null para os roles relevantes
  let passengerInterest = payload.passengerInterest;
  if (includePassenger && !passengerInterest) {
    if (payload.passengerIntention === "TALVEZ") passengerInterest = "TALVEZ";
    else passengerInterest = "USARIA_HOJE";
  }

  let driverInterest = payload.driverInterest;
  if (includeDriver && !driverInterest) {
    if (payload.driverRealValidation === "TALVEZ") driverInterest = "TALVEZ";
    else if (payload.driverRealValidation === "NAO") driverInterest = "PROVAVELMENTE_NAO";
    else driverInterest = "USARIA_HOJE";
  }

  // Valores normalizados para o banco — garantia dupla com || "HOJE"
  const intencaoPassageiro: string | null = includePassenger
    ? normalizeInterest(passengerInterest) || "HOJE"
    : null;

  const intencaoMotorista: string | null = includeDriver
    ? normalizeInterest(driverInterest) || "HOJE"
    : null;

  // Guarda: nunca envia null violando a constraint
  if (includePassenger && !intencaoPassageiro) {
    throw new Error(
      "Erro interno: interesse do passageiro não pôde ser determinado. Tente novamente.",
    );
  }
  if (includeDriver && !intencaoMotorista) {
    throw new Error(
      "Erro interno: interesse do motorista não pôde ser determinado. Tente novamente.",
    );
  }

  const costPeriodNorm = normalizeCostPeriod(payload.costPeriod);

  return {
    // 1. Colunas padrão da tabela form_submissions (compatibilidade com migração 0013 e insert direto)
    submission_id: uuidSchema.parse(payload.submissionId),
    source: normalizeStsSource(payload.source),
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
    custo_referencia: costPeriodNorm,
    intencao_passageiro: intencaoPassageiro,
    intencao_motorista: intencaoMotorista,
    nome: payload.name,
    whatsapp: payload.whatsapp,
    email: payload.email,
    consentimento: true,
    raw_payload: sanitizeSubmissionRawPayload(payload),

    // 2. Chaves compatíveis com a RPC submit_form_response (migração 0017):
    // A RPC no Supabase extrai:
    // coalesce(p_submission ->> 'passengerInterest', p_submission ->> 'passenger_interest')::public.form_intencao
    // coalesce(p_submission ->> 'driverInterest', p_submission ->> 'driver_interest')::public.form_intencao
    // Se essas chaves não existirem no payload, a RPC insere NULL em intencao_passageiro / intencao_motorista!
    passengerInterest: intencaoPassageiro,
    passenger_interest: intencaoPassageiro,
    driverInterest: intencaoMotorista,
    driver_interest: intencaoMotorista,

    // Outros campos lidos pela RPC 0017 via coalesce(camelCase, snake_case)
    submissionId: payload.submissionId,
    campaignEvent: payload.campaignEvent,
    intent: payload.intent,
    occupation: payload.occupation,
    originNeighborhood: payload.originNeighborhood,
    destinationNeighborhood: payload.destinationNeighborhood,
    departureWindow: payload.departureWindow,
    departure_window: payload.departureWindow,
    weeklyFrequency: payload.weeklyFrequency,
    weekly_frequency: payload.weeklyFrequency,
    currentTransport: payload.currentTransport,
    routeCostRange: payload.routeCostRange,
    costPeriod: costPeriodNorm,
    cost_period: costPeriodNorm,
    name: payload.name,
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
    throw new Error(
      "As dores selecionadas exigem uma única dor principal com intensidade de 1 a 5.",
    );
  }
}

export async function saveFormSubmission(payload: CaronaaStsSubmission, userId: string | null) {
  uuidSchema.parse(payload.submissionId);
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
  source = "direct",
  campaign = null,
  campaignEvent = "CARONAA",
  tipoUsuario = null,
  ocupacao = null,
  rawPayload = {},
}: RegisterFormStartInput) {
  const normalizedSource = normalizeStsSource(source || "direct");
  const deduplicationKey = [
    "caronaa-form-start",
    normalizedSource,
    campaign ?? "",
    campaignEvent,
  ].join(":");

  if (typeof window !== "undefined" && window.localStorage.getItem(deduplicationKey) === "1") {
    return;
  }

  const row: FormStartInsert = {
    user_id: userId,
    anonymous_session_id: userId ? null : getAnonymousSessionId(),
    source: normalizedSource,
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
    .order("created_at", { ascending: false })
    .abortSignal(AbortSignal.timeout(15000));

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
