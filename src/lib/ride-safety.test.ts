import { describe, expect, it } from "vitest";
import {
  boardingPinSchema,
  geolocationErrorMessage,
  ridePositionSchema,
  rideRatingSchema,
} from "./ride-safety";
import { transitionRide, getRideNextActions } from "./ride-lifecycle";

const participant = { hasPersistedMatch: true, isParticipant: true, confirmedByBoth: true };
describe("ride safety input validation", () => {
  it("accepts an eight-digit PIN including leading zeros", () => {
    expect(boardingPinSchema.parse("00123456")).toBe("00123456");
    expect(boardingPinSchema.safeParse("1234567").success).toBe(false);
    expect(boardingPinSchema.safeParse("abcdefgh").success).toBe(false);
  });
  it("validates real coordinate ranges and rejects nonfinite values", () => {
    const position = {
      latitude: -3.735,
      longitude: -38.5,
      accuracyM: 10,
      capturedAt: "2026-10-07T10:00:00.000Z",
    };
    expect(ridePositionSchema.parse(position)).toEqual(position);
    expect(ridePositionSchema.safeParse({ ...position, latitude: 91 }).success).toBe(false);
    expect(ridePositionSchema.safeParse({ ...position, longitude: NaN }).success).toBe(false);
    expect(ridePositionSchema.safeParse({ ...position, accuracyM: -1 }).success).toBe(false);
  });
  it("limits ratings to integral scores and bounded comments", () => {
    expect(rideRatingSchema.parse({ score: 5, comment: " Boa viagem " })).toEqual({
      score: 5,
      comment: "Boa viagem",
    });
    expect(rideRatingSchema.safeParse({ score: 0, comment: "" }).success).toBe(false);
    expect(rideRatingSchema.safeParse({ score: 4.5, comment: "" }).success).toBe(false);
    expect(rideRatingSchema.safeParse({ score: 4, comment: "a".repeat(1001) }).success).toBe(false);
  });
  it("distinguishes denied GPS permission, unavailability and timeout", () => {
    expect(geolocationErrorMessage(1)).toContain("negada");
    expect(geolocationErrorMessage(2)).toContain("indisponível");
    expect(geolocationErrorMessage(3)).toContain("a tempo");
  });
});
describe("boarding and terminal states", () => {
  it("requires validated boarding and the driver role to start", () => {
    expect(() => transitionRide("CONFIRMED", "IN_PROGRESS", participant)).toThrow("PIN");
    expect(() =>
      transitionRide("CONFIRMED", "IN_PROGRESS", {
        ...participant,
        boardingValidated: true,
        isDriver: false,
      }),
    ).toThrow("PIN");
    expect(
      transitionRide("CONFIRMED", "IN_PROGRESS", {
        ...participant,
        boardingValidated: true,
        isDriver: true,
      }),
    ).toBe("IN_PROGRESS");
  });
  it("cannot reuse boarding to start a running or completed ride", () => {
    const boarded = { ...participant, boardingValidated: true, isDriver: true };
    expect(() => transitionRide("IN_PROGRESS", "IN_PROGRESS", boarded)).toThrow(
      "Invalid ride transition",
    );
    expect(() => transitionRide("COMPLETED", "IN_PROGRESS", boarded)).toThrow(
      "Invalid ride transition",
    );
  });
  it("requires both participants to conclude an ongoing ride", () => {
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...participant, confirmedByBoth: false }),
    ).toThrow();
    expect(transitionRide("IN_PROGRESS", "COMPLETED", participant)).toBe("COMPLETED");
  });
  it("does not offer a direct status-change start action", () => {
    expect(getRideNextActions("CONFIRMED", "driver").some((a) => a.status === "IN_PROGRESS")).toBe(
      false,
    );
    expect(getRideNextActions("COMPLETED", "passenger")).toEqual([]);
  });
});
