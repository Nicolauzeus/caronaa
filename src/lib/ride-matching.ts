export const TIME_TOLERANCE_OPTIONS = [5, 15, 30, 60] as const;
export type TimeToleranceMinutes = (typeof TIME_TOLERANCE_OPTIONS)[number];
export const DEFAULT_TIME_TOLERANCE_MINUTES: TimeToleranceMinutes = 15;
export const DEFAULT_GEOGRAPHIC_TOLERANCE_KM = 2;

type Coordinate = {
  lat?: number | null;
  lng?: number | null;
};

export type RideCompatibilityInput = {
  request: {
    origin: string;
    destination: string;
    originCoordinate?: Coordinate;
    destinationCoordinate?: Coordinate;
    rideDate: string;
    departureTime: string;
    passengerCount: number;
    userId: string;
    timeToleranceMinutes?: number;
  };
  offer: {
    origin: string;
    destination: string;
    originCoordinate?: Coordinate;
    destinationCoordinate?: Coordinate;
    rideDate: string;
    departureTime: string;
    availableSeats: number;
    seatsRemaining: number;
    userId: string;
    timeToleranceMinutes?: number;
  };
  timeToleranceMinutes?: number;
};

const normalizeLocation = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

function isValidCoordinate(coord: Coordinate | undefined): coord is { lat: number; lng: number } {
  return (
    typeof coord?.lat === "number" &&
    Number.isFinite(coord.lat) &&
    coord.lat >= -90 &&
    coord.lat <= 90 &&
    typeof coord.lng === "number" &&
    Number.isFinite(coord.lng) &&
    coord.lng >= -180 &&
    coord.lng <= 180
  );
}

function toRad(degree: number) {
  return (degree * Math.PI) / 180;
}

