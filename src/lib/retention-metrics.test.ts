import { describe, expect, it } from "vitest";
import { buildRetentionMetrics } from "./retention-metrics";

describe("retention metrics", () => {
  it("deduplicates by ride_id and measures the second distinct ride from the first", () => {
    const rides = [
      { userId: "a", rideId: "a1", completedAt: "2026-01-01T10:00:00Z", profile: "PASSAGEIRO" },
      { userId: "a", rideId: "a1", completedAt: "2026-01-02T10:00:00Z", profile: "PASSAGEIRO" },
      { userId: "a", rideId: "a2", completedAt: "2026-01-08T10:00:00Z", profile: "PASSAGEIRO" },
      { userId: "b", rideId: "b1", completedAt: "2026-01-01T10:00:00Z", profile: "MOTORISTA" },
      { userId: "b", rideId: "b2", completedAt: "2026-01-31T10:00:00Z", profile: "MOTORISTA" },
      { userId: "c", rideId: "c1", completedAt: "2026-01-01T10:00:00Z" },
      { userId: "c", rideId: "c2", completedAt: "2026-01-02T10:00:00Z" },
      { userId: "c", rideId: "c3", completedAt: "2026-01-03T10:00:00Z" },
      ...Array.from({ length: 6 }, (_, index) => ({
        userId: "d",
        rideId: `d${index}`,
        completedAt: `2026-01-0${index + 1}T10:00:00Z`,
      })),
      { userId: "e", rideId: "e1", completedAt: "2026-01-01T10:00:00Z" },
    ];

    const summary = buildRetentionMetrics(rides);
    expect(summary).toMatchObject({
      usersWith1Ride: 1,
      usersWith2Rides: 2,
      usersWith3OrMoreRides: 2,
      repeatRate7d: 60,
      repeatRate30d: 80,
      distribution: { one: 1, two: 2, threeToFive: 1, sixOrMore: 1 },
    });
  });

  it("does not treat missing ride ids or repeated events for one ride as repeat rides", () => {
    const summary = buildRetentionMetrics([
      { userId: "u", rideId: "one", completedAt: "2026-01-01T00:00:00Z" },
      { userId: "u", rideId: "one", completedAt: "2026-01-02T00:00:00Z" },
      { userId: "u", rideId: "", completedAt: "2026-01-03T00:00:00Z" },
    ]);
    expect(summary.usersWith1Ride).toBe(1);
    expect(summary.usersWith2Rides).toBe(0);
    expect(summary.repeatRate7d).toBe(0);
  });
});
