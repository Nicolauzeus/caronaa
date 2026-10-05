import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isRideRequestCompatibleWithOffer, type RideCompatibilityInput } from "./ride-matching";

const matchingMigration = readFileSync(
  "drizzle/migrations/0015_create_persisted_ride_matching.sql",
  "utf8",
);

const compatibleRide: RideCompatibilityInput = {
  request: {
    origin: " Aldeota ",
    destination: "Meireles",
    rideDate: "2026-10-04",
    departureTime: "08:30",
    passengerCount: 2,
    userId: "passenger-1",
  },
  offer: {
    origin: "aldeota",
    destination: " MEIRELES ",
    rideDate: "2026-10-04",
    departureTime: "08:30",
    availableSeats: 3,
    seatsRemaining: 2,
    userId: "driver-1",
  },
};

describe("ride compatibility", () => {
  it("allows a persisted request when there are enough seats and the users differ", () => {
    expect(isRideRequestCompatibleWithOffer(compatibleRide)).toBe(true);
  });

  it("rejects insufficient or invalid remaining capacity", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, seatsRemaining: 1 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, seatsRemaining: 4 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, passengerCount: 1.5 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, passengerCount: 7 },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, availableSeats: 7 },
      }),
    ).toBe(false);
  });

  it("rejects matching a user's own request to their offer", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, userId: "passenger-1" },
      }),
    ).toBe(false);
  });

  it("rejects an empty or identical route", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, origin: "  " },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        request: { ...compatibleRide.request, destination: "ALDEOTA" },
      }),
    ).toBe(false);
  });

  it("requires exact departure date and time", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, rideDate: "2026-10-05" },
      }),
    ).toBe(false);
    expect(
      isRideRequestCompatibleWithOffer({
        ...compatibleRide,
        offer: { ...compatibleRide.offer, departureTime: "08:31" },
      }),
    ).toBe(false);
  });

  it("makes the persisted match insert the only idempotent source for MATCH_CREATED", () => {
    expect(matchingMigration).toMatch(
      /CREATE UNIQUE INDEX product_events_match_created_once_idx[\s\S]+?WHERE event_name = 'MATCH_CREATED'/,
    );
    expect(matchingMigration).toMatch(
      /CREATE TRIGGER ride_match_track_product_event\s+AFTER INSERT ON public\.ride_matches/,
    );
    expect(matchingMigration).toMatch(/event_name <> 'MATCH_CREATED'/);
    expect(matchingMigration).toMatch(
      /INSERT INTO public\.ride_matches[\s\S]+?ON CONFLICT \(request_id\) DO NOTHING/,
    );
  });
});
