import { getGoogleServerKey } from "./google-server-key";
import type {
  FormLocationDetails,
  GeocodingResult,
  LocationDetailsResponse,
  LocationProvider,
  LocationSearchResponse,
  LocationSuggestion,
} from "./types";

const API = "https://places.googleapis.com/v1/places";
// A transient quota failure must not initiate paid reverse lookups on every GPS pulse.
let reverseQuotaCooldownUntil = 0;

const PLACE_FIELDS =
  "id,formattedAddress,location,addressComponents"; // Place Details Essentials (no Pro displayName)
const CEARA_BIAS = {
  circle: {
    center: { latitude: -3.7319, longitude: -38.5267 },
    radius: 50000.0,
  },
};
export interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}
interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: GoogleAddressComponent[];
}

export function parseAddressComponents(
  components: GoogleAddressComponent[] = [],
) {
  const byType = (...types: string[]) => {
    for (const type of types) {
      const item = components.find((c) => c.types?.includes(type));
      if (item) return item;
    }
    return undefined;
  };
  const state = byType("administrative_area_level_1"),
    country = byType("country");
  return {
    neighborhood: byType("sublocality_level_1", "neighborhood", "sublocality")
      ?.longText,
    city: byType("administrative_area_level_2", "locality")?.longText,
    state: state?.shortText || state?.longText,
    country: country?.shortText || country?.longText,
    postalCode: byType("postal_code")?.longText,
    street: byType("route")?.longText,
    streetNumber: byType("street_number")?.longText,
  };
}

// Prediction text is presentation only. Geographic components come from Details.
export function parseSecondaryText(text?: string) {
  const match = text?.match(/(?:^|,\s*)([^,]+?)\s*[-–]\s*([A-Z]{2})(?:,|$)/);
  if (!match) return {};
  const beforeCity = text!.slice(0, match.index).replace(/,\s*$/, "").trim();
  return {
    city: match[1].trim(),
    state: match[2],
    neighborhood: beforeCity || undefined,
  };
}

function mapPlace(place: GooglePlace): LocationSuggestion | null {
  const lat = place.location?.latitude,
    lng = place.location?.longitude;
  if (
    !place.id ||
    !Number.isFinite(lat) ||
    Math.abs(lat!) > 90 ||
    !Number.isFinite(lng) ||
    Math.abs(lng!) > 180
  )
    return null;
  const address = parseAddressComponents(place.addressComponents);
  const mainText =
    place.displayName?.text || place.formattedAddress || "Localização";
  const street = [address.street, address.streetNumber]
    .filter(Boolean)
    .join(", ");
  const cityState = [address.city, address.state].filter(Boolean).join(" - ");
  return {
    providerId: place.id,
    mainText,
    formattedAddress: place.formattedAddress || mainText,
    secondaryText: [street, address.neighborhood, cityState]
      .filter(Boolean)
      .join(", "),
    ...address,
    lat,
    lng,
    source: "google",
  };
}

function geocodingResult(
  rawText: string,
  item: LocationSuggestion,
): GeocodingResult {
  return {
    rawText,
    formattedAddress: item.formattedAddress,
    neighborhood: item.neighborhood,
    city: item.city,
    state: item.state,
    country: item.country,
    postalCode: item.postalCode,
    street: item.street,
    streetNumber: item.streetNumber,
    lat: item.lat,
    lng: item.lng,
    placeId: item.providerId,
    source: "google",
    isApproximate: false,
  };
}

async function requestGoogle(
  url: string,
  key: string,
  fieldMask?: string,
  body?: unknown,
  request: typeof fetch = fetch,
): Promise<any> {
  const response = await request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
      ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  // Never forward Google's raw errors, URLs or credential data to the UI/logs.
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "Google Maps recusou a credencial do servidor. Verifique as APIs e as restrições da chave."
        : `Google Maps indisponível (HTTP ${response.status}).`,
    );
  const result = await response.json();
  if (!result || typeof result !== "object" || result.error)
    throw new Error("Resposta do Google Maps indisponível.");
  return result;
}

export class GooglePlacesProvider implements LocationProvider {
  constructor(private readonly request: typeof fetch = fetch) {}
  readonly name = "Google Places (New)";
  isConfigured() {
    return Boolean(getGoogleServerKey());
  }

  async search(query: string, sessionToken?: string): Promise<LocationSearchResponse> {
    const key = getGoogleServerKey();
    if (!key)
      return {
        isConfigured: false,
        provider: "google_places",
        suggestions: [],
        warning:
          "Google Maps não configurado no servidor. Digitação manual disponível.",
      };
    if (query.trim().length < 2)
      return { isConfigured: true, provider: "google_places", suggestions: [] };
    try {
      const result = await requestGoogle(
        API + ":autocomplete",
        key,
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
        {
          input: query.trim(),
          includedRegionCodes: ["br"],
          languageCode: "pt-BR",
          locationBias: CEARA_BIAS,
          ...(sessionToken ? { sessionToken } : {}),
        },
        this.request,
      );
      if (
        result.suggestions !== undefined &&
        !Array.isArray(result.suggestions)
      )
        throw new Error("Resposta inválida");
      const suggestions: LocationSuggestion[] = (
        result.suggestions ?? []
      ).flatMap((item: any) => {
        const pred = item?.placePrediction;
        if (typeof pred?.placeId !== "string" || !pred.placeId) return [];
        const mainText =
          pred.structuredFormat?.mainText?.text || pred.text?.text;
        if (typeof mainText !== "string" || !mainText) return [];
        return [
          {
            providerId: pred.placeId,
            mainText,
            secondaryText: pred.structuredFormat?.secondaryText?.text || "",
            formattedAddress: pred.text?.text || mainText,
            source: "google" as const,
          },
        ];
      });
      return { isConfigured: true, provider: "google_places", suggestions };
    } catch {
      return {
        isConfigured: true,
        provider: "google_places",
        suggestions: [],
        error: "Busca Google indisponível. Você pode digitar o endereço.",
      };
    }
  }

