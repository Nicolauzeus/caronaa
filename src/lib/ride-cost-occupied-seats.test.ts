import { describe, expect, it } from "vitest";
import { calculatePassengerFare, calculateRequestedGroupFare } from "./ride-cost";

describe("Passenger reservation fares do not depend on vehicle capacity", () => {
  it("charges one requested passenger regardless of seven offered seats", () => {
    const offeredSeats = 7;
    const price = calculatePassengerFare(3.95);
    expect(price).toBe(2.15);
    expect(calculateRequestedGroupFare(price, 1)).toBe(2.15);
    expect(calculateRequestedGroupFare(price, 1)).not.toBe(calculateRequestedGroupFare(price, offeredSeats - 1));
  });
  it("charges two only if two passengers are explicitly in the request", () => {
    expect(calculateRequestedGroupFare(2.15, 2)).toBe(4.30);
  });
  it("rejects a zero, fractional or excessive passenger count", () => {
    expect(() => calculateRequestedGroupFare(2.15, 0)).toThrow();
    expect(() => calculateRequestedGroupFare(2.15, 1.5)).toThrow();
    expect(() => calculateRequestedGroupFare(2.15, 7)).toThrow();
  });
});
