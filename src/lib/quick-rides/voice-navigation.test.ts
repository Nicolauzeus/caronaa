import { describe, expect, it } from "vitest";
import { navigationVoiceKey, navigationVoiceMessage, navigationVoiceStage } from "./voice-navigation";

const right = { start: { lat: -3.85012, lng: -38.62233 },
  instruction: "Vire à direita na Avenida", distanceMeters: 240 };

describe("F07 voice navigation", () => {
  it("speaks only at the 600m, 180m and 45m distance bands", () => {
    expect([750, 500, 240, 180, 45, 0, -1, Infinity].map(navigationVoiceStage))
      .toEqual([0, 1, 1, 2, 3, 3, 0, 0]);
  });

  it("keeps the ride leg and junction in the cue identity", () => {
    expect(navigationVoiceKey("ride", "PICKUP", right))
      .not.toBe(navigationVoiceKey("ride", "DROPOFF", right));
    expect(navigationVoiceKey("ride", "PICKUP", right))
      .not.toBe(navigationVoiceKey("ride", "PICKUP", {
        ...right, start: { ...right.start, lng: right.start.lng + 0.001 },
      }));
  });

  it("forms short Brazilian Portuguese announcements", () => {
    expect(navigationVoiceMessage(right, 1)).toBe("Em 250 metros, vire à direita na Avenida.");
    expect(navigationVoiceMessage({ ...right, distanceMeters: 140 }, 2))
      .toBe("Em 140 metros, vire à direita na Avenida.");
    expect(navigationVoiceMessage({ ...right, distanceMeters: 30 }, 3))
      .toBe("Agora, vire à direita na Avenida.");
  });
});
