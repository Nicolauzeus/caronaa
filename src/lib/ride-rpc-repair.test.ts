import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("canonical ride creation RPC contract", () => {
  const service = readFileSync("src/lib/ride-matching.functions.ts", "utf8");
  const repair = readFileSync("drizzle/migrations/0032_canonical_ride_creation_rpcs.sql", "utf8");
  it("sends absent coordinates and request price explicitly instead of omitting arguments", () => {
    const isPreferred = service.includes("create_preferred_ride");
    if (isPreferred) {
      expect(service).toContain('p_kind: "request"');
      expect(service).toContain("p_details: data");
    } else {
      expect(service).toContain("p_origin_lat: data.originLat ?? null");
      expect(service).toContain("p_destination_lng: data.destinationLng ?? null");
      expect(service).toContain("p_price: data.price ?? null");
    }
  });
  it("never retries a failed creation with a less complete payload", () => {
    const isPreferred = service.includes("create_preferred_ride");
    if (isPreferred) {
      expect(service.match(/\.rpc\("create_preferred_ride"/g)).toHaveLength(2);
    } else {
      expect(service.match(/\.rpc\("create_ride_request"/g)).toHaveLength(1);
      expect(service.match(/\.rpc\("create_ride_offer"/g)).toHaveLength(1);
    }
  });
  it("removes stale overloads without cascading into dependent application objects", () => {
    expect(repair).toContain("DROP FUNCTION IF EXISTS public.create_ride_offer");
    expect(repair).toContain("DROP FUNCTION IF EXISTS public.create_ride_request");
    expect(repair).not.toContain("CASCADE");
    expect(repair).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
