import { getRequest } from "@tanstack/react-start/server";
import { GOOGLE_TIMEOUT_MS, shouldRetryGoogle, type GoogleOperation } from "./google-request-policy";
import { fetchGoogleWithDeadline, googleTransportFailure, runtimeGoogleFetch } from "./google-http-transport";

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
    throw new Error("Destino Google inv\u00e1lido.");
  }
  if (!input.userId || !input.key) throw new Error("Busca Google n\u00e3o configurada ou sess\u00e3o ausente.");
  const deps = injected ?? await runtimeDependencies();
  if (!await deps.consume(input.userId, input.operation)) {
    throw new Error("Voc\u00ea fez muitas consultas. Aguarde um minuto e tente novamente.");
  }
  const service = url.hostname === "routes.googleapis.com" ? "routes" : url.hostname === "places.googleapis.com" ? "places" : "geocoding";
  const record = (success: boolean, code: string | null) => {
    try {
      const task = Promise.resolve().then(() => deps.log({ api_service: service, caller_function: input.caller, success, error_code: code, user_id: input.userId })).catch(() => undefined);
      deps.defer(task);
    } catch { /* best-effort observability */ }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetchGoogleWithDeadline(deps.fetch, input.url, {
        method: input.body === undefined ? "GET" : "POST",
        headers: {
          "X-Goog-Api-Key": input.key,
          "Content-Type": "application/json",
          ...(input.fieldMask ? { "X-Goog-FieldMask": input.fieldMask } : {}),
        },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      }, GOOGLE_TIMEOUT_MS);
    } catch (cause) {
      const reason = googleTransportFailure(cause);
      const code = reason === "TIMEOUT" ? "TIMEOUT" : "NETWORK_ERROR";
      record(false, code);
      console.error("[CARONAA][GOOGLE_REQUEST]", {
        service, operation: input.operation, caller: input.caller,
        code, reason, attempt: attempt + 1,
      });
      throw new Error(code === "TIMEOUT"
        ? "O c\u00e1lculo de rota demorou mais que o esperado. Tente novamente."
        : "Google Maps indispon\u00edvel. Tente novamente em instantes.");
    }
    record(response.ok, response.ok ? null : `HTTP_${response.status}`);
    if (shouldRetryGoogle(response.status, attempt)) {
      await response.body?.cancel();
      continue;
    }
    if (response.status === 403) {
      type ForbiddenBody = { error?: {
        status?: string;
        details?: Array<{ reason?: string; metadata?: { reason?: string } }>;
      } };
      const payload = await response.clone().json().catch(() => null) as ForbiddenBody | null;
      const rawReason = payload?.error?.details?.find(detail => detail.reason || detail.metadata?.reason);
      const reason = rawReason?.reason ?? rawReason?.metadata?.reason ?? "";
      const category = reason === "API_KEY_HTTP_REFERRER_BLOCKED" ? "REFERRER_RESTRICTED"
        : reason === "API_KEY_SERVICE_BLOCKED" ? "API_RESTRICTED"
        : reason === "SERVICE_DISABLED" || reason === "API_DISABLED" ? "SERVICE_DISABLED"
        : "GOOGLE_FORBIDDEN";
      console.error("[CARONAA][GOOGLE_REQUEST]", {
        service, operation: input.operation, caller: input.caller,
        code: category, httpStatus: 403,
      });
      if (category === "REFERRER_RESTRICTED")
        throw new Error("A chave Google do servidor est\u00e1 restrita a websites. Configure uma chave de servidor apropriada no Google Cloud.");
      if (category === "API_RESTRICTED" || category === "SERVICE_DISABLED")
        throw new Error("A API Google necess\u00e1ria para a rota n\u00e3o est\u00e1 habilitada ou autorizada na chave de servidor.");
      throw new Error("Google recusou a consulta. Verifique a chave de servidor e a ativa\u00e7\u00e3o da API.");
    }
    if (!response.ok) throw new Error(`Google Maps indispon\u00edvel (HTTP ${response.status}).`);
    return response;
  }
  throw new Error("Google Maps indispon\u00edvel.");
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
    if (!userId) throw new Error("Sess\u00e3o necess\u00e1ria.");
    if (++calls > 16) throw new Error("H\u00e1 consultas demais nesta a\u00e7\u00e3o.");
    const url = resource instanceof Request ? resource.url : String(resource);
    const headers = new Headers(options?.headers);
    const key = headers.get("X-Goog-Api-Key") ?? "";
    const body = options?.body;
    if (body !== undefined && body !== null && typeof body !== "string") throw new Error("Consulta Google inv\u00e1lida.");
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const request = getRequest() as Request & { waitUntil?: (task: Promise<unknown>) => void };
  return {
    fetch: runtimeGoogleFetch,
    consume: async (userId, operation) => {
      const { data, error } = await supabaseAdmin.rpc("consume_google_request_limit", { p_user_id: userId, p_operation: operation });
      if (error) throw new Error("Controle de consultas indispon\u00edvel. Tente novamente em instantes.");
      return data === true;
    },
    log: async usage => { await supabaseAdmin.from("google_api_usage").insert(usage); },
    defer: task => {
      if (request.waitUntil) request.waitUntil(task);
      else void task;
    },
  };
}
