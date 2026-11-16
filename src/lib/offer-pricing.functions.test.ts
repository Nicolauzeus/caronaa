import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  geocode: vi.fn(),
  route: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  persist: vi.fn(),
  request: vi.fn(),
  googleActionFetch: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (data: unknown): unknown => data;
    const chain = {
      middleware: () => chain,
      inputValidator: (validator: typeof validate) => {
        validate = validator;
        return chain;
      },
      handler: (handler: (input: { context: unknown; data: unknown }) => Promise<unknown>) =>
        async (input: { context: unknown; data: unknown }) =>
          handler({ ...input, data: validate(input.data) }),
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from },
}));
vi.mock("./location/service", () => ({ geocodeAddressService: mocks.geocode }));
vi.mock("./road-routing", () => ({ getDrivingRoute: mocks.route }));
vi.mock("./google-request.server", () => ({ googleActionFetch: mocks.googleActionFetch }));

import { quoteOfferRoute } from "./offer-pricing.functions";

const invoke = quoteOfferRoute as unknown as (input: unknown) => Promise<unknown>;
const originPoint = { lat: -3.730123, lng: -38.530456 };
const destinationPoint = { lat: -3.750123, lng: -38.510456 };
// Google may snap the line endpoints to the road; they are not the selected points.
const routePath = [{ lat: -3.7303, lng: -38.5307 }, { lat: -3.7503, lng: -38.5107 }];
const route = { distanceKm: 11, durationMinutes: 18, routePath };
const expiresAt = "2099-01-01T12:30:00.000Z";
const context = { userId: "authenticated-driver" };
const addresses = { origin: "Rua A, Fortaleza", destination: "Universidade de Fortaleza" };
const selected = {
  origin: "Ponto selecionado no mapa",
  destination: addresses.destination,
  originPoint,
  destinationPoint,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.googleActionFetch.mockReturnValue(mocks.request);
  mocks.geocode
    .mockResolvedValueOnce({ ...originPoint, isApproximate: false })
    .mockResolvedValue({ ...destinationPoint, isApproximate: false });
  mocks.route.mockResolvedValue(route);
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.persist });
  mocks.persist.mockResolvedValue({
    data: { quote_id: "saved-trusted-quote", expires_at: expiresAt },
    error: null,
  });
});

