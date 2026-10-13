import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/migrations/0062_multi_stop_route_geometry.sql", "utf8");

describe("multi-stop route geometry migration", () => {
  it("adds nullable geometry for compatibility with historical offers and quotes", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS route_path jsonb");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS route_duration_minutes numeric(10,2)");
    expect(migration).toContain("(route_path IS NULL AND route_duration_minutes IS NULL)");
  });

  it("copies only the caller-owned trusted quote into a new offer", () => {
    expect(migration).toMatch(/quote_id = NEW\.route_quote_id AND user_id = auth\.uid\(\)/);
    expect(migration).toContain("NEW.route_path := quote_row.route_path");
    expect(migration).toContain("NEW.route_duration_minutes := quote_row.route_duration_minutes");
    expect(migration).toContain("CREATE TRIGGER z_offer_route_geometry_before_insert");
  });

  it("validates geometry and prevents it changing after publication", () => {
    expect(migration).toContain("public.has_valid_route_path(route_path)");
    expect(migration).toContain("jsonb_typeof(point->'lat') IS DISTINCT FROM 'number'");
    expect(migration).toContain("CREATE TRIGGER offer_route_geometry_immutable");
    expect(migration).toContain("A geometria da oferta é imutável após a publicação");
  });
});
