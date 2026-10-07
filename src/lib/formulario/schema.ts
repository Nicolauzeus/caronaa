// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { z } from "zod";
import { MIN_DRIVER_PRICE } from "./pricing";

const intentSchema = z.enum(["MOTORISTA", "PASSAGEIRO", "AMBOS"], {
  required_error: "Escolha como você deseja participar.",
  invalid_type_error: "Escolha como você deseja participar.",
});

const vehicleTypeSchema = z.enum(["CARRO_PROPRIO", "CARRO_COMPARTILHADO", "MOTO"], {
  required_error: "Selecione o tipo de veículo.",
  invalid_type_error: "Selecione o tipo de veículo.",
});

const passengerTransportSchema = z.enum([
  "ONIBUS",
  "METRO_VLT",
  "CARRO_PROPRIO",
  "MOTO_PROPRIA",
  "UBER_99",
  "TAXI",
  "CARONA",
  "BICICLETA",
  "APE",
  "COMBINACAO",
  "OUTRO",
]);

const departureWindowSchema = z.enum(["ANTES_18", "18_19", "19_20", "20_21", "21_22", "APOS_22"], {
  required_error: "Selecione o horário previsto de saída.",
  invalid_type_error: "Selecione o horário previsto de saída.",
});

const occupationSchema = z.enum(["ESTUDANTE", "TRABALHADOR", "ESTUDANTE_TRABALHADOR", "OUTRO"], {
  required_error: "Informe seu perfil ou ocupação.",
  invalid_type_error: "Informe seu perfil ou ocupação.",
});

const weeklyFrequencySchema = z.enum(["1_2", "3_4", "5_MAIS", "EVENTUAL"]);

const routeCostRangeSchema = z.enum(["0_5", "6_10", "11_20", "21_30", "31_50", "ACIMA_50"]);

const costPeriodSchema = z.enum(["POR_TRECHO", "POR_DIA"]);

const painPointSchema = z.enum([
  "DOR_01",
  "DOR_02",
  "DOR_03",
  "DOR_04",
  "DOR_05",
  "DOR_06",
  "OUTRO_PROBLEMA",
  "SEM_GRANDES_DIFICULDADES",
]);

const interestLevelSchema = z.enum([
  "USARIA_HOJE",
  "PROVAVELMENTE_USARIA",
  "TALVEZ",
  "PROVAVELMENTE_NAO",
  "NAO_USARIA",
]);

const trustFactorSchema = z.enum([
  "IDENTIDADE_VERIFICADA",
  "FOTO",
  "WHATSAPP_VERIFICADO",
  "PERFIL_CARONAA",
  "DADOS_VEICULO",
  "PLACA",
  "AVALIACOES",
  "PARTICIPANTE_STS",
  "ROTA_VISIVEL",
  "COMPARTILHAR_VIAGEM",
  "MESMO_GENERO",
  "OUTRO",
]);

const priceRangeSchema = z.enum([
  "ATE_5",
  "5_10",
  "10_15",
  "15_20",
  "ACIMA_20",
  "DEPENDE_DISTANCIA",
  "GRATUITO",
]);

const commitmentLevelSchema = z.enum(["SIM_HOJE", "QUERO_VER_MATCH", "NAO_HOJE"]);

const proposalSenseSchema = z.enum(["POUCO", "MEDIO", "ALTO", "ALTISSIMO"]);
const driverFutureOfferSchema = z.enum(["SIM", "TALVEZ", "NAO"]);
const driverGenderPreferenceSchema = z.enum(["MASCULINO", "FEMININO", "OUTRO"]);
const driverRealValidationSchema = z.enum(["COM_CERTEZA", "TALVEZ", "APENAS_STS"]);
const passengerIntentionSchema = z.enum(["COM_CERTEZA_HOJE", "TALVEZ", "COM_CERTEZA_SEMPRE"]);
const dualPrioritySchema = z.enum(["OFERECER", "PEGAR", "AMBOS_AVALIAR"]);

