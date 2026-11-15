import { GOOGLE_CACHE_TTL_MS } from "./google-request-policy";

type CacheKind = keyof typeof GOOGLE_CACHE_TTL_MS;
/** Hash all provider parameters; never put raw addresses or GPS into cache keys. */
export async function googleCacheHash(parameters: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parameters));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function googleCacheExpiry(kind: CacheKind, now: number): string {
  return new Date(now + GOOGLE_CACHE_TTL_MS[kind]).toISOString();
}

/** Private cache primitives. Call only after session/participant authorization.
 * Provider payload caching remains opt-in pending storage/attribution review.
 */
export async function readGoogleCache(userId: string, kind: CacheKind, hash: string): Promise<unknown | null> {
  if (!userId) throw new Error("Sessão necessária.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("google_response_cache")
    .select("payload").eq("user_id", userId).eq("cache_kind", kind)
    .eq("request_hash", hash).gt("expires_at", new Date().toISOString()).maybeSingle();
  return error ? null : data?.payload ?? null;
}

export async function writeGoogleCache(userId: string, kind: CacheKind, hash: string, payload: unknown): Promise<void> {
  if (!userId) throw new Error("Sessão necessária.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  // JSON normalization rejects unsupported/circular values before persistence.
  const normalized = JSON.parse(JSON.stringify(payload));
  await supabaseAdmin.from("google_response_cache").upsert({
    user_id: userId, cache_kind: kind, request_hash: hash, payload: normalized,
    created_at: new Date(now).toISOString(), expires_at: googleCacheExpiry(kind, now),
  }, { onConflict: "user_id,cache_kind,request_hash" });
}