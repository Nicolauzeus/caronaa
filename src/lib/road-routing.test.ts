import { describe, expect, it, vi } from "vitest";
import { getDrivingDistanceKm } from "./road-routing";

describe("OSRM road-distance adapter", () => {
  it("returns the road distance in km, not a geometric estimate", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 12_345.678 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      getDrivingDistanceKm({ lat: -3.73, lng: -38.52 }, { lat: -3.77, lng: -38.48 }, request),
    ).resolves.toBe(12.345678);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/route/v1/driving/-38.52,-3.73;-38.48,-3.77"),
      expect.objectContaining({
        headers: { Accept: "application/json", "User-Agent": "CARONAA/1.0 (ride fare quote)" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("fails closed for no route, HTTP errors, and invalid coordinates", async () => {
    const noRoute = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 }),
    );
    await expect(
      getDrivingDistanceKm({ lat: -3.7, lng: -38.5 }, { lat: -3.8, lng: -38.4 }, noRoute),
    ).rejects.toThrow("Não foi possível calcular");
    const unavailable = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(
      getDrivingDistanceKm({ lat: -3.7, lng: -38.5 }, { lat: -3.8, lng: -38.4 }, unavailable),
    ).rejects.toThrow("indisponível");
    await expect(
      getDrivingDistanceKm({ lat: 120, lng: -38.5 }, { lat: -3.8, lng: -38.4 }, noRoute),
    ).rejects.toThrow("Coordenadas inválidas");
  });
});
