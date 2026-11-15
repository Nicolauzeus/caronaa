import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ walk: vi.fn(), drive: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      validator: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));
vi.mock("./road-routing", () => ({
  getWalkingRoute: mocks.walk,
  getDrivingRoute: mocks.drive,
}));
vi.mock("./google-request.server", () => ({
  googleActionFetch: () => (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
}));
import { suggestStrictPickup, getStrictPickupContext } from "./safe-pickup.functions";
import { getQuickRideMapContext, getQuickRideApproach } from "./quick-ride-map.functions";
import { createRideOffer } from "./ride-matching.functions";
import { projectOntoRoute } from "./safe-pickup";
const route = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.1 },
  ],
  passenger = { lat: 0.001, lng: 0.02 };
function client(rows: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: rows[table], error: null }),
      };
      return query;
    },
  };
}
const ride = {
  ride_id: "r",
  offer_id: "o",
  request_id: "q",
  passenger_user_id: "p",
  driver_user_id: "d",
  status: "MATCHED",
};
const rows = {
  rides: ride,
  ride_offers: { allow_detours: false, route_path: route },
  ride_requests: { origin_lat: passenger.lat, origin_lng: passenger.lng },
};
const invoke = suggestStrictPickup as unknown as (input: unknown) => Promise<any>;
beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-unit");
  mocks.walk.mockReset();
  mocks.drive.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Authorized strict pickup computation", () => {
  it("rejects other accounts before any paid Google request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      invoke({
        context: { userId: "outsider", supabase: client(rows) },
        data: { rideId: "r", projection: passenger },
      }),
    ).rejects.toThrow("conta");
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.walk).not.toHaveBeenCalled();
  });
  it("skips flexible offers and rejects spoofed projections", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      await invoke({
        context: {
          userId: "p",
          supabase: client({ ...rows, ride_offers: { allow_detours: true } }),
        },
        data: { rideId: "r", projection: passenger },
      }),
    ).toBeNull();
    await expect(
      invoke({
        context: { userId: "p", supabase: client(rows) },
        data: { rideId: "r", projection: { lat: 1, lng: 1 } },
      }),
    ).rejects.toThrow("trajeto mudou");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("allows an authorized highway reference without changing a flexible offer into a strict route", async () => {
    const load = getStrictPickupContext as unknown as (input: unknown) => Promise<any>;
    const result = await load({
      context: {
        userId: "p",
        supabase: client({
          ...rows,
          ride_offers: {
            allow_detours: true,
            route_path: route,
            origin: "CE-060, Redenção",
            destination: "Campus",
          },
        }),
      },
      data: { rideId: "highway" },
    });
    expect(result).toMatchObject({ strict: false, highway: true, route, passenger });
  });
  it("returns a road reference when Nearby is empty and never invents failed walking routes", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ places: [] })));
    vi.stubGlobal("fetch", fetch);
    mocks.walk.mockRejectedValue(new Error("walking unavailable"));
    const input = {
      context: { userId: "p", supabase: client(rows) },
      data: {
        rideId: "strict-fallback",
        projection: projectOntoRoute(passenger, route).point,
      },
    };
    const result = await invoke(input);
    expect(result.pickup.source).toBe("ROUTE_REFERENCE");
    expect(result.walk).toBeNull();
    await invoke(input);
    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.walk).toHaveBeenCalledOnce();
  });
});
describe("Quick ride ETA privacy", () => {
  const id = "01234567-1234-4123-8123-012345678901";
  const map = {
    id,
    status: "SEARCHING",
    origin: { lat: 0, lng: 0 },
    destination: { lat: 0, lng: 1 },
    driver: { lat: 0, lng: 0.1, seenAt: new Date().toISOString() },
  };
  const read = getQuickRideMapContext as unknown as (i: unknown) => Promise<any>;
  const eta = getQuickRideApproach as unknown as (i: unknown) => Promise<any>;
  it("does not reveal a driver or estimate arrival before acceptance", async () => {
    const input = {
      context: {
        userId: "p",
        supabase: {
          rpc: vi.fn().mockResolvedValue({ data: map, error: null }),
        },
      },
      data: { rideId: id },
    };
    expect((await read(input)).driver).toBeNull();
    expect(await eta(input)).toBeNull();
    expect(mocks.drive).not.toHaveBeenCalled();
  });
  it("uses the participant RPC then caches accepted-driver driving ETA", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...map, status: "ACCEPTED" }, error: null });
    const input = {
      context: { userId: "p", supabase: { rpc } },
      data: { rideId: id },
    };
    mocks.drive.mockResolvedValue({
      durationMinutes: 5,
      distanceKm: 1,
      routePath: [],
      legs: [],
    });
    expect((await eta(input)).durationMinutes).toBe(5);
    await eta(input);
    expect(rpc).toHaveBeenCalledWith("quick_ride_map_context", { p_id: id });
    expect(mocks.drive).toHaveBeenCalledOnce();
  });
  it("fails closed on denied participant context", async () => {
    await expect(
      eta({
        context: {
          userId: "p",
          supabase: {
            rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }),
          },
        },
        data: { rideId: id },
      }),
    ).rejects.toThrow("autorização");
    expect(mocks.drive).not.toHaveBeenCalled();
  });
});

describe("Offer route-policy publication", () => {
  function offerClient(missing = false) {
    const rpc = vi.fn().mockResolvedValue({ data: "offer", error: null });
    return {
      rpc,
      from: (table: string) =>
        table === "ride_offers"
          ? {
              select: () => ({
                limit: async () => ({
                  error: missing ? { message: "missing column" } : null,
                }),
              }),
            }
          : {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      vehicle_brand: "Carro",
                      vehicle_description: "Modelo",
                    },
                    error: null,
                  }),
                }),
              }),
            },
    };
  }
  it("passes the explicit strict choice through the existing priced publication RPC", async () => {
    const client = offerClient();
    const invoke = createRideOffer as unknown as (i: unknown) => Promise<unknown>;
    await invoke({
      context: { userId: "p", supabase: client },
      data: { quoteId: "quote", allowDetours: false },
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "publish_filtered_priced_offer",
      expect.objectContaining({
        p_quote_id: "quote",
        p_details: expect.objectContaining({ allowDetours: false }),
      }),
    );
  });
  it("does not publish and lose a preference when the migration is absent", async () => {
    const client = offerClient(true);
    const invoke = createRideOffer as unknown as (i: unknown) => Promise<unknown>;
    await expect(
      invoke({
        context: { userId: "p", supabase: client },
        data: { quoteId: "quote", allowDetours: false },
      }),
    ).rejects.toThrow("0136");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
