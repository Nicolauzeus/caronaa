/** The DB gate is preserved. Only its known exhaustion is presented as a limit. */
export function quickQuoteGateError(error: { code?: unknown; message?: unknown } | null, allowed: unknown): Error | null {
  if (!error && allowed === true) return null;
  const exhausted = !error && allowed === false ||
    error?.code === "P0001" && typeof error.message === "string" && /limite.*cota/i.test(error.message);
  return new Error(exhausted
    ? "F07_QUOTE_RATE_LIMIT: Limite tempor\u00e1rio de cota\u00e7\u00f5es. Aguarde um minuto."
    : "O servi\u00e7o de cota\u00e7\u00e3o est\u00e1 temporariamente indispon\u00edvel. Tente novamente.");
}
