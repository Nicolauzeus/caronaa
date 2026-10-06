import type { GeocodingProvider, GeocodingResult, NormalizedAddress } from "./types";
import { searchCatalogLocations } from "./ceara-catalog";

/**
 * Normaliza um endereço ou termo de busca, higienizando e identificando componentes
 * como bairro, cidade, estado e pontos de referência.
 */
export function normalizeAddress(rawAddress: string): NormalizedAddress {
  if (!rawAddress || typeof rawAddress !== "string") {
    return { cleanText: "" };
  }

  const cleanText = rawAddress
    .trim()
    .replace(/\s+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "");

  const lower = cleanText.toLowerCase();

  // Detecção de marcos conhecidos de Fortaleza/Ceará
  let landmark: string | undefined;
  if (lower.includes("unifor") || lower.includes("universidade de fortaleza")) {
    landmark = "Universidade de Fortaleza (UNIFOR)";
  } else if (lower.includes("centro de eventos")) {
    landmark = "Centro de Eventos do Ceará";
  } else if (lower.includes("washington soares")) {
    landmark = "Av. Washington Soares";
  }

  // Detecção de cidades da Região Metropolitana
  let city: string | undefined;
  if (lower.includes("maracanau") || lower.includes("maracanaú")) {
    city = "Maracanaú";
  } else if (lower.includes("caucaia")) {
    city = "Caucaia";
  } else if (lower.includes("eusebio") || lower.includes("eusébio")) {
    city = "Eusébio";
  } else if (lower.includes("aquiraz")) {
    city = "Aquiraz";
  } else if (lower.includes("fortaleza")) {
    city = "Fortaleza";
  }

  // Estado (padrão Ceará para o contexto da plataforma)
  let state: string | undefined = "CE";
  if (lower.includes("ceara") || lower.includes("ceará") || lower.includes("- ce")) {
    state = "CE";
  }

  // Detecção de bairros comuns
  let neighborhood: string | undefined;
  const bairrosConhecidos = [
    "aldeota",
    "meireles",
    "edson queiroz",
    "parangaba",
    "benfica",
    "papicu",
    "messejana",
    "centro",
    "pajucara",
    "pajuçara",
    "coco",
    "cocó",
    "dionisio torres",
    "dionísio torres",
    "montese",
    "fatima",
    "fátima",
  ];

  for (const b of bairrosConhecidos) {
    if (lower.includes(b)) {
      if (b === "pajucara" || b === "pajuçara") neighborhood = "Pajuçara";
      else if (b === "edson queiroz") neighborhood = "Edson Queiroz";
      else if (b === "dionisio torres" || b === "dionísio torres") neighborhood = "Dionísio Torres";
      else neighborhood = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // Se não foi identificada cidade mas o bairro pertence a Maracanaú
  if (neighborhood === "Pajuçara" && !city) {
    city = "Maracanaú";
  } else if (!city && (neighborhood || landmark)) {
    city = "Fortaleza";
  }

  // Extração de número de endereço caso informado (ex: "Av. Santos Dumont, 1234")
  const numberMatch = cleanText.match(/(?:,\s*|n[ºo]\s*|numero\s*)(\d+)/i);
  const number = numberMatch ? numberMatch[1] : undefined;

  return {
    cleanText,
    neighborhood,
    city,
    state,
    country: "Brasil",
    landmark,
    number,
  };
}

/**
 * Calcula a distância geodésica em quilômetros entre duas coordenadas (Fórmula de Haversine).
 */
export function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number },
): number {
  if (
    typeof coord1?.lat !== "number" ||
    typeof coord1?.lng !== "number" ||
    typeof coord2?.lat !== "number" ||
    typeof coord2?.lng !== "number"
  ) {
    return 0;
  }

  if (coord1.lat === coord2.lat && coord1.lng === coord2.lng) {
    return 0;
  }

  const R = 6371; // Raio da Terra em km
  const toRad = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Arredonda para 2 casas decimais
  return Math.round(distance * 100) / 100;
}

/**
 * Verifica se um ponto geográfico está dentro de um raio de tolerância (em km) de outro ponto.
 */
export function isWithinRadius(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number },
  radiusKm: number,
): boolean {
  if (radiusKm <= 0) return false;
  return calculateDistance(coord1, coord2) <= radiusKm;
}

/**
 * Formata um local para apresentação ao usuário, respeitando a privacidade
 * e ocultando endereços residenciais exatos na interface pública.
 */
export function formatLocation(
  location: Partial<GeocodingResult & { landmark?: string; mainText?: string }>,
  options: { privacyMode?: "approximate" | "exact" } = { privacyMode: "approximate" },
): string {
  const { privacyMode = "approximate" } = options;

  const city = location.city || "Fortaleza";
  const state = location.state || "CE";

  if (privacyMode === "approximate") {
    // Se há um marco ou local público de destaque (ex: Universidade de Fortaleza, Centro de Eventos)
    if (location.landmark) {
      return `${location.landmark} — ${city}, ${state}`;
    }
    if (location.mainText && !/\d+/.test(location.mainText)) {
      return `${location.mainText} — ${city}, ${state}`;
    }

    // Modo de privacidade: não expõe número ou residência específica
    if (location.neighborhood) {
      return `${location.neighborhood} — ${city}, ${state}`;
    }

    // Se temos formattedAddress ou rawText (ex.: Rodovia CE-040), exibe o nome da via / local higienizado
    if (location.formattedAddress || location.rawText) {
      const label = location.formattedAddress || location.rawText || "";
      const sanitized = label.replace(/,\s*\d+.*$/i, "").trim();
      return `${sanitized} — ${city}, ${state}`;
    }

    if (location.city && location.city !== "Fortaleza") {
      return `${location.city}, ${state}`;
    }

    return `${city}, ${state}`;
  }

  // Modo exato (para uso interno ou conferência privativa pelo próprio usuário)
  return location.formattedAddress || location.rawText || `${city}, ${state}`;
}

/**
 * Converte um endereço textual ou identificador de lugar em um GeocodingResult estruturado.
 */
export async function geocodeAddress(
  address: string,
  provider?: GeocodingProvider,
): Promise<GeocodingResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // 1. Se um provedor externo foi injetado e está configurado, tenta usá-lo
  if (provider && provider.isConfigured()) {
    try {
      const res = await provider.geocode(trimmed);
      if (res) return res;
    } catch {
      // Falha graciosa do provedor: segue para catalog/normalizer
    }
  }

  // 2. Busca no catálogo integrado de Ceará/Fortaleza
  const catalogMatches = searchCatalogLocations(trimmed);
  if (catalogMatches.length > 0) {
    const top = catalogMatches[0];
    return {
      rawText: trimmed,
      formattedAddress: top.formattedAddress,
      neighborhood: top.neighborhood,
      city: top.city,
      state: top.state,
      country: top.country,
      lat: top.lat,
      lng: top.lng,
      placeId: top.providerId,
      types: top.types,
      isApproximate: false,
    };
  }

  // 3. Fallback manual estruturado via normalização
  const normalized = normalizeAddress(trimmed);
  return {
    rawText: trimmed,
    formattedAddress: normalized.cleanText,
    neighborhood: normalized.neighborhood,
    city: normalized.city || "Fortaleza",
    state: normalized.state || "CE",
    country: normalized.country || "Brasil",
    isApproximate: true,
  };
}
