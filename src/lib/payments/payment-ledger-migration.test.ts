import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0064_asaas_checkout_ledger.sql", "utf8");
const route = readFileSync("src/routes/api/asaas/webhook.ts", "utf8");
describe("secure Asaas ledger migration and webhook boundary", () => {
  it("persists passenger-consented pricing with deterministic arithmetic", () => {
    expect(sql).toContain("passenger_total_cents = fare_cents + processing_fee_cents");
    expect(sql).toContain("platform_target_cents + driver_fixed_cents = fare_cents");
    expect(sql).toContain("accepted_at timestamptz NOT NULL");
    expect(sql).toContain("fee_source = 'ASAAS_ACCOUNT_VERIFIED'");
  });
  it("enforces unique active checkout per ride and duplicate webhook ID", () => {
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS asaas_one_active_checkout_per_ride");
    expect(sql).toContain("event_id text PRIMARY KEY");
    expect(sql).toContain("asaas_payment_id text UNIQUE");
  });
  it("hides sensitive financial data from browser roles", () => {
    expect(sql).toContain("ALTER TABLE public.asaas_checkout_intents ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.asaas_webhook_inbox ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.asaas_checkout_intents FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("REVOKE ALL ON public.asaas_webhook_inbox FROM PUBLIC, anon, authenticated");
  });
  it("requires Asaas webhook auth and independently checks payment provider", () => {
    expect(route).toContain('request.headers.get("asaas-access-token")');
    expect(route).toContain('process.env["ASAAS_WEBHOOK_AUTH_TOKEN"]');
    expect(route).toContain("verifyAsaasWebhookPayment(");
    expect(route).toContain(".getPayment(decision.paymentId)");
    expect(route).toContain("insertError?.code === \"23505\"");
    expect(route).not.toContain('status: "PAID"');
  });
});