const baseSchema = z.object({
  source: z.string().trim().min(1).max(100),
  campaign: z.string().trim().max(100).nullable().optional(),

  intent: intentSchema,

  destinationNeighborhood: z
    .string()
    .trim()
    .min(2, "Informe o bairro ou região de destino.")
    .max(120, "Destino muito longo."),

  destinationReference: z.string().trim().max(160, "Ponto de referência muito longo.").optional(),

  originNeighborhood: z
    .string()
    .trim()
    .min(2, "Informe a origem aproximada do trajeto.")
    .max(120, "Origem muito longa."),

  departureWindow: departureWindowSchema,

  occupation: occupationSchema,
  occupationDetails: z.string().trim().max(160, "Descrição muito longa.").optional(),

  weeklyFrequency: weeklyFrequencySchema.optional(),

  eventPresenceDays: z.array(z.string().trim()).max(10).optional(),
  eventPresenceCustom: z.string().trim().max(200, "Texto muito longo.").optional(),

  name: z
    .string()
    .trim()
    .min(2, "Informe como prefere ser chamado.")
    .max(120, "Nome muito longo.")
    .optional(),

  whatsapp: z
    .string()
    .trim()
    .min(10, "Informe um WhatsApp válido com DDD.")
    .max(20, "WhatsApp inválido.")
    .optional(),

  email: z.string().trim().email("Informe um e-mail válido.").optional(),

  submissionId: z.string().uuid().optional(),

  createdAt: z.string().optional(),

  campaignEvent: z.string().trim().min(1).max(160).optional(),

  passengerCount: z.number().int().min(1).max(6).optional(),

  currentTransport: passengerTransportSchema.optional(),

  routeCostRange: routeCostRangeSchema.optional(),

  costPeriod: costPeriodSchema.optional(),

  painPoints: z.array(painPointSchema).max(8).optional(),

  mainPainPoint: painPointSchema.optional(),

  mainPainIntensity: z.number().int().min(1).max(5).optional(),

  passengerInterest: interestLevelSchema.optional(),

  passengerTrustFactors: z.array(trustFactorSchema).max(12).optional(),

  passengerPriceRange: priceRangeSchema.optional(),

  passengerCommitment: commitmentLevelSchema.optional(),

  vehicleType: vehicleTypeSchema.optional(),

  availableSeats: z.number().int().min(0).max(10).optional(),

  maxDetourMinutes: z.number().int().min(0).max(60).optional(),

  driverTrustFactors: z.array(trustFactorSchema).max(12).optional(),

  driverPrice: z.number().finite().min(3.5).max(25.0).optional(),

  caronaaFee: z.number().finite().optional(),

  driverNetAmount: z.number().finite().optional(),

  familyCarCompanions: z.number().int().min(0).max(10).optional(),

  // Proposta e Validação Motorista
  proposalSense: proposalSenseSchema.optional(),
  driverFutureOffer: driverFutureOfferSchema.optional(),
  driverComfortFactors: z.array(z.string().trim()).max(10).optional(),
  driverGenderPreference: driverGenderPreferenceSchema.optional(),
  driverBarriers: z.array(z.string().trim()).max(10).optional(),
  driverBarriersCustom: z.string().trim().max(300).optional(),
  driverRealValidation: driverRealValidationSchema.optional(),

  // Novos campos estruturados do Passageiro
  passengerTransports: z.array(z.string().trim()).max(10).optional(),
  passengerTransportsCustom: z.string().trim().max(300).optional(),
  passengerDifficulties: z.array(z.string().trim()).max(10).optional(),
  passengerDifficultiesCustom: z.string().trim().max(300).optional(),
  passengerGenderPreference: driverGenderPreferenceSchema.optional(),
  passengerFairPrice: z.number().finite().min(3.5).max(25.0).optional(),
  passengerBarriers: z.array(z.string().trim()).max(10).optional(),
  passengerBarriersCustom: z.string().trim().max(300).optional(),
  passengerIntention: passengerIntentionSchema.optional(),

  // Fluxo "Os Dois" (Dual)
  dualPriority: dualPrioritySchema.optional(),

  driverInterest: interestLevelSchema.optional(),

  driverCommitment: commitmentLevelSchema.optional(),

  feedback: z.string().trim().max(500, "Comentário muito longo.").optional(),
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
  researchAccepted: z.boolean().optional(),
  termsVersion: z.string().trim().max(50).optional(),
  consentsTimestamp: z.string().optional(),
});

