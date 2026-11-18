import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reversePassengerPickupAddress } from "./passenger-reverse-address.server";

beforeEach(() => vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key"));
afterEach(() => vi.unstubAllEnvs());

describe("passenger GPS geographic address", () => {
  it("returns a street address while preserving the device coordinates", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{
          types: ["street_address"],
          formatted_address: "Rua das Flores, 12 - Centro, Fortaleza - CE, Brasil",
          address_components: [
            { long_name: "Rua das Flores", types: ["route"] },
            { long_name: "12", types: ["street_number"] },
            { long_name: "Fortaleza", types: ["administrative_area_level_2"] },
            { short_name: "CE", types: ["administrative_area_level_1"] },
            { short_name: "BR", types: ["country"] },
          ],
        }],
      }),
    });
    const result = await reversePassengerPickupAddress(-3.73, -38.52, request);
    expect(result).toMatchObject({
      formattedAddress: "Rua das Flores, 12 - Centro, Fortaleza - CE, Brasil",
      city: "Fortaleza", lat: -3.73, lng: -38.52, isApproximate: true,
    });
    expect(new URL(request.mock.calls[0][0]).pathname).toBe("/maps/api/geocode/json");
    expect(new URL(request.mock.calls[0][0]).searchParams.get("latlng")).toBe("-3.73,-38.52");
  });

  it("does not pretend an administrative region or POI is a pickup address", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", results: [{
        formatted_address: "Fortaleza, Ceará, Brasil",
        types: ["locality"],
      }] }),
    });
    expect(await reversePassengerPickupAddress(-3.73, -38.52, request)).toBeNull();
  });

  it("handles quota failure and rejects invalid coordinates", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    expect(await reversePassengerPickupAddress(-3.73, -38.52, request)).toBeNull();
    expect(await reversePassengerPickupAddress(123, -38.52, request)).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  });
});
