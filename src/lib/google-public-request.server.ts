import { getCookie, setCookie, getRequest, getRequestProtocol, setResponseHeader } from "@tanstack/react-start/server";
import { GOOGLE_TIMEOUT_MS, shouldRetryGoogle, type GoogleOperation } from "./google-request-policy";
import { googleCacheHash } from "./google-cache.server";

export const GOOGLE_PUBLIC_DAILY_LIMIT = 2000;
export type PublicRequestDependencies = {
  fetch: typeof fetch;
  consume: (hash: string, operation: GoogleOperation) => Promise<string>;
  log: (service: string, caller: string, success: boolean, code: string | null) => Promise<unknown>;
};

/** No fictional auth identity and no raw GPS/address/session logging. */
export function publicGoogleFetch(hash: string, operation: GoogleOperation, caller: string, injected?: PublicRequestDependencies): typeof fetch {
  return async (input, init) => {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Sessão de busca inválida.");
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== "https:" || !["places.googleapis.com", "routes.googleapis.com"].includes(url.hostname)) throw new Error("Destino Google inválido.");
    const deps = injected ?? await publicDependencies();
    const service = url.hostname === "routes.googleapis.com" ? "routes" : "places";
    for (let attempt = 0; attempt < 2; attempt++) {
      // Every billable attempt, including retry, consumes the global budget.
      const allowed = await deps.consume(hash, operation);
      if (allowed !== "ALLOWED") throw new Error(allowed === "DAILY_LIMIT"
        ? "Buscas Google atingiram o limite diário. Use a digitação manual ou tente amanhã."
        : "Muitas consultas nesta sessão. Aguarde um minuto.");
      let response: Response;
      try {
        response = await deps.fetch(url.href, { ...init, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
      } catch {
        void deps.log(service, caller, false, "NETWORK_OR_TIMEOUT").catch(() => undefined);
        throw new Error("Google Maps indisponível. Tente novamente.");
      }
      void deps.log(service, caller, response.ok, response.ok ? null : `HTTP_${response.status}`).catch(() => undefined);
      if (shouldRetryGoogle(response.status, attempt)) { await response.body?.cancel(); continue; }
      if (response.status === 403) {
        const result = await response.clone().json().catch(() => null) as { error?: { details?: { reason?: string }[] } } | null;
        const reason = result?.error?.details?.find(detail => detail.reason)?.reason;
        if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") throw new Error("Chave Google do servidor restrita a websites. Configure Nenhuma ou IP no Google Cloud.");
        if (reason === "API_KEY_SERVICE_BLOCKED") throw new Error("Habilite esta API nas restrições da chave Google do servidor.");
        throw new Error("Google recusou a consulta. Confira as APIs e restrições da chave.");
      }
      if (!response.ok) throw new Error(`Google Maps indisponível (HTTP ${response.status}).`);
      return response;
    }
    throw new Error("Google Maps indisponível.");
  };
}

export async function anonymousGoogleSearchFetch(operation: GoogleOperation, caller: string): Promise<typeof fetch> {
  setResponseHeader("Cache-Control", "no-store");
  const cookieName = "caronaa_google_session";
  let session = getCookie(cookieName);
  if (!session || !/^[a-f0-9]{64}$/.test(session)) {
    session = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
    setCookie(cookieName, session, { httpOnly: true, sameSite: "lax", secure: getRequestProtocol() === "https", path: "/", maxAge: 86400 });
  }
  return publicGoogleFetch(await googleCacheHash(session), operation, caller);
}

async function publicDependencies(): Promise<PublicRequestDependencies> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const request = getRequest() as Request & { waitUntil?: (task: Promise<unknown>) => void };
  return {
    fetch,
    consume: async (hash, operation) => {
      const { data, error } = await supabaseAdmin.rpc("consume_google_public_request_limit", { p_session_hash: hash, p_operation: operation });
      if (error) throw new Error("Controle de buscas indisponível. Use a digitação manual.");
      return data ?? "UNAVAILABLE";
    },
    log: async (service, caller, success, code) => {
      const task = Promise.resolve(supabaseAdmin.from("google_api_usage").insert({ api_service: service, caller_function: caller, success, error_code: code, user_id: null })).catch(() => undefined);
      if (request.waitUntil) request.waitUntil(task);
      else void task;
    },
  };
}