import { describe, expect, it } from "vitest";
import { buildRetentionMetrics } from "./retention-metrics";
describe("retention metrics", () => {
  it("counts only completed rides and measures return from first completion", () => {
    const summary = buildRetentionMetrics([
      { userId: "a", completedAt: "2026-01-01T10:00:00Z", profile: "PASSAGEIRO" },
      { userId: "a", completedAt: "2026-01-05T10:00:00Z", profile: "PASSAGEIRO" },
      { userId: "b", completedAt: "2026-01-01T10:00:00Z", profile: "MOTORISTA" },
      { userId: "b", completedAt: "2026-02-05T10:00:00Z", profile: "MOTORISTA" },
      { userId: "c", completedAt: "2026-01-01T10:00:00Z" }, { userId: "c", completedAt: "2026-01-02T10:00:00Z" }, { userId: "c", completedAt: "2026-01-03T10:00:00Z" },
    ]);
    expect(summary).toMatchObject({ usersWith2Rides: 2, usersWith3OrMoreRides: 1, repeatRate7d: 66.67, repeatRate30d: 66.67 });
    expect(summary.distribution).toEqual({ one: 0, two: 2, threeToFive: 1, sixOrMore: 0 });
  });
});
