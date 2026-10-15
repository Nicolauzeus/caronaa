import { describe, expect, it } from "vitest";
import { quoteGroupBooking } from "./group-booking";

describe("group booking", () => {
  it("charges one reservation owner the sum of each individual route", () => {
    const quote = quoteGroupBooking([
      { destination: "Centro", roadDistanceKm: 11 },
      { destination: "Aldeota", roadDistanceKm: 5.5 },
      { destination: "Messejana", roadDistanceKm: 22 },
    ]);
    expect(quote.passengers.map((p) => p.price)).toEqual([6, 3, 12]);
    expect(quote.totalCents).toBe(2100);
    expect(quote.total).toBe(21);
    expect(quote.passengerCount).toBe(3);
    expect(quote.payer).toBe("REQUEST_OWNER");
    expect(quote.paymentMethod).toBe("DRIVER_PIX");
  });

  it("supports passengers exiting at the same destination", () => {
    expect(quoteGroupBooking([
      { destination: "Centro", roadDistanceKm: 11 },
      { destination: "Centro", roadDistanceKm: 11 },
    ]).total).toBe(12);
  });

  it("rejects invalid group sizes and route distances", () => {
    expect(() => quoteGroupBooking([])).toThrow();
    expect(() => quoteGroupBooking(Array.from({ length: 7 }, () => ({
      destination: "Centro", roadDistanceKm: 11,
    })))).toThrow();
    expect(() => quoteGroupBooking([{ destination: "Centro", roadDistanceKm: 0 }])).toThrow();
    expect(() => quoteGroupBooking([{ destination: "", roadDistanceKm: 11 }])).toThrow();
  });
});
