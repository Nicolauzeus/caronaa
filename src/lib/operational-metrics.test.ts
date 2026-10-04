import { describe, expect, it } from "vitest";
import { buildOperationalMetrics } from "./operational-metrics";

describe("operational ride metrics", () => {
  it("separates unmatched demand from unmatched supply and calculates match timing", () => {
    const summary = buildOperationalMetrics([
      { eventName: "RIDE_REQUEST_CREATED", rideId: "r1", matchId: null, status: "open", createdAt: "2026-01-01T10:00:00Z", metadata: { origin: "Centro", destination: "Aldeota" } },
      { eventName: "RIDE_OFFER_CREATED", rideId: "o1", matchId: null, status: "available", createdAt: "2026-01-01T10:00:00Z", metadata: { origin: "Centro", destination: "Aldeota" } },
      { eventName: "RIDE_OFFER_CREATED", rideId: "o2", matchId: null, status: "closed_unmatched", createdAt: "2026-01-01T10:00:00Z" },
      { eventName: "MATCH_CREATED", rideId: "r1", matchId: "m1", status: "completed", createdAt: "2026-01-01T10:15:00Z" },
      { eventName: "RIDE_STARTED", rideId: "r1", matchId: "m1", status: "matched", createdAt: "2026-01-01T10:16:00Z" },
    ]);
    expect(summary.demand).toEqual({ total: 1, open: 0, matched: 1, closedUnmatched: 0 });
    expect(summary.offer).toEqual({ total: 2, available: 1, matched: 0, closedUnmatched: 1 });
    expect(summary.match).toMatchObject({ total: 1, rate: 33.33, averageMinutesToMatch: 15, completed: 1 });
  });
});
