// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import type {
  GeocodingProvider,
  GeocodingResult,
  LocationDetailsResponse,
  LocationSearchResponse,
  LocationSuggestion,
} from "./types";
import { GooglePlacesProvider } from "./google-places";
import { findCatalogLocationById, searchCatalogLocations } from "./ceara-catalog";
import { normalizeAddress } from "./geo-utils";
import { CearaOnlineProvider } from "./ceara-online-provider";

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

/**
 * Adapter Inteligente que orquestra os fornecedores de geocoding:
 * 1. Utiliza Google Places se configurado no servidor;
 * 2. Consulta o motor Ceará Online (Photon / OpenStreetMap) para cobertura total de ruas e comércios no Ceará;
 * 3. Enriquece com o catálogo de alta velocidade local;
 * 4. Mantém fallback manual transparente sem bloquear o formulário.
 */
export class CompositeGeocodingProvider implements GeocodingProvider {
  private primaryProvider: GeocodingProvider;
  private catalogProvider: CatalogGeocodingProvider;
  private cearaOnlineProvider: CearaOnlineProvider;

  constructor(primaryProvider?: GeocodingProvider) {
    this.primaryProvider = primaryProvider || new GooglePlacesProvider();
    this.catalogProvider = new CatalogGeocodingProvider();
    this.cearaOnlineProvider = new CearaOnlineProvider();
  }

  get name(): string {
    return "Ceará Geocoding Engine";
  }

  setPrimaryProvider(provider: GeocodingProvider) {
    this.primaryProvider = provider;
  }

  isConfigured(): boolean {
    return true;
  }

  async search(query: string): Promise<LocationSearchResponse> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return {
        isConfigured: true,
        provider: "ceara_composite",
        suggestions: [],
      };
    }

    // 1. Sempre busca marcos no catálogo local do Ceará (UNIFOR, Centro de Eventos, bairros de Fortaleza)
    const catalogSuggestions = searchCatalogLocations(trimmed);

    // 2. Consulta o motor online do Ceará (Photon/OSM especializado) e o Google Places
    const [cearaRes, googleRes] = await Promise.allSettled([
      this.cearaOnlineProvider.search(trimmed),
      this.primaryProvider.isConfigured()
        ? this.primaryProvider.search(trimmed)
        : Promise.resolve(null),
    ]);

    const cearaSuggestions =
      cearaRes.status === "fulfilled" ? cearaRes.value.suggestions || [] : [];
    const googleSuggestions =
      googleRes.status === "fulfilled" && googleRes.value ? googleRes.value.suggestions || [] : [];

    // 3. Mescla tudo eliminando duplicatas
    const combined: LocationSuggestion[] = [];
    const seen = new Set<string>();

    const addSuggestion = (sug: LocationSuggestion) => {
      const key = (sug.formattedAddress || sug.mainText).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(sug);
      }
    };

    catalogSuggestions.forEach(addSuggestion);
    googleSuggestions.forEach(addSuggestion);
    cearaSuggestions.forEach(addSuggestion);

    if (combined.length > 0) {
      return {
        isConfigured: true,
        provider: "ceara_composite",
        suggestions: combined,
      };
    }

    // 4. Fallback manual estruturado
    const normalized = normalizeAddress(trimmed);
    const manualSuggestion: LocationSuggestion = {
      providerId: `manual_${Date.now()}`,
      mainText: trimmed,
      secondaryText: [
        normalized.neighborhood,
        `${normalized.city || "Fortaleza"} - ${normalized.state || "CE"}`,
      ]
        .filter(Boolean)
        .join(", "),
      formattedAddress: `${trimmed}, ${normalized.city || "Fortaleza"} - ${normalized.state || "CE"}`,
      neighborhood: normalized.neighborhood,
      city: normalized.city || "Fortaleza",
      state: normalized.state || "CE",
      country: normalized.country || "Brasil",
    };

    return {
      isConfigured: true,
      provider: "ceara_composite",
      suggestions: [manualSuggestion],
      warning: "Endereço processado por normalização manual.",
    };
  }

  async getDetails(placeId: string): Promise<LocationDetailsResponse> {
    if (placeId.startsWith("loc_")) {
      return this.catalogProvider.getDetails(placeId);
    }

    if (placeId.startsWith("ce_") || placeId.startsWith("nom_")) {
      return this.cearaOnlineProvider.getDetails(placeId);
    }

    if (this.primaryProvider.isConfigured()) {
      try {
        const details = await this.primaryProvider.getDetails(placeId);
        if (details.details) return details;
      } catch (err) {
        console.warn("[GeocodingAdapter] Falha em getDetails do provedor primário:", err);
      }
    }

    return this.cearaOnlineProvider.getDetails(placeId);
  }

  async geocode(addressOrPlaceId: string): Promise<GeocodingResult | null> {
    // 1. Tenta identificar no catálogo do Ceará
    if (addressOrPlaceId.startsWith("loc_")) {
      const cat = await this.catalogProvider.geocode(addressOrPlaceId);
      if (cat) return cat;
    }

    if (addressOrPlaceId.startsWith("ce_") || addressOrPlaceId.startsWith("nom_")) {
      const details = await this.cearaOnlineProvider.getDetails(addressOrPlaceId);
      if (details.details) {
        return {
          rawText: addressOrPlaceId,
          formattedAddress: details.details.formattedAddress,
          neighborhood: details.details.neighborhood,
          city: details.details.city,
          state: details.details.state,
          country: details.details.country,
          lat: details.details.lat,
          lng: details.details.lng,
          placeId: details.details.providerId,
        };
      }
    }

    const localMatch = searchCatalogLocations(addressOrPlaceId);
    if (localMatch.length > 0) {
      const top = localMatch[0];
      return {
        rawText: addressOrPlaceId,
        formattedAddress: top.formattedAddress,
        neighborhood: top.neighborhood,
        city: top.city,
        state: top.state,
        country: top.country,
        lat: top.lat,
        lng: top.lng,
        placeId: top.providerId,
        types: top.types,
      };
    }

    // 2. Consulta o motor online do Ceará
    try {
      const searchRes = await this.cearaOnlineProvider.search(addressOrPlaceId);
      if (searchRes.suggestions && searchRes.suggestions.length > 0) {
        const top = searchRes.suggestions[0];
        return {
          rawText: addressOrPlaceId,
          formattedAddress: top.formattedAddress,
          neighborhood: top.neighborhood,
          city: top.city,
          state: top.state,
          country: top.country,
          lat: top.lat,
          lng: top.lng,
          placeId: top.providerId,
        };
      }
    } catch {
      // continua para fallback
    }

    // 3. Provedor primário se configurado
    if (this.primaryProvider.isConfigured()) {
      try {
        const res = await this.primaryProvider.geocode(addressOrPlaceId);
        if (res) return res;
      } catch (err) {
        console.warn("[GeocodingAdapter] Falha no geocode do provedor primário:", err);
      }
    }

    // 4. Fallback estruturado via normalização
    return this.catalogProvider.geocode(addressOrPlaceId);
  }
}

/**
 * Instância singleton do adaptador global de geocoding.
 */
let currentGeocodingProvider: GeocodingProvider = new CompositeGeocodingProvider();

export function getGeocodingProvider(): GeocodingProvider {
  return currentGeocodingProvider;
}

export function setGeocodingProvider(provider: GeocodingProvider): void {
  currentGeocodingProvider = provider;
}

export const geocodingProvider = currentGeocodingProvider;
