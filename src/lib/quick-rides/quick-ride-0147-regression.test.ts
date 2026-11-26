import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/quick-rides/quick-ride.functions.ts", "utf8");
const sql = readFileSync("drizzle/migrations/0147_f07_quick_quote_verified_destination.sql", "utf8");
const acceptSql = readFileSync("drizzle/migrations/0129_professional_quick_ride_lifecycle.sql", "utf8");
const driverUi = readFileSync("src/components/caronaa/QuickRideExperience.tsx", "utf8");

describe("F07 regression: verified fare, SQL dispatch and driver race", () => {
  it("persists every server-verified destination, regardless of test environment flags", () => {
    expect(source).toContain("destination_municipality:destinationCity.municipality,");
    expect(source).not.toContain("...(f07TestEnvironmentConfigured()");
    expect(source).toContain("destinationStatus?.status!==\"ENABLED\"");
    expect(source).toContain("policy.intermunicipal_enabled!==true");
  });
  it("accepts legacy null destinations only after a trusted matching-city lookup", () => {
    expect(source).toContain("verifyLegacyQuickRideDestination");
    expect(source).toContain("city.municipality!==quote.municipality");
    expect(source).toContain("quote_id:quoteId,destination_municipality:city.municipality");
    expect(sql).toContain("v_destination := q.destination_municipality");
    expect(sql).toContain("v.destination_municipality=q.municipality");
    expect(sql).toContain("v.verified_at >= q.issued_at");
    expect(sql).toContain("REVOKE ALL ON public.caronaa_quick_legacy_destination_verifications");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain("Quote destination is not verified");
    expect(sql).not.toContain("v_destination := q.municipality");
  });
  it("preserves published tariff, origin/destination coverage and idempotency", () => {
    expect(sql).toContain("IF q.ride_id IS NOT NULL THEN RETURN q.ride_id");
    expect(sql).toContain("AND r.public_discovery_enabled AND r.dispatch_enabled AND t.published");
    expect(sql).toContain("AND (v_destination=o.municipality OR t.intermunicipal_enabled)");
    expect(sql).toContain("WHERE d.municipality=v_destination");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.guard_caronaa_quick_driver_assignment()");
    expect(sql).toContain("d.municipality=COALESCE(q.destination_municipality,v.destination_municipality)");
    expect(sql).toContain("v.verified_at>=q.issued_at");
    expect(sql).toContain("public.caronaa_f07_test_dispatch_allowed()");
    expect(sql).toContain("public.quick_ride_request(");
    expect(sql).toContain("UPDATE public.caronaa_quick_fare_quotes SET ride_id=r_id");
  });
  it("keeps acceptance atomic and immediately evicts lost races from the UI", () => {
    expect(acceptSql).toContain("WHERE q.id=p_id AND q.status='SEARCHING' AND q.expires_at>now()");
    expect(acceptSql).toContain("IF NOT FOUND THEN RETURN false");
    expect(driverUi).toContain('const message = "Solicitação indisponível: pode ter expirado ou sido aceita por outro motorista."');
    expect(driverUi).toContain("rejectedQueueIds.current.add(id)");
    expect(driverUi).toContain("setQueue(items => items.filter(item => item.id !== id))");
    expect(driverUi).toContain("toast.error(message)");
    expect(driverUi).toContain("await refreshQueue()");
    expect(driverUi).toContain("submitting.current = false");
  });
});
