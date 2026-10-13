import { describe, expect, it, vi } from "vitest";
import { getMultiStopRoute } from "./road-routing";

describe("OSRM ordered multi-stop route query", () => {
  it("preserves supplied waypoint order and maps full road geometry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 12500,
              duration: 1800,
              geometry: {
                type: "LineString",
                coordinates: [
                  [-38.5, -3.7],
                  [-38.4, -3.6],
                ],
              },
              legs: [
                { distance: 5000, duration: 600 },
                { distance: 7500, duration: 1200 },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const route = await getMultiStopRoute(
      [
        { lat: -3.7, lng: -38.5 },
        { lat: -3.6, lng: -38.4 },
        { lat: -3.5, lng: -38.3 },
      ],
      fetchMock as unknown as typeof fetch,
    );

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/-38.5,-3.7;-38.4,-3.6;-38.3,-3.5?");
    expect(requestedUrl).toContain("overview=full&geometries=geojson");
    expect(route.distanceKm).toBe(12.5);
    expect(route.durationMinutes).toBe(30);
    expect(route.routePath).toEqual([
      { lat: -3.7, lng: -38.5 },
      { lat: -3.6, lng: -38.4 },
    ]);
    expect(route.legs).toHaveLength(2);
  });

  it("fails closed if OSRM is unavailable or geometry is missing", async () => {
    await expect(
      getMultiStopRoute(
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        vi.fn().mockResolvedValue(new Response("", { status: 503 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow("indisponível");
    await expect(
      getMultiStopRoute(
        [
          { lat: 0, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "Ok",
              routes: [{ distance: 1000, duration: 60 }],
            }),
            { status: 200 },
          ),
        ) as unknown as typeof fetch,
      ),
    ).rejects.toThrow("geometria");
  });

  it("rejects invalid coordinates and excessive waypoint counts before network access", async () => {
    const fetchMock = vi.fn();
    await expect(
      getMultiStopRoute(
        [
          { lat: 91, lng: 0 },
          { lat: 1, lng: 1 },
        ],
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow("inválidas");
    await expect(
      getMultiStopRoute(
        Array.from({ length: 15 }, (_, i) => ({ lat: i, lng: i })),
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow("14 pontos");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
