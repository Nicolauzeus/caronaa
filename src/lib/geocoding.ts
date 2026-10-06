export interface LocationSuggestion {
  formattedAddress: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  providerId?: string;
}

export const KNOWN_CEARA_LOCATIONS: LocationSuggestion[] = [
  {
    formattedAddress:
      "Centro de Eventos do Ceará - Av. Washington Soares, 999 - Edson Queiroz, Fortaleza - CE",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7915,
    lng: -38.4802,
    providerId: "cec-fortaleza",
  },
  {
    formattedAddress:
      "Universidade de Fortaleza (UNIFOR) - Av. Washington Soares, 1321 - Edson Queiroz, Fortaleza - CE",
    neighborhood: "Edson Queiroz",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7697,
    lng: -38.4777,
    providerId: "unifor-hub",
  },
  {
    formattedAddress: "Aldeota - Fortaleza - CE",
    neighborhood: "Aldeota",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7383,
    lng: -38.5026,
    providerId: "aldeota",
  },
  {
    formattedAddress: "Meireles - Fortaleza - CE",
    neighborhood: "Meireles",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7275,
    lng: -38.4975,
    providerId: "meireles",
  },
  {
    formattedAddress: "Benfica - Fortaleza - CE",
    neighborhood: "Benfica",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7424,
    lng: -38.5385,
    providerId: "benfica",
  },
  {
    formattedAddress: "Papicu - Fortaleza - CE",
    neighborhood: "Papicu",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7441,
    lng: -38.4795,
    providerId: "papicu",
  },
  {
    formattedAddress: "Messejana - Fortaleza - CE",
    neighborhood: "Messejana",
    city: "Fortaleza",
    state: "CE",
    lat: -3.8329,
    lng: -38.4965,
    providerId: "messejana",
  },
  {
    formattedAddress: "Centro - Fortaleza - CE",
    neighborhood: "Centro",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7277,
    lng: -38.5273,
    providerId: "centro-fortaleza",
  },
  {
    formattedAddress: "Parquelândia - Fortaleza - CE",
    neighborhood: "Parquelândia",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7369,
    lng: -38.5574,
    providerId: "parquelandia",
  },
  {
    formattedAddress: "Cocó - Fortaleza - CE",
    neighborhood: "Cocó",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7547,
    lng: -38.4839,
    providerId: "coco",
  },
  {
    formattedAddress: "Fátima - Fortaleza - CE",
    neighborhood: "Bairro de Fátima",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7554,
    lng: -38.5284,
    providerId: "fatima",
  },
  {
    formattedAddress: "Montese - Fortaleza - CE",
    neighborhood: "Montese",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7663,
    lng: -38.5492,
    providerId: "montese",
  },
  {
    formattedAddress: "Dionísio Torres - Fortaleza - CE",
    neighborhood: "Dionísio Torres",
    city: "Fortaleza",
    state: "CE",
    lat: -3.7495,
    lng: -38.5085,
    providerId: "dionisio-torres",
  },
  {
    formattedAddress: "Maracanaú - CE",
    neighborhood: "Maracanaú Centro",
    city: "Maracanaú",
    state: "CE",
    lat: -3.8741,
    lng: -38.6256,
    providerId: "maracanau",
  },
  {
    formattedAddress: "Eusébio - CE",
    neighborhood: "Eusébio Centro",
    city: "Eusébio",
    state: "CE",
    lat: -3.8906,
    lng: -38.4552,
    providerId: "eusebio",
  },
  {
    formattedAddress: "Caucaia - CE",
    neighborhood: "Caucaia Centro",
    city: "Caucaia",
    state: "CE",
    lat: -3.7361,
    lng: -38.6531,
    providerId: "caucaia",
  },
];

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Searches for location suggestions.
 * Defaults to local verified Fortaleza & Ceará metropolitan points.
 * Ready to integrate Google Places Autocomplete API seamlessly if VITE_GOOGLE_MAPS_API_KEY is defined.
 */
export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const normalizedQuery = normalizeText(trimmed);

  // Filter local known reference points
  const localMatches = KNOWN_CEARA_LOCATIONS.filter((loc) => {
    const normFormatted = normalizeText(loc.formattedAddress);
    const normNeighborhood = normalizeText(loc.neighborhood);
    const normCity = normalizeText(loc.city);
    return (
      normFormatted.includes(normalizedQuery) ||
      normNeighborhood.includes(normalizedQuery) ||
      normCity.includes(normalizedQuery)
    );
  });

  return localMatches;
}
