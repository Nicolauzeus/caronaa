import { validPoint, type UserPosition } from "./use-user-location";

export const MAX_TRUSTED_GPS_ACCURACY_M = 80;

/** An accuracy circle is an uncertainty estimate, not proof of the user's position. */
export function isTrustedGpsFix(point?: UserPosition | null): point is UserPosition {
  return validPoint(point) &&
    Number.isFinite(point.accuracy) &&
    point.accuracy >= 0 &&
    point.accuracy <= MAX_TRUSTED_GPS_ACCURACY_M;
}

/** Decide whether the manually chosen point and a reliable GPS fix overlap. */
export function areNearbyPoints(
  a?: { lat?: number; lng?: number } | null,
  b?: { lat?: number; lng?: number } | null,
  maxDistanceM = 100,
): boolean {
  if (!validPoint(a) || !validPoint(b)) return false;
  const radians = Math.PI / 180;
  const latDistance = (b.lat - a.lat) * radians;
  const lngDistance = (b.lng - a.lng) * radians;
  const centerLat = ((a.lat + b.lat) / 2) * radians;
  const x = lngDistance * Math.cos(centerLat);
  const distanceM = Math.hypot(x, latDistance) * 6_371_000;
  return distanceM <= maxDistanceM;
}
