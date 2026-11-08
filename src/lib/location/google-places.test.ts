import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GooglePlacesProvider } from "./google-places";

beforeEach(() => vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-test-key"));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Google Places (New) billing sessions", () => {
  const token = "2c289b89-137f-4e04-8d92-10a320cfb611";

  it("sends sessionToken on autocomplete and not without an active session", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ placePrediction: { placeId: "ChIJ_session", structuredFormat: { mainText: { text: "Local" } } } }] }),
    });
    vi.stubGlobal("fetch", request);
    const provider = new GooglePlacesProvider();
    await provider.search("Fortaleza", token);
    const [url, config] = request.mock.calls[0];
    expect(url).toContain("places:autocomplete");
    expect(JSON.parse(config.body).sessionToken).toBe(token);
    await provider.search("Redenção");
    expect(JSON.parse(request.mock.calls[1][1].body)).not.toHaveProperty("sessionToken");
  });

  it("terminates with the same token and Essentials-only field mask", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "ChIJ_session",
        formattedAddress: "Avenida Teste, Fortaleza - CE",
        location: { latitude: -3.73, longitude: -38.52 },
        addressComponents: [],
      }),
    });
    vi.stubGlobal("fetch", request);
    const provider = new GooglePlacesProvider();
    const details = await provider.getDetails("ChIJ_session", token);
    expect(details.details?.lat).toBe(-3.73);
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get("sessionToken")).toBe(token);
    expect(url.searchParams.get("fields")).not.toContain("displayName");
    await provider.getDetails("ChIJ_session");
    expect(new URL(request.mock.calls[1][0]).searchParams.has("sessionToken")).toBe(false);
  });
});
