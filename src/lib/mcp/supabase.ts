import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (name: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function publishableKey() {
  for (const name of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  try {
    const keys: unknown = JSON.parse(runtimeEnv("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (keys && typeof keys === "object" && !Array.isArray(keys)) {
      const record = keys as Record<string, unknown>;
      const key = [record.default, ...Object.values(record)].find((value): value is string => typeof value === "string" && value.trim().startsWith("sb_publishable_"));
      if (key) return key.trim();
    }
  } catch { /* Continue to legacy public keys. */ }
  const legacy = runtimeEnv("SUPABASE_ANON_KEY") ?? runtimeEnv("VITE_SUPABASE_ANON_KEY");
  if (legacy?.trim()) return legacy.trim();
  // The same verified browser-public connection used by the application.
  const bundled = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (bundled) return bundled;
  throw new Error("Public connection is unavailable.");
}

export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!ctx.isAuthenticated() || !token || !ctx.getUserId()) throw new Error("Authentication required.");
  const url = runtimeEnv("SUPABASE_URL") ?? runtimeEnv("VITE_SUPABASE_URL") ?? import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("Public connection is unavailable.");
  return createClient(url, publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}