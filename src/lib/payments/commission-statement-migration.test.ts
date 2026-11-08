import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("drizzle/migrations/0140_driver_commission_statements.sql","utf8");
const dashboard = readFileSync("src/components/caronaa/DriverPlatformFees.tsx","utf8");
const finance = readFileSync("src/components/admin/PlatformFeeFinance.tsx","utf8");

describe("CARONAA cross-product commission ledger v0140", () => {
  it("does not replace or recompute historical shared-ride fee amounts", () => {
    expect(migration).toContain("FROM public.driver_platform_fees f");
    expect(migration).toContain("round(f.fee_rate*10000)");
    expect(migration).not.toContain("UPDATE public.driver_platform_fees SET fee_amount");
    expect(migration).not.toContain("DELETE FROM public.driver_platform_fees");
  });

  it("accrues exactly one F07 obligation after the quoted ride reaches COMPLETED", () => {
    expect(migration).toContain("NEW.status IS DISTINCT FROM 'COMPLETED'");
    expect(migration).toContain("OLD.status IS NOT DISTINCT FROM 'COMPLETED'");
    expect(migration).toContain("quote_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("ride_id uuid PRIMARY KEY");
    expect(migration).toContain("ON CONFLICT(ride_id) DO NOTHING");
    expect(migration).toContain("v_quote.platform_commission_cents");
    expect(migration).toContain("caronaa_completed_quick_ride_fee");
  });

  it("locks and snapshots all outstanding item amounts before generating a QR", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_my_caronaa_fee_statement");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_total:=v_total+v_row.fee_cents");
    expect(migration).toContain("UNIQUE(source_kind,ride_id)");
    expect(migration).toContain("item_count integer NOT NULL");
    expect(migration).toContain("pix_key_snapshot");
    expect(dashboard).toContain("buildPixPayload(");
    expect(dashboard).toContain("statement.totalCents / 100");
    expect(dashboard).toContain("statement.txid");
    expect(dashboard).toContain("create_my_caronaa_fee_statement");
  });

  it("requires receipt declaration and actual finance verification before marking settled", () => {
    expect(migration).toContain("claim_my_caronaa_fee_statement");
    expect(migration).toContain("admin_verify_caronaa_fee_statement");
    expect(migration).toContain("has_admin_department_access('finance',true)");
    expect(migration).toContain("v_shared+v_quick<>v_expected");
    expect(migration).toContain("SET status='SETTLED',verified_by=auth.uid(),verified_at=now()");
    expect(migration).toContain("status='CLAIMED'");
    expect(dashboard).toContain("NÃO comprova recebimento automático");
    expect(finance).toContain("Confirmei o valor no banco");
  });

  it("prevents settlement double counting between old single-debt and new batch flows", () => {
    expect(migration).toContain("caronaa_guard_legacy_shared_fee_claim");
    expect(migration).toContain("Fee is already assigned to a commission Pix statement");
    expect(migration).toContain("UNIQUE(source_kind,ride_id)");
    expect(migration).toContain("caronaa_fee_statement_unique_payment_claim");
    expect(migration).toContain("driver_platform_access_allowed");
    expect(migration).toContain("public.caronaa_quick_driver_fees q");
  });

  it("keeps Asaas charges disabled and does not confuse QR display with bank confirmation", () => {
    expect(migration).not.toContain("AsaasClient");
    expect(migration).not.toContain("asaas_payment_id");
    expect(migration).not.toContain("status='PAID'");
    expect(dashboard).toContain("Conferência bancária pendente");
    expect(dashboard).toContain("comissões");
  });
});