  async getDetails(placeId: string, sessionToken?: string): Promise<LocationDetailsResponse> {
    const key = getGoogleServerKey();
    if (!key)
      return { isConfigured: false, provider: "google_places", details: null };
    // Caller supplies an ID, never an arbitrary URL/path.
    if (!/^[A-Za-z0-9_-]{1,250}$/.test(placeId))
      return { isConfigured: true, provider: "google_places", details: null };
    try {
      const result = await requestGoogle(
        API +
          "/" +
          encodeURIComponent(placeId) +
          "?fields=" +
          PLACE_FIELDS +
          "&languageCode=pt-BR" +
          (sessionToken ? "&sessionToken=" + encodeURIComponent(sessionToken) : ""),
        key,
        undefined,
        undefined,
        this.request,
      );
      return {
        isConfigured: true,
        provider: "google_places",
        details: mapPlace(result),
      };
    } catch {
      return {
        isConfigured: true,
        provider: "google_places",
        details: null,
        error:
          "Detalhes Google indisponíveis. Você pode continuar pelo endereço.",
      };
    }
  }

  async geocode(addressOrPlaceId: string): Promise<GeocodingResult | null> {
    const key = getGoogleServerKey(),
      text = addressOrPlaceId.trim();
    if (!key || !text) return null;
    if (
      /^(?:ChIJ|GhIJ)[A-Za-z0-9_-]+$/.test(text) ||
      text.startsWith("places/")
    ) {
      const details = await this.getDetails(text.replace(/^places\//, ""));
      return details.details ? geocodingResult(text, details.details) : null;
    }
    try {
      const result = await requestGoogle(
        API + ":searchText",
        key,
        PLACE_FIELDS.split(",")
          .map((field) => "places." + field)
          .join(","),
        {
          textQuery: text,
          languageCode: "pt-BR",
          regionCode: "BR",
          locationBias: CEARA_BIAS,
          pageSize: 1,
        },
        this.request,
      );
      const item =
        Array.isArray(result.places) && result.places.length
          ? mapPlace(result.places[0])
          : null;
      return item ? geocodingResult(text, item) : null;
    } catch {
      return null;
    }
  }

  async reverse(lat: number, lng: number): Promise<FormLocationDetails | null> {
    if (
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      !Number.isFinite(lng) ||
      Math.abs(lng) > 180
    )
      throw new Error("Coordenadas inválidas.");
    const key = getGoogleServerKey();
    if (!key) return null;
    if (Date.now() < reverseQuotaCooldownUntil)
      throw new Error("Google Maps temporariamente limitado (HTTP 429).");
    try {
      // Nearby Search is a nearby *place* lookup, not a guaranteed civic
      // reverse-geocoder. Never treat an out-of-radius POI as the GPS location.
      const result = await requestGoogle(
        API + ":searchNearby",
        key,
        "places.id,places.formattedAddress,places.addressComponents,places.location",
        {
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: 150.0 },
          },
          rankPreference: "DISTANCE",
          maxResultCount: 1,
          languageCode: "pt-BR",
          regionCode: "BR",
        },
        this.request,
      );
      const first: GooglePlace | undefined = Array.isArray(result.places)
        ? result.places[0] : undefined;
      if (!first?.formattedAddress || !first.location) return null;
      const placeLat=first.location.latitude,placeLng=first.location.longitude;
      if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return null;
      const rad=Math.PI/180;
      const a=Math.sin(((placeLat as number)-lat)*rad/2)**2+
        Math.cos(lat*rad)*Math.cos((placeLat as number)*rad)*
        Math.sin(((placeLng as number)-lng)*rad/2)**2;
      const meters=6371000*2*Math.asin(Math.min(1,Math.sqrt(a)));
      if (meters>150) return null;
      const parts=parseAddressComponents(first.addressComponents);
      // Unrecognizable place boundaries must remain unverified.
      if(!parts.city || !parts.state || !parts.country) return null;
      return {
        rawText: first.formattedAddress,
        formattedAddress: first.formattedAddress,
        ...parts,
        lat,
        lng,
        placeId: first.id,
        source: "google",
        isApproximate: true,
      };
    } catch (error) {
      if(error instanceof Error && /HTTP 429/.test(error.message))
        reverseQuotaCooldownUntil=Date.now()+60_000;
      throw error;
    }
  }
}
