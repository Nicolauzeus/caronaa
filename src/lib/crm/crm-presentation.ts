import type { UnifiedCrmContact, UnifiedCrmParticipation } from "./unified-crm-service";
import { formatResearchOption } from "@/lib/formulario/research-option-labels";

type UnknownRecord = Record<string, unknown>;
export type ExecutiveField = { label: string; value: string };
export type ExecutiveParticipation = {
  routine: ExecutiveField[];
  fit: ExecutiveField[];
  primaryPain: string | null;
  barriers: ExecutiveField[];
  pains: string[];
  otherAnswers: UnknownRecord;
};

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord : {};
const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const FIELD_LABELS: Record<string, string> = {
  feedback: "Comentário", termsAccepted: "Termos aceitos",
  privacyAccepted: "Privacidade aceita", researchAccepted: "Pesquisa autorizada",
  termsVersion: "Versão dos termos", consentsTimestamp: "Data da autorização",
  passengerCount: "Passageiros", vehicleType: "Veículo", availableSeats: "Vagas",
  driverPrice: "Contribuição", passengerFairPrice: "Preço considerado justo",
  occupationDetails: "Detalhes da ocupação", destinationReference: "Referência do destino",
  eventPresenceDays: "Dias no evento", eventPresenceCustom: "Outros dias",
  driverBarriersCustom: "Outras barreiras do motorista",
  passengerBarriersCustom: "Outras barreiras do passageiro",
  passengerTransportsCustom: "Outro transporte",
  passengerDifficultiesCustom: "Outras dificuldades",
  leadType: "Classificação", activationStatus: "Ativação antecipada",
  wantsToSeeMatch: "Deseja ver combinação",
  driverGenderPreference: "Preferência do motorista",
  passengerGenderPreference: "Preferência do passageiro",
  maxDetourMinutes: "Desvio máximo", driverNetAmount: "Valor líquido",
  caronaaFee: "Taxa CARONAA", originArea: "Bairro ou região de origem",
  destinationArea: "Bairro ou região de destino",
  outboundTime: "Horário de ida", returnTime: "Horário de volta",
  flexibilityMinutes: "Tolerância de horário", direction: "Sentido do trajeto",
  days: "Dias habituais", originLat: "Latitude da origem",
  originLng: "Longitude da origem", destinationLat: "Latitude do destino",
  destinationLng: "Longitude do destino", marketingConsent: "Consentimento para novidades",
  partnerSharingConsent: "Compartilhamento com parceiros",
  profile: "Perfil de mobilidade", mode: "Modalidade",
  MOBILITY_PAINS: "Dificuldades no deslocamento",
  MOBILITY_PRIMARY_PAIN: "Dificuldade principal",
  URBAN_PRIMARY_PAIN: "Dificuldade principal",
  REGIONAL_PRIMARY_PAIN: "Dificuldade principal",
  REGIONAL_BARRIER: "Principal barreira",
  TRANSPORT_MODE: "Transporte atual",
  ACCEPTABLE_FARE_RANGE: "Orçamento por trecho",
  ADOPTION_INTENT: "Disposição de uso",
  LAUNCH_PARTICIPATION_INTENT: "Interesse no lançamento",
};

const weekdays = [
  "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira",
  "Sexta-feira", "Sábado", "Domingo",
];

export function formatCrmWeekdays(value: unknown): string | null {
  if (!Array.isArray(value) || !value.length) return null;
  const days = [...new Set(value.map(Number))].sort((a, b) => a - b);
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) return null;
  if (days.join(",") === "1,2,3,4,5") return "Segunda a sexta-feira";
  if (days.join(",") === "1,2,3,4,5,6,7") return "Todos os dias";
  if (days.join(",") === "6,7") return "Sábado e domingo";
  return days.map(day => weekdays[day - 1]).join(", ");
}

export function formatCrmFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (/\s|[?!.]/.test(key) && !key.includes("_")) return key;
  const readable = key.replace(/([a-z\d])([A-Z])/g, "$1 $2").replaceAll("_", " ").trim();
  if (!readable) return key;
  const plain = formatResearchOption(readable);
  return plain.charAt(0).toLocaleUpperCase("pt-BR") + plain.slice(1);
}

export function formatCrmRole(value: string | null | undefined): string {
  const roles: Record<string, string> = {
    PASSAGEIRO: "Passageiro", MOTORISTA: "Motorista",
    AMBOS: "Passageiro e motorista", INVESTIDOR: "Investidor",
    PARCEIRO: "Parceiro", PARCEIRO_INVESTIDOR: "Parceiro e investidor",
  };
  return value ? roles[value] ?? formatResearchOption(value) : "Perfil não informado";
}

