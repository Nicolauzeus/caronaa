/**
 * F07 — publish consented GPS through authenticated SERVER code.
 * Debug logs emit only a correlation ID, stage, diagnostic code and policy
 * booleans; never precise coordinates, auth tokens or raw SQL messages.
 */
import { createServerFn } from "@tanstack/react-start";
import { professionalRadarPointSchema, municipalityFromProfessionalGps } from "@/lib/professional-radar-geo";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reverseGeocodeRadarMunicipality } from "@/lib/professional-radar-civic-geocode.server";
import { distanceBetweenMeters } from "@/lib/quick-rides/corridor-coverage";
import { GPS_POLICY, isFreshGpsTimestamp } from "@/lib/location/gps-policy";
import { classifyF07RadarDbError, f07RadarTraceId } from "@/lib/professional-radar-diagnostics";

export type ProfessionalRadarPublication =
  | { published: true; municipality: string; traceId?: string }
  | { published: false; reason: "OUTSIDE_APPROVED_ZONE" | "LOCATION_UNKNOWN" | "GOOGLE_QUOTA_LIMITED" | "GPS_LOW_ACCURACY" | "STALE_GPS" | "GPS_JUMP"; municipality: string | null; traceId?: string };

// Short-lived, bounded server cache: Google verifies the civic municipality
// once for a stable area, not on every 25-second browser GPS pulse.
const civicCache = new Map<string, { city: string; lat: number; lng: number; at: number }>();
function getCachedMunicipality(userId: string, lat: number, lng: number): string | null {
  const cached = civicCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.at > GPS_POLICY.driverCivicCacheTtlMs ||
      distanceBetweenMeters(cached, { lat, lng }) > GPS_POLICY.driverCivicCacheRadiusM) {
    civicCache.delete(userId);
    return null;
  }
  return cached.city;
}
function rememberMunicipality(userId: string, city: string, lat: number, lng: number) {
  if (civicCache.size >= 1000) civicCache.delete(civicCache.keys().next().value!);
  civicCache.set(userId, { city, lat, lng, at: Date.now() });
}

