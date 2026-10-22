import { z } from "zod";

export const SUGGESTED_RESEARCH_TIMES = [
  "06:00",
  "07:00",
  "12:00",
  "13:00",
  "17:00",
  "18:00",
  "19:00",
  "21:00",
  "22:00",
];
export const SERVICE_STATES = ["PLANEJADO", "CONFIRMADO", "EM_OPERACAO", "ADIADO"] as const;
export const researchTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = (max = 180) => z.string().trim().max(max);
export const researchConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    templateKey: text(80).min(1),
    institutionId: text(80)
      .min(2)
      .regex(/^[A-Z0-9_-]+$/),
    institutionName: text().min(2),
    publicName: text().min(2),
    campus: text(120),
    nearbyUniversity: text(180).optional(),
    region: text(120).min(2),
    address: text(240),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    campaignName: text(120),
    emailCaptureEnabled: z.boolean().default(false),
    campaignType: z.enum(["INSTITUCIONAL", "EVENTO", "ORGANICO", "OUTRO"]),
    acquisitionSource: text(80),
    launchDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .refine(
        (value) =>
          !value ||
          (!Number.isNaN(Date.parse(value)) &&
            new Date(value).toISOString().slice(0, 10) === value),
        "Data inválida",
      ),
    timezone: text(80).refine((value) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido"),
    serviceState: z.enum(SERVICE_STATES),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    outboundTimes: z.array(researchTime).min(1).max(48),
    returnTimes: z.array(researchTime).max(48),
    flexibilityMinutes: z.number().int().min(0).max(120),
    profileSchedules: z
      .array(
        z
          .object({
            profile: z.enum(["PASSAGEIRO", "MOTORISTA", "AMBOS"]),
            days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
            outboundTimes: z.array(researchTime).min(1).max(48),
            returnTimes: z.array(researchTime).max(48),
            flexibilityMinutes: z.number().int().min(0).max(120),
          })
          .strict(),
      )
      .max(3)
      .default([]),
    profiles: z.array(z.enum(["PASSAGEIRO", "MOTORISTA", "AMBOS"])).min(1),
    modes: z.array(z.enum(["CARONA", "TRANSPORTE_PROFISSIONAL_INTERESSE"])).min(1),
    usagePolicy: text(1500).min(10),
    priceReference: text(500),
    accessPolicy: z
      .enum(["PESQUISA_PUBLICA", "MEMBROS_DA_INSTITUICAO", "COLABORADORES_DA_EMPRESA"])
      .default("PESQUISA_PUBLICA"),
    pricing: z
      .object({
        currency: z.literal("BRL"),
        referencePerTrip: z.number().min(0).max(10000).nullable(),
        referenceSource: text(500),
      })
      .strict()
      .default({ currency: "BRL", referencePerTrip: null, referenceSource: "" }),
    institutionalContact: text(180),
    partnershipDescription: text(500),
    partnershipConfirmed: z.boolean(),
    safeMeetingPoints: z.array(text(180).min(2)).max(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.pricing.referencePerTrip !== null && value.pricing.referenceSource.trim().length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["pricing"],
        message: "Informe a origem da referência de preço.",
      });
    if ((value.latitude === null) !== (value.longitude === null))
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Informe as duas coordenadas ou deixe ambas vazias.",
      });
    if (value.partnershipDescription && !value.partnershipConfirmed)
      ctx.addIssue({
        code: "custom",
        path: ["partnershipConfirmed"],
        message: "Confirme a parceria antes de descrevê-la publicamente.",
      });
    if (
      new Set(value.profileSchedules.map((schedule) => schedule.profile)).size !==
        value.profileSchedules.length ||
      value.profileSchedules.some((schedule) => !value.profiles.includes(schedule.profile))
    )
      ctx.addIssue({
        code: "custom",
        path: ["profileSchedules"],
        message: "Confira os horários específicos de cada perfil.",
      });
    for (const key of ["days", "outboundTimes", "returnTimes", "profiles", "modes"] as const) {
      if (new Set<string | number>(value[key]).size !== value[key].length)
        ctx.addIssue({ code: "custom", path: [key], message: "Remova os itens repetidos." });
    }
  });
