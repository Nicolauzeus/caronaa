import { describe, expect, it } from "vitest";

import { buildOperationalMetrics, type RideOperationalEvent } from "./operational-metrics";

const event = (eventName: RideOperationalEvent["eventName"], rideId: string, matchId: string | null = null, metadata: Record<string, unknown> = {}): RideOperationalEvent => ({
  eventName, rideId, matchId, status: null, createdAt: "2026-01-01T10:00:00Z", metadata,
});

describe("operational match metrics", () => {
  it("calculates request and offer rates from their own eligible populations", () => {
    const requests = Array.from({ length: 100 }, (_, index) => event("RIDE_REQUEST_CREATED", `r${index + 1}`));
    const offers = Array.from({ length: 50 }, (_, index) => event("RIDE_OFFER_CREATED", `o${index + 1}`, null, { availableSeats: 2 }));
    const matches = Array.from({ length: 70 }, (_, index) => event("MATCH_CREATED", `r${index + 1}`, `m${index + 1}`, { requestRideId: `r${index + 1}`, offerRideId: `o${(index % 40) + 1}`, seatsOccupied: 1 }));
    const summary = buildOperationalMetrics([...requests, ...offers, ...matches]);

    expect(summary.request).toEqual({ eligible: 100, served: 70, unmatched: 30, matchRate: 70 });
    expect(summary.offer).toEqual({ eligible: 50, utilized: 40, unmatched: 10, matchRate: 80 });
    expect(summary.seats).toEqual({ available: 100, occupied: 70, fillRate: 70 });
  });

  it("counts an offer only once even when it serves multiple requests", () => {
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "r1"), event("RIDE_REQUEST_CREATED", "r2"),
      event("RIDE_OFFER_CREATED", "o1", null, { availableSeats: 3 }),
      event("MATCH_CREATED", "r1", "m1", { requestRideId: "r1", offerRideId: "o1" }),
      event("MATCH_CREATED", "r2", "m2", { requestRideId: "r2", offerRideId: "o1" }),
    ]);

    expect(summary.request).toMatchObject({ served: 2, matchRate: 100 });
    expect(summary.offer).toMatchObject({ utilized: 1, matchRate: 100 });
    expect(summary.seats).toEqual({ available: 3, occupied: 2, fillRate: 66.67 });
  });

  it("does not report a seat fill rate when offers do not provide seat capacity", () => {
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "r1"), event("RIDE_OFFER_CREATED", "o1"),
      event("MATCH_CREATED", "r1", "m1", { requestRideId: "r1", offerRideId: "o1" }),
    ]);
    expect(summary.seats).toEqual({ available: null, occupied: null, fillRate: null });
  });
});
