import type {
  GeocodingProvider,
  GeocodingResult,
  LocationDetailsResponse,
  LocationSearchResponse,
} from "./types";
import { GooglePlacesProvider } from "./google-places";
import {
  findCatalogLocationById,
  searchCatalogLocations,
} from "./ceara-catalog";
import { normalizeAddress } from "./geo-utils";

/**
 * Provedor baseado no catálogo local e enriquecido com heurísticas de Ceará/Fortaleza.
 * Funciona como fallback autônomo e de alta velocidade mesmo sem internet ou sem chave de API.
 */
export class CatalogGeocodingProvider implements GeocodingProvider {
  readonly name = "Catálogo Ceará (Local)";

  isConfigured(): boolean {
    return true;
  }

  async search(query: string): Promise<LocationSearchResponse> {
    const suggestions = searchCatalogLocations(query);
    return {
      isConfigured: true,
      provider: "catalog",
      suggestions,
    };
  }

  async getDetails(placeId: string): Promise<LocationDetailsResponse> {
    const item = findCatalogLocationById(placeId);
    return {
      isConfigured: true,
      provider: "catalog",
      details: item,
    };
  }

  async geocode(addressOrPlaceId: string): Promise<GeocodingResult | null> {
    const item = findCatalogLocationById(addressOrPlaceId);
    if (item) {
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
        source: "catalog",
        isApproximate: item.isApproximate,
      };
    }

    const matches = searchCatalogLocations(addressOrPlaceId);
    if (matches.length > 0) {
      const first = matches[0];
      return {
        rawText: addressOrPlaceId,
        formattedAddress: first.formattedAddress,
        neighborhood: first.neighborhood,
        city: first.city,
        state: first.state,
        country: first.country,
        lat: first.lat,
        lng: first.lng,
        placeId: first.providerId,
        types: first.types,
        source: "catalog",
        isApproximate: first.isApproximate,
      };
    }

    const norm = normalizeAddress(addressOrPlaceId);
    return {
      rawText: addressOrPlaceId,
      formattedAddress: norm.cleanText,
      neighborhood: norm.neighborhood,
      city: norm.city || "Fortaleza",
      state: norm.state || "CE",
      country: norm.country || "Brasil",
      isApproximate: true,
    };
  }
}

/** Local Ceará catalog plus Google's official online provider and manual entry. */
export class CompositeGeocodingProvider implements GeocodingProvider {
  private primaryProvider: GeocodingProvider;
  private catalogProvider = new CatalogGeocodingProvider();

  constructor(primaryProvider: GeocodingProvider = new GooglePlacesProvider()) {
    this.primaryProvider = primaryProvider;
  }
  get name() {
    return "Google Maps + Catálogo Ceará";
  }
  setPrimaryProvider(provider: GeocodingProvider) {
    this.primaryProvider = provider;
  }
  isConfigured() {
    return true;
  }

  async search(query: string, sessionToken?: string): Promise<LocationSearchResponse> {
    const trimmed = query.trim();
    if (trimmed.length < 2)
      return { isConfigured: true, provider: "catalog", suggestions: [] };
    const catalog = searchCatalogLocations(trimmed);
    // Return official predictions when available; the client already displays
    // local landmarks instantly while this bounded request is in flight.
    if (this.primaryProvider.isConfigured()) {
      try {
        const result = await this.primaryProvider.search(trimmed, sessionToken);
        if (result.suggestions.length > 0) return result;
      } catch {
        /* Local/manual fallback remains available. */
      }
    }
    if (catalog.length > 0)
      return {
        isConfigured: true,
        provider: "catalog",
        suggestions: catalog.map((item) => ({
          ...item,
          source: "catalog" as const,
        })),
      };
    const norm = normalizeAddress(trimmed);
    return {
      isConfigured: true,
      provider: "none",
      suggestions: [
        {
          source: "manual",
          providerId: "manual_" + Date.now(),
          mainText: trimmed,
          secondaryText: [
            norm.neighborhood,
            norm.city || "Fortaleza",
            norm.state || "CE",
          ]
            .filter(Boolean)
            .join(", "),
          formattedAddress: norm.cleanText,
          neighborhood: norm.neighborhood,
          city: norm.city || "Fortaleza",
          state: norm.state || "CE",
          country: norm.country || "Brasil",
        },
      ],
      warning: "Endereço aproximado informado manualmente.",
    };
  }

  async getDetails(placeId: string, sessionToken?: string): Promise<LocationDetailsResponse> {
    const local = await this.catalogProvider.getDetails(placeId);
    if (local.details) return local;
    if (!placeId.startsWith("manual_") && this.primaryProvider.isConfigured()) {
      try {
        return await this.primaryProvider.getDetails(placeId, sessionToken);
      } catch {
        /* No invented details. */
      }
    }
    return {
      isConfigured: this.primaryProvider.isConfigured(),
      provider: "none",
      details: null,
    };
  }

  async geocode(addressOrPlaceId: string): Promise<GeocodingResult | null> {
    if (findCatalogLocationById(addressOrPlaceId))
      return this.catalogProvider.geocode(addressOrPlaceId);
    if (this.primaryProvider.isConfigured()) {
      try {
        const result = await this.primaryProvider.geocode(addressOrPlaceId);
        if (result) return result;
      } catch {
        /* Approximate manual text is still accepted, without coordinates. */
      }
    }
    return this.catalogProvider.geocode(addressOrPlaceId);
  }
}

/**
 * Instância singleton do adaptador global de geocoding.
 */
let currentGeocodingProvider: GeocodingProvider =
  new CompositeGeocodingProvider();

export function getGeocodingProvider(): GeocodingProvider {
  return currentGeocodingProvider;
}

export function setGeocodingProvider(provider: GeocodingProvider): void {
  currentGeocodingProvider = provider;
}

export const geocodingProvider = currentGeocodingProvider;
