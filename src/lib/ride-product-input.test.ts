import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const c = { middleware: () => c, inputValidator: () => c, handler: () => ({}) };
    return c;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { pricedRequestInput, rideInput } from "./ride-matching.functions";
const request = {
  quoteId: "8b9f53e9-2728-4985-b866-d912fba5bd5e",
  rideDate: "2026-11-09",
  departureTime: "09:00",
};
const offer = {
  origin: "Redenção",
  destination: "Acarape",
  rideDate: "2026-11-09",
  departureTime: "09:00",
  idempotencyKey: request.quoteId,
};
describe("Ride publication validation", () => {
  it("rejects multiple seats on a motorcycle for both roles", () => {
    expect(
      pricedRequestInput.safeParse({ ...request, vehicleType: "MOTO", passengerCount: 2 }).success,
    ).toBe(false);
    expect(rideInput.safeParse({ ...offer, vehicleType: "MOTO", availableSeats: 2 }).success).toBe(
      false,
    );
    expect(rideInput.safeParse({ ...offer, vehicleType: "MOTO", availableSeats: 1 }).success).toBe(
      true,
    );
  });
  it("limits car offers to four seats", () => {
    expect(rideInput.safeParse({ ...offer, vehicleType: "CAR", availableSeats: 4 }).success).toBe(
      true,
    );
    expect(rideInput.safeParse({ ...offer, vehicleType: "CAR", availableSeats: 5 }).success).toBe(
      false,
    );
  });
  it("discards browser fares and keeps explicit request filters", () => {
    const parsed = pricedRequestInput.parse({
      ...request,
      vehicleType: "MOTO",
      womenOnly: true,
      passengerCount: 1,
      price: 1,
      distanceKm: 999,
    });
    expect(parsed).toMatchObject({ vehicleType: "MOTO", womenOnly: true, passengerCount: 1 });
    expect(parsed).not.toHaveProperty("price");
    expect(parsed).not.toHaveProperty("distanceKm");
  });
});
