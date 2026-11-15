import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeRadarMunicipality } from "./professional-radar-civic-geocode.server";

vi.mock("@/lib/location/google-server-key", () => ({
  getGoogleServerKey: () => "unit-test-server-key",
}));

const civic = {
  status: "OK",
  results: [{
    types: ["administrative_area_level_2", "political"],
    address_components: [
      { long_name: "Redenção", short_name: "Redenção", types: ["administrative_area_level_2", "political"] },
      { long_name: "Ceará", short_name: "CE", types: ["administrative_area_level_1", "political"] },
      { long_name: "Brasil", short_name: "BR", types: ["country", "political"] },
    ],
  }],
};

describe("F07: server civic reverse geocoding", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ok: true,status: 200,json: async () => civic})));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("obtains municipality from civic address components, not nearby businesses", async () => {
    await expect(reverseGeocodeRadarMunicipality(-4.225, -38.73))
      .resolves.toEqual({city:"Redenção",state:"CE",country:"BR"});
    const calls = vi.mocked(fetch).mock.calls;
    const request = new URL(String(calls[0][0]));
    expect(request.pathname).toBe("/maps/api/geocode/json");
    expect(request.searchParams.get("result_type")).toContain("administrative_area_level_2");
    expect(request.searchParams.get("key")).toBe("unit-test-server-key");
  });

  it("rejects absent civic components without inventing a municipality", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ok:true,status:200,json:async()=>({status:"ZERO_RESULTS",results:[]})})));
    await expect(reverseGeocodeRadarMunicipality(-4.225, -38.73)).resolves.toBeNull();
  });

  it("converts upstream quota failure to a safe code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ok:false,status:429})));
    await expect(reverseGeocodeRadarMunicipality(-4.225, -38.73))
      .rejects.toThrow("GOOGLE_QUOTA_LIMITED");
  });

  it("does not query Google with invalid coordinates", async () => {
    await expect(reverseGeocodeRadarMunicipality(91, -38.73)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
