import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMultiStopRoute,
  getDrivingDistanceKm,
  getWalkingRoute,
} from "./road-routing";

const points = [
  { lat: -3.7, lng: -38.5 },
  { lat: -3.6, lng: -38.4 },
  { lat: -3.5, lng: -38.3 },
];
const route = {
  distanceMeters: 12500,
  duration: "1800s",
  polyline: {
    geoJsonLinestring: {
      coordinates: [
        [-38.5, -3.7],
        [-38.4, -3.6],
      ],
    },
  },
  legs: [
    { distanceMeters: 5000, duration: "600s" },
    { distanceMeters: 7500, duration: "1200s" },
  ],
};
const response = (value: unknown) =>
  new Response(JSON.stringify({ routes: [value] }));
beforeEach(() => vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-test-key"));
afterEach(() => vi.unstubAllEnvs());

describe("Google Routes ordered multi-stop route", () => {
  it("preserves waypoint order, road geometry and server authentication", async () => {
    const request = vi.fn().mockResolvedValue(response(route));
    const result = await getMultiStopRoute(points, request);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
    );
    expect(options.headers["X-Goog-Api-Key"]).toBe("server-test-key");
    expect(url).not.toContain("server-test-key");
    const body = JSON.parse(options.body);
    expect(body.origin.location.latLng).toEqual({
      latitude: -3.7,
      longitude: -38.5,
    });
    expect(body.intermediates[0].location.latLng).toEqual({
      latitude: -3.6,
      longitude: -38.4,
    });
    expect(body.destination.location.latLng).toEqual({
      latitude: -3.5,
      longitude: -38.3,
    });
    expect(body.travelMode).toBe("DRIVE");
    expect(result).toEqual({
      distanceKm: 12.5,
      durationMinutes: 30,
      routePath: [
        { lat: -3.7, lng: -38.5 },
        { lat: -3.6, lng: -38.4 },
      ],
      legs: [
        { distanceKm: 5, durationMinutes: 10 },
        { distanceKm: 7.5, durationMinutes: 20 },
      ],
    });
  });
  it("uses the same road distance for fares", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(response({ ...route, legs: [route.legs[0]] }));
    expect(await getDrivingDistanceKm(points[0], points[1], request)).toBe(
      12.5,
    );
  });
  it("fails closed on unavailable API, missing geometry, invalid coordinates and incomplete legs", async () => {
    await expect(
      getMultiStopRoute(
        points,
        vi.fn().mockResolvedValue(new Response("", { status: 503 })),
      ),
    ).rejects.toThrow("indisponível");
    for (const value of [
      { ...route, polyline: undefined },
      { ...route, duration: "NaNs" },
      {
        ...route,
        polyline: {
          geoJsonLinestring: {
            coordinates: [
              [0, 91],
              [0, 0],
            ],
          },
        },
      },
    ]) {
      await expect(
        getMultiStopRoute(points, vi.fn().mockResolvedValue(response(value))),
      ).rejects.toThrow("geometria");
    }
    await expect(
      getMultiStopRoute(
        points,
        vi.fn().mockResolvedValue(response({ ...route, legs: [] })),
      ),
    ).rejects.toThrow("etapas incompletas");
  });
  it("rejects missing server key and malformed inputs before making a request", async () => {
    const request = vi.fn();
    await expect(
      getMultiStopRoute([{ lat: 91, lng: 0 }, points[0]], request),
    ).rejects.toThrow("inválidas");
    await expect(
      getMultiStopRoute(Array(17).fill(points[0]), request),
    ).rejects.toThrow("16 pontos");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", " ");
    await expect(getMultiStopRoute(points, request)).rejects.toThrow(
      "não configurado",
    );
    expect(request).not.toHaveBeenCalled();
  });
});

it("requests walking geometry without a driving-only routing preference", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-test-key");
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ routes: [{ ...route, legs: [route.legs[0]] }] }),
      ),
    );
  const result = await getWalkingRoute(points.slice(0, 2), request);
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.travelMode).toBe("WALK");
  expect(body.routingPreference).toBeUndefined();
  expect(result.routePath).toHaveLength(2);
});
