export const TIME_TOLERANCE_OPTIONS = [5, 15, 30, 60] as const;
export type TimeToleranceMinutes = (typeof TIME_TOLERANCE_OPTIONS)[number];
export const DEFAULT_TIME_TOLERANCE_MINUTES: TimeToleranceMinutes = 15;
export const DEFAULT_GEOGRAPHIC_TOLERANCE_KM = 2;

export const RIDE_MATCH_SCORE_CONFIG = {
  maximum: 100,
  maximumBase: 94,
  minimum: 0,
  detourPenaltyPerKm: 5.5,
  maximumDetourPenalty: 35,
  pickupPenaltyPerKm: 8,
  maximumPickupPenalty: 20,
  timePenaltyPerMinute: 1 / 3,
  maximumTimePenalty: 20,
  destinationPenaltyPerKm: 5,
  maximumDestinationPenalty: 15,
  missingCoordinatesPenalty: 15,
  maximumPreferenceBonus: 6,
} as const;

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
    /** Polilinha rodoviária opcional do motorista; quando presente, substitui a reta A→F. */
    routePath?: Coordinate[];
    routeDurationMinutes?: number;
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
    Math.min(
      1,
      ((projectedPoint.x - start.x) * dx + (projectedPoint.y - start.y) * dy) / lengthSquared,
    ),
  );
  const nearest = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return Math.hypot(projectedPoint.x - nearest.x, projectedPoint.y - nearest.y);
}

/**
 * Projeta um ponto na polilinha rodoviária do motorista (A → F).
 * Retorna a distância lateral até a rota e o progresso (km desde o início),
 * permitindo aceitar qualquer subtrecho no sentido da viagem.
 */
export function projectOntoRoutePath(
  point: { lat: number; lng: number },
  path: Array<{ lat: number; lng: number }>,
): { distanceKm: number; progressKm: number } {
  let best = { distanceKm: Infinity, progressKm: 0 };
  let travelled = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segmentKm = calculateRideDistanceKm(a, b);
    const end = toLocalPoint(b, a);
    const p = toLocalPoint(point, a);
    const len2 = end.x * end.x + end.y * end.y;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (p.x * end.x + p.y * end.y) / len2));
    const d = Math.hypot(p.x - end.x * t, p.y - end.y * t);
    if (d < best.distanceKm) best = { distanceKm: d, progressKm: travelled + segmentKm * t };
    travelled += segmentKm;
  }
  return best;
}

