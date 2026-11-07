import type { RoadPoint } from "./road-routing";
export type ProjectedPoint = {
  point: RoadPoint;
  distanceMeters: number;
  segment: number;
  fraction: number;
};
const R = 6371000,
  rad = Math.PI / 180;
export function validCoordinate(p: RoadPoint): boolean {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lng) <= 180
  );
}
export function metersBetween(a: RoadPoint, b: RoadPoint) {
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) * rad) / 2),
    y = (b.lat - a.lat) * rad;
  return R * Math.hypot(x, y);
}
/** Local tangent-plane projection, without SDK calls, Turf dependency or GPS writes. */
export function projectOntoRoute(passenger: RoadPoint, route: RoadPoint[]): ProjectedPoint {
  if (
    !validCoordinate(passenger) ||
    route.length < 2 ||
    route.length > 30000 ||
    route.some((p) => !validCoordinate(p))
  )
    throw new Error("Trajeto inválido para projetar o embarque.");
  let best: ProjectedPoint | null = null;
  const cos = Math.max(0.00001, Math.cos(passenger.lat * rad));
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i],
      b = route[i + 1];
    const ax = (a.lng - passenger.lng) * rad * R * cos,
      ay = (a.lat - passenger.lat) * rad * R;
    const dx = (b.lng - a.lng) * rad * R * cos,
      dy = (b.lat - a.lat) * rad * R;
    const squared = dx * dx + dy * dy;
    const t = squared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squared));
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || distance < best.distanceMeters)
      best = {
        point: {
          lat: a.lat + (b.lat - a.lat) * t,
          lng: a.lng + (b.lng - a.lng) * t,
        },
        distanceMeters: distance,
        segment: i,
        fraction: t,
      };
  }
  return best!;
}
export type NearbyReference = { id: string; title: string; point: RoadPoint };
export function chooseStrictPickup(
  projection: RoadPoint,
  route: RoadPoint[],
  places: NearbyReference[],
) {
  // A POI is a reference only. Always keep the actual pickup on the driver's line.
  for (const place of places) {
    if (!validCoordinate(place.point) || metersBetween(projection, place.point) > 400) continue;
    const onRoad = projectOntoRoute(place.point, route);
    if (onRoad.distanceMeters > 50 || metersBetween(projection, onRoad.point) > 400) continue;
    return {
      point: onRoad.point,
      label: "Na rota, próximo a " + place.title,
      source: "PLACE_REFERENCE" as const,
      placeId: place.id,
      needsConfirmation: true as const,
    };
  }
  return {
    point: projection,
    label: "Referência na via principal",
    source: "ROUTE_REFERENCE" as const,
    placeId: null,
    needsConfirmation: true as const,
  };
}

/** A road code in the offer's saved address is a reference, not a safety certificate. */
export function hasHighwayReference(...labels: Array<string | null | undefined>): boolean {
  return labels.some((label) => /\b(?:BR|CE)[\s-]?\d{3}\b/i.test(label ?? ""));
}

export type StrictPickupPreview = {
  passenger: RoadPoint;
  route: RoadPoint[];
  pickup: ReturnType<typeof chooseStrictPickup>;
  walk: { distanceKm: number; durationMinutes: number; routePath: RoadPoint[] } | null;
  strict: boolean;
  highway: boolean;
};
