import { GooglePlacesProvider } from "./google-places";
import { getGeocodingProvider } from "./geocoding-adapter";
import type {
  GeocodingResult,
  LocationDetailsResponse,
  LocationProvider,
  LocationSearchResponse,
} from "./types";

const activeProvider: LocationProvider = new GooglePlacesProvider();

export function isLocationServiceConfigured(): boolean {
  return activeProvider.isConfigured();
}

export function getLocationProviderName(): string {
  return activeProvider.name;
}

export function getMissingLocationConfig(): string[] {
  const missing: string[] = [];
  const nodeEnv = typeof process !== "undefined" && process.env ? process.env : undefined;
  const globalEnv = globalThis as Record<string, unknown>;
  const viteEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, unknown>)
      : undefined;
  const hasKey = Boolean(
    nodeEnv?.GOOGLE_PLACES_API_KEY ||
    nodeEnv?.GOOGLE_MAPS_API_KEY ||
    nodeEnv?.VITE_GOOGLE_PLACES_API_KEY ||
    nodeEnv?.VITE_GOOGLE_MAPS_API_KEY ||
    globalEnv?.["GOOGLE_PLACES_API_KEY"] ||
    globalEnv?.["GOOGLE_MAPS_API_KEY"] ||
    viteEnv?.["VITE_GOOGLE_PLACES_API_KEY"] ||
    viteEnv?.["VITE_GOOGLE_MAPS_API_KEY"],
  );
  if (!hasKey) {
    missing.push("GOOGLE_PLACES_API_KEY");
  }
  return missing;
}

export async function searchLocationsService(query: string): Promise<LocationSearchResponse> {
  if (process.env.NODE_ENV === "test" && !activeProvider.isConfigured()) {
    return activeProvider.search(query);
  }
  return getGeocodingProvider().search(query);
}

export async function getLocationDetailsService(placeId: string): Promise<LocationDetailsResponse> {
  return getGeocodingProvider().getDetails(placeId);
}

export async function geocodeAddressService(address: string): Promise<GeocodingResult | null> {
  return getGeocodingProvider().geocode(address);
}
