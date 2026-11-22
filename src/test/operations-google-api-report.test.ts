import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
describe("CARONAA Google API operations reporting",()=>{
  const sql=readFileSync("drizzle/migrations/0236_admin_google_api_usage_report.sql","utf8");
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const section=readFileSync("src/components/admin/OperationsGoogleMapsUsage.tsx","utf8");
  const printable=readFileSync("src/components/admin/OperationsPrintableReport.tsx","utf8");
  const attached=readFileSync("src/components/admin/operations-pdf-file.ts","utf8");
  it("requires administrator and uses Fortaleza actual event timestamps",()=>{
    expect(sql).toContain("public.has_role(auth.uid(),'admin'");
    expect(sql).toContain("u.created_at AT TIME ZONE 'America/Fortaleza'");
    expect(sql).toContain("v_from:=p_from::timestamp AT TIME ZONE 'America/Fortaleza'");
    expect(sql).toContain("p_to-p_from)>366");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_google_api_usage_report");
    expect(sql).not.toContain("INSERT INTO public.google_api_usage");
  });
  it("filters by report dates and preserves service-independent Google totals",()=>{
    expect(ui).toContain('"admin_google_api_usage_report"');
    expect(ui).toContain("p_from:dates.from,p_to:dates.to");
    expect(ui).toContain("OperationsGoogleMapsUsage");
    expect(section).toContain("Chamadas registradas");
    expect(section).toContain("Places API");
    expect(section).toContain("Routes API");
    expect(section).toContain("Principais origens das consultas");
    expect(section).toContain("não"); 
  });
  it("includes API metrics in both browser print and the PDF file shared via WhatsApp/email",()=>{
    expect(ui).toContain("google_usage:googleUsage??undefined");
    expect(ui).toContain("googleUsage={googleUsage}");
    expect(printable).toContain("Consumo Google Maps");
    expect(printable).toContain("googleUsage.summary.total");
    expect(attached).toContain("d.google_usage.summary");
    expect(attached).toContain("GOOGLE MAPS  |  CONSUMO INTERNO DAS APIS");
  });
});