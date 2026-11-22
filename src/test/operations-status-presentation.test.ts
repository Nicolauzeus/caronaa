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
    expect(ui).toContain("Cenário projetado");
    expect(ui).toContain("caronaa-report-projection-label");
    expect(ui).not.toContain("caronaa-demo-banner");
    expect(ui).not.toContain("Simular +108 pedidos");
    expect(ui).not.toContain("setPresentationMode");
    expect(ui).toContain("calculateOperationsDisplay(report.summary,ENABLE_OPERATIONS_PROJECTION)");
    expect(ui).toContain("Nunca receberam aceite");
    expect(ui).toContain("cancelled_after_acceptance");
    expect(ui).toContain('disabled={!report||presentationMode}');
    expect(ui).toContain("projectRequestHistogram");
    expect(ui).toContain("Estimativa proporcional sobre a base registrada.");
    expect(projection).toContain("PRESENTATION_ILLUSTRATIVE_REQUESTS=108");
    expect(projection).toContain("ENABLE_OPERATIONS_PROJECTION=false");
    expect(projection).toContain("allocateProportionally");
    expect(projection).toContain("accepted:actual.accepted+acceptedAdd");
    expect(projection).not.toContain("supabase");
    const printCss=readFileSync("src/components/admin/operations-history-print.css","utf8");
    expect(printCss).toContain(".caronaa-report-projection-label");
    expect(printCss).toContain("visibility: visible !important");
  });
});