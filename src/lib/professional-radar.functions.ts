/**
 * F07 — publish consented GPS through authenticated SERVER code.
 * Debug logs emit only a correlation ID, stage, diagnostic code and policy
 * booleans; never precise coordinates, auth tokens or raw SQL messages.
 */
import { createServerFn } from "@tanstack/react-start";
import { professionalRadarPointSchema, municipalityFromProfessionalGps } from "@/lib/professional-radar-geo";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePilotCivic } from "@/lib/location/pilot-area.server";
import { classifyF07RadarDbError, f07RadarTraceId } from "@/lib/professional-radar-diagnostics";

export type ProfessionalRadarPublication =
  | { published: true; municipality: string; traceId?: string }
  | { published: false; reason: "OUTSIDE_APPROVED_ZONE" | "LOCATION_UNKNOWN" | "GOOGLE_QUOTA_LIMITED"; municipality: string | null; traceId?: string };

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

    const sampleAgeMs=Date.now()-data.sampledAtMs;
    if(sampleAgeMs < -5000 || sampleAgeMs > 25000)
      return reject("GPS_STALE_SAMPLE", "Recebemos uma leitura GPS antiga. Solicitando nova localização.");

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
    const clearStaleLocation = async () => {
      const { error } = await admin.from("professional_driver_locations")
        .delete().eq("user_id", context.userId);
      if (error) return reject("LOCATION_CLEAR_FAILED", "Não foi possível suspender um sinal GPS antigo.", {
        sqlState: String(error.code ?? ""),
      });
    };

    // Recent Google-verified municipality may be reused only inside a 300m
    // radius and 3-minute TTL. An HTTP 429 never fabricates a municipality.
    let city: string | null = null;
    if(city){
      log("municipality_cache_hit", undefined, {ageBoundSeconds:180});
    } else {
      try {
        log("reverse_geocoding_started");
        const geo = await resolvePilotCivic(data.lat, data.lng);
        city = municipalityFromProfessionalGps(geo);
        if(!city){
          log("municipality_unknown","GPS_CITY_UNKNOWN");
          // A definitive OUTSIDE city requires actual address components.
          if(!geo || geo.city){
            await clearStaleLocation();
            return {published:false,reason:"OUTSIDE_APPROVED_ZONE",municipality:null,traceId};
          }
          // A POI lookup may return no result even in an approved area.
          // Preserve the previous real fix only until the server's 90s TTL.
          return {published:false,reason:"LOCATION_UNKNOWN",municipality:null,traceId};
        }
      } catch (cause) {
        log("reverse_geocoding_failed",
          cause instanceof Error && cause.message==="GOOGLE_QUOTA_LIMITED"
            ? "GOOGLE_QUOTA_LIMITED" : "GOOGLE_REVERSE_FAILED");
        // Temporary upstream failures are not revocations of GPS consent.
        // Never replay an older coordinate as the current driver position.
        return {published:false,
          reason:cause instanceof Error && cause.message==="GOOGLE_QUOTA_LIMITED"
            ?"GOOGLE_QUOTA_LIMITED":"LOCATION_UNKNOWN",
          municipality:null,traceId};
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
      await admin.rpc("publish_verified_professional_position_v2", {
        p_user_id: context.userId,
        p_lat: data.lat,
        p_lng: data.lng,
        p_accuracy_m: data.accuracyM,
        p_municipality: city,
        p_sampled_at_ms: data.sampledAtMs,
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