export const publishVerifiedProfessionalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => professionalRadarPointSchema.parse(value))
  .handler(async ({ context, data }): Promise<ProfessionalRadarPublication> => {
    const traceId = data.traceId ?? f07RadarTraceId();
    const log = (stage: string, code?: string, details: Record<string, string | number | boolean | null> = {}) => {
      // Deliberately no user ID, precise coordinates, phone, token, JWT or
      // free-form PostgREST message. The trace ID is diagnostic only.
      const entry = { ref: traceId, stage, ...(code ? { code } : {}), ...details };
      if (code) console.warn("[CARONAA][F07][GPS][server]", entry);
      else console.info("[CARONAA][F07][GPS][server]", entry);
    };
    const reject = (code: string, message: string, details: Record<string, string | number | boolean | null> = {}): never => {
      log("blocked", code, details);
      throw new Error(`${message} [F07:${code}] (ref ${traceId})`);
    };

    log("request", undefined, {
      accuracyBand: data.accuracyM <= 100 ? "<=100m" : data.accuracyM <= 1000 ? "101-1000m" : ">1000m",
      serviceRoleConfigured: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
    });

    // Fast authenticated authorization checks avoid a paid Google API call
    // for unauthorized or offline users. SQL independently checks again.
    const [access, fees, presence] = await Promise.all([
      (context.supabase as any).rpc("get_my_professional_access"),
      (context.supabase as any).rpc("get_my_driver_platform_fees"),
      (context.supabase as any).from("professional_presence")
        .select("is_available").eq("user_id", context.userId).maybeSingle(),
    ]);
    const gateSummary = {
      appAccessAuthorized: access.data?.authorized === true,
      appFeesAllowed: fees.data?.driverAllowed === true,
      appPresenceOnline: presence.data?.is_available === true,
    };
    log("preflight", undefined, gateSummary);
    if (access.error) return reject("ACCESS_RPC_ERROR", "Falha ao verificar sua autorização.", { sqlState: String(access.error.code ?? "") });
    if (access.data?.authorized !== true) return reject("ACCESS_NOT_AUTHORIZED", "O acesso profissional ainda não está aprovado.");
    if (fees.error) return reject("FEES_RPC_ERROR", "Falha ao consultar os repasses.", { sqlState: String(fees.error.code ?? "") });
    if (fees.data?.driverAllowed !== true) return reject("FEES_BLOCKED", "Seu acesso ao radar está bloqueado pelos repasses.");
    if (presence.error) return reject("PRESENCE_RPC_ERROR", "Falha ao consultar a disponibilidade.", { sqlState: String(presence.error.code ?? "") });
    if (presence.data?.is_available !== true) return reject("DRIVER_OFFLINE", "Sua presença está offline.");

    const { data: quota, error: quotaError } =
      await (context.supabase as any).rpc("professional_radar_location_rate_gate");
    if (quotaError) return reject("RATE_GATE_UNAVAILABLE", "Radar indisponível: verifique a migration 0142.", { sqlState: String(quotaError.code ?? "") });
    if (quota !== true) return reject("RATE_LIMITED", "Aguarde alguns segundos para atualizar o GPS.");

    // Service role stays on the server and the municipality is always
    // resolved from the actual GPS coordinates, never from profile or client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    if (data.accuracyM > GPS_POLICY.driverMaxAccuracyM) {
      log("quality_rejected", "GPS_LOW_ACCURACY");
      return { published: false, reason: "GPS_LOW_ACCURACY", municipality: null, traceId };
    }
    if (data.sampledAtMs != null &&
        !isFreshGpsTimestamp(data.sampledAtMs, GPS_POLICY.driverSampleMaxAgeMs)) {
      log("stale_fix_rejected", "STALE_GPS");
      return { published: false, reason: "STALE_GPS", municipality: null, traceId };
    }
    const { data: prior, error: priorError } = await admin.from("professional_driver_locations")
      .select("lat,lng,accuracy_m,sampled_at").eq("user_id", context.userId).maybeSingle();
    if (priorError) return reject("LOCATION_READ_FAILED", "Não foi possível validar a posição anterior.");
    if (prior?.sampled_at && data.sampledAtMs != null) {
      const elapsed = (Date.now() - Date.parse(String(prior.sampled_at))) / 1000;
      if (elapsed > 0 && elapsed <= 90 &&
          distanceBetweenMeters(prior, data) >
            Math.max(300, elapsed * 65 + Number(prior.accuracy_m) + data.accuracyM)) {
        log("jump_rejected", "GPS_JUMP");
        return { published: false, reason: "GPS_JUMP", municipality: null, traceId };
      }
    }
    const clearStaleLocation = async () => {
      const { error } = await admin.from("professional_driver_locations")
        .delete().eq("user_id", context.userId);
      if (error) return reject("LOCATION_CLEAR_FAILED", "Não foi possível suspender um sinal GPS antigo.", {
        sqlState: String(error.code ?? ""),
      });
    };

    // Google civic address components, never centre-radius estimates or
    // municipality sent by the browser. Fail closed on upstream uncertainty.
    let city: string | null = getCachedMunicipality(context.userId, data.lat, data.lng);
    if (city) {
      log("municipality_cache_hit", undefined, { ageBoundSeconds: 180 });
    } else {
      try {
        log("reverse_geocoding_started");
        const geo = await reverseGeocodeRadarMunicipality(data.lat, data.lng);
        if (!geo) return { published: false, reason: "LOCATION_UNKNOWN", municipality: null, traceId };
        city = municipalityFromProfessionalGps(geo);
        if (!city) {
          await clearStaleLocation();
          return { published: false, reason: "OUTSIDE_APPROVED_ZONE", municipality: null, traceId };
        }
        rememberMunicipality(context.userId, city, data.lat, data.lng);
      } catch (cause) {
        log("reverse_geocoding_failed",
          cause instanceof Error && cause.message === "GOOGLE_QUOTA_LIMITED"
            ? "GOOGLE_QUOTA_LIMITED" : "GOOGLE_REVERSE_FAILED");
        return { published: false,
          reason: cause instanceof Error && cause.message === "GOOGLE_QUOTA_LIMITED"
            ? "GOOGLE_QUOTA_LIMITED" : "LOCATION_UNKNOWN",
          municipality: null, traceId };
      }
    }
    log("municipality_resolved", undefined, { city });

    const { data: zone, error: zoneError } = await admin
      .from("professional_service_regions")
      .select("public_discovery_enabled")
      .eq("municipality", city).maybeSingle();
    if (zoneError) {
      // DB outages must not erase real, previously consented GPS evidence.
      return reject("REGION_RPC_ERROR", "Não foi possível consultar a cobertura do radar.", {
        sqlState: String(zoneError.code ?? ""), city,
      });
    }
    if (zone?.public_discovery_enabled !== true) {
      log("region_disabled", "REGION_DISABLED", { city });
      await clearStaleLocation();
      return { published: false, reason: "OUTSIDE_APPROVED_ZONE", municipality: city, traceId };
    }

    log("db_publish_started", undefined, { city });
    const { data: saved, error: savedError } =
      await admin.rpc("publish_verified_professional_position", {
        p_user_id: context.userId,
        p_lat: data.lat,
        p_lng: data.lng,
        p_accuracy_m: data.accuracyM,
        p_municipality: city,
      });
    if (savedError || saved !== true) {
      // Extra checks ONLY after an SQL rejection. They distinguish a user
      // authorized by a high-level RPC from a missing raw DB approval row.
      // Do not print or return other user records.
      const [dbAuth, dbPresence] = await Promise.all([
        admin.from("professional_driver_authorizations").select("approved")
          .eq("user_id", context.userId).maybeSingle(),
        admin.from("professional_presence").select("is_available")
          .eq("user_id", context.userId).maybeSingle(),
      ]);
      let code = savedError ? classifyF07RadarDbError(savedError) : "DB_WRITE_FALSE";
      if (code === "DB_DRIVER_NOT_APPROVED" &&
          !dbAuth.error && dbAuth.data?.approved === true) {
        code = "DB_FINANCIAL_BLOCK";
      }
      log("db_publish_rejected", code, {
        sqlState: String(savedError?.code ?? ""),
        dbAuthorizationRowApproved: !dbAuth.error && dbAuth.data?.approved === true,
        dbPresenceOnline: !dbPresence.error && dbPresence.data?.is_available === true,
        city,
        serviceRoleConfigured: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
      });
      // Leave the last real fix to expire naturally after 90s on transient SQL
      // errors; the DB itself continues to enforce all authorization checks.
      return reject(code, "O banco recusou publicar a localização. Consulte o diagnóstico F07 e o log do servidor.");
    }
    log("db_publish_success", undefined, { city });
    return { published: true, municipality: city, traceId };
  });
