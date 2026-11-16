export const GOOGLE_REQUEST_LIMITS = { autocomplete: 30, quote: 10, details: 20 } as const;
export type GoogleOperation = keyof typeof GOOGLE_REQUEST_LIMITS;
export const GOOGLE_CACHE_TTL_MS = {
  places_search_text: 30 * 24 * 60 * 60 * 1000,
  route_quote: 10 * 60 * 1000,
} as const;
export const GOOGLE_TIMEOUT_MS = 12000;
export const shouldRetryGoogle = (status: number, attempt: number) =>
  attempt === 0 && status >= 500 && status <= 599;