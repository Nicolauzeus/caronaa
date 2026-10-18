import { describe, expect, it, vi } from "vitest";
import { recoverStaleChunk } from "./chunk-recovery";

describe("stale chunk recovery", () => {
  it("reloads a missing module once and prevents a reload loop", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const reload = vi.fn();
    const error = new TypeError("Failed to fetch dynamically imported module: /assets/routes-old.js");
    expect(recoverStaleChunk(error, storage, reload, 1000)).toBe(true);
    expect(recoverStaleChunk(error, storage, reload, 1001)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
  it("does not reload unrelated errors", () => {
    const reload = vi.fn();
    expect(recoverStaleChunk(new Error("Permission denied"), { getItem: () => null, setItem: vi.fn() }, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});