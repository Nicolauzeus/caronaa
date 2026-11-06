import { afterEach, describe, expect, it, vi } from "vitest";
import {
  projectOntoRoute,
  chooseStrictPickup,
  metersBetween,
} from "./safe-pickup";
import { sessionRequest } from "./session-request-cache";
import { nearbyPickupReferences } from "./safe-pickup.functions";
const road = [
  { lat: -4.2, lng: -38.8 },
  { lat: -4.2, lng: -38.7 },
];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("zero-API strict pickup geometry", () => {
  it("projects onto a segment, not just the nearest vertex", () => {
    const result = projectOntoRoute({ lat: -4.199, lng: -38.75 }, road);
    expect(result.point.lat).toBe(-4.2);
    expect(result.point.lng).toBeCloseTo(-38.75, 8);
    expect(result.fraction).toBeCloseTo(0.5, 8);
    expect(result.distanceMeters).toBeGreaterThan(100);
  });
  it("clamps outside the route and handles repeated vertices", () => {
    expect(projectOntoRoute({ lat: -4.2, lng: -39 }, road).point).toEqual(
      road[0],
    );
    expect(
      projectOntoRoute({ lat: -4.2, lng: -38.6 }, [road[0], road[0], road[1]])
        .point,
    ).toEqual(road[1]);
  });
  it("rejects invalid or empty geometry", () => {
    expect(() => projectOntoRoute({ lat: 91, lng: 0 }, road)).toThrow(
      "inválido",
    );
    expect(() => projectOntoRoute(road[0], [])).toThrow("inválido");
  });
  it("uses the road projection when the interior has no commercial references", () => {
    const projected = projectOntoRoute(
      { lat: -4.199, lng: -38.75 },
      road,
    ).point;
    expect(chooseStrictPickup(projected, road, [])).toMatchObject({
      point: projected,
      source: "ROUTE_REFERENCE",
      needsConfirmation: true,
    });
  });
  it("keeps the boarding coordinate on the strict road and rejects off-route venues", () => {
    const point = { lat: -4.2, lng: -38.75 };
    const result = chooseStrictPickup(point, road, [
      { id: "offroad", title: "Distante", point: { lat: -4.198, lng: -38.75 } },
      { id: "gas", title: "Posto", point: { lat: -4.1999, lng: -38.75 } },
    ]);
    expect(result.source).toBe("PLACE_REFERENCE");
    expect(result.placeId).toBe("gas");
    expect(
      metersBetween(projectOntoRoute(result.point, road).point, result.point),
    ).toBeLessThan(0.1);
  });
});
describe("Nearby budget and failure behavior", () => {
  it("makes one field-masked request within 400m for the configured categories", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-pickup-test");
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            places: [
              {
                id: "gas",
                displayName: { text: "Posto" },
                location: { latitude: -4.2, longitude: -38.75 },
              },
            ],
          }),
        ),
      );
    const values = await nearbyPickupReferences(road[0], request);
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    const body = JSON.parse(options.body);
    expect(body.locationRestriction.circle.radius).toBe(400);
    expect(body.includedTypes).toEqual([
      "gas_station",
      "transit_station",
      "convenience_store",
      "shopping_mall",
      "parking",
    ]);
    expect(options.headers["X-Goog-FieldMask"]).toBe(
      "places.id,places.displayName,places.location",
    );
    expect(values[0].point).toEqual({ lat: -4.2, lng: -38.75 });
  });
  it("turns empty, malformed and failed nearby responses into a rural fallback", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-pickup-test");
    for (const reply of [
      new Response(JSON.stringify({ places: [] })),
      new Response("{}"),
      new Response("denied", { status: 403 }),
    ]) {
      const refs = await nearbyPickupReferences(
        road[0],
        vi.fn().mockResolvedValue(reply),
      );
      expect(chooseStrictPickup(road[0], road, refs).source).toBe(
        "ROUTE_REFERENCE",
      );
    }
    expect(
      await nearbyPickupReferences(
        road[0],
        vi.fn().mockRejectedValue(new Error("network")),
      ),
    ).toEqual([]);
  });
  it("deduplicates concurrent requests and caches the result for the session window", async () => {
    const request = vi.fn().mockResolvedValue("cached");
    const first = sessionRequest("geometry-test-once", request),
      second = sessionRequest("geometry-test-once", request);
    expect(first).toBe(second);
    expect(await first).toBe("cached");
    expect(await sessionRequest("geometry-test-once", request)).toBe("cached");
    expect(request).toHaveBeenCalledOnce();
  });
});
