import { z } from "zod";
import type { RoadPoint } from "./road-routing";

const coordinate = (limit: number) =>
  z
    .preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().finite().min(-limit).max(limit).optional(),
    )
    .catch(undefined);
export const quickRideSearchSchema = z
  .object({
    origin: z.string().trim().max(160).catch(""),
    destination: z.string().trim().max(160).catch(""),
    municipality: z.string().trim().max(120).catch(""),
    originLat: coordinate(90),
    originLng: coordinate(180),
    destinationLat: coordinate(90),
    destinationLng: coordinate(180),
  })
  .transform((value) => ({
    ...value,
    originLat: value.originLat != null && value.originLng != null ? value.originLat : undefined,
    originLng: value.originLat != null && value.originLng != null ? value.originLng : undefined,
    destinationLat:
      value.destinationLat != null && value.destinationLng != null
        ? value.destinationLat
        : undefined,
    destinationLng:
      value.destinationLat != null && value.destinationLng != null
        ? value.destinationLng
        : undefined,
  }));

export function buildQuickRideSearch(input: {
  origin: string;
  destination: string;
  municipality?: string;
  originPoint?: Partial<RoadPoint>;
  destinationPoint?: Partial<RoadPoint>;
}) {
  return quickRideSearchSchema.parse({
    origin: input.origin,
    destination: input.destination,
    municipality: input.municipality ?? "",
    originLat: input.originPoint?.lat,
    originLng: input.originPoint?.lng,
    destinationLat: input.destinationPoint?.lat,
    destinationLng: input.destinationPoint?.lng,
  });
}