export function calculateRideDistanceKm(
  coordA: { lat: number; lng: number },
  coordB: { lat: number; lng: number },
): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(coordB.lat - coordA.lat);
  const dLng = toRad(coordB.lng - coordA.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coordA.lat)) *
      Math.cos(toRad(coordB.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toLocalPoint(
  coord: { lat: number; lng: number },
  reference: { lat: number; lng: number },
): { x: number; y: number } {
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.cos(toRad(reference.lat));
  return {
    x: (coord.lng - reference.lng) * kmPerDegreeLng,
    y: (coord.lat - reference.lat) * kmPerDegreeLat,
  };
}

export function distanceFromPointToSegmentKm(
  point: { lat: number; lng: number },
  segmentStart: { lat: number; lng: number },
  segmentEnd: { lat: number; lng: number },
): number {
  const start = toLocalPoint(segmentStart, segmentStart);
  const end = toLocalPoint(segmentEnd, segmentStart);
  const projectedPoint = toLocalPoint(point, segmentStart);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return calculateRideDistanceKm(point, segmentStart);

  const t = Math.max(
    0,
    Math.min(1, ((projectedPoint.x - start.x) * dx + (projectedPoint.y - start.y) * dy) / lengthSquared),
  );
  const nearest = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return Math.hypot(projectedPoint.x - nearest.x, projectedPoint.y - nearest.y);
}

function isPointCompatibleWithRoute(
  point: { lat: number; lng: number },
  routeStart: { lat: number; lng: number },
  routeEnd: { lat: number; lng: number },
  endpointRadiusKm: number,
  routeRadiusKm: number,
  endpoint: "origin" | "destination",
): boolean {
  const endpointCoordinate = endpoint === "origin" ? routeStart : routeEnd;
  return (
    calculateRideDistanceKm(point, endpointCoordinate) <= endpointRadiusKm ||
    distanceFromPointToSegmentKm(point, routeStart, routeEnd) <= routeRadiusKm
  );
}

export function areRideLocationsCompatible(
  input: RideCompatibilityInput,
  options: {
    originToleranceKm?: number;
    destinationToleranceKm?: number;
    routeToleranceKm?: number;
    allowTextFallback?: boolean;
  } = {},
): boolean {
  const requestOrigin = input.request.originCoordinate;
  const requestDestination = input.request.destinationCoordinate;
  const offerOrigin = input.offer.originCoordinate;
  const offerDestination = input.offer.destinationCoordinate;
  const hasAllCoordinates =
    isValidCoordinate(requestOrigin) &&
    isValidCoordinate(requestDestination) &&
    isValidCoordinate(offerOrigin) &&
    isValidCoordinate(offerDestination);
  const hasAnyCoordinate =
    isValidCoordinate(requestOrigin) ||
    isValidCoordinate(requestDestination) ||
    isValidCoordinate(offerOrigin) ||
    isValidCoordinate(offerDestination);

  if (hasAllCoordinates) {
    const originToleranceKm = options.originToleranceKm ?? DEFAULT_GEOGRAPHIC_TOLERANCE_KM;
    const destinationToleranceKm =
      options.destinationToleranceKm ?? DEFAULT_GEOGRAPHIC_TOLERANCE_KM;
    const routeToleranceKm = options.routeToleranceKm ?? DEFAULT_GEOGRAPHIC_TOLERANCE_KM;
    const driverVector = toLocalPoint(offerDestination, offerOrigin);
    const passengerStart = toLocalPoint(requestOrigin, offerOrigin);
    const passengerEnd = toLocalPoint(requestDestination, offerOrigin);
    const forwardProgress =
      (passengerEnd.x - passengerStart.x) * driverVector.x +
      (passengerEnd.y - passengerStart.y) * driverVector.y;

    return (
      forwardProgress > 0 &&
      calculateRideDistanceKm(requestOrigin, requestDestination) > 0 &&
      calculateRideDistanceKm(offerOrigin, offerDestination) > 0 &&
      isPointCompatibleWithRoute(
        requestOrigin,
        offerOrigin,
        offerDestination,
        originToleranceKm,
        routeToleranceKm,
        "origin",
      ) &&
      isPointCompatibleWithRoute(
        requestDestination,
        offerOrigin,
        offerDestination,
        destinationToleranceKm,
        routeToleranceKm,
        "destination",
      )
    );
  }

  if (hasAnyCoordinate || options.allowTextFallback === false) return false;

  return (
    normalizeLocation(input.request.origin) !== normalizeLocation(input.request.destination) &&
    normalizeLocation(input.offer.origin) === normalizeLocation(input.request.origin) &&
    normalizeLocation(input.offer.destination) === normalizeLocation(input.request.destination)
  );
}

/**
 * Normaliza horário no formato "HH:MM" (ou "HH:MM:SS") para total de minutos desde 00:00 (0 a 1439).
 * Evita comparação puramente textual de horário.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Converte minutos do dia (0 a 1439) de volta para o formato legível "HH:MM".
 */
export function formatMinutesToTime(minutes: number): string {
  const bounded = Math.max(0, Math.min(1439, minutes));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calcula a diferença absoluta em minutos entre dois horários normalizados.
 */
export function timeDifferenceInMinutes(timeA: string, timeB: string): number | null {
  const minA = parseTimeToMinutes(timeA);
  const minB = parseTimeToMinutes(timeB);
  if (minA === null || minB === null) return null;
  return Math.abs(minA - minB);
}

/**
 * Verifica se dois horários estão dentro da janela de tolerância temporal (em minutos).
 */
export function isTimeWithinTolerance(
  timeA: string,
  timeB: string,
  toleranceMinutes: number = DEFAULT_TIME_TOLERANCE_MINUTES,
): boolean {
  const diff = timeDifferenceInMinutes(timeA, timeB);
  if (diff === null) return false;
  return diff <= toleranceMinutes;
}

/** A transparent ordering signal for results that already passed hard compatibility rules. */
export function calculateRideMatchScore(input: RideCompatibilityInput): number {
  let score = 100;
  const origin = input.request.originCoordinate;
  const destination = input.request.destinationCoordinate;
  const offerOrigin = input.offer.originCoordinate;
  const offerDestination = input.offer.destinationCoordinate;
  if (isValidCoordinate(origin) && isValidCoordinate(destination) && isValidCoordinate(offerOrigin) && isValidCoordinate(offerDestination)) {
    const originOffset = Math.min(calculateRideDistanceKm(origin, offerOrigin), distanceFromPointToSegmentKm(origin, offerOrigin, offerDestination));
    const destinationOffset = Math.min(calculateRideDistanceKm(destination, offerDestination), distanceFromPointToSegmentKm(destination, offerOrigin, offerDestination));
    score -= Math.min(30, Math.round((originOffset + destinationOffset) * 7));
  } else score -= 12; // Exact text fallback is useful, but less certain than real coordinates.
  const timeDifference = timeDifferenceInMinutes(input.request.departureTime, input.offer.departureTime) ?? 60;
  score -= Math.min(20, Math.round(timeDifference / 3));
  return Math.max(55, Math.min(100, score));
}

/**
 * Retorna os horários inicial e final correspondentes à janela de tolerância para um dado horário base.
 */
export function getTimeWindowRange(
  baseTime: string,
  toleranceMinutes: number = DEFAULT_TIME_TOLERANCE_MINUTES,
): { start: string; end: string } | null {
  const baseMinutes = parseTimeToMinutes(baseTime);
  if (baseMinutes === null) return null;
  const start = formatMinutesToTime(Math.max(0, baseMinutes - toleranceMinutes));
  const end = formatMinutesToTime(Math.min(1439, baseMinutes + toleranceMinutes));
  return { start, end };
}

/**
 * Regra de compatibilidade do CARONAA:
 * - Mesma rota normalizada (origem e destino compatíveis e distintos entre si)
 * - Mesma data de viagem (requisito separado)
 * - Janela temporal configurável (padrão ±15m; opções ±5m, ±15m, ±30m, ±60m)
 * - Capacidade de vagas suficiente
 * - Usuários distintos
 */
export function isRideRequestCompatibleWithOffer(
  input: RideCompatibilityInput,
  options?: {
    timeToleranceMinutes?: number;
    originToleranceKm?: number;
    destinationToleranceKm?: number;
    routeToleranceKm?: number;
    allowTextFallback?: boolean;
  },
): boolean {
  const tolerance =
    options?.timeToleranceMinutes ??
    input.timeToleranceMinutes ??
    input.request.timeToleranceMinutes ??
    DEFAULT_TIME_TOLERANCE_MINUTES;

  const isTimeCompatible = isTimeWithinTolerance(
    input.request.departureTime,
    input.offer.departureTime,
    tolerance,
  );

  return (
    areRideLocationsCompatible(input, options) &&
    input.request.rideDate.length > 0 &&
    input.offer.rideDate === input.request.rideDate &&
    input.request.departureTime.length > 0 &&
    isTimeCompatible &&
    Number.isInteger(input.request.passengerCount) &&
    Number.isInteger(input.offer.availableSeats) &&
    Number.isInteger(input.offer.seatsRemaining) &&
    input.request.passengerCount >= 1 &&
    input.request.passengerCount <= 6 &&
    input.offer.availableSeats >= 1 &&
    input.offer.availableSeats <= 6 &&
    input.offer.seatsRemaining >= input.request.passengerCount &&
    input.offer.seatsRemaining <= input.offer.availableSeats &&
    input.request.userId !== input.offer.userId
  );
}
