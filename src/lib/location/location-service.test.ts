import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GooglePlacesProvider, parseAddressComponents, parseSecondaryText } from "./google-places";
import {
  isLocationServiceConfigured,
  getMissingLocationConfig,
  getLocationProviderName,
  searchLocationsService,
} from "./service";

describe("Location Service & Google Places Provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.VITE_GOOGLE_PLACES_API_KEY;
    delete process.env.VITE_GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Configuration Detection", () => {
    it("reports not configured when API key is missing", () => {
      expect(isLocationServiceConfigured()).toBe(false);
      expect(getMissingLocationConfig()).toContain("GOOGLE_PLACES_API_KEY");
      expect(getLocationProviderName()).toBe("Google Places");
    });

    it("returns empty suggestions and fallback warning when unconfigured", async () => {
      const result = await searchLocationsService("UNIFOR");
      expect(result.isConfigured).toBe(false);
      expect(result.provider).toBe("google_places");
      expect(result.suggestions).toEqual([]);
      expect(result.warning).toContain("GOOGLE_PLACES_API_KEY não configurada");
    });
  });

  describe("Google Places Parsers", () => {
    it("correctly parses address components from Google Place Details", () => {
      const components = [
        { long_name: "1321", short_name: "1321", types: ["street_number"] },
        {
          long_name: "Avenida Washington Soares",
          short_name: "Av. Washington Soares",
          types: ["route"],
        },
        {
          long_name: "Edson Queiroz",
          short_name: "Edson Queiroz",
          types: ["sublocality", "sublocality_level_1"],
        },
        {
          long_name: "Fortaleza",
          short_name: "Fortaleza",
          types: ["administrative_area_level_2", "locality"],
        },
        { long_name: "Ceará", short_name: "CE", types: ["administrative_area_level_1"] },
        { long_name: "Brasil", short_name: "BR", types: ["country"] },
      ];

      const parsed = parseAddressComponents(components);
      expect(parsed.neighborhood).toBe("Edson Queiroz");
      expect(parsed.city).toBe("Fortaleza");
      expect(parsed.state).toBe("CE");
      expect(parsed.country).toBe("BR");
    });

    it("correctly infers neighborhood and city from secondary_text", () => {
      const text = "Aldeota, Fortaleza - CE, Brasil";
      const inferred = parseSecondaryText(text);

      expect(inferred.neighborhood).toBe("Aldeota");
      expect(inferred.city).toBe("Fortaleza");
      expect(inferred.state).toBe("CE");
    });

    it("handles secondary text with only city and state", () => {
      const text = "Maracanaú - CE, Brasil";
      const inferred = parseSecondaryText(text);

      expect(inferred.neighborhood).toBe("Maracanaú - CE");
      expect(inferred.city).toBe("Brasil");
    });
  });

  describe("Google Places Provider API Calls", () => {
    it("constructs request with Ceará bias and parses predictions when configured", async () => {
      process.env.GOOGLE_PLACES_API_KEY = "test_google_key_123";

      const mockResponse = {
        status: "OK",
        predictions: [
          {
            place_id: "ChIJ_unifor_123",
            description:
              "UNIFOR - Universidade de Fortaleza, Edson Queiroz, Fortaleza - CE, Brasil",
            structured_formatting: {
              main_text: "Universidade de Fortaleza (UNIFOR)",
              secondary_text: "Edson Queiroz, Fortaleza - CE, Brasil",
            },
            types: ["university", "point_of_interest", "establishment"],
          },
          {
            place_id: "ChIJ_parangaba_456",
            description: "Parangaba, Fortaleza - CE, Brasil",
            structured_formatting: {
              main_text: "Parangaba",
              secondary_text: "Fortaleza - CE, Brasil",
            },
            types: ["sublocality", "neighborhood"],
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const provider = new GooglePlacesProvider();
      expect(provider.isConfigured()).toBe(true);

      const result = await provider.search("UNIFOR");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);

      expect(calledUrl.searchParams.get("input")).toBe("UNIFOR");
      expect(calledUrl.searchParams.get("components")).toBe("country:br");
      expect(calledUrl.searchParams.get("location")).toBe("-3.7319,-38.5267");
      expect(calledUrl.searchParams.get("radius")).toBe("150000");
      expect(calledUrl.searchParams.get("key")).toBe("test_google_key_123");

      expect(result.isConfigured).toBe(true);
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].mainText).toBe("Universidade de Fortaleza (UNIFOR)");
      expect(result.suggestions[0].neighborhood).toBe("Edson Queiroz");
      expect(result.suggestions[0].city).toBe("Fortaleza");
      expect(result.suggestions[0].state).toBe("CE");
    });

    it("handles ZERO_RESULTS gracefully without error", async () => {
      process.env.GOOGLE_PLACES_API_KEY = "test_google_key_123";

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ZERO_RESULTS", predictions: [] }),
      } as unknown as Response);

      const provider = new GooglePlacesProvider();
      const result = await provider.search("LocalInexistentexyz123");

      expect(result.isConfigured).toBe(true);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it("handles API failure / network error gracefully", async () => {
      process.env.GOOGLE_PLACES_API_KEY = "test_google_key_123";

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

      const provider = new GooglePlacesProvider();
      const result = await provider.search("Pajuçara");

      expect(result.isConfigured).toBe(true);
      expect(result.suggestions).toEqual([]);
      expect(result.error).toBe("Network timeout");
    });
  });
});