export type ResearchConfiguration = z.infer<typeof researchConfigurationSchema>;
export function parseResearchConfiguration(input: ResearchConfiguration): ResearchConfiguration {
  const parsed = researchConfigurationSchema.safeParse({
    ...input,
    safeMeetingPoints: input.safeMeetingPoints.map((point) => point.trim()).filter(Boolean),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const names: Record<string, string> = {
      institutionId: "Identificador institucional",
      institutionName: "Instituição, empresa ou evento",
      publicName: "Nome público da pesquisa",
      region: "Município ou região",
      timezone: "Fuso horário",
      days: "Dias disponíveis",
      outboundTimes: "Horários de saída",
      returnTimes: "Horários de retorno",
      usagePolicy: "Política de uso",
      profiles: "Público-alvo",
      modes: "Modalidades",
      launchDate: "Previsão de presença do CARONAA",
      latitude: "Latitude",
      longitude: "Longitude",
      safeMeetingPoints: "Pontos de embarque",
      pricing: "Referência de preço",
      profileSchedules: "Horários por perfil",
    };
    throw new Error(
      issue.code === "custom"
        ? issue.message
        : `Confira o campo: ${names[String(issue.path[0])] ?? "configuração institucional"}.`,
    );
  }
  return parsed.data;
}
export type PublicResearchConfiguration = {
  revision: number;
  settings: Omit<ResearchConfiguration, "institutionalContact">;
};
export function newResearchConfiguration(templateKey = "CUSTOM"): ResearchConfiguration {
  return {
    schemaVersion: 1,
    templateKey,
    institutionId: "",
    institutionName: "",
    publicName: "",
    campus: "",
    region: "",
    address: "",
    latitude: null,
    longitude: null,
    campaignName: "",
    emailCaptureEnabled: false,
    campaignType: "INSTITUCIONAL",
    acquisitionSource: "",
    launchDate: null,
    timezone: "America/Fortaleza",
    serviceState: "PLANEJADO",
    days: [1, 2, 3, 4, 5],
    outboundTimes: [...SUGGESTED_RESEARCH_TIMES],
    returnTimes: [...SUGGESTED_RESEARCH_TIMES],
    flexibilityMinutes: 15,
    profileSchedules: [],
    profiles: ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
    modes: ["CARONA"],
    usagePolicy: "",
    priceReference: "",
    accessPolicy: "PESQUISA_PUBLICA",
    pricing: { currency: "BRL", referencePerTrip: null, referenceSource: "" },
    institutionalContact: "",
    partnershipDescription: "",
    partnershipConfirmed: false,
    safeMeetingPoints: [],
  };
}
export function launchMessage(config: PublicResearchConfiguration["settings"]) {
  if (!config.launchDate) return "";
  const date = new Date(config.launchDate + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const status = {
    PLANEJADO: "Início planejado",
    CONFIRMADO: "Início confirmado",
    EM_OPERACAO: "Em operação",
    ADIADO: "Início adiado",
  }[config.serviceState];
  return `${status} · ${date} · ${config.timezone}`;
}

export const journeySchema = z
  .object({
    profile: z.enum(["PASSAGEIRO", "MOTORISTA", "AMBOS"]),
    mode: z.enum(["CARONA", "TRANSPORTE_PROFISSIONAL_INTERESSE"]),
    direction: z.enum(["IDA", "VOLTA", "IDA_E_VOLTA"]),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    outboundTime: researchTime,
    returnTime: researchTime.or(z.literal("")),
    otherOutboundTime: z.boolean(),
    otherReturnTime: z.boolean(),
    flexibilityMinutes: z.number().int().min(0).max(120),
    originArea: text(120).min(2),
    originLat: z.number().min(-90).max(90).nullable(),
    originLng: z.number().min(-180).max(180).nullable(),
    destinationArea: text(120).min(2),
    destinationLat: z.number().min(-90).max(90).nullable(),
    destinationLng: z.number().min(-180).max(180).nullable(),
    marketingConsent: z.boolean(),
    partnerSharingConsent: z.boolean(),
  })
  .strict();
export type ResearchJourney = z.infer<typeof journeySchema>;
export function effectiveResearchSchedule(
  config: PublicResearchConfiguration["settings"],
  profile: ResearchJourney["profile"],
) {
  return {
    ...config,
    ...config.profileSchedules?.find((schedule) => schedule.profile === profile),
  };
}
export function validateJourney(
  input: unknown,
  config: PublicResearchConfiguration["settings"],
): ResearchJourney {
  const parsed = journeySchema.safeParse(input);
  if (!parsed.success)
    throw new Error("Confira o perfil, os dias, os horários e as regiões do trajeto.");
  const value = parsed.data;
  config = effectiveResearchSchedule(config, value.profile);
  if (!config.profiles.includes(value.profile) || !config.modes.includes(value.mode))
    throw new Error("Perfil ou modalidade não habilitado nesta pesquisa.");
  if (
    new Set(value.days).size !== value.days.length ||
    value.days.some((day) => !config.days.includes(day))
  )
    throw new Error("Confira os dias disponíveis.");
  if (value.flexibilityMinutes > config.flexibilityMinutes)
    throw new Error("A flexibilidade supera o limite configurado.");
  const departureTimes =
    value.direction === "VOLTA" && config.returnTimes.length
      ? config.returnTimes
      : config.outboundTimes;
  if (!value.otherOutboundTime && !departureTimes.includes(value.outboundTime))
    throw new Error("Escolha um horário sugerido ou Outro horário.");
  if (value.direction === "IDA_E_VOLTA" && !value.returnTime)
    throw new Error("Informe o horário de retorno.");
  if (value.returnTime && !value.otherReturnTime && !config.returnTimes.includes(value.returnTime))
    throw new Error("Confira o horário de retorno.");
  for (const prefix of ["origin", "destination"] as const)
    if ((value[`${prefix}Lat`] === null) !== (value[`${prefix}Lng`] === null))
      throw new Error("Coordenadas incompletas.");
  return value;
}

export const RESEARCH_SEMANTICS = {
  RESEARCH_PARTICIPANT_ROLE: "Perfil inicial: passageiro, ofertante ou profissional",
  RIDE_OFFER_INTENT: "Disponibilidade declarada para oferecer carona",
  BOOKING_INTENT: "Intenção declarada de solicitar carona",
  MOBILITY_MODE: "Modalidade pretendida",
  NORMALIZED_DEPARTURE_TIME: "Horário local de saída (HH:mm)",
  TRAVEL_FREQUENCY: "Frequência declarada de deslocamento",
  ACCEPTABLE_FARE_RANGE: "Faixa de valor aceitável por trecho",
  WILLINGNESS_TO_PAY: "Disposição declarada a pagar",
  QUOTE_ACCEPTANCE_INTENT: "Intenção declarada de aceitar uma cotação; não é aceite real",
  ACQUISITION_SOURCE: "Origem de aquisição declarada",
  LAUNCH_PARTICIPATION_INTENT: "Intenção declarada de participar do lançamento",
} as const;
export const RESEARCH_SEMANTIC_TYPES: Record<string, string> = {
  RESEARCH_PARTICIPANT_ROLE: "single_choice",
  RIDE_OFFER_INTENT: "yes_no",
  BOOKING_INTENT: "yes_no",
  MOBILITY_MODE: "single_choice",
  NORMALIZED_DEPARTURE_TIME: "time",
  TRAVEL_FREQUENCY: "single_choice",
  ACCEPTABLE_FARE_RANGE: "money_range",
  WILLINGNESS_TO_PAY: "yes_no",
  QUOTE_ACCEPTANCE_INTENT: "yes_no",
  ACQUISITION_SOURCE: "single_choice",
  LAUNCH_PARTICIPATION_INTENT: "yes_no",
};

export const RESEARCH_EVIDENCE_STAGES = [
  "Problema declarado",
  "Interesse na solução",
  "Disposição declarada a pagar",
  "Aceitação de cotação real",
  "Solicitação ou oferta criada",
  "Correspondência confirmada",
  "Corrida realizada",
  "Pagamento confirmado",
  "Nova utilização",
];
export function exportResearchSummary(rows: Record<string, unknown>[]) {
  const headers = ["version_id", "semantic_code", "category", "eligible", "answered", "total"];
  const cell = (value: unknown) => {
    const raw = String(value ?? "");
    let start = 0;
    // Spreadsheet formulas may follow whitespace or control characters.
    while (start < raw.length && (raw.charCodeAt(start) <= 32 || /\s/.test(raw[start]))) start++;
    const safe = /^[=+@-]/.test(raw.slice(start)) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => cell(row[key])).join(",")),
  ].join("\n");
}
