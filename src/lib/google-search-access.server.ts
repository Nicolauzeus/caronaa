import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { googleActionFetch } from "./google-request.server";
import type { GoogleOperation } from "./google-request-policy";

/** Public research remains anonymous. A supplied bearer must be verified;
 * failure never downgrades an authenticated request to the anonymous path.
 */
export async function optionalGoogleSearchFetch(operation: GoogleOperation, caller: string): Promise<typeof fetch | undefined> {
  const authorization = getRequest().headers.get("authorization");
  if (!authorization) return undefined;
  if (!/^Bearer \S+$/.test(authorization)) throw new Error("Sessão inválida. Entre novamente.");
  const token = authorization.slice(7);
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Verificação da sessão indisponível.");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims.sub) throw new Error("Sessão expirada. Entre novamente.");
  return googleActionFetch(data.claims.sub, operation, caller);
}