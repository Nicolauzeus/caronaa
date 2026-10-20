import { z } from "zod";

export const rideMatchEvaluationSchema = z.object({
  classification: z.enum(["compatible", "approximate", "opportunity"]),
  pickupAt: z.string().datetime({ offset: true }),
  differenceMinutes: z.number().nullable(),
  score: z.number().min(0).max(100).nullable(),
  preferenceBonus: z.number(),
  reasons: z.array(z.string()),
  roadGeometry: z.boolean(),
  pickupDistanceKm: z.number().nullable(),
  dropoffDistanceKm: z.number().nullable(),
  requiresAdjustment: z.boolean(),
  timeEstimated: z.boolean(),
});
export type RideMatchEvaluation = z.infer<typeof rideMatchEvaluationSchema>;
export const matchClassificationLabels = {
  compatible: "Compatível",
  approximate: "Match aproximado",
  opportunity: "Oportunidade",
} as const;

export function formatPickupAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function describePickupDifference(minutes: number | null) {
  if (minutes == null) return "Informe quando quer embarcar para comparar os horários.";
  if (Math.abs(minutes) < 0.5) return "Embarque estimado no horário solicitado.";
  return `Embarque estimado ${Math.round(Math.abs(minutes))} min ${minutes < 0 ? "antes" : "depois"} do solicitado.`;
}
