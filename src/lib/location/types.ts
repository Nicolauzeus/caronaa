export interface LocationSuggestion {
  providerId: string;
  mainText: string;
  secondaryText: string;
  formattedAddress: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
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
  lat?: number;
  lng?: number;
  providerId?: string;
}

export interface LocationSearchResponse {
  isConfigured: boolean;
  provider: "google_places" | "none";
  suggestions: LocationSuggestion[];
  warning?: string;
  error?: string;
}

export interface LocationDetailsResponse {
  isConfigured: boolean;
  provider: "google_places" | "none";
  details: LocationSuggestion | null;
  error?: string;
}

export interface LocationProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string): Promise<LocationSearchResponse>;
  getDetails(placeId: string): Promise<LocationDetailsResponse>;
}
