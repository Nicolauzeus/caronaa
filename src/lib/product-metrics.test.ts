import { describe, expect, it } from "vitest";
import { buildProductMetrics } from "./product-metrics";

describe("product metrics", () => {
  it("deduplicates users and calculates acquisition-to-repeat conversion", () => {
    const summary = buildProductMetrics([
      { eventName: "USER_REGISTERED", userId: "a" },
      { eventName: "USER_REGISTERED", userId: "b" },
      { eventName: "RIDE_OFFER_CREATED", userId: "a" },
      { eventName: "MATCH_CREATED", userId: "a" },
      { eventName: "RIDE_COMPLETED", userId: "a" },
      { eventName: "RIDE_REPEATED", userId: "a" },
      { eventName: "RIDE_REPEATED", userId: "a" },
    ]);
    expect(summary).toMatchObject({
      registered: 2,
      rideCreated: 1,
      matched: 1,
      rideCompleted: 1,
      paid: null,
      paymentMetricAvailable: false,
      repeated: 1,
      conversionToRide: 50,
      conversionToRepeat: 100,
    });
  });
});
