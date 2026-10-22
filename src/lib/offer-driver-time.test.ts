import { describe, expect, it } from "vitest";
import { departureAfterMinutes, isFutureOfferDeparture } from "./offer-driver-time";

describe("Driver offer departure shortcuts", () => {
  it("formats quick departure in Fortaleza rather than UTC", () => {
    expect(departureAfterMinutes(5, new Date("2026-10-22T02:58:00Z"))).toEqual({
      date: "2026-10-22", time: "00:03",
    });
  });
  it("supports shortcuts over month boundary", () => {
    expect(departureAfterMinutes(30, new Date("2026-11-01T02:40:00Z"))).toEqual({
      date: "2026-11-01", time: "00:10",
    });
  });
  it("rejects past and invalid publication departures", () => {
    const now = new Date("2026-10-22T15:00:00Z");
    expect(isFutureOfferDeparture("2026-10-22", "12:01", now)).toBe(true);
    expect(isFutureOfferDeparture("2026-10-22", "12:00", now)).toBe(false);
    expect(isFutureOfferDeparture("2026-10-22", "invalid", now)).toBe(false);
  });
});
