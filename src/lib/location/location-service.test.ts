import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GooglePlacesProvider,
  parseAddressComponents,
  parseSecondaryText,
} from "./google-places";
import { getGoogleServerKey } from "./google-server-key";
import {
  isLocationServiceConfigured,
  getMissingLocationConfig,
  getLocationProviderName,
  searchLocationsService,
  geocodeAddressService,
} from "./service";

const fields = [
  {
    longText: "Av. Washington Soares",
    shortText: "Av. Washington Soares",
    types: ["route"],
  },
  { longText: "1321", types: ["street_number"] },
  { longText: "Edson Queiroz", types: ["sublocality_level_1"] },
  { longText: "Fortaleza", types: ["administrative_area_level_2"] },
  {
    longText: "Ceará",
    shortText: "CE",
    types: ["administrative_area_level_1"],
  },
  { longText: "Brasil", shortText: "BR", types: ["country"] },
  { longText: "60811-905", types: ["postal_code"] },
];
const place = (
  name = "Universidade de Fortaleza (UNIFOR)",
  lat = -3.7698,
  lng = -38.4788,
) => ({
  id: "ChIJ_unifor_123",
  displayName: { text: name },
  formattedAddress:
    "Av. Washington Soares, 1321, Edson Queiroz, Fortaleza - CE",
  location: { latitude: lat, longitude: lng },
  addressComponents: fields,
});
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
beforeEach(() => {
  for (const key of [
    "GOOGLE_MAPS_API_KEY",
    "GOOGLE_PLACES_API_KEY",
    "VITE_GOOGLE_MAPS_API_KEY",
    "VITE_GOOGLE_PLACES_API_KEY",
    "GOOGLE_MAPS_BROWSER_API_KEY",
    "VITE_GOOGLE_MAPS_BROWSER_API_KEY",
  ])
    vi.stubEnv(key, "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Google server keys", () => {
  it("uses maps, places, Vite order and ignores blank or known browser-only keys", () => {
    expect(isLocationServiceConfigured()).toBe(false);
    expect(getMissingLocationConfig()).toEqual(["GOOGLE_MAPS_API_KEY"]);
    expect(getLocationProviderName()).toBe("Google Places (New)");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", " maps ");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "places");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "vite");
    expect(getGoogleServerKey()).toBe("maps");
    vi.stubEnv("GOOGLE_MAPS_BROWSER_API_KEY", "maps");
    expect(getGoogleServerKey()).toBe("places");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(getGoogleServerKey()).toBe("vite");
    vi.stubEnv("VITE_GOOGLE_MAPS_BROWSER_API_KEY", "vite");
    expect(getGoogleServerKey()).toBeNull();
  });
  it("keeps curated campus coordinates available without external calls offline", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const query of ["unilab", "unifor", "Aldeota", "Maracanaú"]) {
      const result = await searchLocationsService(query);
      expect(result.provider).toBe("catalog");
      expect(
        result.suggestions.some(
          (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
        ),
      ).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Places API New contracts", () => {
  beforeEach(() => vi.stubEnv("GOOGLE_MAPS_API_KEY", "maps-server-test"));
  it("POSTs Brazil-only Autocomplete with a 50km geographic bias and new prediction structure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ_1",
                structuredFormat: {
                  mainText: { text: "UNILAB - Campus das Auroras" },
                  secondaryText: { text: "Redenção - CE, Brasil" },
                },
                text: { text: "UNILAB - Campus das Auroras, Redenção - CE" },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await new GooglePlacesProvider().search("unilab");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(options.method).toBe("POST");
    expect(options.headers["X-Goog-Api-Key"]).toBe("maps-server-test");
    expect(url).not.toContain("maps-server-test");
    expect(JSON.parse(options.body)).toMatchObject({
      input: "unilab",
      includedRegionCodes: ["br"],
      languageCode: "pt-BR",
      locationBias: {
        circle: {
          center: { latitude: -3.7319, longitude: -38.5267 },
          radius: 50000,
        },
      },
    });
    expect(result.suggestions[0]).toEqual({
      providerId: "ChIJ_1",
      mainText: "UNILAB - Campus das Auroras",
      secondaryText: "Redenção - CE, Brasil",
      formattedAddress: "UNILAB - Campus das Auroras, Redenção - CE",
      source: "google",
    });
    // Predictions never fabricate coordinates or infer a neighborhood.
    expect(result.suggestions[0].lat).toBeUndefined();
    expect(result.suggestions[0].city).toBeUndefined();
  });
  it("GETs selected details and maps real coordinates, address components and ZIP", async () => {
    const fetch = vi.fn().mockResolvedValue(response(place()));
    vi.stubGlobal("fetch", fetch);
    const result = await new GooglePlacesProvider().getDetails(
      "ChIJ_unifor_123",
    );
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe("/v1/places/ChIJ_unifor_123");
    expect(new URL(url).searchParams.get("fields")).toBe(
      "id,formattedAddress,location,addressComponents",
    );
    expect(new URL(url).searchParams.get("languageCode")).toBe("pt-BR");
    expect(options.headers["X-Goog-Api-Key"]).toBe("maps-server-test");
    expect(result.details).toMatchObject({
      lat: -3.7698,
      lng: -38.4788,
      neighborhood: "Edson Queiroz",
      city: "Fortaleza",
      state: "CE",
      postalCode: "60811-905",
      streetNumber: "1321",
      source: "google",
    });
  });
  it.each(["unilab", "unifor", "Aldeota Fortaleza", "Maracanaú"])(
    "uses Text Search with a field mask for free text %s",
    async (query) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(response({ places: [place(query)] }));
      vi.stubGlobal("fetch", fetch);
      const result = await geocodeAddressService(query);
      expect(fetch.mock.calls[0][0]).toBe(
        "https://places.googleapis.com/v1/places:searchText",
      );
      const options = fetch.mock.calls[0][1];
      expect(JSON.parse(options.body).textQuery).toBe(query);
      expect(options.headers["X-Goog-FieldMask"]).toContain("places.location");
      expect(result).toMatchObject({
        lat: -3.7698,
        lng: -38.4788,
        source: "google",
        isApproximate: false,
      });
    },
  );
  it("geocodes place IDs through details and rejects invalid/missing geometry", async () => {
    const fetch = vi.fn().mockResolvedValue(response(place()));
    vi.stubGlobal("fetch", fetch);
    expect(
      await new GooglePlacesProvider().geocode("ChIJ_unifor_123"),
    ).toMatchObject({ lat: -3.7698, lng: -38.4788 });
    fetch.mockResolvedValue(
      response({ ...place(), location: { latitude: NaN, longitude: 0 } }),
    );
    expect(
      (await new GooglePlacesProvider().getDetails("ChIJ_unifor_123")).details,
    ).toBeNull();
  });
  it("handles empty, malformed, timeout and denied responses without leaking raw provider errors", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const provider = new GooglePlacesProvider();
    for (const data of [
      {},
      { suggestions: [] },
      { suggestions: [{ queryPrediction: { text: { text: "not a place" } } }] },
    ]) {
      fetch.mockResolvedValue(response(data));
      expect((await provider.search("xpto")).suggestions).toEqual([]);
    }
    fetch.mockResolvedValue(response({ suggestions: "invalid" }));
    expect((await provider.search("xpto")).error).toBeDefined();
    fetch.mockResolvedValue(
      response({ error: { message: "sensitive key/maps-server-test" } }, 403),
    );
    const failure = await provider.search("xpto");
    expect(failure.error).toBeDefined();
    expect(JSON.stringify(failure)).not.toContain("maps-server-test");
    expect((await provider.getDetails("ChIJ_1")).details).toBeNull();
    fetch.mockRejectedValue(new Error("request url with sensitive key"));
    expect(await provider.geocode("Rua fictícia")).toBeNull();
    expect((await provider.search("xpto")).error).not.toContain("sensitive");
  });
});

describe("Geographic component parsing", () => {
  it("prefers precise neighborhood and municipality components regardless of order", () => {
    expect(
      parseAddressComponents([
        { longText: "Wrong city", types: ["locality"] },
        { longText: "Broad area", types: ["sublocality"] },
        ...fields,
      ]),
    ).toMatchObject({
      neighborhood: "Edson Queiroz",
      city: "Fortaleza",
      postalCode: "60811-905",
    });
    expect(parseSecondaryText("Maracanaú - CE, Brasil")).toEqual({
      city: "Maracanaú",
      state: "CE",
      neighborhood: undefined,
    });
    expect(parseSecondaryText("Aldeota, Fortaleza - CE, Brasil")).toEqual({
      city: "Fortaleza",
      state: "CE",
      neighborhood: "Aldeota",
    });
  });
});
