import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { professionalRadarPointSchema } from "@/lib/professional-radar-geo";
import { publishProfessionalPosition } from "@/lib/professional-radar-publication.server";

type AuthContext = { supabase: SupabaseClient<Database>; userId: string };
type NativeDeps = {
  authenticate: (token: string) => Promise<AuthContext | null>;
  publish: typeof publishProfessionalPosition;
};
const response = (status: number, code: string) =>
  Response.json({ code }, { status, headers: { "Cache-Control": "no-store" } });

async function authenticate(token: string): Promise<AuthContext | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("CONFIG_REQUIRED");
  const client = createClient<Database>(url, key, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub || data.claims.role !== "authenticated") return null;
  return { supabase: client, userId: data.claims.sub };
}

/** Fixed HTTPS endpoint: bearer JWT, no cookie auth, no client userId/city.
 * Preserve existing Google geocoding, rate gate, freshness, approved presence
 * and service-only SQL publication. Never accept a client claim of availability.
 */
export async function handleNativeDriverLocation(request: Request, deps: NativeDeps = {
  authenticate, publish: publishProfessionalPosition,
}): Promise<Response> {
  try {
    const header = request.headers.get("authorization") ?? "";
    const token = header.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
    if (!token || token.length > 8192) return response(401, "SESSION_REQUIRED");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
      return response(415, "JSON_REQUIRED");
    const reader = request.body?.getReader();
    if (!reader) return response(400, "INVALID_FIX");
    let size = 0, body = "";
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 1024) { await reader.cancel(); return response(413, "INVALID_FIX"); }
        body += decoder.decode(part.value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    let raw: unknown;
    try { raw = JSON.parse(body); } catch { return response(400, "INVALID_FIX"); }
    // No user ID, client municipality, GPS simulation or caller-controlled trace ID.
    const parsed = professionalRadarPointSchema.omit({ traceId: true }).strict().safeParse(raw);
    if (!parsed.success) return response(422, "INVALID_FIX");
    if (Date.now() - parsed.data.sampledAtMs > 25_000 || parsed.data.sampledAtMs > Date.now() + 5000)
      return response(422, "GPS_STALE_SAMPLE");
    const context = await deps.authenticate(token);
    if (!context) return response(401, "SESSION_REQUIRED");
    const role = await context.supabase.from("profiles").select("active_role").eq("id", context.userId).maybeSingle();
    if (role.error) return response(503, "ROLE_UNAVAILABLE");
    if (role.data?.active_role !== "MOTORISTA") return response(403, "DRIVER_ROLE_REQUIRED");
    const result = await deps.publish(context, parsed.data);
    if (!result.published) return response(202, result.reason);
    // Ping only an existing online presence (never set available=true).
    const ping = await context.supabase.rpc("driver_presence_ping");
    if (ping.error) return response(503, "PRESENCE_UNAVAILABLE");
    if (ping.data !== true) return response(409, "DRIVER_OFFLINE");
    return response(200, "PUBLISHED");
  } catch (error) {
    const code = error instanceof Error ? error.message.match(/\[F07:([A-Z_]+)\]/)?.[1] : undefined;
    if (code === "ACCESS_NOT_AUTHORIZED" || code === "DB_DRIVER_NOT_APPROVED") return response(403, "DRIVER_NOT_AUTHORIZED");
    if (code === "DRIVER_OFFLINE" || code === "DB_DRIVER_OFFLINE") return response(409, "DRIVER_OFFLINE");
    if (code === "RATE_LIMITED") return response(429, "RATE_LIMITED");
    if (code === "GPS_STALE_SAMPLE" || code === "GPS_INVALID_FIX" || code === "GPS_IMPLAUSIBLE_JUMP") return response(422, code);
    // Never forward/log request body, token or SQL/upstream exception.
    return response(503, "LOCATION_UNAVAILABLE");
  }
}
