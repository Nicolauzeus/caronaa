/** Pure client-side coordination: never computes prices or authorizes a ride. */
type Quote = { quoteId: string; expiresAt: string };
type Entry = { promise: Promise<Quote>; quoteId?: string; expires: number };
export const QUICK_QUOTE_COOLDOWN_MS = 60_000;

export function isQuickQuoteRateLimit(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : "";
  return /F07_QUOTE_RATE_LIMIT|limite.*cota|muitas consultas/i.test(message);
}

/** Key uses exact coordinates, never address labels or rounded GPS. */
export function quickQuoteItineraryKey(
  origin: { lat?: number; lng?: number } | undefined,
  destination: { lat?: number; lng?: number } | undefined,
  vehicle: string | null,
): string {
  return JSON.stringify([origin?.lat, origin?.lng, destination?.lat, destination?.lng, vehicle]);
}

export function createQuickQuoteCoordinator(now: () => number = () => Date.now()) {
  let scope: string | null = null;
  let generation = 0;
  let cooldownUntil = 0;
  const cache = new Map<string, Entry>();
  const setAccount = (account: string | null) => {
    if (scope === account) return;
    scope = account;
    generation++;
    cooldownUntil = 0;
    cache.clear();
  };
  const remainingMs = () => Math.max(0, cooldownUntil - now());
  function run<T extends Quote>(account: string | null, key: string, load: () => Promise<T>): Promise<T> {
    setAccount(account);
    // No root session: do not share a cache; the existing authenticated endpoint
    // remains responsible for rejecting unauthenticated calls.
    if (!account) return Promise.resolve().then(load);
    const entry = cache.get(key);
    if (entry && entry.expires > now()) return entry.promise as Promise<T>;
    if (remainingMs() > 0) return Promise.reject(new Error("F07_QUOTE_RATE_LIMIT"));
    if (entry) cache.delete(key);
    // Avoid eviction of in-flight work and bound the ephemeral browser cache.
    if (cache.size >= 16) {
      const removable = [...cache].find(([, value]) => value.quoteId || value.expires <= now());
      if (removable) cache.delete(removable[0]);
      else return Promise.reject(new Error("Aguarde o c\u00e1lculo em andamento."));
    }
    const requestGeneration = generation;
    const record: Entry = { expires: now() + 45_000, promise: Promise.resolve(null as unknown as Quote) };
    record.promise = Promise.resolve().then(load).then(value => {
      if (generation === requestGeneration && cache.get(key) === record) {
        const expires = Date.parse(value.expiresAt);
        if (!Number.isFinite(expires) || expires <= now() + 5_000) cache.delete(key);
        else {
          record.quoteId = value.quoteId;
          record.expires = Math.min(now() + 45_000, expires - 5_000);
        }
      }
      return value;
    }).catch(cause => {
      if (generation === requestGeneration && cache.get(key) === record) {
        cache.delete(key);
        if (isQuickQuoteRateLimit(cause) && remainingMs() === 0)
          cooldownUntil = now() + QUICK_QUOTE_COOLDOWN_MS;
      }
      throw cause;
    });
    cache.set(key, record);
    return record.promise as Promise<T>;
  }
  function forget(quoteId?: string) {
    if (!quoteId) { cache.clear(); generation++; return; }
    for (const [key, value] of cache) if (value.quoteId === quoteId) cache.delete(key);
  }
  return { run, setAccount, remainingMs, forget };
}

// Used only by browser effects. Not persisted and never shared across accounts.
export const quickQuoteCoordinator = createQuickQuoteCoordinator();
