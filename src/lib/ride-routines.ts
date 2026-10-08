import { z } from "zod";
import { travelPreferencesSchema } from "./travel-preferences";

export const weekDays = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
] as const;
export function localRideDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
const routeFields = {
  origin: z.string().trim().min(1).max(160),
  destination: z.string().trim().min(1).max(160),
  originLat: z.number().finite().min(-90).max(90).nullable(),
  originLng: z.number().finite().min(-180).max(180).nullable(),
  destinationLat: z.number().finite().min(-90).max(90).nullable(),
  destinationLng: z.number().finite().min(-180).max(180).nullable(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  seats: z.number().int().min(1).max(6),
  timeToleranceMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]),
  totalPrice: z.number().finite().min(0).max(1000),
  preferences: travelPreferencesSchema.nullish().transform((value) => value ?? undefined),
};
export const routineDefinitionSchema = z
  .object({
    ...routeFields,
    kind: z.enum(["offer", "request"]),
    days: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .transform((days) => [...new Set(days)].sort()),
    startDate: z.string().date(),
    endDate: z.string().date().nullable(),
    active: z.boolean(),
  })
  .refine(
    (value) => !value.endDate || value.endDate >= value.startDate,
    "A data final deve ser igual ou posterior à inicial.",
  )
  .refine(
    (value) =>
      value.origin.toLocaleLowerCase("pt-BR") !== value.destination.toLocaleLowerCase("pt-BR"),
    "Origem e destino devem ser diferentes.",
  )
  .refine(
    (value) =>
      (value.originLat === null) === (value.originLng === null) &&
      (value.destinationLat === null) === (value.destinationLng === null),
    "Coordenadas incompletas.",
  );
export const occurrenceDefinitionSchema = z
  .object({ ...routeFields, rideDate: z.string().date() })
  .refine(
    (value) =>
      value.origin.toLocaleLowerCase("pt-BR") !== value.destination.toLocaleLowerCase("pt-BR"),
    "Origem e destino devem ser diferentes.",
  )
  .refine(
    (value) =>
      (value.originLat === null) === (value.originLng === null) &&
      (value.destinationLat === null) === (value.destinationLng === null),
    "Coordenadas incompletas.",
  );
export const occurrenceSchema = z.object({
  ...routeFields,
  id: z.string().uuid(),
  rideDate: z.string().date(),
  status: z.string(),
  overridden: z.boolean(),
  canEdit: z.boolean(),
  canCancel: z.boolean(),
});
export const routinesSchema = z.array(
  routineDefinitionSchema.and(
    z.object({ id: z.string().uuid(), occurrences: z.array(occurrenceSchema) }),
  ),
);
export type RoutineDefinition = z.infer<typeof routineDefinitionSchema>;
export type RoutineOccurrence = z.infer<typeof occurrenceSchema>;
export type RideRoutine = z.infer<typeof routinesSchema>[number];
