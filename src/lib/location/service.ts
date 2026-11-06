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
): Promise<LocationSearchResponse> {
  return getGeocodingProvider().search(query);
}

export async function getLocationDetailsService(
  placeId: string,
): Promise<LocationDetailsResponse> {
  return getGeocodingProvider().getDetails(placeId);
}

export async function geocodeAddressService(
  address: string,
): Promise<GeocodingResult | null> {
  return getGeocodingProvider().geocode(address);
}

const reverseProvider = new GooglePlacesProvider();
export async function reverseGeocodeService(lat: number, lng: number) {
  return reverseProvider.reverse(lat, lng);
}