export function formatCrmAnswerValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (key === "days" || key === "eventPresenceDays") {
    const formatted = formatCrmWeekdays(value);
    if (formatted) return formatted;
  }
  if (Array.isArray(value)) {
    return value.length ? value.map(item => formatCrmAnswerValue(item)).join(", ") : "Não informado";
  }
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "Ver detalhes da resposta";
  const clean = value.trim();
  const range = /^DE_(\d+)_A_(\d+)$/.exec(clean);
  const reais = (amount: string) => Number(amount).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  if (range) return "De R$ " + reais(range[1]) + " a R$ " + reais(range[2]);
  if (/^ATE_(\d+)$/.test(clean)) return "Até R$ " + reais(clean.slice(4));
  if (/^ACIMA_(\d+)$/.test(clean)) return "Acima de R$ " + reais(clean.slice(6));
  return formatResearchOption(clean);
}

export function crmContactHeading(
  contact: Pick<UnifiedCrmContact, "name" | "email" | "whatsapp">,
): string {
  const name = contact.name.trim();
  const generic = !name || /^(participante sem identificação|participante sts|participante sem contato|contato de parceria|participante anônimo)$/i.test(name);
  if (!generic) return name;
  if (contact.email) return contact.email;
  if (contact.whatsapp) {
    const digits = contact.whatsapp.replace(/\D/g, "");
    const local = digits.startsWith("55") && digits.length === 13 ? digits.slice(2) : digits;
    if (/^\d{11}$/.test(local)) return "(" + local.slice(0,2) + ") " + local.slice(2,7) + "-" + local.slice(7);
    return contact.whatsapp;
  }
  return "Participante sem contato informado";
}

const normalizeKey = (key: string): string =>
  formatCrmFieldLabel(key).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[_-]/g, " ");
type AnswerGroup = "identity" | "duplicate" | "routine" | "fit" | "pain" | "primary" | "barrier" | "other";

function classify(key: string): AnswerGroup {
  const text = normalizeKey(key);
  const technical = new Set([
    "answers_raw", "raw_payload", "journey", "version", "form", "formId",
    "submissionId", "submissionKey", "receipt", "receiptId", "uuid", "hash",
    "termsAccepted", "privacyAccepted", "researchAccepted", "termsVersion",
    "consentsTimestamp", "createdAt", "updatedAt", "created_at", "updated_at",
    "metadata", "providerId", "userId", "user_id", "lat", "lng", "latitude", "longitude",
  ]);
  if (technical.has(key) ||
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(key) ||
      /(?:_id|Id|_hash|Hash|_token|Token)$/.test(key)) return "identity";
  if (/^(nome|e mail|email|whatsapp|telefone|perfil|vinculo|ocupacao|academico)/.test(text) ||
      /como podemos chamar|seu vinculo com|nome completo|nome social/.test(text))
    return "identity";
  if ((/principal/.test(text) && /dor|dificul|problema/.test(text)) ||
      /dificuldade principal/.test(text)) return "primary";
  if (/barreira|receio|hesitar|inseguranca|impediria|obstaculo/.test(text)) return "barrier";
  if (/dificul|dores|dor principal|desafios no (trajeto|percurso)/.test(text)) return "pain";
  if (/como (voce )?(se )?(costuma )?(desloca|deslocar|ir ao|ir ou voltar)|transporte(s)? atual|passenger transports|tempo costuma esperar|tempo de espera|gasta.*por trecho/.test(text))
    return "routine";
  if (/^(origem|destino|horario de ida|horario de volta|dia|veiculo|vagas|sentido do trajeto)|quantos lugares|qual veiculo|veiculo proprio|marca e modelo do veiculo/.test(text))
    return "duplicate";
  if (/orcamento|faixa de valor|pagaria|preco considerado justo|valor aceitavel|passenger fair price|\bdriver price\b|contribuicao/.test(text))
    return "fit";
  if (/interesse|interest|carona compartilhada|alternativa|modalidade|consideraria|usaria|utilizaria|disposicao|adocao|ativacao|antecipad|lancamento|noticia|alerta|notifica|participar|receber informacoes|saber quando|combina(cao|ções)|decisao|influenciaria|motivaria|valoriza|indispensavel|pretende/.test(text))
    return "fit";
  if (/^(journey|answers raw|version|form|pain points|researchaccepted|research accepted|termsaccepted|terms accepted|privacyaccepted|privacy accepted|consents timestamp|consentstimestamp|lead type)$/.test(text))
    return "identity";
  return "other";
}

function fitLabel(key: string): string {
  const text = normalizeKey(key);
  if (/orcamento|faixa de valor|pagaria|preco considerado justo|valor aceitavel|passenger fair price/.test(text))
    return "Orçamento por trecho";
  if (/disposicao|consideraria|usaria|utilizaria|adocao/.test(text)) return "Disposição de uso";
  if (/ativacao|antecipad/.test(text)) return "Ativação antecipada";
  if (/lancamento|noticia|alerta|saber quando|notifica/.test(text)) return "Alerta de lançamento";
  if (/alternativa|modalidade|carona compartilhada|interesse|interest/.test(text)) return "Interesse";
  return formatCrmFieldLabel(key);
}

