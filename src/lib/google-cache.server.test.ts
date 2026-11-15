import { describe, expect, it } from "vitest";
import { googleCacheExpiry, googleCacheHash } from "./google-cache.server";

describe("private Google cache keys and expiry", () => {
  const now = Date.parse("2026-11-15T20:00:00Z");
  it("expires searchText after exactly 30 days", () => {
    expect(googleCacheExpiry("places_search_text", now)).toBe("2026-12-15T20:00:00.000Z");
  });
  it("expires route geometry after exactly 10 minutes", () => {
    expect(googleCacheExpiry("route_quote", now)).toBe("2026-11-15T20:10:00.000Z");
  });
  it("separates different routing modes", async () => {
    expect(await googleCacheHash({ points: [1, 2], mode: "DRIVE" })).not.toBe(await googleCacheHash({ points: [1, 2], mode: "WALK" }));
  });
  it("does not expose search text in the key", async () => {
    const hash = await googleCacheHash({ text: "Redenção" });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("Redenção");
  });
});