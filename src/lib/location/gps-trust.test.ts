import { describe, expect, it } from "vitest";
import { areNearbyPoints, isTrustedGpsFix } from "./gps-trust";

describe("GPS confidence and user-origin semantics", () => {
  const point = (accuracy: number) => ({ lat: -3.737, lng: -38.525, accuracy });

  it("accepts precisely 80m and rejects 81m and a 1029m browser fix", () => {
    expect(isTrustedGpsFix(point(80))).toBe(true);
    expect(isTrustedGpsFix(point(81))).toBe(false);
    expect(isTrustedGpsFix(point(1029))).toBe(false);
    expect(isTrustedGpsFix(null)).toBe(false);
  });

  it("distinguishes a verified location from a distant selected origin", () => {
    expect(areNearbyPoints(point(15), { lat: -3.7373, lng: -38.5252 })).toBe(true);
    expect(areNearbyPoints(point(15), { lat: -3.75, lng: -38.53 })).toBe(false);
    expect(areNearbyPoints(point(15), null)).toBe(false);
  });
});
