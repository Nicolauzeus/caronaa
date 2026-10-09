import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareRideRecency } from "./ride-order";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0054_ride_publication_modified_at.sql"),
  "utf8",
);

describe("ride publication ordering", () => {
  it("orders by latest relevant modification then creation time", () => {
    const older = {
      id: "old",
      updatedAt: "2026-10-01T12:00:00Z",
      createdAt: "2026-10-01T12:00:00Z",
    };
    const edited = {
      id: "edited",
      updatedAt: "2026-10-08T12:00:00Z",
      createdAt: "2026-10-01T10:00:00Z",
    };
    const tieBreak = {
      id: "tie",
      updatedAt: "2026-10-08T12:00:00Z",
      createdAt: "2026-10-02T10:00:00Z",
    };
    expect([older, edited, tieBreak].sort(compareRideRecency).map((item) => item.id)).toEqual([
      "tie",
      "edited",
      "old",
    ]);
  });

  it("uses creation time as historical baseline and excludes automatic inventory/status churn", () => {
    expect(migration).toContain("SET updated_at = created_at WHERE updated_at IS NULL");
    expect(migration).toContain("NEW.passenger_count IS DISTINCT FROM OLD.passenger_count");
    expect(migration).toContain("NEW.available_seats IS DISTINCT FROM OLD.available_seats");
    expect(migration).not.toContain("NEW.seats_remaining");
    expect(migration).not.toContain("NEW.status IS DISTINCT FROM OLD.status");
  });
});
