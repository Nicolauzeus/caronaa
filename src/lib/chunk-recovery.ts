const KEY = "caronaa-chunk-recovery";

/** A deploy can swap build files while a tab is open; allow a few reloads before giving up. */
export const MAX_ATTEMPTS = 3;
export const RECOVERY_WINDOW_MS = 5 * 60_000;

const CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk .+ failed/i;

export function isChunkLoadError(error: unknown): boolean {
  return CHUNK_PATTERN.test(error instanceof Error ? error.message : String(error));
}

export async function clearStaleServiceWorkerCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined" || typeof caches.keys !== "function") return;
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith("caronaa-")).map((key) => caches.delete(key)),
    );
  } catch {
    // Recovery must not depend on a cache API that may be unavailable.
  }
}

type RecoveryState = { attempts: number; startedAt: number };

function readState(storage: Pick<Storage, "getItem">): RecoveryState | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecoveryState>;
    if (typeof parsed?.attempts !== "number" || typeof parsed?.startedAt !== "number") return null;
    return { attempts: parsed.attempts, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

let reloadInFlight = false;

/** Test hook: a page reload normally clears this flag. */
export function resetChunkRecovery(): void {
  reloadInFlight = false;
}

export function recoverStaleChunk(
  error: unknown,
  storage: Pick<Storage, "getItem" | "setItem">,
  reload: () => void,
  now = Date.now(),
  clearStaleCaches: () => Promise<void> | void = clearStaleServiceWorkerCaches,
): boolean {
  if (!isChunkLoadError(error)) return false;
  if (reloadInFlight) return true;

  const previous = readState(storage);
  const live = previous && now - previous.startedAt < RECOVERY_WINDOW_MS ? previous : null;
  const attempts = (live?.attempts ?? 0) + 1;
  if (attempts > MAX_ATTEMPTS) return false;

  try {
    storage.setItem(
      KEY,
      JSON.stringify({ attempts, startedAt: live?.startedAt ?? now }),
    );
  } catch {
    return false;
  }

  reloadInFlight = true;
  void clearStaleCaches();
  reload();
  return true;
}
