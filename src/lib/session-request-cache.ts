/** Ephemeral, bounded cache: nothing is written to localStorage or a database. */
const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();
export function sessionRequest<T>(
  key: string,
  request: () => Promise<T>,
  ttlMs = 5 * 60_000,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.promise as Promise<T>;
  if (cache.size >= 80) cache.delete(cache.keys().next().value!);
  const promise = request().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expires: Date.now() + ttlMs, promise });
  return promise;
}
