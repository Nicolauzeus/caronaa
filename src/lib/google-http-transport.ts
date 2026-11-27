/** Host fetch needs its global receiver on Workers and browser Web APIs. */
export const runtimeGoogleFetch: typeof fetch = (resource, options) =>
  globalThis.fetch(resource, options);

/** A portable, bounded deadline. Does not rely on AbortSignal.timeout support. */
export async function fetchGoogleWithDeadline(
  fetchRequest: typeof fetch,
  resource: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Google request deadline exceeded");
      error.name = "TimeoutError";
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  try {
    // Do not call a captured native fetch as a method of an unrelated object.
    const response = Reflect.apply(fetchRequest, globalThis, [resource, {
      ...options, signal: controller.signal,
    }]) as Promise<Response>;
    return await Promise.race([response, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Only allowlisted diagnostics. Never emit raw messages, URLs or coordinates. */
export function googleTransportFailure(cause: unknown):
  "TIMEOUT" | "INVALID_FETCH_RECEIVER" | "DNS_ERROR" | "TLS_ERROR" | "NETWORK_ERROR" {
  // DOMException may originate in a different realm (browser, Worker, jsdom).
  // Recognize only the fixed timeout names; never expose the raw exception.
  const name = cause !== null && typeof cause === "object" && "name" in cause
    ? cause.name : undefined;
  if (name === "TimeoutError" || name === "AbortError") return "TIMEOUT";
  if (!(cause instanceof Error)) return "NETWORK_ERROR";
  if (cause.name === "TypeError" && /illegal invocation|incorrect.*this|invalid.*receiver/i.test(cause.message))
    return "INVALID_FETCH_RECEIVER";
  const nested = (cause as Error & { cause?: { code?: unknown }; code?: unknown });
  const code = nested.cause?.code ?? nested.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS_ERROR";
  if (code === "CERT_HAS_EXPIRED" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") return "TLS_ERROR";
  return "NETWORK_ERROR";
}
