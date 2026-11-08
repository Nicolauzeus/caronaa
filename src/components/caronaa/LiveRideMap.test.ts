import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRoadRoute, routeWaypoints } from "./LiveRideMap";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
vi.mock("@/lib/map-routing.functions", () => ({ getMapDrivingRoute: vi.fn() }));
const points = [
  { lat: -3.7, lng: -38.5, title: "Motorista", type: "driver" as const },
  { lat: -3.72, lng: -38.52, title: "Encontro", type: "meeting" as const },
  { lat: -3.76, lng: -38.54, title: "Destino", type: "destination" as const },
];
afterEach(() => vi.clearAllMocks());
describe("live Google road route", () => {
  it("respects driver, boarding and drop-off order", () => {
    expect(routeWaypoints([...points].reverse()).map((p) => p.type)).toEqual([
      "driver",
      "meeting",
      "destination",
    ]);
    expect(routeWaypoints(points, true).map((p) => p.type)).toEqual([
      "driver",
      "destination",
    ]);
  });
  it("uses the planned origin for preview routes without a driver", () => {
    const origin = { lat: -3.71, lng: -38.49, title: "Origem", type: "origin" as const };
    expect(routeWaypoints([origin, points[2]]).map((p) => p.type)).toEqual(["origin", "destination"]);
  });
  it("requests server Google geometry without exposing the route key", async () => {
    vi.mocked(getMapDrivingRoute).mockResolvedValue({
      distanceKm: 12,
      durationMinutes: 15,
      routePath: points.map(({ lat, lng }) => ({ lat, lng })),
      legs: [],
    });
    expect(await fetchRoadRoute(points)).toEqual({
      geometry: [
        [-3.7, -38.5],
        [-3.72, -38.52],
        [-3.76, -38.54],
      ],
      distanceKm: 12,
      durationMinutes: 15,
    });
    expect(getMapDrivingRoute).toHaveBeenCalledWith({
      data: { points: points.map(({ lat, lng }) => ({ lat, lng })) },
      signal: undefined,
    });
  });
  it("propagates provider errors without fabricating a straight-line route", async () => {
    vi.mocked(getMapDrivingRoute).mockRejectedValue(
      new Error("Google indisponível"),
    );
    await expect(fetchRoadRoute(points)).rejects.toThrow("indisponível");
  });
  it("does not request a route without two valid waypoints", async () => {
    expect(await fetchRoadRoute(points.slice(0, 1))).toBeNull();
    expect(getMapDrivingRoute).not.toHaveBeenCalled();
  });
});
