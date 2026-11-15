import { getGoogleServerKey } from "./google-server-key";
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
  return getGoogleServerKey() ? [] : ["GOOGLE_MAPS_API_KEY"];
}

export async function searchLocationsService(
  query: string,
  sessionToken?: string,
): Promise<LocationSearchResponse> {
  return getGeocodingProvider().search(query, sessionToken);
}

export async function getLocationDetailsService(
  placeId: string,
  sessionToken?: string,
): Promise<LocationDetailsResponse> {
  return getGeocodingProvider().getDetails(placeId, sessionToken);
}

export async function geocodeAddressService(
  address: string,
  request?: typeof fetch,
): Promise<GeocodingResult | null> {
  if (request) {
    const { CompositeGeocodingProvider } = await import("./geocoding-adapter");
    return new CompositeGeocodingProvider(new GooglePlacesProvider(request)).geocode(address);
  }
  return getGeocodingProvider().geocode(address);
}

const reverseProvider = new GooglePlacesProvider();
export async function reverseGeocodeService(lat: number, lng: number) {
  return reverseProvider.reverse(lat, lng);
}