export const caronaaStsFormSchema = baseSchema.superRefine((data, ctx) => {
  if (data.intent === "PASSAGEIRO" || data.intent === "AMBOS") {
    const hasNewPassengerData = Boolean(
      data.passengerIntention || (data.passengerTransports && data.passengerTransports.length > 0),
    );

    if (!hasNewPassengerData) {
      if (!data.passengerInterest) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerInterest"],
          message: "Informe seu interesse em usar a CARONAA como passageiro.",
        });
      }

      if (!data.currentTransport) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentTransport"],
          message: "Informe como você faz esse trajeto atualmente.",
        });
      }

      if (!data.routeCostRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["routeCostRange"],
          message: "Informe quanto você costuma gastar nesse deslocamento.",
        });
      }

      if (!data.costPeriod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["costPeriod"],
          message: "Informe se o gasto é por trecho ou por dia.",
        });
      }

      if (!data.painPoints || data.painPoints.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["painPoints"],
          message: "Selecione pelo menos uma resposta sobre os problemas do trajeto.",
        });
      }

      if (!data.mainPainPoint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mainPainPoint"],
          message: "Informe qual problema mais incomoda você.",
        });
      }

      if (data.mainPainPoint && !data.painPoints?.includes(data.mainPainPoint)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mainPainPoint"],
          message: "A dor principal deve estar entre as opções selecionadas.",
        });
      }

      if (!data.mainPainIntensity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mainPainIntensity"],
          message: "Informe quanto esse problema impacta sua rotina.",
        });
      }
    } else {
      if (!data.passengerTransports || data.passengerTransports.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerTransports"],
          message: "Informe como você costuma se deslocar.",
        });
      }

      if (data.passengerTransports?.includes("OUTRO") && !data.passengerTransportsCustom?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerTransportsCustom"],
          message: "Especifique seu modo de transporte.",
        });
      }

      if (!data.passengerDifficulties || data.passengerDifficulties.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerDifficulties"],
          message: "Informe suas dificuldades no deslocamento.",
        });
      }

      if (
        data.passengerDifficulties?.includes("OUTRA") &&
        !data.passengerDifficultiesCustom?.trim()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerDifficultiesCustom"],
          message: "Descreva sua principal dificuldade.",
        });
      }

      if (
        data.passengerFairPrice === undefined ||
        data.passengerFairPrice < 3.5 ||
        data.passengerFairPrice > 25.0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerFairPrice"],
          message: "O valor justo a pagar deve ser entre R$ 3,50 e R$ 25,00.",
        });
      }

      if (data.passengerBarriers?.includes("OUTRA") && !data.passengerBarriersCustom?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerBarriersCustom"],
          message: "Descreva sua principal dúvida ou questão.",
        });
      }

      if (!data.passengerIntention) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerIntention"],
          message: "Informe sua intenção de pegar carona.",
        });
      }
    }
  }

  if (data.intent === "AMBOS") {
    if (!data.dualPriority && (data.passengerIntention || data.driverRealValidation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dualPriority"],
        message: "Informe qual possibilidade é mais importante para você hoje.",
      });
    }
  }

  if (data.intent === "MOTORISTA" || data.intent === "AMBOS") {
    if (!data.driverInterest && !data.driverRealValidation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["driverInterest"],
        message: "Informe seu interesse em oferecer lugares pela CARONAA.",
      });
    }
  }

  if (!data.occupation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["occupation"],
      message: "Informe seu perfil.",
    });
  }

  if (!data.originNeighborhood?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["originNeighborhood"],
      message: "Informe a origem aproximada do trajeto.",
    });
  }

  if (!data.name || data.name.trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Informe como prefere ser chamado.",
    });
  }
  if (!data.whatsapp || data.whatsapp.replace(/\D/g, "").length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["whatsapp"],
      message: "Informe um WhatsApp válido com DDD.",
    });
  }
});

