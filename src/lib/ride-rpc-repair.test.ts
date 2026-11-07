import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("canonical priced ride creation RPC contract", () => {
  const service = readFileSync("src/lib/ride-matching.functions.ts", "utf8");
  const repair = readFileSync(
    "drizzle/migrations/0032_canonical_ride_creation_rpcs.sql",
    "utf8",
  );
  const priced = readFileSync(
    "drizzle/migrations/0060_partial_passenger_route_quotes.sql",
    "utf8",
  );

  it("requires a trusted road quote and never accepts a client-provided price", () => {
    expect(service).toContain("quoteId: z.string().uuid()");
    expect(service).toMatch(/client\.rpc\(\s*"create_filtered_priced_ride_request"/);
    expect(service).toContain("p_quote_id: data.quoteId");
    expect(service).not.toContain("p_price: data.price");
    expect(priced).toContain("request_available_ride_segment");
  });

  it("publishes offers with the priced RPC and verified vehicle details", () => {
    expect(service).toMatch(
      /\(context\.supabase as any\)\.rpc\(\s*"publish_filtered_priced_offer"/,
    );
    expect(service).toContain("p_quote_id: data.quoteId");
    expect(service).toContain("profile.vehicle_brand");
    expect(service).toContain("if (!data.quoteId)");
  });

  it("never retries a rejected request using an unpriced legacy creation path", () => {
    expect(
      service.match(/\.rpc\(\s*"create_filtered_priced_ride_request"/g),
    ).toHaveLength(1);
    expect(service.match(/\.rpc\(\s*"publish_filtered_priced_offer"/g)).toHaveLength(1);
    expect(service).not.toMatch(/\.rpc\(\s*"create_ride_(?:request|offer)"/);
  });

  it("keeps historic canonical RPC repair without destructive cascade", () => {
    expect(repair).toContain(
      "DROP FUNCTION IF EXISTS public.create_ride_offer",
    );
    expect(repair).toContain(
      "DROP FUNCTION IF EXISTS public.create_ride_request",
    );
    expect(repair).not.toContain("CASCADE");
    expect(repair).toContain("NOTIFY pgrst, 'reload schema'");
  });
});

