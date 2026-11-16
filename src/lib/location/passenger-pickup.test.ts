import { describe, expect, it } from "vitest";
import { canPreviewPassengerPickup, needsPassengerPickupConfirmation } from "./passenger-pickup";

describe("passenger approximate pickup preview", () => {
  it("allows a real 300m fix for preview but rejects larger uncertainty", () => {
    expect(canPreviewPassengerPickup({lat:-3.73,lng:-38.52,accuracy:300})).toBe(true);
    expect(canPreviewPassengerPickup({lat:-3.73,lng:-38.52,accuracy:301})).toBe(false);
  });
  it("requires confirmation above the existing 80m trusted boundary", () => {
    expect(needsPassengerPickupConfirmation({lat:-3.73,lng:-38.52,accuracy:81})).toBe(true);
    expect(needsPassengerPickupConfirmation({lat:-3.73,lng:-38.52,accuracy:80})).toBe(false);
  });
});