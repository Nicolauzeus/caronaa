import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).google;
  delete (window as any).gm_authFailure;
});
afterEach(() => {
  vi.useRealTimers();
  document
    .querySelectorAll('script[src*="maps.googleapis.com"]')
    .forEach((s) => s.remove());
  delete (window as any).google;
});
describe("Google script lifecycle", () => {
  it("shares one script between concurrent maps and resolves only with the API", async () => {
    const { loadGoogleMaps } = await import("./google-maps-loader");
    const first = loadGoogleMaps("test-key");
    expect(loadGoogleMaps("test-key")).toBe(first);
    expect(
      document.querySelectorAll('script[src*="maps.googleapis.com"]'),
    ).toHaveLength(1);
    (window as any).google = { maps: { Map: class {} } };
    (window as any).__caronaaGoogleMapsLoaded();
    await expect(first).resolves.toBeUndefined();
  });
  it("rejects a missing key, network errors and timeouts; permits network retry", async () => {
    const { loadGoogleMaps } = await import("./google-maps-loader");
    await expect(loadGoogleMaps("")).rejects.toThrow("key missing");
    const pending = loadGoogleMaps("test-key");
    const rejected = expect(pending).rejects.toThrow("load failed");
    document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com"]',
    )!.onerror!(new Event("error"));
    await rejected;
    const retry = loadGoogleMaps("test-key");
    const timedOut = expect(retry).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(12000);
    await timedOut;
  });
  it("notifies every mounted map of a late domain failure, respects unsubscribe", async () => {
    const { loadGoogleMaps, onGoogleMapsAuthFailure } =
      await import("./google-maps-loader");
    const first = vi.fn(),
      second = vi.fn();
    const stop = onGoogleMapsAuthFailure(first);
    onGoogleMapsAuthFailure(second);
    stop();
    const pending = loadGoogleMaps("test-key");
    const rejected = expect(pending).rejects.toThrow("authentication");
    (window as any).gm_authFailure();
    await rejected;
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    await expect(loadGoogleMaps("test-key")).rejects.toThrow("authentication");
  });
});
