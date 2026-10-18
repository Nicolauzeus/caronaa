const KEY = "caronaa-chunk-recovery";
const RETRY_WINDOW_MS = 60_000;

export function recoverStaleChunk(error: unknown, storage: Pick<Storage, "getItem" | "setItem">, reload: () => void, now = Date.now()): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .+ failed/i.test(message)) return false;
  try {
    const previous = storage.getItem(KEY);
    if (previous !== null && now - Number(previous) < RETRY_WINDOW_MS) return false;
    storage.setItem(KEY, String(now));
    reload();
    return true;
  } catch {
    return false;
  }
}