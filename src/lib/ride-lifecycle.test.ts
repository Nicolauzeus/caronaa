import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transitionRide } from "./ride-lifecycle";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0016_ride_lifecycle_and_payment_model.sql"),
  "utf8",
);

const confirmed = { hasPersistedMatch: true, isParticipant: true, confirmedByBoth: true };

describe("ride lifecycle", () => {
  it("allows completion only from IN_PROGRESS after both participants confirm", () => {
    expect(transitionRide("IN_PROGRESS", "COMPLETED", confirmed)).toBe("COMPLETED");
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...confirmed, confirmedByBoth: false }),
    ).toThrow();
  });

  it("rejects duplicate completion because COMPLETED is terminal", () => {
    expect(() => transitionRide("COMPLETED", "COMPLETED", confirmed)).toThrow(
      "Invalid ride transition",
    );
  });

  it("rejects completion without a persisted match", () => {
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...confirmed, hasPersistedMatch: false }),
    ).toThrow("persisted match");
  });

  it("rejects completion after cancellation", () => {
    expect(() => transitionRide("CANCELLED", "COMPLETED", confirmed)).toThrow(
      "Invalid ride transition",
    );
  });

  it("rejects client attempts when caller is not a ride participant", () => {
    expect(() =>
      transitionRide("IN_PROGRESS", "COMPLETED", { ...confirmed, isParticipant: false }),
    ).toThrow("participants");
  });

  it("denies browser insertion of completion/payment domain events and payment writes", () => {
    expect(migration).toContain("'RIDE_COMPLETED', 'PAYMENT_COMPLETED'");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.rides");
    expect(migration).toContain(
      "public.ride_completion_confirmations, public.payments FROM anon, authenticated",
    );
    expect(migration).toContain(
      "CREATE TRIGGER ride_status_event AFTER UPDATE OF status ON public.rides",
    );
    expect(migration).toContain("CREATE UNIQUE INDEX product_events_ride_completed_once_idx");
  });
});
