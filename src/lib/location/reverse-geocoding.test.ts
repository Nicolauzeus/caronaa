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
        status: "OK",
        results: [
          {
            formatted_address: "Rua A, Fortaleza, Ceará",
            address_components: [],
            geometry: { location: { lat: -3.7, lng: -38.5 } },
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
    expect(request.mock.calls[0][0].hostname).toBe("maps.googleapis.com");
    expect(request.mock.calls[0][0].searchParams.get("latlng")).toBe(
      "-3.73,-38.52",
    );
  });
  it("does not invent addresses when results are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ status: "ZERO_RESULTS" }),
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
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ status: "REQUEST_DENIED" }),
        }),
    );
    await expect(
      new GooglePlacesProvider().reverse(-3.73, -38.52),
    ).rejects.toThrow("indisponível");
  });
});
