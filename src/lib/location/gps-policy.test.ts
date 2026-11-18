import { describe, expect, it } from "vitest";
import { GPS_POLICY, isFreshGpsTimestamp } from "./gps-policy";
describe("GPS freshness and quality policy", () => {
  it("does not accept a cached fix as fresh", () => {
    expect(isFreshGpsTimestamp(70_000, GPS_POLICY.driverSampleMaxAgeMs, 100_000)).toBe(true);
    expect(isFreshGpsTimestamp(69_999, GPS_POLICY.driverSampleMaxAgeMs, 100_000)).toBe(false);
    expect(isFreshGpsTimestamp(105_001, GPS_POLICY.driverSampleMaxAgeMs, 100_000)).toBe(false);
    expect(isFreshGpsTimestamp(undefined, GPS_POLICY.driverSampleMaxAgeMs)).toBe(false);
  });
  it("separates previews, radar and arrival precision", () => {
    expect(GPS_POLICY.passengerPreviewAccuracyM).toBeGreaterThan(GPS_POLICY.driverMaxAccuracyM);
    expect(GPS_POLICY.driverMaxAccuracyM).toBeGreaterThan(GPS_POLICY.driverArrivalAccuracyM);
  });
});
