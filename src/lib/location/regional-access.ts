import { reverseGeocodeServerFn } from "@/lib/location.functions";

export const CEARA_ONLY_MESSAGE =
  "A CARONAA está disponível apenas no Ceará neste momento. Em breve estaremos aí com vocês!";

export type RegionalAccessResult =
  | { allowed: true }
  | { allowed: false; reason: "OUTSIDE_CEARA" | "LOCATION_UNAVAILABLE" };

type Position = { latitude: number; longitude: number; accuracy: number };

export function isCearaState(state?: string | null): boolean {
  const normalized = state?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return normalized === "ce" || normalized?.includes("ceara") === true;
}

export async function checkCearaAccess(): Promise<RegionalAccessResult> {
  if (
    typeof window === "undefined" ||
    window.isSecureContext === false ||
    !navigator.geolocation
  ) {
    return { allowed: false, reason: "LOCATION_UNAVAILABLE" };
  }

  try {
    const position = await new Promise<Position>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });

    // Localizações imprecisas não são suficientes para liberar acesso regional.
    if (!Number.isFinite(position.accuracy) || position.accuracy > 20000) {
      return { allowed: false, reason: "LOCATION_UNAVAILABLE" };
    }

    const address = await reverseGeocodeServerFn({
      data: { lat: position.latitude, lng: position.longitude },
    });
    if (!address?.state) return { allowed: false, reason: "LOCATION_UNAVAILABLE" };
    return isCearaState(address.state)
      ? { allowed: true }
      : { allowed: false, reason: "OUTSIDE_CEARA" };
  } catch {
    return { allowed: false, reason: "LOCATION_UNAVAILABLE" };
  }
}

export function regionalAccessMessage(reason: RegionalAccessResult["reason"]): string {
  if (reason === "OUTSIDE_CEARA") return CEARA_ONLY_MESSAGE;
  return `Não foi possível confirmar sua localização. Ative a localização do dispositivo e tente novamente. ${CEARA_ONLY_MESSAGE}`;
}
