import { z } from "zod";
import { resolveCorridorMunicipality } from "@/lib/quick-rides/corridor-coverage";

// GPS fix and accuracy are revalidated by the privileged SQL RPC.
export const professionalRadarPointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().min(0).max(5000),
});

/** Validated by Google's SERVER reverse geocoding; registration never consulted. */
export function municipalityFromProfessionalGps(
  geo: { city?: string | null; state?: string | null; country?: string | null } | null,
): string | null {
  if (!geo?.city) return null;
  return resolveCorridorMunicipality(geo.city, geo.state, geo.country)?.municipality ?? null;
}
