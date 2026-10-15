import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRoadRoute, routeWaypoints } from "./LiveRideMap";

const points = [
  { lat: -3.7, lng: -38.5, title: "Motorista", type: "driver" as const },
  { lat: -3.72, lng: -38.52, title: "Encontro", type: "meeting" as const },
  { lat: -3.76, lng: -38.54, title: "Destino", type: "destination" as const },
];
afterEach(() => vi.unstubAllGlobals());

describe("live road route", () => {
  it("respects driver, boarding and drop-off order", () => {
    expect(routeWaypoints([...points].reverse()).map(p => p.type)).toEqual(["driver", "meeting", "destination"]);
  });
  it("skips pickup once the ride is in progress", () => {
    expect(routeWaypoints(points,true).map(p => p.type)).toEqual(["driver","destination"]);
  });
  it("requests OSRM geometry and decodes longitude/latitude into Leaflet order", async () => {
    const fn = vi.fn().mockResolvedValue({ok:true,json:async()=>({
      routes:[{distance:12000,duration:900,geometry:{coordinates:[[-38.5,-3.7],[-38.52,-3.72],[-38.54,-3.76]]}}],
    })});
    vi.stubGlobal("fetch",fn);
    const result = await fetchRoadRoute(points);
    expect(fn.mock.calls[0][0]).toContain("-38.5,-3.7;-38.52,-3.72;-38.54,-3.76");
    expect(result).toEqual({geometry:[[-3.7,-38.5],[-3.72,-38.52],[-3.76,-38.54]],distanceKm:12,durationMinutes:15});
  });
  it("rejects invalid provider response; never fabricates straight-line route", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({routes:[]})}));
    await expect(fetchRoadRoute(points)).rejects.toThrow("Trajeto rodoviário indisponível");
  });
  it("does not call provider without two valid waypoints", async () => {
    const fn=vi.fn();
    vi.stubGlobal("fetch",fn);
    expect(await fetchRoadRoute(points.slice(0,1))).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
