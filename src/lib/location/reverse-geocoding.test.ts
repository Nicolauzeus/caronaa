import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GooglePlacesProvider } from "./google-places";
beforeEach(() => vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-test-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Google reverse geocoding", () => {
  it("resolves an address without replacing GPS with the nearest building", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            formattedAddress: "Rua A, Fortaleza, Ceará",
            addressComponents: [],
            location: { latitude: -3.7, longitude: -38.5 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", request);
    expect(await new GooglePlacesProvider().reverse(-3.73, -38.52)).toEqual(
      expect.objectContaining({
        formattedAddress: "Rua A, Fortaleza, Ceará",
        lat: -3.73,
        lng: -38.52,
      }),
    );
    expect(new URL(request.mock.calls[0][0]).hostname).toBe(
      "geocode.googleapis.com",
    );
    expect(new URL(request.mock.calls[0][0]).pathname).toBe(
      "/v4/geocode/location/-3.73,-38.52",
    );
  });
  it("does not invent addresses when results are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      }),
    );
    expect(await new GooglePlacesProvider().reverse(-3.73, -38.52)).toBeNull();
  });
  it("fails on HTTP and authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    await expect(
      new GooglePlacesProvider().reverse(-3.73, -38.52),
    ).rejects.toThrow("503");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: "forbidden" } }),
      }),
    );
    await expect(
      new GooglePlacesProvider().reverse(-3.73, -38.52),
    ).rejects.toThrow("indisponível");
  });
});
