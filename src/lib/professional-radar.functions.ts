/**
 * F07 — publish consented professional GPS through authenticated SERVER code.
 * A driver may register in Maciço and operate in Fortaleza (or vice versa):
 * only the municipality resolved from the GPS point matters.
 */
import { createServerFn } from "@tanstack/react-start";
import { professionalRadarPointSchema, municipalityFromProfessionalGps } from "@/lib/professional-radar-geo";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reverseGeocodeService } from "@/lib/location/service";

export type ProfessionalRadarPublication =
  | { published: true; municipality: string }
  | { published: false; reason: "OUTSIDE_APPROVED_ZONE" | "LOCATION_UNKNOWN"; municipality: string | null };

export const publishVerifiedProfessionalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => professionalRadarPointSchema.parse(value))
  .handler(async ({ context, data }): Promise<ProfessionalRadarPublication> => {
    // Fail early: unauthorized, offline or financially blocked users must not
    // consume Google API calls. SQL rechecks atomically before persistence.
    const [access, fees, presence] = await Promise.all([
      (context.supabase as any).rpc("get_my_professional_access"),
      (context.supabase as any).rpc("get_my_driver_platform_fees"),
      (context.supabase as any).from("professional_presence")
        .select("is_available").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (access.error || access.data?.authorized !== true ||
        fees.error || fees.data?.driverAllowed !== true ||
        presence.error || presence.data?.is_available !== true) {
      throw new Error("Motorista offline, sem aprovação ou com repasses bloqueantes.");
    }
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
