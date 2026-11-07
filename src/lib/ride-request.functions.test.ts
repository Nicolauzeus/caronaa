import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { createRideRequest } from "./ride-matching.functions";

const invoke = createRideRequest as unknown as (input: unknown) => Promise<{ requestId: string }>;

describe("priced passenger route request", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpc.mockResolvedValue({ data: "request-1", error: null });
  });

  it("sends only the persisted quote id and trip metadata to the trusted RPC", async () => {
    await expect(
      invoke({
        context: { supabase: { rpc } },
        data: {
          quoteId: "8b9f53e9-2728-4985-b866-d912fba5bd5e",
          rideDate: "2026-10-15",
          departureTime: "09:15",
          passengerCount: 2,
          vehicleType: "CAR",
          womenOnly: false,
          timeToleranceMinutes: 15,
          preferences: {
            conversation: "quiet",
            music: "off",
            smoking: "no",
            pets: "no",
            luggage: 1,
          },
          // Any browser-supplied fare and coordinates are excluded by the schema.
          distanceKm: 999,
          price: 0,
          originLat: 0,
        },
      }),
    ).resolves.toEqual({ requestId: "request-1" });

    expect(rpc).toHaveBeenCalledWith("create_filtered_priced_ride_request", {
      p_vehicle_type: "CAR",
      p_women_only: false,
      p_quote_id: "8b9f53e9-2728-4985-b866-d912fba5bd5e",
      p_ride_date: "2026-10-15",
      p_departure_time: "09:15",
      p_passenger_count: 2,
      p_time_tolerance_minutes: 15,
      p_preferences: { conversation: "quiet", music: "off", smoking: "no", pets: "no", luggage: 1 },
    });
  });

  it("fails closed if the RPC does not return a request identifier", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(
      invoke({
        context: { supabase: { rpc } },
        data: {
          quoteId: "8b9f53e9-2728-4985-b866-d912fba5bd5e",
          rideDate: "2026-10-15",
          departureTime: "09:15",
        },
      }),
    ).rejects.toThrow("identificador inválido");
  });
});

