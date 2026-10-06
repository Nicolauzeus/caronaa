import type {
  LocationDetailsResponse,
  LocationProvider,
  LocationSearchResponse,
  LocationSuggestion,
} from "./types";

interface PhotonFeature {
  type: string;
  properties: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    type?: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

interface NominatimResult {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

// Centro e Bounding Box do Ceará
const CEARA_LAT = -3.7319;
const CEARA_LON = -38.5267;
const CEARA_BOUNDS = {
  minLat: -7.9,
  maxLat: -2.7,
  minLng: -41.5,
  maxLng: -37.0,
};

function isWithinCeara(lat?: number, lng?: number, state?: string): boolean {
  if (state && (state.toLowerCase().includes("cear") || state.toUpperCase() === "CE")) {
    return true;
  }
  if (typeof lat === "number" && typeof lng === "number") {
    return (
      lat >= CEARA_BOUNDS.minLat &&
      lat <= CEARA_BOUNDS.maxLat &&
      lng >= CEARA_BOUNDS.minLng &&
      lng <= CEARA_BOUNDS.maxLng
    );
  }
  return false;
}

export class CearaOnlineProvider implements LocationProvider {
  readonly name = "Ceará Geocoding Engine";
  private cache = new Map<string, LocationSuggestion>();

  isConfigured(): boolean {
    return true;
  }

  async search(query: string): Promise<LocationSearchResponse> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return {
        isConfigured: true,
        provider: "ceara_engine",
        suggestions: [],
      };
    }

    try {
      // 1. Tenta Photon com viés geográfico centrado em Fortaleza / Ceará
      const photonUrl = new URL("https://photon.komoot.io/api/");
      photonUrl.searchParams.set("q", trimmed);
      photonUrl.searchParams.set("lat", String(CEARA_LAT));
      photonUrl.searchParams.set("lon", String(CEARA_LON));
      photonUrl.searchParams.set("limit", "15");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const resp = await fetch(photonUrl.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = (await resp.json()) as { features?: PhotonFeature[] };
        const features = data.features || [];

        const suggestions: LocationSuggestion[] = [];
        const nonCeara: LocationSuggestion[] = [];

        for (const feat of features) {
          const [lng, lat] = feat.geometry?.coordinates || [0, 0];
          const props = feat.properties || {};

          const mainText =
            props.name || [props.street, props.housenumber].filter(Boolean).join(", ") || trimmed;
          const neighborhood = props.district || props.locality;
          const city = props.city || "Fortaleza";
          const state =
            props.state?.toLowerCase().includes("cear") || !props.state ? "CE" : props.state;

          const secondaryParts = [neighborhood, `${city} - ${state}`].filter(Boolean);
          const secondaryText = secondaryParts.join(", ");

          const addressParts = [
            props.name,
            props.street && props.street !== props.name ? props.street : null,
            props.housenumber,
            neighborhood,
            `${city} - ${state}`,
          ].filter(Boolean);

          const formattedAddress = addressParts.join(", ");
          const id = `ce_${props.osm_type || "w"}_${props.osm_id || Math.random().toString(36).slice(2)}`;

          const sug: LocationSuggestion = {
            providerId: id,
            mainText,
            secondaryText,
            formattedAddress,
            neighborhood,
            city,
            state,
            country: props.country || "Brasil",
            lat,
            lng,
          };

          this.cache.set(id, sug);

          if (isWithinCeara(lat, lng, props.state)) {
            suggestions.push(sug);
          } else {
            nonCeara.push(sug);
          }
        }

        // Se houver resultados do Ceará, prioriza-os totalmente
        const finalResults =
          suggestions.length > 0 ? [...suggestions, ...nonCeara.slice(0, 3)] : nonCeara;

        if (finalResults.length > 0) {
          return {
            isConfigured: true,
            provider: "ceara_engine",
            suggestions: finalResults,
          };
        }
      }
    } catch {
      // Fallback para Nominatim abaixo
    }

    // 2. Fallback Nominatim (OpenStreetMap) com viewbox do Ceará
    try {
      const nomUrl = new URL("https://nominatim.openstreetmap.org/search");
      nomUrl.searchParams.set("format", "json");
      nomUrl.searchParams.set("addressdetails", "1");
      nomUrl.searchParams.set("q", `${trimmed}, Ceará, Brasil`);
      nomUrl.searchParams.set("viewbox", "-41.5,-2.7,-37.0,-7.9");
      nomUrl.searchParams.set("bounded", "0");
      nomUrl.searchParams.set("limit", "10");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(nomUrl.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "CARONAA-MVP/1.0 (contato@caronaa.com.br)",
        },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const items = (await resp.json()) as NominatimResult[];
        const suggestions: LocationSuggestion[] = items.map((item) => {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          const addr = item.address || {};

          const neighborhood = addr.neighbourhood || addr.suburb;
          const city = addr.city || addr.town || addr.municipality || "Fortaleza";
          const state = "CE";

          const mainText = addr.road || item.display_name.split(",")[0].trim();
          const secondaryText = [neighborhood, `${city} - ${state}`].filter(Boolean).join(", ");
          const id = `nom_${item.place_id}`;

          const sug: LocationSuggestion = {
            providerId: id,
            mainText,
            secondaryText,
            formattedAddress: item.display_name,
            neighborhood,
            city,
            state,
            country: "Brasil",
            lat,
            lng,
          };

          this.cache.set(id, sug);
          return sug;
        });

        if (suggestions.length > 0) {
          return {
            isConfigured: true,
            provider: "ceara_engine",
            suggestions,
          };
        }
      }
    } catch {
      // Retorna vazio graciosamente
    }

    return {
      isConfigured: true,
      provider: "ceara_engine",
      suggestions: [],
    };
  }

  async getDetails(placeId: string): Promise<LocationDetailsResponse> {
    const cached = this.cache.get(placeId);
    if (cached) {
      return {
        isConfigured: true,
        provider: "ceara_engine",
        details: cached,
      };
    }

    return {
      isConfigured: true,
      provider: "ceara_engine",
      details: null,
    };
  }
}