function pushUnique(fields: ExecutiveField[], item: ExecutiveField) {
  if (!fields.some(existing => existing.label === item.label && existing.value === item.value))
    fields.push(item);
}

export function summarizeCrmParticipation(p: UnifiedCrmParticipation): ExecutiveParticipation {
  const raw = asRecord(p.raw_payload);
  const journey = asRecord(raw.journey);
  const answers = Object.keys(asRecord(raw.answers)).length
    ? asRecord(raw.answers)
    : raw;
  const routine: ExecutiveField[] = [];
  const fit: ExecutiveField[] = [];
  const barriers: ExecutiveField[] = [];
  const otherAnswers: UnknownRecord = {};
  let primaryPain: string | null = null;
  const extraPains: string[] = [];

  const origin = p.route_origin ?? asText(journey.originArea);
  const destination = p.route_destination ?? asText(journey.destinationArea);
  if (origin || destination)
    routine.push({ label: "Trajeto", value: [origin ?? "Origem não informada", destination ?? "Destino não informado"].join(" → ") });
  if (asText(journey.direction))
    routine.push({ label: "Sentido", value: formatCrmAnswerValue(journey.direction) });
  const departure = p.outbound_time ?? asText(journey.outboundTime);
  const returning = asText(journey.returnTime);
  const outboundLabel = journey.direction === "VOLTA" ? "Volta" : "Ida";
  if (departure || returning)
    routine.push({ label: "Horários", value: [
      departure ? outboundLabel + " " + departure : null,
      returning ? "Volta " + returning : null,
    ].filter(Boolean).join(" · ") });
  const days = formatCrmWeekdays(journey.days);
  if (days) routine.push({ label: "Dias da semana", value: days });
  const tolerance = Number(journey.flexibilityMinutes);
  if (journey.flexibilityMinutes !== null && journey.flexibilityMinutes !== undefined &&
      Number.isFinite(tolerance) && tolerance > 0)
    routine.push({ label: "Tolerância", value: "±" + tolerance + " min" });
  if (p.vehicle_type)
    routine.push({ label: "Veículo", value: formatCrmAnswerValue(p.vehicle_type) });
  if (p.seats !== null)
    routine.push({ label: "Vagas declaradas", value: String(p.seats) });

  for (const [key, value] of Object.entries(answers)) {
    if (value === null || value === "" || value === undefined) continue;
    const category = classify(key);
    if (category === "identity") continue;
    if (category === "duplicate") {
      const k = normalizeKey(key);
      if ((/veiculo|modelo/.test(k) && !p.vehicle_type) ||
          (/vaga|lugares/.test(k) && p.seats === null))
        pushUnique(routine, { label: formatCrmFieldLabel(key), value: formatCrmAnswerValue(value, key) });
      continue;
    }
    if (category === "primary") {
      if (typeof value === "string") primaryPain = formatCrmAnswerValue(value, key);
      continue;
    }
    if (category === "pain") {
      const values = Array.isArray(value) ? value : [value];
      extraPains.push(...values.filter((x): x is string => typeof x === "string" && Boolean(x.trim())));
      continue;
    }
    if (category === "barrier") {
      pushUnique(barriers, { label: "Maior receio/barreira", value: formatCrmAnswerValue(value, key) });
      continue;
    }
    if (category === "routine") {
      const k = normalizeKey(key);
      const label = /tempo.*espera/.test(k) ? "Tempo de espera declarado"
        : /gasta.*por trecho/.test(k) ? "Gasto habitual por trecho"
        : "Transporte atual";
      const money = label === "Gasto habitual por trecho" && value !== null &&
        (typeof value === "number" || /^\d+(?:[.,]\d{1,2})?$/.test(String(value)));
      const currency = money
        ? "R$ " + Number(String(value).replace(",", ".")).toLocaleString("pt-BR", {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })
        : formatCrmAnswerValue(value, key);
      pushUnique(routine, { label, value: currency });
      continue;
    }
    if (category === "fit") {
      pushUnique(fit, { label: fitLabel(key), value: formatCrmAnswerValue(value, key) });
      continue;
    }
    if (key !== "journey" && key !== "answers_raw" && key !== "answers" &&
        key !== "pain_points" && key !== "version" && key !== "form") {
      otherAnswers[key] = value;
    }
  }

  if (!primaryPain && Array.isArray(raw.pain_points)) {
    const primary = raw.pain_points.map(asRecord).find(item => item.principal === true);
    if (primary && asText(primary.codigo_dor)) primaryPain = formatCrmAnswerValue(primary.codigo_dor);
  }
  const pains = [...new Set([...p.pains, ...extraPains].map(v => formatCrmAnswerValue(v)))];
  if (primaryPain) {
    // Explicit primary pain is a headline, not a duplicate chip.
    const index = pains.indexOf(primaryPain);
    if (index >= 0) pains.splice(index, 1);
  }
  return { routine, fit, primaryPain, barriers, pains, otherAnswers };
}
