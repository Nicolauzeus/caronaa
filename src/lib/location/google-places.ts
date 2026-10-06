import type {
  LocationDetailsResponse,
  LocationProvider,
  LocationSearchResponse,
  LocationSuggestion,
} from "./types";

const GOOGLE_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const GOOGLE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

// Coordenadas centrais de Fortaleza/Ceará para viés geográfico (lat: -3.7319, lng: -38.5267, raio de ~150km)
const CEARA_BIAS_LOCATION = "-3.7319,-38.5267";
const CEARA_BIAS_RADIUS_METERS = "150000";

function getApiKey(): string | null {
  const nodeEnv = typeof process !== "undefined" && process.env ? process.env : undefined;
  const globalEnv = globalThis as Record<string, unknown>;
  const viteEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, unknown>)
      : undefined;
  const key =
    nodeEnv?.GOOGLE_PLACES_API_KEY ||
    nodeEnv?.GOOGLE_MAPS_API_KEY ||
    nodeEnv?.VITE_GOOGLE_PLACES_API_KEY ||
    nodeEnv?.VITE_GOOGLE_MAPS_API_KEY ||
    (typeof globalEnv?.["GOOGLE_PLACES_API_KEY"] === "string"
      ? (globalEnv["GOOGLE_PLACES_API_KEY"] as string)
      : null) ||
    (typeof globalEnv?.["GOOGLE_MAPS_API_KEY"] === "string"
      ? (globalEnv["GOOGLE_MAPS_API_KEY"] as string)
      : null) ||
    (typeof viteEnv?.["VITE_GOOGLE_PLACES_API_KEY"] === "string"
      ? (viteEnv["VITE_GOOGLE_PLACES_API_KEY"] as string)
      : null) ||
    (typeof viteEnv?.["VITE_GOOGLE_MAPS_API_KEY"] === "string"
      ? (viteEnv["VITE_GOOGLE_MAPS_API_KEY"] as string)
      : null);
  return key || null;
}

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types?: string[];
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceDetailsResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
  address_components?: GoogleAddressComponent[];
  types?: string[];
}

export function parseAddressComponents(components: GoogleAddressComponent[] = []) {
  let neighborhood: string | undefined;
  let city: string | undefined;
  let state: string | undefined;
  let country: string | undefined;

  for (const comp of components) {
    if (
      comp.types.includes("sublocality") ||
      comp.types.includes("sublocality_level_1") ||
      comp.types.includes("neighborhood")
    ) {
      neighborhood = comp.long_name;
    } else if (
      comp.types.includes("administrative_area_level_2") ||
      comp.types.includes("locality")
    ) {
      if (!city) city = comp.long_name;
    } else if (comp.types.includes("administrative_area_level_1")) {
      state = comp.short_name || comp.long_name;
    } else if (comp.types.includes("country")) {
      country = comp.short_name || comp.long_name;
    }
  }

  return { neighborhood, city, state, country };
}

/**
 * Tenta inferir bairro e cidade a partir do texto secundário caso details não esteja disponível
 * Exemplo: "Aldeota, Fortaleza - CE, Brasil" -> neighborhood: "Aldeota", city: "Fortaleza", state: "CE"
 */
export function parseSecondaryText(secondaryText?: string) {
  if (!secondaryText) return {};
  const parts = secondaryText.split(",").map((s) => s.trim());
  const neighborhood = parts.length > 1 ? parts[0] : undefined;
  const cityState = parts.length > 1 ? parts[1] : parts[0];
  const [city, state] = (cityState || "").split("-").map((s) => s.trim());

  return {
    neighborhood,
    city: city || undefined,
    state: state || undefined,
  };
}

export class GooglePlacesProvider implements LocationProvider {
  readonly name = "Google Places";

  isConfigured(): boolean {
    return Boolean(getApiKey());
  }

