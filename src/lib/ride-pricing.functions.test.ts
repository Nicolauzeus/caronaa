import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  participantRead: vi.fn(),
  adminRead: vi.fn(),
  adminInsert: vi.fn(),
  quoteInsert: vi.fn(),
  rpc: vi.fn(),
  geocode: vi.fn(),
  route: vi.fn(),
}));
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
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ ...query(mocks.adminRead), insert: mocks.adminInsert }),
    rpc: mocks.rpc,
  },
}));
vi.mock("./location/service", () => ({ geocodeAddressService: mocks.geocode }));
vi.mock("./road-routing", () => ({ getDrivingDistanceKm: mocks.route }));
import { calculateRideQuote, previewRequestFare } from "./ride-pricing.functions";

function query(read: typeof mocks.participantRead) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: read };
  return chain;
}
const ride = {
  ride_id: "r",
  request_id: "q",
  passenger_user_id: "p",
  driver_user_id: "d",
  status: "MATCHED",
  response_expires_at: "2099-01-01T00:00:00Z",
};
const saved = {
  route_distance_km: 11,
  passenger_price: 6,
  passenger_group_total: 12,
  tariff_reference: "caronaa-km-6-per-11-v1",
};
const invoke = calculateRideQuote as unknown as (input: unknown) => Promise<unknown>;
const invokePreview = previewRequestFare as unknown as (input: unknown) => Promise<unknown>;
const input = {
  context: { userId: "p", supabase: { from: () => query(mocks.participantRead) } },
  data: { rideId: "r" },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.participantRead
    .mockResolvedValueOnce({ data: ride, error: null })
    .mockResolvedValue({ data: saved, error: null });
  mocks.adminRead.mockResolvedValue({
    data: { user_id: "p", origin: "A", destination: "B", passenger_count: 2 },
    error: null,
  });
  mocks.adminInsert.mockReturnValue({ select: () => ({ single: mocks.quoteInsert }) });
  mocks.quoteInsert.mockResolvedValue({ data: { quote_id: "quote-1" }, error: null });
  mocks.geocode.mockResolvedValue({ lat: -3.7, lng: -38.5, isApproximate: false });
  mocks.route.mockResolvedValue(11);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
describe("trusted quote persistence", () => {
  it("saves the server-calculated group fare and reads it back", async () => {
    expect(await invoke(input)).toMatchObject({ pricePerPassenger: 6, groupTotal: 12 });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "persist_ride_route_quote",
      expect.objectContaining({ p_passenger_price: 6, p_group_total: 12 }),
    );
  });
  it("returns the persisted winner when a concurrent save returns false", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    mocks.route.mockResolvedValue(22);
    expect(await invoke(input)).toMatchObject({ pricePerPassenger: 6, groupTotal: 12 });
  });
  it("rejects nonparticipants before privileged reads", async () => {
    await expect(
      invoke({ ...input, context: { ...input.context, userId: "outsider" } }),
    ).rejects.toThrow("não pode");
    expect(mocks.adminRead).not.toHaveBeenCalled();
  });
  it("ignores browser-supplied prices and distance", async () => {
    await invoke({ ...input, data: { rideId: "r", price: 0, distanceKm: 1 } });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "persist_ride_route_quote",
      expect.objectContaining({ p_route_distance_km: 11, p_passenger_price: 6 }),
    );
  });
  it("fails without persistence when routing fails", async () => {
    mocks.route.mockRejectedValue(new Error("unavailable"));
    await expect(invoke(input)).rejects.toThrow("calcular o preço");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not requote historical accepted trips", async () => {
    mocks.participantRead
      .mockReset()
      .mockResolvedValue({ data: { ...ride, status: "COMPLETED" }, error: null });
    await expect(invoke(input)).rejects.toThrow("pendente de aceite");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("passenger fare estimate before requesting a ride", () => {
  const previewInput = {
    context: { userId: "p", supabase: {} },
    data: { origin: "Rua A, Fortaleza", destination: "Rua B, Fortaleza" },
  };

  it("persists the authenticated, server-calculated road quote before a request", async () => {
    mocks.route.mockResolvedValue(11);
    await expect(invokePreview(previewInput)).resolves.toMatchObject({
      distanceKm: 11,
      pricePerPassenger: 6,
      tariffReference: "caronaa-km-6-per-11-v1",
      quoteId: "quote-1",
    });
    expect(mocks.geocode).toHaveBeenCalledTimes(2);
    expect(mocks.route).toHaveBeenCalledTimes(1);
    expect(mocks.adminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "p",
        origin: "Rua A, Fortaleza",
        destination: "Rua B, Fortaleza",
        distance_km: 11,
        passenger_price: 6,
      }),
    );
  });

  it("quotes captured GPS coordinates without trying to geocode a placeholder", async () => {
    await expect(
      invokePreview({
        ...previewInput,
        data: {
          origin: "Minha localização atual",
          destination: "Campus",
          originLat: -4.22,
          originLng: -38.71,
          destinationLat: -4.23,
          destinationLng: -38.72,
          price: 0,
        },
      }),
    ).resolves.toMatchObject({ pricePerPassenger: 6, originPoint: { lat: -4.22, lng: -38.71 } });
    expect(mocks.geocode).not.toHaveBeenCalled();
    expect(mocks.route).toHaveBeenCalledWith(
      { lat: -4.22, lng: -38.71 },
      { lat: -4.23, lng: -38.72 },
    );
    expect(mocks.adminInsert).toHaveBeenCalledWith(
      expect.objectContaining({ passenger_price: 6, origin_lat: -4.22, origin_lng: -38.71 }),
    );
  });

  it("does not estimate when an address is approximate or road routing fails", async () => {
    mocks.geocode.mockResolvedValue({ lat: -3.7, lng: -38.5, isApproximate: true });
    await expect(invokePreview(previewInput)).rejects.toThrow("Revise os endereços");

    mocks.geocode.mockResolvedValue({ lat: -3.7, lng: -38.5, isApproximate: false });
    mocks.route.mockRejectedValue(new Error("routing unavailable"));
    await expect(invokePreview(previewInput)).rejects.toThrow("estimar o preço");
  });
});