const stepFields = {
  ROLE_SELECTION: ["intent"],
  ROUTE_DETAILS: ["occupation", "originNeighborhood", "destinationNeighborhood", "departureWindow"],
  EVENT_PRESENCE: ["eventPresenceDays"],
  PROFILE_ROUTE: [
    "intent",
    "occupation",
    "originNeighborhood",
    "destinationNeighborhood",
    "departureWindow",
  ],
  PROPOSAL_TRANSITION: ["proposalSense"],
  DRIVER_FLOW: ["vehicleType", "availableSeats", "driverPrice", "driverRealValidation"],
  PASSENGER_FLOW: [
    "passengerTransports",
    "passengerDifficulties",
    "passengerFairPrice",
    "passengerIntention",
  ],
  BOTH_FLOW: [
    "dualPriority",
    "vehicleType",
    "availableSeats",
    "driverPrice",
    "driverRealValidation",
    "passengerTransports",
    "passengerDifficulties",
    "passengerFairPrice",
    "passengerIntention",
  ],
  CURRENT_PRICE: ["currentTransport", "routeCostRange", "costPeriod"],
  PROBLEMS: ["painPoints"],
  MAIN_PROBLEM: ["mainPainPoint", "mainPainIntensity"],
  INTEREST: ["passengerInterest", "driverInterest"],
  CONTACT: ["name", "whatsapp", "email", "feedback", "termsAccepted", "privacyAccepted"],
} as const;

export type FormValidationStep = keyof typeof stepFields;

