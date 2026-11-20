import type { FormLocationDetails, GeocodingResult } from "./types";

/**
 * One-night venue shortcut. Never store arbitrary map coordinates for events.
 * Civic geocoding is performed ONLY after the user taps the suggestion.
 */
export const KALUANDA_NIGHT = {
  id: "kaluanda-night",
  name: "Kaluanda Night (PUB vibe)",
  address: "23 R. Edmilson Medeiros",
  municipality: "Redenção",
  state: "CE",
  googleQuery: "Rua Edmilson Medeiros, 23, Redenção, Ceará, Brasil",
  startAt: "2026-11-20T00:00:00-03:00",
  endAt: "2026-11-21T06:00:00-03:00",
} as const;

export function isKaluandaNightActive(now = new Date()): boolean {
  const time = now.getTime();
  return Number.isFinite(time) &&
    time >= Date.parse(KALUANDA_NIGHT.startAt) &&
    time < Date.parse(KALUANDA_NIGHT.endAt);
}

export function kaluandaCaption(now = new Date()): string {
  return now.getTime() < Date.parse("2026-11-21T00:00:00-03:00")
    ? "Festa de hoje · estreia do Caronaa"
    : "Local da estreia do Caronaa";
}

function normalize(value: string | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

/**
 * The street exists in Redenção, but the house number isn't independently
 * verified until Google returns the civic address. No street-centre fallback:
 * that could produce incorrect routes, fares and pickup points.
 */
export function isExactKaluandaAddress(
  result: GeocodingResult | null | undefined,
): result is GeocodingResult & { lat: number; lng: number } {
  if (!result || result.source !== "google" || result.isApproximate === true ||
    !Number.isFinite(result.lat) || !Number.isFinite(result.lng) ||
    Math.abs(result.lat!) > 90 || Math.abs(result.lng!) > 180 ||
    (result.lat === 0 && result.lng === 0)) return false;

  const address = normalize(result.formattedAddress);
  const street = normalize(result.street ?? result.formattedAddress);
  const city = normalize(result.city ?? result.formattedAddress);
  const state = normalize(result.state ?? result.formattedAddress);
  const country = normalize(result.country);

  const streetMatches = street.includes("edmilson medeiros");
  const cityMatches = city.includes("redencao");
  const stateMatches = /(^|[\s,-])(ce|ceara)([\s,-]|$)/.test(state);
  const countryMatches = !country || country === "br" || country === "brasil";
  const numberMatches = result.streetNumber
    ? result.streetNumber.trim() === "23"
    : /\b23\b/.test(address);

  return streetMatches && cityMatches && stateMatches &&
    countryMatches && numberMatches;
}

export function makeKaluandaLocation(
  location: GeocodingResult & { lat: number; lng: number },
): { label: string; details: FormLocationDetails } {
  const label = KALUANDA_NIGHT.name + " · " + KALUANDA_NIGHT.address;
  return {
    label,
    details: {
      rawText: label,
      formattedAddress: location.formattedAddress,
      city: location.city ?? KALUANDA_NIGHT.municipality,
      state: location.state ?? KALUANDA_NIGHT.state,
      country: location.country,
      postalCode: location.postalCode,
      neighborhood: location.neighborhood,
      street: location.street,
      streetNumber: location.streetNumber,
      providerId: location.placeId,
      placeId: location.placeId,
      lat: location.lat,
      lng: location.lng,
      source: "google",
      isApproximate: false,
    },
  };
}
