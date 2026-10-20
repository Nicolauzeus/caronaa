import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  route: vi.fn(),
  requests: [] as {
    request_id: string;
    origin_lat: number;
    origin_lng: number;
    destination_lat: number;
    destination_lng: number;
  }[],
}));
vi.mock("./road-routing", () => ({ getDrivingRoute: mocks.route }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { assessOpportunityRoadRoute } from "./opportunity-road-assessment";
const origin = { lat: 0, lng: 0 };
const destination = { lat: 0, lng: 0.1 };
const pickup = { lat: 0, lng: 0.03 };
const dropoff = { lat: 0, lng: 0.06 };
const input = { offerId: "offer", quoteId: "quote" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requests = [];
  mocks.rpc.mockResolvedValue({
    data: {
      origin,
      destination,
      pickup,
      dropoff,
      routePath: [origin, destination],
      durationMinutes: 10,
      distanceKm: 11,
      inventoryVersion: "inventory-v1",
    },
    error: null,
  });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.route.mockResolvedValue({
    durationMinutes: 12,
    distanceKm: 12,
    routePath: [origin, destination],
    legs: [],
  });
  mocks.from.mockImplementation((table: string) => {
    if (table === "ride_road_assessments") return { insert: mocks.insert };
    if (table === "rides")
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: mocks.requests.map((row) => ({ request_id: row.request_id })),
              error: null,
            }),
          }),
        }),
      };
    return { select: () => ({ in: async () => ({ data: mocks.requests, error: null }) }) };
  });
});
describe("road assessment before opportunity reservation", () => {
  it("authorizes with the participant before any privileged access", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(
      assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input),
    ).rejects.toThrow("não está disponível");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.route).not.toHaveBeenCalled();
  });
  it("reports expired quotes so the UI can refresh its fare", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Passenger route quote is invalid or expired" },
    });
    await expect(
      assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input),
    ).rejects.toThrow("cotação do trecho expirou");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("persists a server-only assessment bound to user, quote and inventory", async () => {
    await assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "passenger",
      offer_id: "offer",
      quote_id: "quote",
      request_id: null,
      inventory_version: "inventory-v1",
      added_duration_minutes: 2,
    });
  });
  it("checks existing reserved stops along with the prospective request", async () => {
    mocks.requests = [
      {
        request_id: "existing",
        origin_lat: 0,
        origin_lng: 0.01,
        destination_lat: 0,
        destination_lng: 0.08,
      },
    ];
    await assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input);
    expect(mocks.route.mock.calls[1][0]).toHaveLength(6);
  });
  it("rejects excessive individual detour before persisting an assessment", async () => {
    mocks.route
      .mockResolvedValueOnce({ durationMinutes: 17 })
      .mockResolvedValueOnce({ durationMinutes: 17 });
    await expect(
      assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input),
    ).rejects.toThrow("desvio acima");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects a combined route exceeding fifteen added minutes", async () => {
    mocks.route
      .mockResolvedValueOnce({ durationMinutes: 12 })
      .mockResolvedValueOnce({ durationMinutes: 26 });
    await expect(
      assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input),
    ).rejects.toThrow("desvio acima");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not fabricate road feasibility when routing is unavailable", async () => {
    mocks.route.mockRejectedValue(new Error("offline"));
    await expect(
      assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input),
    ).rejects.toThrow("Nenhuma vaga foi reservada");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("allows idempotent retries even when the last seat was already reserved", async () => {
    mocks.rpc.mockResolvedValue({ data: { alreadyRequested: true }, error: null });
    await assessOpportunityRoadRoute({ rpc: mocks.rpc }, "passenger", input);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
