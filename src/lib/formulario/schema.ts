import { z } from "zod";

const intentSchema = z.enum([
  "MOTORISTA",
  "PASSAGEIRO",
  "AMBOS",
]);

const vehicleTypeSchema = z.enum([
  "CARRO_PROPRIO",
  "CARRO_COMPARTILHADO",
  "MOTO",
]);

const passengerTransportSchema = z.enum([
  "ONIBUS",
  "UBER_99",
  "CARONA",
  "BICICLETA",
  "APE",
  "OUTRO",
]);

const departureWindowSchema = z.enum([
  "ANTES_18",
  "18_19",
  "19_20",
  "20_21",
  "21_22",
  "APOS_22",
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

const commitmentLevelSchema = z.enum([
  "SIM_HOJE",
  "QUERO_VER_MATCH",
  "NAO_HOJE",
]);

const baseSchema = z.object({
  source: z.literal("sts-2026"),

  intent: intentSchema,

  destinationNeighborhood: z
    .string()
    .trim()
    .min(2, "Informe o bairro ou região de destino.")
    .max(120, "Destino muito longo."),

  destinationReference: z
    .string()
    .trim()
    .max(160, "Ponto de referência muito longo.")
    .optional(),

  departureWindow: departureWindowSchema,

  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(120, "Nome muito longo."),

  whatsapp: z
    .string()
    .trim()
    .min(10, "Informe um WhatsApp válido.")
    .max(20, "WhatsApp inválido."),

  submissionId: z.string().uuid().optional(),

  createdAt: z.string().optional(),

  passengerCount: z.number().int().min(1).max(6).optional(),

  currentTransport: passengerTransportSchema.optional(),

  passengerTrustFactors: z
    .array(trustFactorSchema)
    .max(12)
    .optional(),

  passengerPriceRange: priceRangeSchema.optional(),

  passengerCommitment: commitmentLevelSchema.optional(),

  vehicleType: vehicleTypeSchema.optional(),

  availableSeats: z.number().int().min(1).max(6).optional(),

  maxDetourMinutes: z.number().int().min(0).max(60).optional(),

  driverTrustFactors: z
    .array(trustFactorSchema)
    .max(12)
    .optional(),

  driverPriceRange: priceRangeSchema.optional(),

  driverCommitment: commitmentLevelSchema.optional(),
});

export const caronaaStsFormSchema = baseSchema.superRefine(
  (data, ctx) => {
    if (data.intent === "PASSAGEIRO" || data.intent === "AMBOS") {
      if (!data.passengerCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerCount"],
          message: "Informe para quantas pessoas você procura carona.",
        });
      }

      if (!data.currentTransport) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentTransport"],
          message: "Informe como você faria esse trajeto hoje.",
        });
      }

      if (
        !data.passengerTrustFactors ||
        data.passengerTrustFactors.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerTrustFactors"],
          message: "Selecione pelo menos um fator de confiança.",
        });
      }

      if (!data.passengerPriceRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerPriceRange"],
          message: "Informe uma faixa de contribuição.",
        });
      }

      if (!data.passengerCommitment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passengerCommitment"],
          message: "Informe se você usaria a CARONAA hoje.",
        });
      }
    }

    if (data.intent === "MOTORISTA" || data.intent === "AMBOS") {
      if (!data.vehicleType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vehicleType"],
          message: "Informe qual veículo você utilizaria.",
        });
      }

      if (
        data.vehicleType !== "MOTO" &&
        !data.availableSeats
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["availableSeats"],
          message: "Informe quantos lugares você teria disponíveis.",
        });
      }

      if (
        data.vehicleType !== "MOTO" &&
        data.maxDetourMinutes === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxDetourMinutes"],
          message: "Informe quanto você aceitaria desviar da rota.",
        });
      }

      if (
        !data.driverTrustFactors ||
        data.driverTrustFactors.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["driverTrustFactors"],
          message: "Selecione pelo menos um fator de confiança.",
        });
      }

      if (!data.driverPriceRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["driverPriceRange"],
          message: "Informe uma faixa de contribuição.",
        });
      }

      if (!data.driverCommitment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["driverCommitment"],
          message: "Informe se você ofereceria a carona hoje.",
        });
      }
    }
  },
);

export type CaronaaStsFormValues = z.infer<
  typeof caronaaStsFormSchema
>;
