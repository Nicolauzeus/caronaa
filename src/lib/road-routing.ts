export type RoadPoint = { lat: number; lng: number };
export type DrivingRoute = {
  distanceKm: number;
  durationMinutes: number;
  routePath: RoadPoint[];
  legs: Array<{ distanceKm: number; durationMinutes: number }>;
};

export function validateRoutePoints(points: RoadPoint[]) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 16) {
    throw new Error("Informe de 2 a 16 pontos para calcular o percurso.");
  }
  if (
    points.some(
      (point) =>
        !point ||
        !Number.isFinite(point.lat) ||
        Math.abs(point.lat) > 90 ||
        !Number.isFinite(point.lng) ||
        Math.abs(point.lng) > 180,
    )
  ) {
    throw new Error("Coordenadas inválidas para calcular o percurso.");
  }
}

const validMeters = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
function durationSeconds(value: unknown): number {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?s$/.test(value)) return NaN;
  return Number(value.slice(0, -1));
}

/** Server-only Google Routes request. Errors never fabricate a road distance. */
export async function getDrivingRoute(
  points: RoadPoint[],
  request: typeof fetch = fetch,
): Promise<DrivingRoute> {
  validateRoutePoints(points);
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Google Maps Routes não configurado no servidor.");
  const waypoint = ({ lat, lng }: RoadPoint) => ({
    location: { latLng: { latitude: lat, longitude: lng } },
  });
  const response = await request(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring,routes.legs.distanceMeters,routes.legs.duration",
      },
      body: JSON.stringify({
        origin: waypoint(points[0]),
        destination: waypoint(points[points.length - 1]),
        intermediates: points.slice(1, -1).map(waypoint),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        computeAlternativeRoutes: false,
        polylineEncoding: "GEO_JSON_LINESTRING",
        polylineQuality: "HIGH_QUALITY",
        languageCode: "pt-BR",
      }),
      signal: AbortSignal.timeout(7000),
    },
  );
  if (!response.ok)
    throw new Error(`Serviço de rotas indisponível (HTTP ${response.status}).`);
  const result = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { geoJsonLinestring?: { coordinates?: number[][] } };
      legs?: Array<{ distanceMeters?: number; duration?: string }>;
    }>;
  };
  const route = result.routes?.[0];
  const meters = route?.distanceMeters;
  const seconds = durationSeconds(route?.duration);
  const coordinates = route?.polyline?.geoJsonLinestring?.coordinates;
  if (
    !validMeters(meters) ||
    meters <= 0 ||
    !Number.isFinite(seconds) ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    coordinates.some(
      (c) =>
        !Array.isArray(c) ||
        c.length < 2 ||
        !Number.isFinite(c[0]) ||
        Math.abs(c[0]) > 180 ||
        !Number.isFinite(c[1]) ||
        Math.abs(c[1]) > 90,
    )
  ) {
    throw new Error("Não foi possível calcular a geometria rodoviária.");
  }
  const legs = route?.legs;
  if (
    !Array.isArray(legs) ||
    legs.length !== points.length - 1 ||
    legs.some(
      (leg) =>
        !validMeters(leg.distanceMeters) ||
        !Number.isFinite(durationSeconds(leg.duration)),
    )
  ) {
    throw new Error("O serviço de rotas retornou etapas incompletas.");
  }
  return {
    distanceKm: meters / 1000,
    durationMinutes: seconds / 60,
    routePath: coordinates.map(([lng, lat]) => ({ lat, lng })),
    legs: legs.map((leg) => ({
      distanceKm: leg.distanceMeters! / 1000,
      durationMinutes: durationSeconds(leg.duration) / 60,
    })),
  };
}

export function getMultiStopRoute(
  points: RoadPoint[],
  request: typeof fetch = fetch,
) {
  return getDrivingRoute(points, request);
}

export async function getDrivingDistanceKm(
  origin: RoadPoint,
  destination: RoadPoint,
  request: typeof fetch = fetch,
) {
  return (await getDrivingRoute([origin, destination], request)).distanceKm;
}
