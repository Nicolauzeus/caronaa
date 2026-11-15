import { getRequest } from "@tanstack/react-start/server";
import { GOOGLE_TIMEOUT_MS, shouldRetryGoogle, type GoogleOperation } from "./google-request-policy";

type Usage = { api_service: string; caller_function: string; success: boolean; error_code: string | null; user_id: string };
export type GoogleRequestDependencies = {
  fetch: typeof fetch;
  consume: (userId: string, operation: GoogleOperation) => Promise<boolean>;
  log: (usage: Usage) => Promise<unknown>;
  defer: (task: Promise<unknown>) => void;
};
type Input = {
  url: string; key: string; userId: string; caller: string;
  operation: GoogleOperation; fieldMask?: string; body?: unknown;
};

/** Authenticated server callers only. No client-supplied identity or arbitrary host. */
export async function authenticatedGoogleRequest(input: Input, injected?: GoogleRequestDependencies): Promise<Response> {
  const url = new URL(input.url);
  if (url.protocol !== "https:" || !["places.googleapis.com", "routes.googleapis.com", "maps.googleapis.com"].includes(url.hostname)) {
    throw new Error("Destino Google inválido.");
  }
  if (!input.userId || !input.key) throw new Error("Busca Google não configurada ou sessão ausente.");
  const deps = injected ?? await runtimeDependencies();
  if (!await deps.consume(input.userId, input.operation)) {
    throw new Error("Você fez muitas consultas. Aguarde um minuto e tente novamente.");
  }
  const service = url.hostname === "routes.googleapis.com" ? "routes" : url.hostname === "places.googleapis.com" ? "places" : "geocoding";
  const record = (success: boolean, code: string | null) => {
    // Even a synchronous logger/defer failure must never affect the main result.
    try {
      const task = Promise.resolve().then(() => deps.log({ api_service: service, caller_function: input.caller, success, error_code: code, user_id: input.userId })).catch(() => undefined);
      deps.defer(task);
    } catch { /* best-effort observability */ }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await deps.fetch(input.url, {
        method: input.body === undefined ? "GET" : "POST",
        headers: {
          "X-Goog-Api-Key": input.key,
          "Content-Type": "application/json",
          ...(input.fieldMask ? { "X-Goog-FieldMask": input.fieldMask } : {}),
        },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });
    } catch (cause) {
      record(false, cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name) ? "TIMEOUT" : "NETWORK_ERROR");
      throw new Error("Google Maps indisponível. Tente novamente em instantes.");
    }
    record(response.ok, response.ok ? null : `HTTP_${response.status}`);
    if (shouldRetryGoogle(response.status, attempt)) {
      await response.body?.cancel();
      continue;
    }
    if (response.status === 403) {
      const error = await response.clone().json().catch(() => null) as { error?: { details?: Array<{ reason?: string }> } } | null;
      const reason = error?.error?.details?.find(detail => detail.reason)?.reason;
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") throw new Error("A chave Google do servidor tem restrição de websites. Configure Nenhuma ou IP no Google Cloud.");
      if (reason === "API_KEY_SERVICE_BLOCKED") throw new Error("A chave Google do servidor não permite esta API. Habilite-a nas restrições da chave no Google Cloud.");
      throw new Error("Google recusou a consulta. Confira as APIs e as restrições da chave do servidor.");
    }
    if (!response.ok) throw new Error(`Google Maps indisponível (HTTP ${response.status}).`);
    return response;
  }
  throw new Error("Google Maps indisponível.");
}

/** One verified server action may contain bounded route legs/Places lookups.
 * Identity is supplied only by authenticated middleware, never RPC input.
 * A shared promise prevents concurrent legs from consuming multiple counters.
 */
export function googleActionFetch(userId: string, operation: GoogleOperation, caller: string, injected?: GoogleRequestDependencies): typeof fetch {
  let dependencies: Promise<GoogleRequestDependencies> | undefined;
  let permission: Promise<boolean> | undefined;
  let calls = 0;
  return async (resource, options) => {
    if (!userId) throw new Error("Sessão necessária.");
    if (++calls > 16) throw new Error("Há consultas demais nesta ação.");
    const url = resource instanceof Request ? resource.url : String(resource);
    const headers = new Headers(options?.headers);
    const key = headers.get("X-Goog-Api-Key") ?? "";
    const body = options?.body;
    if (body !== undefined && body !== null && typeof body !== "string") throw new Error("Consulta Google inválida.");
    dependencies ??= injected ? Promise.resolve(injected) : runtimeDependencies();
    const deps = await dependencies;
    return authenticatedGoogleRequest({
      url, key, userId, operation, caller,
      fieldMask: headers.get("X-Goog-FieldMask") ?? undefined,
      ...(typeof body === "string" ? { body: JSON.parse(body) } : {}),
    }, { ...deps, consume: () => {
      permission ??= deps.consume(userId, operation);
      return permission;
    } });
  };
}

async function runtimeDependencies(): Promise<GoogleRequestDependencies> {
  // Called only after an authenticated handler has supplied its verified identity.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const request = getRequest() as Request & { waitUntil?: (task: Promise<unknown>) => void };
  return {
    fetch,
    consume: async (userId, operation) => {
      const { data, error } = await supabaseAdmin.rpc("consume_google_request_limit", { p_user_id: userId, p_operation: operation });
      if (error) throw new Error("Controle de consultas indisponível. Tente novamente em instantes.");
      return data === true;
    },
    log: async usage => { await supabaseAdmin.from("google_api_usage").insert(usage); },
    defer: task => {
      // Nitro attaches waitUntil to the request on supported deployments.
      // On dev/other adapters this is explicitly best effort, never awaited.
      if (request.waitUntil) request.waitUntil(task);
      else void task;
    },
  };
}