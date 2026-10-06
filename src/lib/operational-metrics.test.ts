import { describe, expect, it } from "vitest";

import { buildOperationalMetrics, type RideOperationalEvent } from "./operational-metrics";

const event = (
  eventName: RideOperationalEvent["eventName"],
  rideId: string,
  matchId: string | null = null,
  metadata: Record<string, unknown> = {},
): RideOperationalEvent => ({
  eventName,
  rideId,
  matchId,
  status: null,
  createdAt: "2026-01-01T10:00:00Z",
  trustedSource: true,
  metadata,
});

describe("operational match metrics", () => {
  it("ignores untrusted client-side ride completion events", () => {
    const summary = buildOperationalMetrics([
      { ...event("RIDE_COMPLETED", "fake-ride"), trustedSource: false },
      { ...event("RIDE_COMPLETED", "real-ride"), trustedSource: true },
    ]);
    expect(summary.match.completed).toBe(1);
  });

  it("calculates request and offer rates from their own eligible populations", () => {
    const requests = Array.from({ length: 100 }, (_, index) =>
      event("RIDE_REQUEST_CREATED", `r${index + 1}`),
    );
    const offers = Array.from({ length: 50 }, (_, index) =>
      event("RIDE_OFFER_CREATED", `o${index + 1}`, null, { availableSeats: 2 }),
    );
    const matches = Array.from({ length: 70 }, (_, index) =>
      event("MATCH_CREATED", `r${index + 1}`, `m${index + 1}`, {
        requestRideId: `r${index + 1}`,
        offerRideId: `o${(index % 40) + 1}`,
        seatsOccupied: 1,
      }),
    );
    const summary = buildOperationalMetrics([...requests, ...offers, ...matches]);

    expect(summary.request).toEqual({
      eligibleRequests: 100,
      matchedRequests: 70,
      unmatchedRequests: 30,
      requestMatchRate: 70,
    });
    expect(summary.offer).toEqual({
      eligibleOffers: 50,
      utilizedOffers: 40,
      unmatchedOffers: 10,
      offerMatchRate: 80,
    });
    expect(summary.seats).toEqual({ availableSeats: 100, occupiedSeats: 70, seatFillRate: 70 });
  });

  it("matches the aggregate RPC DTO on a controlled ride dataset", () => {
    const fixture = [
      {
        ...event("RIDE_REQUEST_CREATED", "request-1", null, { passengerCount: 1 }),
        createdAt: "2026-01-01T10:00:00Z",
      },
      {
        ...event("RIDE_REQUEST_CREATED", "request-2", null, { passengerCount: 2 }),
        createdAt: "2026-01-01T10:05:00Z",
      },
      event("RIDE_OFFER_CREATED", "offer-1", null, { availableSeats: 3 }),
      {
        ...event("MATCH_CREATED", "ride-1", "match-1", {
          requestId: "request-1",
          offerId: "offer-1",
          seatsOccupied: 1,
        }),
        createdAt: "2026-01-01T10:30:00Z",
      },
      {
        ...event("MATCH_CREATED", "ride-2", "match-2", {
          requestId: "request-2",
          offerId: "offer-1",
          seatsOccupied: 2,
        }),
        createdAt: "2026-01-01T10:40:00Z",
      },
      event("RIDE_COMPLETED", "ride-1"),
      event("RIDE_COMPLETED", "ride-1"),
    ];
    expect(buildOperationalMetrics(fixture)).toEqual({
      request: {
        eligibleRequests: 2,
        matchedRequests: 2,
        unmatchedRequests: 0,
        requestMatchRate: 100,
      },
      offer: { eligibleOffers: 1, utilizedOffers: 1, unmatchedOffers: 0, offerMatchRate: 100 },
      seats: { availableSeats: 3, occupiedSeats: 3, seatFillRate: 100 },
      match: { total: 2, averageMinutesToMatch: 32.5, cancelled: 0, completed: 1 },
    });
  });

  it("counts an offer only once even when it serves multiple requests", () => {
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "r1"),
      event("RIDE_REQUEST_CREATED", "r2"),
      event("RIDE_OFFER_CREATED", "o1", null, { availableSeats: 3 }),
      event("MATCH_CREATED", "r1", "m1", { requestRideId: "r1", offerRideId: "o1" }),
      event("MATCH_CREATED", "r2", "m2", { requestRideId: "r2", offerRideId: "o1" }),
    ]);

    expect(summary.request).toMatchObject({ matchedRequests: 2, requestMatchRate: 100 });
    expect(summary.offer).toMatchObject({ utilizedOffers: 1, offerMatchRate: 100 });
    expect(summary.seats).toEqual({ availableSeats: 3, occupiedSeats: 2, seatFillRate: 66.67 });
  });

  it("reads request and offer ids emitted by persisted domain matches", () => {
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "request-1"),
      event("RIDE_OFFER_CREATED", "offer-1", null, { availableSeats: 2 }),
      event("MATCH_CREATED", "", "match-1", {
        requestId: "request-1",
        offerId: "offer-1",
        seatsOccupied: 1,
      }),
    ]);

    expect(summary.request.matchedRequests).toBe(1);
    expect(summary.offer.utilizedOffers).toBe(1);
    expect(summary.seats.occupiedSeats).toBe(1);
  });

  it("reports a perfect rate for one eligible request and one eligible offer with one match", () => {
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "r1"),
      event("RIDE_OFFER_CREATED", "o1", null, { availableSeats: 1 }),
      event("MATCH_CREATED", "r1", "m1", {
        requestRideId: "r1",
        offerRideId: "o1",
        seatsOccupied: 1,
      }),
    ]);

    expect(summary.request).toEqual({
      eligibleRequests: 1,
      matchedRequests: 1,
      unmatchedRequests: 0,
      requestMatchRate: 100,
    });
    expect(summary.offer).toEqual({
      eligibleOffers: 1,
      utilizedOffers: 1,
      unmatchedOffers: 0,
      offerMatchRate: 100,
    });
    expect(summary.seats).toEqual({ availableSeats: 1, occupiedSeats: 1, seatFillRate: 100 });
  });

  it("deduplicates repeated events for the same match before counting requests, offers, or seats", () => {
    const match = event("MATCH_CREATED", "r1", "m1", {
      requestRideId: "r1",
      offerRideId: "o1",
      seatsOccupied: 2,
    });
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "r1"),
      event("RIDE_OFFER_CREATED", "o1", null, { availableSeats: 3 }),
      match,
      { ...match, createdAt: "2026-01-01T10:01:00Z" },
    ]);

    expect(summary.request.matchedRequests).toBe(1);
    expect(summary.offer.utilizedOffers).toBe(1);
    expect(summary.seats).toEqual({ availableSeats: 3, occupiedSeats: 2, seatFillRate: 66.67 });
  });

  it("does not report a seat fill rate when offers do not provide seat capacity", () => {
    const summary = buildOperationalMetrics([
      event("RIDE_REQUEST_CREATED", "r1"),
      event("RIDE_OFFER_CREATED", "o1"),
      event("MATCH_CREATED", "r1", "m1", { requestRideId: "r1", offerRideId: "o1" }),
    ]);
    expect(summary.seats).toEqual({
      availableSeats: null,
      occupiedSeats: null,
      seatFillRate: null,
    });
  });
});
