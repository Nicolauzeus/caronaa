import { describe, expect, it } from "vitest";
import {
  calculateFreeSeatPotential,
  shouldRecalculateRoadEstimate,
  type RoadEstimateLocation,
} from "./ride-potential";

describe("remaining free-seat potential", () => {
  it("uses road distance times only the currently free seats", () => {
    expect(calculateFreeSeatPotential(22, 3)).toEqual({
      distanceKm: 22,
      freeSeats: 3,
      pricePerPassenger: 12,
      potentialTotal: 36,
    });
    expect(calculateFreeSeatPotential(11, 3).potentialTotal).toBe(18);
  });

  it("does not produce negative or fabricated values for invalid inputs", () => {
    expect(() => calculateFreeSeatPotential(Number.NaN, 2)).toThrow();
    expect(() => calculateFreeSeatPotential(11, -1)).toThrow();
    expect(() => calculateFreeSeatPotential(11, 1.5)).toThrow();
  });
});

describe("location sampling for road estimates", () => {
  const first: RoadEstimateLocation = {
    latitude: 0,
    longitude: 0,
    accuracy: 20,
    capturedAt: 1_000,
  };

  it("requests the first estimate but ignores GPS jitter and too-frequent samples", () => {
    expect(shouldRecalculateRoadEstimate(null, first)).toBe(true);
    expect(
      shouldRecalculateRoadEstimate(first, {
        ...first,
        longitude: 0.0002,
        capturedAt: 60_000,
      }),
    ).toBe(false);
    expect(
      shouldRecalculateRoadEstimate(first, {
        ...first,
        longitude: 0.003,
        capturedAt: 20_000,
      }),
    ).toBe(false);
  });

  it("recalculates after at least 250 m and 30 seconds with a reliable fix", () => {
    expect(
      shouldRecalculateRoadEstimate(first, {
        ...first,
        longitude: 0.003,
        capturedAt: 31_000,
      }),
    ).toBe(true);
  });

  it("rejects inaccurate and out-of-range GPS samples", () => {
    expect(shouldRecalculateRoadEstimate(null, { ...first, accuracy: 250 })).toBe(false);
    expect(shouldRecalculateRoadEstimate(null, { ...first, latitude: 91 })).toBe(false);
  });
});
