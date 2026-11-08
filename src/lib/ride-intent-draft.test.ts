import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRideIntentDraft,
  consumeRideIntentDraft,
  saveRideIntentDraft,
} from "./ride-intent-draft";

beforeEach(() => clearRideIntentDraft());
afterEach(() => {
  vi.restoreAllMocks();
  clearRideIntentDraft();
});

describe("passenger/driver role-switch handoff", () => {
  const route = {
    origin: "Rua São João, Fortaleza",
    destination: "Campus em Redenção",
    originLocation: {
      rawText: "Rua São João, Fortaleza", lat: -3.74, lng: -38.5,
    },
    destinationLocation: {
      rawText: "Campus em Redenção", lat: -4.23, lng: -38.73,
    },
    date: "2026-11-10",
    time: "15:30",
    tolerance: 15 as const,
    passengerMode: "EXCLUSIVE" as const,
    offerVehicle: "MOTO" as const,
  };
  it("preserves the selected trip and modal preference for one navigation only", () => {
    saveRideIntentDraft(route);
    expect(consumeRideIntentDraft()).toEqual(expect.objectContaining(route));
    expect(consumeRideIntentDraft()).toBeNull();
  });
  it("expires a handoff after two minutes rather than leaving old routes in the tab", () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    saveRideIntentDraft(route);
    clock.mockReturnValue(now + 121_000);
    expect(consumeRideIntentDraft()).toBeNull();
  });
  it("rejects invalid points instead of creating a false pickup", () => {
    saveRideIntentDraft({
      origin: "GPS inválido",
      destination: route.destination,
      originLocation: { rawText:"GPS inválido", lat: 1000, lng: -38.5 },
      destinationLocation: route.destinationLocation,
    });
    const draft = consumeRideIntentDraft();
    expect(draft?.origin).toBe("GPS inválido");
    expect(draft?.originLocation).toBeUndefined();
    expect(draft?.destinationLocation?.lng).toBe(-38.73);
  });
  it("never survives a clearing action such as sign-out", () => {
    saveRideIntentDraft(route);
    clearRideIntentDraft();
    expect(consumeRideIntentDraft()).toBeNull();
  });
});
