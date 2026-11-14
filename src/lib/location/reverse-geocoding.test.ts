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
        places: [{
          id: "nearby-test-id",
          formattedAddress: "Rua A, Fortaleza, Ceará",
          addressComponents: [
            {longText:"Fortaleza",types:["administrative_area_level_2"]},
            {shortText:"CE",types:["administrative_area_level_1"]},
            {shortText:"BR",types:["country"]},
          ],
          location: { latitude: -3.7301, longitude: -38.52 },
        }],
      }),
    });
    vi.stubGlobal("fetch", request);
    expect(await new GooglePlacesProvider().reverse(-3.73, -38.52)).toEqual(
      expect.objectContaining({
        formattedAddress: "Rua A, Fortaleza, Ceará",
        lat: -3.73,
        lng: -38.52,
        city: "Fortaleza",
        isApproximate: true,
      }),
    );
    const [url,options]=request.mock.calls[0];
    expect(new URL(url).hostname).toBe("places.googleapis.com");
    expect(new URL(url).pathname).toBe("/v1/places:searchNearby");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      locationRestriction:{circle:{
        center:{latitude:-3.73,longitude:-38.52},radius:150,
      }},
      maxResultCount:1,
    }));
  });
  it("does not invent addresses when results are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ places: [] }),
      }),
    );
    expect(await new GooglePlacesProvider().reverse(-3.73, -38.52)).toBeNull();
  });
  it("backs off after Google returns HTTP 429 instead of repeating the request", async () => {
    const now=vi.spyOn(Date,"now").mockReturnValue(100000);
    try {
      const request=vi.fn().mockResolvedValue({ok:false,status:429});
      vi.stubGlobal("fetch",request);
      await expect(new GooglePlacesProvider().reverse(-3.73,-38.52)).rejects.toThrow("429");
      await expect(new GooglePlacesProvider().reverse(-3.73,-38.52)).rejects.toThrow("429");
      expect(request).toHaveBeenCalledTimes(1);
      now.mockReturnValue(161000);
      request.mockResolvedValue({ok:true,json:async()=>({places:[]})});
      expect(await new GooglePlacesProvider().reverse(-3.73,-38.52)).toBeNull();
      expect(request).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
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