export function validateFormStep(step: FormValidationStep, data: Record<string, unknown>) {
  const fields = stepFields[step];
  if (!fields) return { success: true as const, data };

  const friendlyMessages: Record<string, string> = {
    intent: "Escolha como você deseja participar.",
    occupation: "Informe seu perfil ou ocupação.",
    occupationDetails: "Descreva sua ocupação.",
    originNeighborhood: "Informe a origem aproximada do trajeto.",
    destinationNeighborhood: "Informe o destino aproximado do trajeto.",
    departureWindow: "Selecione o horário previsto de saída.",
    eventPresenceDays: "Selecione os dias em que você estará no evento.",
    eventPresenceCustom: "Descreva sua disponibilidade.",
    proposalSense: "Informe quanto essa proposta faz sentido para você.",
    vehicleType: "Selecione o tipo de veículo.",
    availableSeats: "Informe a quantidade de assentos disponíveis.",
    driverPrice: "Informe o valor sugerido por vaga.",
    driverRealValidation: "Informe se disponibilizaria a carona hoje.",
    passengerTransports: "Selecione como costuma se deslocar.",
    passengerTransportsCustom: "Especifique seu modo de transporte.",
    passengerDifficulties: "Selecione suas dificuldades no deslocamento.",
    passengerDifficultiesCustom: "Descreva sua principal dificuldade.",
    passengerFairPrice: "Informe um valor justo para a carona.",
    passengerIntention: "Informe sua intenção de pegar carona.",
    dualPriority: "Informe qual possibilidade é mais importante para você hoje.",
    name: "Informe como prefere ser chamado.",
    whatsapp: "Informe um WhatsApp válido com DDD.",
    feedback: "Deixe seu comentário, dúvida ou sugestão.",
    termsAccepted: "É obrigatório aceitar os Termos de Uso.",
    privacyAccepted: "É obrigatório aceitar a Política de Privacidade.",
  };

  const errors: Partial<Record<(typeof fields)[number], string>> = {};
  const add = (field: (typeof fields)[number], message: string) => {
    if (!errors[field]) {
      errors[field] = message;
    }
  };

  const partial = baseSchema.pick(
    Object.fromEntries(fields.map((field) => [field, true])) as never,
  );
  const parsed = partial.safeParse(data);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      const field = String(issue.path[0] || "") as (typeof fields)[number];
      if (
        issue.message === "Required" ||
        issue.message.toLowerCase().includes("required") ||
        issue.code === "invalid_type"
      ) {
        add(field, friendlyMessages[field] || "Campo obrigatório.");
      } else {
        add(field, issue.message);
      }
    });
  }

  const value = data as Record<string, unknown>;
  if (step === "ROLE_SELECTION") {
    if (!value["intent"]) add("intent", "Escolha como você deseja participar.");
  }
  if (step === "ROUTE_DETAILS") {
    if (!value["occupation"]) add("occupation", "Informe seu perfil.");
    if (
      value["occupation"] === "OUTRO" &&
      (typeof value["occupationDetails"] !== "string" || !value["occupationDetails"].trim())
    ) {
      add("occupationDetails", "Descreva sua ocupação.");
    }
    if (typeof value["originNeighborhood"] !== "string" || !value["originNeighborhood"].trim())
      add("originNeighborhood", "Informe a origem aproximada do trajeto.");
    if (
      typeof value["destinationNeighborhood"] !== "string" ||
      !value["destinationNeighborhood"].trim()
    )
      add("destinationNeighborhood", "Informe o destino aproximado do trajeto.");
    if (!value["departureWindow"]) add("departureWindow", "Selecione o horário previsto de saída.");
  }
  if (step === "EVENT_PRESENCE") {
    if (
      Array.isArray(value["eventPresenceDays"]) &&
      value["eventPresenceDays"].includes("OUTRO") &&
      (typeof value["eventPresenceCustom"] !== "string" || !value["eventPresenceCustom"].trim())
    ) {
      add("eventPresenceCustom", "Descreva sua disponibilidade.");
    }
  }
  if (step === "PROFILE_ROUTE") {
    if (!value["intent"]) add("intent", "Escolha como pretende usar a CARONAA.");
    if (!value["occupation"]) add("occupation", "Informe seu perfil.");
    if (typeof value["originNeighborhood"] !== "string" || !value["originNeighborhood"].trim())
      add("originNeighborhood", "Informe a origem aproximada do trajeto.");
  }
  if (step === "PROPOSAL_TRANSITION") {
    if (!value["proposalSense"])
      add("proposalSense", "Informe quanto essa proposta faz sentido para você.");
  }
  if (step === "DRIVER_FLOW") {
    if (!value["vehicleType"])
      add("vehicleType", "Selecione o veículo com o qual pretende se deslocar.");
    if (value["availableSeats"] === undefined || value["availableSeats"] === null)
      add("availableSeats", "Informe o número de lugares disponíveis (0 a 10).");
    const price = Number(value["driverPrice"]);
    if (isNaN(price) || price < 3.5 || price > 25.0) {
      add("driverPrice", "O valor por passageiro deve ser entre R$ 3,50 e R$ 25,00.");
    }
    if (Array.isArray(value["driverBarriers"]) && value["driverBarriers"].includes("OUTRA")) {
      if (
        typeof value["driverBarriersCustom"] !== "string" ||
        !value["driverBarriersCustom"].trim()
      ) {
        add("driverBarriersCustom", "Descreva sua principal dúvida ou questão.");
      }
    }
    if (!value["driverRealValidation"])
      add("driverRealValidation", "Informe se você toparia oferecer carona.");
  }
  if (step === "PASSENGER_FLOW") {
    if (!Array.isArray(value["passengerTransports"]) || value["passengerTransports"].length === 0) {
      add("passengerTransports", "Selecione como você costuma se deslocar.");
    }
    if (
      Array.isArray(value["passengerTransports"]) &&
      value["passengerTransports"].includes("OUTRO") &&
      (typeof value["passengerTransportsCustom"] !== "string" ||
        !value["passengerTransportsCustom"].trim())
    ) {
      add("passengerTransportsCustom", "Especifique seu modo de transporte atual.");
    }
    if (
      !Array.isArray(value["passengerDifficulties"]) ||
      value["passengerDifficulties"].length === 0
    ) {
      add("passengerDifficulties", "Selecione suas maiores dificuldades no deslocamento.");
    }
    if (
      Array.isArray(value["passengerDifficulties"]) &&
      value["passengerDifficulties"].includes("OUTRA") &&
      (typeof value["passengerDifficultiesCustom"] !== "string" ||
        !value["passengerDifficultiesCustom"].trim())
    ) {
      add("passengerDifficultiesCustom", "Descreva sua principal dificuldade.");
    }
    const fairPrice = Number(value["passengerFairPrice"]);
    if (isNaN(fairPrice) || fairPrice < 3.5 || fairPrice > 25.0) {
      add("passengerFairPrice", "O valor justo a pagar deve ser entre R$ 3,50 e R$ 25,00.");
    }
    if (
      Array.isArray(value["passengerBarriers"]) &&
      value["passengerBarriers"].includes("OUTRA") &&
      (typeof value["passengerBarriersCustom"] !== "string" ||
        !value["passengerBarriersCustom"].trim())
    ) {
      add("passengerBarriersCustom", "Descreva sua principal dúvida ou questão.");
    }
    if (!value["passengerIntention"]) {
      add("passengerIntention", "Informe sua intenção de pegar carona.");
    }
  }
  if (step === "BOTH_FLOW") {
    if (!value["dualPriority"]) {
      add("dualPriority", "Informe qual possibilidade é mais importante para você hoje.");
    }
    // Validações Motorista
    if (!value["vehicleType"])
      add("vehicleType", "Selecione o veículo com o qual pretende se deslocar.");
    if (value["availableSeats"] === undefined || value["availableSeats"] === null)
      add("availableSeats", "Informe o número de lugares disponíveis (0 a 10).");
    const dPrice = Number(value["driverPrice"]);
    if (isNaN(dPrice) || dPrice < 3.5 || dPrice > 25.0) {
      add("driverPrice", "O valor por passageiro deve ser entre R$ 3,50 e R$ 25,00.");
    }
    if (Array.isArray(value["driverBarriers"]) && value["driverBarriers"].includes("OUTRA")) {
      if (
        typeof value["driverBarriersCustom"] !== "string" ||
        !value["driverBarriersCustom"].trim()
      ) {
        add("driverBarriersCustom", "Descreva sua principal dúvida para oferecer carona.");
      }
    }
    if (!value["driverRealValidation"])
      add("driverRealValidation", "Informe se você toparia oferecer carona.");

    // Validações Passageiro
    if (!Array.isArray(value["passengerTransports"]) || value["passengerTransports"].length === 0) {
      add("passengerTransports", "Selecione como você costuma se deslocar.");
    }
    if (
      Array.isArray(value["passengerTransports"]) &&
      value["passengerTransports"].includes("OUTRO") &&
      (typeof value["passengerTransportsCustom"] !== "string" ||
        !value["passengerTransportsCustom"].trim())
    ) {
      add("passengerTransportsCustom", "Especifique seu modo de transporte atual.");
    }
    if (
      !Array.isArray(value["passengerDifficulties"]) ||
      value["passengerDifficulties"].length === 0
    ) {
      add("passengerDifficulties", "Selecione suas maiores dificuldades no deslocamento.");
    }
    if (
      Array.isArray(value["passengerDifficulties"]) &&
      value["passengerDifficulties"].includes("OUTRA") &&
      (typeof value["passengerDifficultiesCustom"] !== "string" ||
        !value["passengerDifficultiesCustom"].trim())
    ) {
      add("passengerDifficultiesCustom", "Descreva sua principal dificuldade.");
    }
    const pPrice = Number(value["passengerFairPrice"]);
    if (isNaN(pPrice) || pPrice < 3.5 || pPrice > 25.0) {
      add("passengerFairPrice", "O valor justo a pagar deve ser entre R$ 3,50 e R$ 25,00.");
    }
    if (
      Array.isArray(value["passengerBarriers"]) &&
      value["passengerBarriers"].includes("OUTRA") &&
      (typeof value["passengerBarriersCustom"] !== "string" ||
        !value["passengerBarriersCustom"].trim())
    ) {
      add("passengerBarriersCustom", "Descreva sua principal dúvida para pegar carona.");
    }
    if (!value["passengerIntention"]) {
      add("passengerIntention", "Informe sua intenção de pegar carona.");
    }
  }
  if (step === "CURRENT_PRICE") {
    if (!value["currentTransport"])
      add("currentTransport", "Informe como você faz esse trajeto atualmente.");
    if (!value["routeCostRange"])
      add("routeCostRange", "Informe quanto costuma gastar nesse deslocamento.");
    if (!value["costPeriod"]) add("costPeriod", "Informe se o gasto é por trecho ou por dia.");
  }
  if (
    step === "PROBLEMS" &&
    (!Array.isArray(value["painPoints"]) || value["painPoints"].length === 0)
  )
    add("painPoints", "Selecione pelo menos uma resposta sobre os problemas do trajeto.");
  if (step === "MAIN_PROBLEM") {
    if (!value["mainPainPoint"]) add("mainPainPoint", "Informe qual problema mais incomoda você.");
    else if (
      !Array.isArray(value["painPoints"]) ||
      !value["painPoints"].includes(value["mainPainPoint"])
    )
      add("mainPainPoint", "A dor principal deve estar entre as opções selecionadas.");
    if (
      !Number.isInteger(value["mainPainIntensity"]) ||
      Number(value["mainPainIntensity"]) < 1 ||
      Number(value["mainPainIntensity"]) > 5
    )
      add("mainPainIntensity", "Informe uma intensidade de 1 a 5.");
  }
  if (step === "INTEREST") {
    if (
      (value["intent"] === "PASSAGEIRO" || value["intent"] === "AMBOS") &&
      !value["passengerInterest"]
    )
      add("passengerInterest", "Informe seu interesse como passageiro.");
    if (
      (value["intent"] === "MOTORISTA" || value["intent"] === "AMBOS") &&
      !value["driverInterest"]
    )
      add("driverInterest", "Informe seu interesse como motorista.");
  }
  if (step === "CONTACT") {
    if (typeof value["name"] !== "string" || value["name"].trim().length < 2)
      add("name", "Informe como prefere ser chamado.");
    if (typeof value["whatsapp"] !== "string" || value["whatsapp"].replace(/\D/g, "").length < 10)
      add("whatsapp", "Informe um WhatsApp válido com DDD.");
    if (
      value["feedback"] !== undefined &&
      (typeof value["feedback"] !== "string" || !value["feedback"].trim())
    ) {
      add("feedback", "Deixe seu comentário, dúvida ou sugestão.");
    }
    if (value["termsAccepted"] === false) {
      add("termsAccepted", "Você precisa aceitar os Termos de Uso.");
    }
    if (value["privacyAccepted"] === false) {
      add("privacyAccepted", "Você precisa aceitar a Política de Privacidade.");
    }
  }
  return Object.keys(errors).length
    ? {
        success: false as const,
        errors,
        error: {
          issues: Object.entries(errors).map(([field, message]) => ({
            path: [field],
            message,
            code: "custom" as const,
          })),
        },
      }
    : { success: true as const, data };
}

export type CaronaaStsFormValues = z.infer<typeof caronaaStsFormSchema>;
