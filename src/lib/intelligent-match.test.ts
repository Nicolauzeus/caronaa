import { describe, expect, it } from "vitest";
import {
  calculateRideMatchScore,
  getRidePickupAt,
  getRidePickupDifferenceMinutes,
  getTimeWindowRange,
  isRideRequestCompatibleWithOffer,
  type RideCompatibilityInput,
} from "./ride-matching";
import {
  describePickupDifference,
  formatPickupAt,
  rideMatchEvaluationSchema,
} from "./intelligent-match";

const input: RideCompatibilityInput = {
  request: {
    userId: "passenger",
    origin: "B",
    destination: "C",
    originCoordinate: { lat: 0, lng: 0.1 },
    destinationCoordinate: { lat: 0.1, lng: 0.1 },
    rideDate: "2030-01-02",
    departureTime: "07:45",
    passengerCount: 1,
    timeToleranceMinutes: 5,
  },
  offer: {
    userId: "driver",
    origin: "A",
    destination: "C",
    originCoordinate: { lat: 0, lng: 0 },
    destinationCoordinate: { lat: 0.1, lng: 0.1 },
    rideDate: "2030-01-02",
    departureTime: "07:00",
    availableSeats: 3,
    seatsRemaining: 3,
    timeToleranceMinutes: 5,
    routePath: [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.1 },
      { lat: 0.1, lng: 0.1 },
    ],
    routeDurationMinutes: 90,
  },
};
describe("intelligent boarding estimates", () => {
  it("compares requested boarding against passage time, not initial departure", () => {
    expect(getRidePickupAt(input)).toBe(Date.parse("2030-01-02T07:45:00-03:00"));
    expect(getRidePickupDifferenceMinutes(input)).toBe(0);
    expect(isRideRequestCompatibleWithOffer(input)).toBe(true);
  });
  it("does not penalize an on-route intermediate pickup for distance from endpoints", () => {
    expect(calculateRideMatchScore(input)).toBe(94);
  });
  it("handles a 30 minute window across midnight using full dates", () => {
    const midnight = {
      request: {
        ...input.request,
        origin: "A",
        originCoordinate: { lat: 0, lng: 0 },
        rideDate: "2030-01-01",
        departureTime: "23:40",
        timeToleranceMinutes: 30,
      },
      offer: { ...input.offer, departureTime: "00:10", timeToleranceMinutes: 30 },
    };
    expect(getRidePickupDifferenceMinutes(midnight)).toBe(30);
    expect(isRideRequestCompatibleWithOffer(midnight)).toBe(true);
    expect(
      isRideRequestCompatibleWithOffer({
        ...midnight,
        request: { ...midnight.request, departureTime: "23:39" },
      }),
    ).toBe(false);
  });
  it("rejects invalid dates rather than treating times as identical", () => {
    expect(
      isRideRequestCompatibleWithOffer({
        ...input,
        request: { ...input.request, rideDate: "invalid" },
      }),
    ).toBe(false);
  });
  it("labels windows extending into adjacent days", () => {
    expect(getTimeWindowRange("00:10", 30)).toEqual({
      start: "23:40 (dia anterior)",
      end: "00:40",
    });
    expect(getTimeWindowRange("23:40", 60)).toEqual({
      start: "22:40",
      end: "00:40 (dia seguinte)",
    });
  });
  it("explains the direction of adjustment and formats times in Fortaleza", () => {
    expect(describePickupDifference(-40)).toContain("40 min antes");
    expect(describePickupDifference(25)).toContain("25 min depois");
    expect(describePickupDifference(0)).toContain("no horário");
    expect(formatPickupAt("2030-01-02T10:45:00Z")).toContain("07:45");
  });
  it("rejects malformed backend evaluations before rendering a request action", () => {
    expect(
      rideMatchEvaluationSchema.safeParse({ classification: "compatible", pickupAt: "invalid" })
        .success,
    ).toBe(false);
  });
});
