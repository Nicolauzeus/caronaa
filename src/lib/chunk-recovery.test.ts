import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ATTEMPTS,
  RECOVERY_WINDOW_MS,
  clearStaleServiceWorkerCaches,
  recoverStaleChunk,
  resetChunkRecovery,
} from "./chunk-recovery";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  };
}

const chunkError = () =>
  new TypeError("Failed to fetch dynamically imported module: /assets/admin-0rMkOagy.js");

afterEach(() => resetChunkRecovery());

describe("stale chunk recovery", () => {
  it("retries a missing module across deploys, then stops before looping", () => {
    const { storage } = makeStorage();
    const reload = vi.fn();
    const clear = vi.fn(async () => {});

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      expect(recoverStaleChunk(chunkError(), storage, reload, 1000 + attempt, clear)).toBe(true);
      resetChunkRecovery();
    }
    expect(reload).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(clear).toHaveBeenCalledTimes(MAX_ATTEMPTS);

    expect(recoverStaleChunk(chunkError(), storage, reload, 1000 + MAX_ATTEMPTS + 1, clear)).toBe(
      false,
    );
    expect(reload).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(clear).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("opens a fresh budget once the recovery window expires", () => {
    const { storage } = makeStorage();
    const reload = vi.fn();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      recoverStaleChunk(chunkError(), storage, reload, 1000 + attempt, () => {});
      resetChunkRecovery();
    }
    expect(recoverStaleChunk(chunkError(), storage, reload, 1000 + RECOVERY_WINDOW_MS + 1, () => {})).toBe(
      true,
    );
    resetChunkRecovery();
    expect(reload).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1);
  });

  it("drops cached build files before reloading", async () => {
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => ["caronaa-static-v2", "other"],
      delete: async (key: string) => {
        deleted.push(key);
        return true;
      },
    });
    await clearStaleServiceWorkerCaches();
    expect(deleted).toEqual(["caronaa-static-v2"]);
    vi.unstubAllGlobals();
  });

  it("ignores unrelated failures", () => {
    const { storage } = makeStorage();
    const reload = vi.fn();
    expect(recoverStaleChunk(new Error("Permission denied"), storage, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("starts over when the stored marker is unreadable", () => {
    const values = new Map<string, string>([["caronaa-chunk-recovery", "not json"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const reload = vi.fn();
    expect(recoverStaleChunk(chunkError(), storage, reload, 5000, () => {})).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
