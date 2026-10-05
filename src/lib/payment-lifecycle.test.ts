import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transitionPayment } from "./payment-lifecycle";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0016_ride_lifecycle_and_payment_model.sql"),
  "utf8",
);

describe("payment lifecycle", () => {
  it("requires a trusted provider to confirm PROCESSING -> PAID", () => {
    expect(transitionPayment("PROCESSING", "PAID", true)).toBe("PAID");
    expect(() => transitionPayment("PROCESSING", "PAID", false)).toThrow(
      "trusted payment provider",
    );
  });

  it("rejects invalid settlement and refund transitions", () => {
    expect(() => transitionPayment("FAILED", "PAID", true)).toThrow("Invalid payment transition");
    expect(transitionPayment("PAID", "REFUNDED", true)).toBe("REFUNDED");
    expect(() => transitionPayment("REFUNDED", "PAID", true)).toThrow("Invalid payment transition");
  });

  it("treats duplicate status updates as idempotent", () => {
    expect(transitionPayment("PAID", "PAID", false)).toBe("PAID");
  });

  it("requires trusted server writes and deduplicates provider references and paid events", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX payments_provider_reference_once_idx");
    expect(migration).toContain("CREATE UNIQUE INDEX product_events_payment_completed_once_idx");
    expect(migration).toContain(
      "CREATE TRIGGER payment_status_event AFTER UPDATE OF status ON public.payments",
    );
    expect(migration).toContain("'PAYMENT_COMPLETED'");
  });
});