  async search(query: string): Promise<LocationSearchResponse> {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        isConfigured: false,
        provider: "google_places",
        suggestions: [],
        warning: "GOOGLE_PLACES_API_KEY não configurada no servidor. Modo manual ativo.",
      };
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return {
        isConfigured: true,
        provider: "google_places",
        suggestions: [],
      };
    }

    try {
      const url = new URL(GOOGLE_AUTOCOMPLETE_URL);
      url.searchParams.set("input", trimmed);
      url.searchParams.set("components", "country:br");
      url.searchParams.set("location", CEARA_BIAS_LOCATION);
      url.searchParams.set("radius", CEARA_BIAS_RADIUS_METERS);
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", apiKey);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isConfigured: true,
          provider: "google_places",
          suggestions: [],
          error: `Falha na requisição ao Google Places: HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        status: string;
        predictions?: GooglePrediction[];
        error_message?: string;
      };

      if (data.status === "ZERO_RESULTS" || !data.predictions) {
        return {
          isConfigured: true,
          provider: "google_places",
          suggestions: [],
        };
      }

      if (data.status !== "OK") {
        return {
          isConfigured: true,
          provider: "google_places",
          suggestions: [],
          error: data.error_message || `Status Google Places: ${data.status}`,
        };
      }

      const suggestions: LocationSuggestion[] = data.predictions.map((pred) => {
        const mainText = pred.structured_formatting?.main_text || pred.description;
        const secondaryText = pred.structured_formatting?.secondary_text || "";
        const inferred = parseSecondaryText(secondaryText);

        return {
          providerId: pred.place_id,
          mainText,
          secondaryText,
          formattedAddress: pred.description,
          neighborhood: inferred.neighborhood,
          city: inferred.city,
          state: inferred.state,
          types: pred.types,
        };
      });

      return {
        isConfigured: true,
        provider: "google_places",
        suggestions,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro de conexão com Google Places";
      return {
        isConfigured: true,
        provider: "google_places",
        suggestions: [],
        error: message,
      };
    }
  }

  async getDetails(placeId: string): Promise<LocationDetailsResponse> {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        isConfigured: false,
        provider: "google_places",
        details: null,
      };
    }

    try {
      const url = new URL(GOOGLE_DETAILS_URL);
      url.searchParams.set("place_id", placeId);
      url.searchParams.set(
        "fields",
        "place_id,name,formatted_address,geometry,address_components,types",
      );
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", apiKey);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isConfigured: true,
          provider: "google_places",
          details: null,
          error: `Falha ao buscar detalhes do local: HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        status: string;
        result?: GooglePlaceDetailsResult;
        error_message?: string;
      };

      if (data.status !== "OK" || !data.result) {
        return {
          isConfigured: true,
          provider: "google_places",
          details: null,
          error: data.error_message || `Status Google Places Details: ${data.status}`,
        };
      }

      const res = data.result;
      const components = parseAddressComponents(res.address_components);

      const suggestion: LocationSuggestion = {
        providerId: res.place_id,
        mainText: res.name || res.formatted_address || "",
        secondaryText: [components.neighborhood, components.city, components.state]
          .filter(Boolean)
          .join(", "),
        formattedAddress: res.formatted_address || res.name || "",
        neighborhood: components.neighborhood,
        city: components.city,
        state: components.state,
        country: components.country,
        lat: res.geometry?.location?.lat,
        lng: res.geometry?.location?.lng,
        types: res.types,
      };

      return {
        isConfigured: true,
        provider: "google_places",
        details: suggestion,
      };
    } catch (err) {
      return {
        isConfigured: true,
        provider: "google_places",
        details: null,
        error: err instanceof Error ? err.message : "Erro ao buscar detalhes no Google Places",
      };
    }
  }

  async geocode(addressOrPlaceId: string): Promise<import("./types").GeocodingResult | null> {
    if (!this.isConfigured() || !addressOrPlaceId.trim()) return null;

    // Se parecer um place_id (começa com ChIJ ou similar), busca detalhes diretamente
    if (/^[a-zA-Z0-9_-]{20,}$/.test(addressOrPlaceId.trim())) {
      const details = await this.getDetails(addressOrPlaceId.trim());
      if (details.details) {
        return {
          rawText: addressOrPlaceId,
          formattedAddress: details.details.formattedAddress,
          neighborhood: details.details.neighborhood,
          city: details.details.city,
          state: details.details.state,
          country: details.details.country,
          lat: details.details.lat,
          lng: details.details.lng,
          placeId: details.details.providerId,
          types: details.details.types,
        };
      }
    }

    const searchRes = await this.search(addressOrPlaceId);
    if (!searchRes.suggestions || searchRes.suggestions.length === 0) return null;

    const first = searchRes.suggestions[0];
    const details = await this.getDetails(first.providerId);
    const item = details.details || first;

    return {
      rawText: addressOrPlaceId,
      formattedAddress: item.formattedAddress,
      neighborhood: item.neighborhood,
      city: item.city,
      state: item.state,
      country: item.country,
      lat: item.lat,
      lng: item.lng,
      placeId: item.providerId,
      types: item.types,
    };
  }
}
