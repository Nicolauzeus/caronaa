import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("CARONAA historical outcomes and presentation-only scenario",()=>{
  const sql=readFileSync("drizzle/migrations/0235_operations_exclusive_status_reporting.sql","utf8");
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const projection=readFileSync("src/components/admin/operations-presentation.ts","utf8");

  it("reports cancelled before or after driver acceptance separately",()=>{
    expect(sql).toContain("AS cancelled_after_acceptance");
    expect(sql).toContain("AS cancelled_without_acceptance");
    expect(sql).toContain("AS searching");
    expect(sql).toContain("AS other");
    expect(sql).toContain("q.expires_at<=now()");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_operations_history_report");
    expect(sql).not.toContain("UPDATE public.professional_quick_rides");
  });
  it("keeps actual history and charts while showing a permanently labeled scenario",()=>{
    expect(ui).toContain("CENÁRIO SIMULADO");
    expect(ui).toContain("Nunca receberam aceite");
    expect(ui).toContain("cancelled_after_acceptance");
    expect(ui).toContain('disabled={!report||presentationMode}');
    expect(ui).toContain("O cenário demonstrativo não altera este gráfico");
    expect(projection).toContain("PRESENTATION_ILLUSTRATIVE_REQUESTS=108");
    expect(projection).toContain("allocateProportionally");
    expect(projection).toContain("accepted:actual.accepted+acceptedAdd");
    expect(projection).not.toContain("supabase");
  });
});