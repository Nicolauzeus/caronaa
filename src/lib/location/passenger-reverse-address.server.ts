import { getGoogleServerKey } from "./google-server-key";
import type { FormLocationDetails } from "./types";

type Component = { long_name?: string; short_name?: string; types?: string[] };
type Result = { formatted_address?: string; types?: string[]; address_components?: Component[] };
type Response = { status?: string; results?: Result[] };

/** Passenger pickup address lookup. A geographic address is not a nearby business. */
export async function reversePassengerPickupAddress(
  lat: number,
  lng: number,
  request: typeof fetch = fetch,
): Promise<FormLocationDetails | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const key = getGoogleServerKey();
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", key);
  const response = await request(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const data = await response.json() as Response;
  if (data.status !== "OK") return null;
  // Prefer actual street addresses over plus codes, POIs or administrative names.
  const results = data.results ?? [];
  const result = results.find(item => item.types?.includes("street_address")) ??
    results.find(item => item.types?.includes("premise")) ??
    results.find(item => item.types?.includes("route")) ??
    results.find(item => item.types?.includes("intersection"));
  if (!result?.formatted_address?.trim()) return null;
  const components = result.address_components ?? [];
  const part = (...types: string[]) => {
    for (const type of types) {
      const found = components.find(component => component.types?.includes(type));
      if (found) return found;
    }
    return undefined;
  };
  const formattedAddress = result.formatted_address.trim();
  return {
    rawText: formattedAddress,
    formattedAddress,
    city: part("administrative_area_level_2", "locality")?.long_name,
    state: part("administrative_area_level_1")?.short_name,
    country: part("country")?.short_name,
    neighborhood: part("sublocality_level_1", "neighborhood")?.long_name,
    street: part("route")?.long_name,
    streetNumber: part("street_number")?.long_name,
    postalCode: part("postal_code")?.long_name,
    lat, lng, source: "google", isApproximate: true,
  };
}
