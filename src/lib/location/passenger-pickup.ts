import { isTrustedGpsFix } from "./gps-trust";
import type { UserPosition } from "./use-user-location";

/** A real but approximate fix may preview fares, never silently confirm pickup. */
export function canPreviewPassengerPickup(point?: UserPosition | null): point is UserPosition {
  return !!point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lng) && Math.abs(point.lng) <= 180 &&
    Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 300;
}

export function needsPassengerPickupConfirmation(point?: UserPosition | null): boolean {
  return canPreviewPassengerPickup(point) && !isTrustedGpsFix(point);
}