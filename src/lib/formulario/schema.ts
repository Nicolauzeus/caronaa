import { z } from "zod";
import { MIN_DRIVER_PRICE } from "./pricing";

const intentSchema = z.enum(["MOTORISTA", "PASSAGEIRO", "AMBOS"]);

const vehicleTypeSchema = z.enum(["CARRO_PROPRIO", "CARRO_COMPARTILHADO", "MOTO"]);

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

const departureWindowSchema = z.enum(["ANTES_18", "18_19", "19_20", "20_21", "21_22", "APOS_22"]);

const occupationSchema = z.enum(["ESTUDANTE", "TRABALHADOR", "ESTUDANTE_TRABALHADOR", "OUTRO"]);

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

  originNeighborhood: z.string().trim().max(120, "Origem muito longa.").optional(),

  departureWindow: departureWindowSchema,

  occupation: occupationSchema.optional(),

  weeklyFrequency: weeklyFrequencySchema.optional(),

  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),

  whatsapp: z.string().trim().min(10, "Informe um WhatsApp válido.").max(20, "WhatsApp inválido."),

  email: z.string().trim().email("Informe um e-mail válido.").optional(),

  submissionId: z.string().uuid().optional(),

  createdAt: z.string().optional(),

  campaign: z.string().trim().max(120).nullable().optional(),

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

  availableSeats: z.number().int().min(1).max(6).optional(),

  maxDetourMinutes: z.number().int().min(0).max(60).optional(),

  driverTrustFactors: z.array(trustFactorSchema).max(12).optional(),

  driverPrice: z.number().finite().optional(),

  caronaaFee: z.number().finite().optional(),

  driverNetAmount: z.number().finite().optional(),

  familyCarCompanions: z.number().int().min(0).max(10).optional(),

  driverInterest: interestLevelSchema.optional(),

  driverCommitment: commitmentLevelSchema.optional(),
});

export const caronaaStsFormSchema = baseSchema.superRefine((data, ctx) => {
  if (data.intent === "PASSAGEIRO" || data.intent === "AMBOS") {
    if (!data.passengerInterest) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passengerInterest"],
        message: "Informe seu interesse em usar a CARONAA como passageiro.",
      });
    }
  }

  if (data.intent === "MOTORISTA" || data.intent === "AMBOS") {
    if (!data.driverInterest) {
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

  if (!data.weeklyFrequency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weeklyFrequency"],
      message: "Informe a frequência semanal desse trajeto.",
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
});

export type CaronaaStsFormValues = z.infer<typeof caronaaStsFormSchema>;