describe("trusted offer route quote", () => {
  it("uses selected coordinates and persists actual road geometry without geocoding a map label", async () => {
    await expect(invoke({ context, data: selected })).resolves.toEqual({
      quoteId: "saved-trusted-quote",
      expiresAt,
      originPoint,
      destinationPoint,
      distanceKm: 11,
      durationMinutes: 18,
      pricePerPassenger: 6,
      routePath,
    });
    expect(mocks.geocode).not.toHaveBeenCalled();
    expect(mocks.googleActionFetch).toHaveBeenCalledWith(
      context.userId, "quote", "quoteOfferRoute",
    );
    expect(mocks.route).toHaveBeenCalledExactlyOnceWith(
      [originPoint, destinationPoint], mocks.request,
    );
    expect(mocks.from).toHaveBeenCalledWith("offer_route_quotes");
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: context.userId,
      origin: selected.origin,
      destination: selected.destination,
      origin_lat: originPoint.lat,
      origin_lng: originPoint.lng,
      destination_lat: destinationPoint.lat,
      destination_lng: destinationPoint.lng,
      distance_km: 11,
      route_path: routePath,
      route_duration_minutes: 18,
      passenger_price: 6,
      tariff_reference: "caronaa-km-6-per-11-v1",
    });
    expect(mocks.select).toHaveBeenCalledWith("quote_id, expires_at");
  });

  it("keeps the existing address-only offer flow and resolves both endpoints", async () => {
    await expect(invoke({ context, data: addresses })).resolves.toMatchObject({
      quoteId: "saved-trusted-quote", originPoint, destinationPoint, pricePerPassenger: 6,
    });
    expect(mocks.geocode).toHaveBeenCalledTimes(2);
    expect(mocks.geocode).toHaveBeenNthCalledWith(1, addresses.origin, mocks.request);
    expect(mocks.geocode).toHaveBeenNthCalledWith(2, addresses.destination, mocks.request);
    expect(mocks.route).toHaveBeenCalledWith([originPoint, destinationPoint], mocks.request);
  });

  it.each(["origin", "destination"] as const)(
    "geocodes only the missing %s coordinates in a mixed request",
    async (missing) => {
      const data = missing === "origin"
        ? { ...addresses, destinationPoint }
        : { ...addresses, originPoint };
      const resolved = missing === "origin" ? originPoint : destinationPoint;
      mocks.geocode.mockReset().mockResolvedValue({ ...resolved, isApproximate: false });
      await invoke({ context, data });
      expect(mocks.geocode).toHaveBeenCalledExactlyOnceWith(addresses[missing], mocks.request);
      expect(mocks.route).toHaveBeenCalledWith([originPoint, destinationPoint], mocks.request);
    },
  );

  it("uses the canonical road fare without a minimum or browser-provided pricing", async () => {
    mocks.route.mockResolvedValue({ ...route, distanceKm: 1 });
    await expect(invoke({ context, data: {
      ...selected, distanceKm: 99, pricePerPassenger: 0, userId: "another-user", routePath: [],
    } })).resolves.toMatchObject({ distanceKm: 1, pricePerPassenger: 0.55 });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: context.userId,
      distance_km: 1,
      passenger_price: 0.55,
      route_path: routePath,
    }));
  });

  it.each([
    ["latitude outside bounds", { originPoint: { lat: 91, lng: -38.5 } }],
    ["longitude outside bounds", { destinationPoint: { lat: -3.7, lng: -181 } }],
    ["NaN", { originPoint: { lat: NaN, lng: -38.5 } }],
    ["infinite coordinate", { destinationPoint: { lat: -3.7, lng: Infinity } }],
    ["incomplete coordinate", { originPoint: { lat: -3.7 } }],
    ["string coordinate", { destinationPoint: { lat: "-3.7", lng: -38.5 } }],
  ])("rejects %s before routing or trusted persistence", async (_name, change) => {
    await expect(invoke({ context, data: { ...selected, ...change } })).rejects.toThrow();
    expect(mocks.geocode).not.toHaveBeenCalled();
    expect(mocks.route).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["unresolved", null],
    ["approximate", { ...originPoint, isApproximate: true }],
    ["incomplete", { lat: originPoint.lat, isApproximate: false }],
  ])("does not save a trusted quote for an %s address", async (_name, result) => {
    mocks.geocode.mockReset().mockResolvedValue(result);
    await expect(invoke({ context, data: addresses })).rejects.toThrow("Revise os endereços");
    expect(mocks.route).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not save a trusted quote when geocoding fails", async () => {
    mocks.geocode.mockReset().mockRejectedValue(new Error("Geocoding unavailable"));
    await expect(invoke({ context, data: addresses })).rejects.toThrow();
    expect(mocks.route).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not invent a route or save a quote when the route provider fails", async () => {
    mocks.route.mockRejectedValue(new Error("Provider unavailable"));
    await expect(invoke({ context, data: selected })).rejects.toThrow("percurso rodoviário");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid road distance %s before persistence", async (distanceKm) => {
    mocks.route.mockResolvedValue({ ...route, distanceKm });
    await expect(invoke({ context, data: selected })).rejects.toThrow("distância rodoviária");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["database error", { data: null, error: { message: "Insert failed" } }],
    ["missing row", { data: null, error: null }],
    ["invalid expiry", { data: { quote_id: "quote", expires_at: "invalid" }, error: null }],
    ["missing expiry", { data: { quote_id: "quote" }, error: null }],
  ])("does not return a usable quote after %s", async (_name, result) => {
    mocks.persist.mockResolvedValue(result);
    await expect(invoke({ context, data: selected })).rejects.toThrow("salvar o preço");
  });
});
