/**
 * F07 — publish consented professional GPS through authenticated SERVER code.
 * A driver may register in Maciço and operate in Fortaleza (or vice versa):
 * only the municipality resolved from the GPS point matters.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reverseGeocodeService } from "@/lib/location/service";
import { resolveCorridorMunicipality } from "@/lib/quick-rides/corridor-coverage";

export const professionalRadarPointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().min(0).max(5000),
});

export type ProfessionalRadarPublication =
  | { published: true; municipality: string }
  | { published: false; reason: "OUTSIDE_APPROVED_ZONE" | "LOCATION_UNKNOWN"; municipality: string | null };

/** Only geocoded cities within the canonical, known Ceará inventory are eligible. */
export function municipalityFromProfessionalGps(
  geo: { city?: string | null; state?: string | null; country?: string | null } | null,
): string | null {
  if (!geo?.city) return null;
  return resolveCorridorMunicipality(geo.city, geo.state, geo.country)?.municipality ?? null;
}

export const publishVerifiedProfessionalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => professionalRadarPointSchema.parse(value))
  .handler(async ({ context, data }): Promise<ProfessionalRadarPublication> => {
    // Rate gate before a potentially billed Google reverse lookup.
    const { data: quota, error: quotaError } =
      await (context.supabase as any).rpc("professional_radar_location_rate_gate");
    if (quotaError) throw new Error("Radar indisponível: atualização 0142 pendente.");
    if (quota !== true) throw new Error("Aguarde alguns segundos para atualizar seu GPS.");

    // Privileged client is imported only inside authenticated server functions.
    // No client-supplied municipality/userId can reach the privileged SQL RPC.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const clearStaleLocation = async () => {
      const { error } = await admin.from("professional_driver_locations")
        .delete().eq("user_id", context.userId);
      if (error) throw new Error("Não foi possível suspender o compartilhamento do radar.");
    };

    let city: string | null = null;
    try {
      const geo = await reverseGeocodeService(data.lat, data.lng);
      city = municipalityFromProfessionalGps(geo);
    } catch {
      // No OSM fallback, no fabricated municipality, and no stale GPS pin.
      await clearStaleLocation();
      return { published: false, reason: "LOCATION_UNKNOWN", municipality: null };
    }
    if (!city) {
      await clearStaleLocation();
      return { published: false, reason: "OUTSIDE_APPROVED_ZONE", municipality: null };
    }
    const { data: zone, error: zoneError } = await admin
      .from("professional_service_regions")
      .select("public_discovery_enabled")
      .eq("municipality", city).maybeSingle();
    if (zoneError) {
      await clearStaleLocation();
      throw new Error("Não foi possível conferir se este município está habilitado.");
    }
    if (zone?.public_discovery_enabled !== true) {
      await clearStaleLocation();
      return { published: false, reason: "OUTSIDE_APPROVED_ZONE", municipality: city };
    }
    const { data: saved, error: savedError } =
      await admin.rpc("publish_verified_professional_position", {
        p_user_id: context.userId,
        p_lat: data.lat,
        p_lng: data.lng,
        p_accuracy_m: data.accuracyM,
        p_municipality: city,
      });
    if (savedError || saved !== true) {
      await clearStaleLocation();
      throw new Error("Não foi possível publicar a localização. Verifique sua aprovação, disponibilidade e repasses.");
    }
    return { published: true, municipality: city };
  });
