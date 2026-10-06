import { GooglePlacesProvider } from "./google-places";
import type {
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
  if (typeof process !== "undefined" && process.env) {
    if (!process.env.GOOGLE_PLACES_API_KEY && !process.env.GOOGLE_MAPS_API_KEY) {
      missing.push("GOOGLE_PLACES_API_KEY");
    }
  } else {
    missing.push("GOOGLE_PLACES_API_KEY");
  }
  return missing;
}

export async function searchLocationsService(query: string): Promise<LocationSearchResponse> {
  return activeProvider.search(query);
}

export async function getLocationDetailsService(placeId: string): Promise<LocationDetailsResponse> {
  return activeProvider.getDetails(placeId);
}
