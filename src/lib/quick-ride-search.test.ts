import { describe, expect, it } from "vitest";
import { buildQuickRideSearch, quickRideSearchSchema } from "./quick-ride-search";
describe("Quick ride route handoff", () => {
  it("preserves resolved labels and coordinates through a URL round trip", () => {
    const search = buildQuickRideSearch({
      origin: "Minha localização atual",
      destination: "Campus Auroras",
      municipality: "Redenção",
      originPoint: { lat: -4.22, lng: -38.71 },
      destinationPoint: { lat: -4.23, lng: -38.72 },
    });
    expect(search.originLat).toBe(-4.22);
    expect(search.originLng).toBe(-38.71);
    expect(search.destinationLat).toBe(-4.23);
    expect(search.destinationLng).toBe(-38.72);

    const params = new URLSearchParams(
      Object.entries(search)
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)]),
    );
    const parsed = quickRideSearchSchema.parse(Object.fromEntries(params));
    expect(parsed.originLat).toBe(-4.22);
    expect(parsed.originLng).toBe(-38.71);
    expect(parsed.destinationLat).toBe(-4.23);
    expect(parsed.destinationLng).toBe(-38.72);
    expect(parsed).toEqual(search);
  });
  it("drops malformed or partial coordinate pairs without inventing zero coordinates", () => {
    expect(
      quickRideSearchSchema.parse({
        origin: "Origem",
        originLat: "",
        originLng: "",
        destinationLat: "-4",
        destinationLng: "999",
      }),
    ).toMatchObject({
      origin: "Origem",
      originLat: undefined,
      originLng: undefined,
      destinationLat: undefined,
      destinationLng: undefined,
    });
    expect(quickRideSearchSchema.parse({ originLat: "-4.2" }).originLat).toBeUndefined();
    expect(quickRideSearchSchema.parse({}).origin).toBe("");
  });
});
