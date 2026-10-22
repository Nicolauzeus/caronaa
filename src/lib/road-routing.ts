export type RoadPoint = { lat: number; lng: number };
export type DrivingRoute = {
  distanceKm: number;
  durationMinutes: number;
  routePath: RoadPoint[];
  legs: Array<{ distanceKm: number; durationMinutes: number }>;
};

function validateRoutePoints(points: RoadPoint[]) {
  if (points.length < 2 || points.length > 14) {
    throw new Error("Informe de 2 a 14 pontos para calcular o percurso.");
  }
  for (const point of points) {
    if (
      !Number.isFinite(point.lat) ||
      point.lat < -90 ||
      point.lat > 90 ||
      !Number.isFinite(point.lng) ||
      point.lng < -180 ||
      point.lng > 180
    )
      throw new Error("Coordenadas inválidas para calcular o percurso.");
  }
}

/** OSRM public demo router. Route errors never fall back to straight-line distance. */
export async function getDrivingRoute(
  points: RoadPoint[],
  request: typeof fetch = fetch,
): Promise<DrivingRoute> {
  validateRoutePoints(points);
  const coordinates = points.map(({ lat, lng }) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const response = await request(url, {
    headers: { Accept: "application/json", "User-Agent": "CARONAA/1.0 (road route planning)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Serviço de rotas indisponível (HTTP ${response.status}).`);

  const result = (await response.json()) as {
    code?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { type?: string; coordinates?: Array<[number, number]> };
      legs?: Array<{ distance?: number; duration?: number }>;
    }>;
  };
  const route = result.routes?.[0];
  const meters = route?.distance;
  const seconds = route?.duration;
  const coordinatesOut = route?.geometry?.coordinates;
  if (
    result.code !== "Ok" ||
    typeof meters !== "number" ||
    !Number.isFinite(meters) ||
    meters <= 0 ||
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    route?.geometry?.type !== "LineString" ||
    !coordinatesOut ||
    coordinatesOut.length < 2 ||
    coordinatesOut.some(
      (coordinate) =>
        !Array.isArray(coordinate) ||
        coordinate.length !== 2 ||
        !Number.isFinite(coordinate[0]) ||
        !Number.isFinite(coordinate[1]),
    )
  )
    throw new Error("Não foi possível calcular a geometria rodoviária.");

  const legs = route.legs ?? [];
  if (
    legs.length !== points.length - 1 ||
    legs.some(
      (leg) =>
        typeof leg.distance !== "number" ||
        !Number.isFinite(leg.distance) ||
        leg.distance < 0 ||
        typeof leg.duration !== "number" ||
        !Number.isFinite(leg.duration) ||
        leg.duration < 0,
    )
  )
    throw new Error("O serviço de rotas retornou etapas incompletas.");

  return {
    distanceKm: meters / 1000,
    durationMinutes: seconds / 60,
    routePath: coordinatesOut.map(([lng, lat]) => ({ lat, lng })),
    legs: legs.map((leg) => ({
      distanceKm: (leg.distance as number) / 1000,
      durationMinutes: (leg.duration as number) / 60,
    })),
  };
}

/** OSRM route query for a fixed, already ordered stop sequence. */
export function getMultiStopRoute(points: RoadPoint[], request: typeof fetch = fetch) {
  return getDrivingRoute(points, request);
}

export async function getDrivingDistanceKm(
  origin: RoadPoint,
  destination: RoadPoint,
  request: typeof fetch = fetch,
): Promise<number> {
  validateRoutePoints([origin, destination]);
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`;
  const response = await request(url, {
    headers: { Accept: "application/json", "User-Agent": "CARONAA/1.0 (ride fare quote)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Serviço de rotas indisponível (HTTP ${response.status}).`);
  const result = (await response.json()) as {
    code?: string;
    routes?: Array<{ distance?: number }>;
  };
  const meters = result.routes?.[0]?.distance;
  if (
    result.code !== "Ok" ||
    typeof meters !== "number" ||
    !Number.isFinite(meters) ||
    meters <= 0
  ) {
    throw new Error("Não foi possível calcular o percurso rodoviário.");
  }
  return meters / 1000;
}
