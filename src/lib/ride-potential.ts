import { calculatePassengerFare } from "./ride-cost";

export const MIN_LOCATION_UPDATE_INTERVAL_MS = 30_000;
export const MIN_LOCATION_MOVEMENT_KM = 0.25;
export const MAX_LOCATION_ACCURACY_METERS = 200;

export type RoadEstimateLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};

export function calculateFreeSeatPotential(distanceKm: number, freeSeats: number) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error("A distância restante precisa ser válida.");
  }
  if (!Number.isInteger(freeSeats) || freeSeats < 0) {
    throw new Error("A quantidade de vagas livres precisa ser válida.");
  }
  const pricePerPassenger = calculatePassengerFare(distanceKm);
  return {
    distanceKm,
    freeSeats,
    pricePerPassenger,
    potentialTotal: Math.round(pricePerPassenger * freeSeats * 100) / 100,
  };
}

export function shouldRecalculateRoadEstimate(
  previous: RoadEstimateLocation | null,
  current: RoadEstimateLocation,
) {
  if (
    !Number.isFinite(current.latitude) ||
    current.latitude < -90 ||
    current.latitude > 90 ||
    !Number.isFinite(current.longitude) ||
    current.longitude < -180 ||
    current.longitude > 180 ||
    !Number.isFinite(current.accuracy) ||
    current.accuracy < 0 ||
    current.accuracy > MAX_LOCATION_ACCURACY_METERS
  ) {
    return false;
  }
  if (!previous) return true;
  const elapsed = current.capturedAt - previous.capturedAt;
  return (
    elapsed >= MIN_LOCATION_UPDATE_INTERVAL_MS &&
    haversineDistanceKm(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    ) >= MIN_LOCATION_MOVEMENT_KM
  );
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