/** Horário estimado em que o motorista passa pelo ponto de embarque. */
export function estimatePickupTime(
  departureTime: string,
  progressKm: number,
  averageSpeedKmh = 40,
): string | null {
  const start = parseTimeToMinutes(departureTime);
  if (start === null) return null;
  return formatMinutesToTime((start + Math.round((progressKm / averageSpeedKmh) * 60)) % 1440);
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
    const path = (input.offer.routePath ?? []).filter(isValidCoordinate);
    if (path.length >= 2) {
      const pickup = projectOntoRoutePath(requestOrigin, path);
      const dropoff = projectOntoRoutePath(requestDestination, path);
      return (
        pickup.distanceKm <= Math.max(originToleranceKm, routeToleranceKm) &&
        dropoff.distanceKm <= Math.max(destinationToleranceKm, routeToleranceKm) &&
        dropoff.progressKm > pickup.progressKm
      );
    }
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

/** Estimated pickup along the stored route. Full timestamps preserve midnight crossings. */
export function getRidePickupAt(input: RideCompatibilityInput): number | null {
  const base = Date.parse(`${input.offer.rideDate}T${input.offer.departureTime}-03:00`);
  if (!Number.isFinite(base)) return null;
  const origin = input.request.originCoordinate;
  const path = (input.offer.routePath ?? []).filter(isValidCoordinate);
  const duration = input.offer.routeDurationMinutes;
  if (!isValidCoordinate(origin) || path.length < 2 || !duration || duration <= 0) return base;
  const pickup = projectOntoRoutePath(origin, path);
  let total = 0;
  for (let i = 1; i < path.length; i++) total += calculateRideDistanceKm(path[i - 1], path[i]);
  return total > 0 ? base + Math.round((duration * 60 * pickup.progressKm) / total) * 1000 : base;
}

export function getRidePickupDifferenceMinutes(input: RideCompatibilityInput): number | null {
  const pickup = getRidePickupAt(input);
  const requested = Date.parse(`${input.request.rideDate}T${input.request.departureTime}-03:00`);
  return pickup != null && Number.isFinite(requested)
    ? Math.abs(pickup - requested) / 60_000
    : null;
}

/** A transparent ordering signal for results that already passed hard compatibility rules. */
export function calculateRideMatchScore(
  input: RideCompatibilityInput,
  preferenceBonus = 0,
): number {
  let score = RIDE_MATCH_SCORE_CONFIG.maximumBase;
  const origin = input.request.originCoordinate;
  const destination = input.request.destinationCoordinate;
  const offerOrigin = input.offer.originCoordinate;
  const offerDestination = input.offer.destinationCoordinate;
  if (
    isValidCoordinate(origin) &&
    isValidCoordinate(destination) &&
    isValidCoordinate(offerOrigin) &&
    isValidCoordinate(offerDestination)
  ) {
    const path = (input.offer.routePath ?? []).filter(isValidCoordinate);
    const route = path.length >= 2 ? path : [offerOrigin, offerDestination];
    const pickupDistance = projectOntoRoutePath(origin, route).distanceKm;
    const destinationDistance = projectOntoRoutePath(destination, route).distanceKm;
    score -= Math.min(
      RIDE_MATCH_SCORE_CONFIG.maximumPickupPenalty,
      Math.round(pickupDistance * RIDE_MATCH_SCORE_CONFIG.pickupPenaltyPerKm),
    );
    score -= Math.min(
      RIDE_MATCH_SCORE_CONFIG.maximumDestinationPenalty,
      Math.round(destinationDistance * RIDE_MATCH_SCORE_CONFIG.destinationPenaltyPerKm),
    );
  } else {
    // Exact text fallback is eligible only when no coordinates exist at all.
    score -= RIDE_MATCH_SCORE_CONFIG.missingCoordinatesPenalty;
  }
  const timeDifference =
    getRidePickupDifferenceMinutes(input) ??
    timeDifferenceInMinutes(input.request.departureTime, input.offer.departureTime) ??
    60;
  score -= Math.min(
    RIDE_MATCH_SCORE_CONFIG.maximumTimePenalty,
    Math.round(timeDifference * RIDE_MATCH_SCORE_CONFIG.timePenaltyPerMinute),
  );
  score += Math.max(0, Math.min(RIDE_MATCH_SCORE_CONFIG.maximumPreferenceBonus, preferenceBonus));
  return Math.max(
    RIDE_MATCH_SCORE_CONFIG.minimum,
    Math.min(RIDE_MATCH_SCORE_CONFIG.maximum, score),
  );
}

export function getRideMatchReasons(input: RideCompatibilityInput, preferenceBonus = 0): string[] {
  const reasons: string[] = [];
  const origin = input.request.originCoordinate;
  const destination = input.request.destinationCoordinate;
  const offerOrigin = input.offer.originCoordinate;
  const offerDestination = input.offer.destinationCoordinate;
  const hasCoordinates =
    isValidCoordinate(origin) &&
    isValidCoordinate(destination) &&
    isValidCoordinate(offerOrigin) &&
    isValidCoordinate(offerDestination);

  if (hasCoordinates) {
    const pickupDistance = calculateRideDistanceKm(offerOrigin, origin);
    const destinationDistance = calculateRideDistanceKm(destination, offerDestination);
    const detour = Math.max(
      0,
      pickupDistance +
        calculateRideDistanceKm(origin, destination) +
        destinationDistance -
        calculateRideDistanceKm(offerOrigin, offerDestination),
    );
    if (detour <= 2) reasons.push("Pouco desvio estimado para o motorista");
    if (pickupDistance <= 2) reasons.push("Embarque próximo ao início da rota");
    if (destinationDistance <= 2) reasons.push("Desembarque próximo ao destino");
  } else {
    reasons.push("Coordenadas ausentes; compatibilidade baseada nos endereços informados");
  }

  const requestedTolerance =
    input.timeToleranceMinutes ??
    input.request.timeToleranceMinutes ??
    DEFAULT_TIME_TOLERANCE_MINUTES;
  const tolerance = Math.min(
    requestedTolerance,
    input.offer.timeToleranceMinutes ?? requestedTolerance,
  );
  if (isTimeWithinTolerance(input.request.departureTime, input.offer.departureTime, tolerance)) {
    reasons.push("Horários compatíveis");
  }
  if (preferenceBonus > 0) reasons.push("Preferências de conversa ou música semelhantes");
  return reasons;
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
  const startMinutes = baseMinutes - toleranceMinutes;
  const endMinutes = baseMinutes + toleranceMinutes;
  const start =
    formatMinutesToTime((startMinutes + 1440) % 1440) + (startMinutes < 0 ? " (dia anterior)" : "");
  const end =
    formatMinutesToTime(endMinutes % 1440) + (endMinutes >= 1440 ? " (dia seguinte)" : "");
  return { start, end };
}

/**
 * Regra de compatibilidade do CARONAA:
 * - Mesma rota normalizada (origem e destino compatíveis e distintos entre si)
 * - Data e hora completas, incluindo embarques próximos à meia-noite
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
  const requestedTolerance =
    options?.timeToleranceMinutes ??
    input.timeToleranceMinutes ??
    input.request.timeToleranceMinutes ??
    DEFAULT_TIME_TOLERANCE_MINUTES;
  const tolerance = Math.min(
    requestedTolerance,
    input.offer.timeToleranceMinutes ?? requestedTolerance,
  );

  const difference = getRidePickupDifferenceMinutes(input);
  const isTimeCompatible = difference !== null && difference <= Math.min(tolerance, 60);

  return (
    areRideLocationsCompatible(input, options) &&
    input.request.rideDate.length > 0 &&
    input.offer.rideDate.length > 0 &&
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
