export interface GeocodingResult {
  rawText: string;
  formattedAddress: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  street?: string;
  streetNumber?: string;
  source?: "google" | "catalog" | "manual";
  lat?: number;
  lng?: number;
  placeId?: string;
  types?: string[];
  isApproximate?: boolean;
}

export interface NormalizedAddress {
  cleanText: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  landmark?: string;
  street?: string;
  number?: string;
  postalCode?: string;
}

export interface LocationSuggestion {
  isApproximate?: boolean;
  providerId: string;
  mainText: string;
  secondaryText: string;
  formattedAddress: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  street?: string;
  streetNumber?: string;
  source?: "google" | "catalog" | "manual";
  lat?: number;
  lng?: number;
  types?: string[];
}

export interface FormLocationDetails {
  rawText: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  country?: string;
  postalCode?: string;
  street?: string;
  streetNumber?: string;
  source?: "google" | "catalog" | "manual";
  lat?: number;
  lng?: number;
  providerId?: string;
  placeId?: string;
  isApproximate?: boolean;
}

export interface LocationSearchResponse {
  isConfigured: boolean;
  provider: "google_places" | "catalog" | "none";
  suggestions: LocationSuggestion[];
  warning?: string;
  error?: string;
}

export interface LocationDetailsResponse {
  isConfigured: boolean;
  provider: "google_places" | "catalog" | "none";
  details: LocationSuggestion | null;
  error?: string;
}

export interface GeocodingProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string): Promise<LocationSearchResponse>;
  getDetails(placeId: string): Promise<LocationDetailsResponse>;
  geocode(addressOrPlaceId: string): Promise<GeocodingResult | null>;
}

export type LocationProvider = GeocodingProvider;
