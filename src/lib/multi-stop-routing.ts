import { projectOntoRoutePath } from "./ride-matching";
import { calculatePassengerFare } from "./ride-cost";
import type { DrivingRoute, RoadPoint } from "./road-routing";

export const MULTI_STOP_LIMITS = {
  corridorKm: 2,
  maximumAddedDurationMinutes: 15,
  maximumAddedMinutesPerRequest: 6,
  maximumRequests: 6,
} as const;

export type RouteStop = {
  requestId: string;
  sequence: number;
  kind: "pickup" | "dropoff";
  point: RoadPoint;
  label: string;
  progressKm: number;
};

export type MultiStopCandidate = {
  requestId: string;
  passengerName: string;
  passengerCount: number;
  pickup: RoadPoint;
  dropoff: RoadPoint;
  roadDistanceKm: number;
  pricePerPassenger: number;
  groupTotal: number;
};

export type SuggestedRoutePlan = {
  originalRoute: DrivingRoute;
  suggestedRoute: DrivingRoute;
  stops: RouteStop[];
  addedDistanceKm: number;
  addedDurationMinutes: number;
  totalIncrementalEarnings: number;
  requestCount: number;
};

export type MultiStopPlanResult =
  | { ok: true; plan: SuggestedRoutePlan }
  | { ok: false; reason: string; rejectedRequestIds: string[] };

export type MultiStopRouter = (points: RoadPoint[]) => Promise<DrivingRoute>;

function isPoint(point: RoadPoint) {
  return (
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Plans only a route ordering for already-persisted proposals. It does not
 * create a match, reserve seats, or change either participant's acceptance.
 */
export async function buildSuggestedRoutePlan(input: {
  originalRoute: DrivingRoute;
  candidates: MultiStopCandidate[];
  route: MultiStopRouter;
}): Promise<MultiStopPlanResult> {
  const { originalRoute, candidates, route } = input;
  if (
    originalRoute.routePath.length < 2 ||
    originalRoute.routePath.some((point) => !isPoint(point))
  ) {
    return {
      ok: false,
      reason: "A oferta não possui uma geometria rodoviária confiável.",
      rejectedRequestIds: [],
    };
  }
  if (!Number.isFinite(originalRoute.durationMinutes) || originalRoute.durationMinutes <= 0) {
    return {
      ok: false,
      reason: "O tempo da rota direta não está disponível.",
      rejectedRequestIds: [],
    };
  }
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "Ainda não há propostas existentes para organizar nesta rota.",
      rejectedRequestIds: [],
    };
  }
  if (candidates.length > MULTI_STOP_LIMITS.maximumRequests) {
    return {
      ok: false,
      reason: "Há propostas demais para calcular uma sugestão segura de uma só vez.",
      rejectedRequestIds: candidates.map((candidate) => candidate.requestId),
    };
  }

  const start = originalRoute.routePath[0];
  const finish = originalRoute.routePath[originalRoute.routePath.length - 1];
  const rejectedRequestIds: string[] = [];
  const accepted: Array<MultiStopCandidate & { pickupProgress: number; dropoffProgress: number }> =
    [];

  for (const candidate of candidates) {
    const validFare =
      Number.isInteger(candidate.passengerCount) &&
      candidate.passengerCount >= 1 &&
      Number.isFinite(candidate.roadDistanceKm) &&
      candidate.roadDistanceKm > 0 &&
      Number.isFinite(candidate.pricePerPassenger) &&
      candidate.pricePerPassenger === calculatePassengerFare(candidate.roadDistanceKm) &&
      candidate.groupTotal === round2(candidate.pricePerPassenger * candidate.passengerCount);
    if (!isPoint(candidate.pickup) || !isPoint(candidate.dropoff) || !validFare) {
      rejectedRequestIds.push(candidate.requestId);
      continue;
    }
    const pickup = projectOntoRoutePath(candidate.pickup, originalRoute.routePath);
    const dropoff = projectOntoRoutePath(candidate.dropoff, originalRoute.routePath);
    if (
      pickup.distanceKm > MULTI_STOP_LIMITS.corridorKm ||
      dropoff.distanceKm > MULTI_STOP_LIMITS.corridorKm ||
      dropoff.progressKm <= pickup.progressKm
    ) {
      rejectedRequestIds.push(candidate.requestId);
      continue;
    }
    accepted.push({
      ...candidate,
      pickupProgress: pickup.progressKm,
      dropoffProgress: dropoff.progressKm,
    });
  }

  if (!accepted.length) {
    return {
      ok: false,
      reason:
        "Nenhuma proposta está no corredor de 2 km com embarque antes do desembarque e cotação válida.",
      rejectedRequestIds,
    };
  }

  const orderedStops = accepted
    .flatMap((candidate) => [
      {
        requestId: candidate.requestId,
        kind: "pickup" as const,
        point: candidate.pickup,
        label: `Embarque ${candidate.passengerName}`,
        progressKm: candidate.pickupProgress,
      },
      {
        requestId: candidate.requestId,
        kind: "dropoff" as const,
        point: candidate.dropoff,
        label: `Desembarque ${candidate.passengerName}`,
        progressKm: candidate.dropoffProgress,
      },
    ])
    .sort(
      (a, b) =>
        a.progressKm - b.progressKm ||
        (a.kind === b.kind ? a.requestId.localeCompare(b.requestId) : a.kind === "pickup" ? -1 : 1),
    );
  const stops: RouteStop[] = orderedStops.map((stop, index) => ({ ...stop, sequence: index + 1 }));
  const routePoints = [start, ...stops.map((stop) => stop.point), finish];

  let suggestedRoute: DrivingRoute;
  let individualRoutes: DrivingRoute[];
  try {
    [suggestedRoute, ...individualRoutes] = await Promise.all([
      route(routePoints),
      ...accepted.map((candidate) => route([start, candidate.pickup, candidate.dropoff, finish])),
    ]);
  } catch {
    return {
      ok: false,
      reason: "O serviço de rotas não respondeu. Nenhum percurso alternativo foi presumido.",
      rejectedRequestIds,
    };
  }

  const addedDurationMinutes = Math.max(
    0,
    suggestedRoute.durationMinutes - originalRoute.durationMinutes,
  );
  if (addedDurationMinutes > MULTI_STOP_LIMITS.maximumAddedDurationMinutes) {
    return {
      ok: false,
      reason: "A rota com paradas acrescentaria mais de 15 minutos à viagem.",
      rejectedRequestIds,
    };
  }
  const exceedsPerRequestLimit = individualRoutes.some(
    (individual) =>
      Math.max(0, individual.durationMinutes - originalRoute.durationMinutes) >
      MULTI_STOP_LIMITS.maximumAddedMinutesPerRequest,
  );
  if (exceedsPerRequestLimit) {
    return {
      ok: false,
      reason: "Pelo menos uma proposta acrescentaria mais de 6 minutos à viagem.",
      rejectedRequestIds,
    };
  }

  return {
    ok: true,
    plan: {
      originalRoute,
      suggestedRoute,
      stops,
      addedDistanceKm: round2(Math.max(0, suggestedRoute.distanceKm - originalRoute.distanceKm)),
      addedDurationMinutes: round2(addedDurationMinutes),
      totalIncrementalEarnings: round2(
        accepted.reduce((sum, candidate) => sum + candidate.groupTotal, 0),
      ),
      requestCount: accepted.length,
    },
  };
}
