import { describe, expect, it } from "vitest";
import { buildSuggestedRoutePlan, type MultiStopCandidate } from "./multi-stop-routing";
import type { DrivingRoute, RoadPoint } from "./road-routing";

const start = { lat: 0, lng: 0 };
const finish = { lat: 0, lng: 1 };
const original: DrivingRoute = {
  distanceKm: 20,
  durationMinutes: 40,
  routePath: [start, finish],
  legs: [{ distanceKm: 20, durationMinutes: 40 }],
};

function request(overrides: Partial<MultiStopCandidate> = {}): MultiStopCandidate {
  return {
    requestId: "request-1",
    passengerName: "Ana",
    passengerCount: 1,
    pickup: { lat: 0, lng: 0.25 },
    dropoff: { lat: 0, lng: 0.75 },
    roadDistanceKm: 11,
    pricePerPassenger: 6,
    groupTotal: 6,
    ...overrides,
  };
}

function routed(minutes: number, points: RoadPoint[]): DrivingRoute {
  return {
    distanceKm: 22,
    durationMinutes: minutes,
    routePath: points,
    legs: points
      .slice(1)
      .map(() => ({ distanceKm: 5, durationMinutes: minutes / (points.length - 1) })),
  };
}

describe("multi-stop route planning", () => {
  it("orders pickup before dropoff and sums the exact quoted group totals", async () => {
    const candidates = [
      request({ requestId: "r1", passengerName: "Ana", passengerCount: 2, groupTotal: 12 }),
      request({
        requestId: "r2",
        passengerName: "Bia",
        passengerCount: 1,
        pickup: { lat: 0, lng: 0.4 },
        dropoff: { lat: 0, lng: 0.8 },
        groupTotal: 6,
      }),
    ];
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates,
      route: async (points) => routed(points.length === 6 ? 49 : 44, points),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops.map((stop) => `${stop.requestId}:${stop.kind}`)).toEqual([
      "r1:pickup",
      "r2:pickup",
      "r1:dropoff",
      "r2:dropoff",
    ]);
    expect(result.plan.totalIncrementalEarnings).toBe(18);
    expect(result.plan.addedDistanceKm).toBe(2);
    expect(result.plan.addedDurationMinutes).toBe(9);
  });

  it("rejects pickup or dropoff more than 2 km from the road corridor", async () => {
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates: [request({ pickup: { lat: 0.03, lng: 0.25 } })],
      route: async (points) => routed(42, points),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectedRequestIds).toContain("request-1");
  });

  it("rejects a passenger route whose dropoff projects before pickup", async () => {
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates: [request({ pickup: { lat: 0, lng: 0.8 }, dropoff: { lat: 0, lng: 0.2 } })],
      route: async (points) => routed(42, points),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejectedRequestIds).toContain("request-1");
  });

  it("rejects a combined detour above the 15-minute trip budget", async () => {
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates: [
        request(),
        request({
          requestId: "request-2",
          passengerName: "Bia",
          pickup: { lat: 0, lng: 0.3 },
          dropoff: { lat: 0, lng: 0.7 },
        }),
      ],
      route: async (points) => routed(points.length === 6 ? 56 : 43, points),
    });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("15 minutos") });
  });

  it("rejects an individual request detour above 6 minutes", async () => {
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates: [
        request(),
        request({
          requestId: "request-2",
          passengerName: "Bia",
          pickup: { lat: 0, lng: 0.3 },
          dropoff: { lat: 0, lng: 0.7 },
        }),
      ],
      route: async (points) => routed(points.length === 6 ? 50 : 47, points),
    });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("6 minutos") });
  });

  it("rejects a quote whose total is inconsistent with passenger count", async () => {
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates: [request({ passengerCount: 2, groupTotal: 6 })],
      route: async (points) => routed(42, points),
    });
    expect(result.ok).toBe(false);
  });

  it("does not offer an alternative when the road router fails", async () => {
    const result = await buildSuggestedRoutePlan({
      originalRoute: original,
      candidates: [request()],
      route: async () => {
        throw new Error("Google Routes offline");
      },
    });
    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringContaining("serviço de rotas"),
    });
  });
});

