import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
describe("CARONAA operations reporting + support contract",()=>{
  const migration=readFileSync("drizzle/migrations/0232_operations_history_and_support.sql","utf8");
  const report=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const phone=readFileSync("src/components/caronaa/DriverWhatsAppSupport.tsx","utf8");
  it("restricts historical order reports to admins and avoids trip double counting",()=>{
    expect(migration).toContain("public.has_role(auth.uid(),'admin')");
    expect(migration).toContain("admin_operations_history_report");
    expect(migration).toContain("LEFT JOIN public.rides r ON r.request_id=rr.request_id");
    expect(migration).toContain("history_of_presence_available',false");
    expect(migration).toContain("America/Fortaleza");
  });
  it("uses current and historical demand without fabricated presence history",()=>{
    expect(report).toContain("Horários com mais pedidos");
    expect(report).toContain("Pedidos registrados");
    expect(report).not.toContain("Entenda a conversão dos pedidos");
    expect(report).not.toContain("<OperationsReportSchedules");
    expect(report).not.toContain('aria-label="Composição e reconciliação dos pedidos"');
    expect(report).toContain("sinais reais de atividade");
    expect(report).toContain("admin_operations_history_report");
    expect(report).toContain("Cenário projetado");
    expect(report).toContain("caronaa-report-projection-label");
    expect(report).not.toContain("caronaa-demo-banner");
    expect(report).not.toContain("Simular +108 pedidos");
    expect(report).toContain("ENABLE_OPERATIONS_PROJECTION");
    expect(report).toContain("presentationMode");
    expect(report).toContain("OperationsPrintableReport");
    expect(report).toContain("caronaa-screen-report");
  });
  it("collapses history table while preserving its filters, paging, and PDF",()=>{
    expect(report).toContain("const [historyExpanded,setHistoryExpanded]=useState(true)");
    expect(report).toContain("aria-expanded={historyExpanded}");
    expect(report).toContain('aria-controls="operations-order-history-content"');
    expect(report).toContain("onClick={()=>setHistoryExpanded(expanded=>!expanded)}");
    expect(report).toContain('id="operations-order-history-content" hidden={!historyExpanded}');
    expect(report).toContain("Recolher");
    expect(report).toContain("Expandir");
    expect(report).toContain('aria-label="Status das solicitações"');
    expect(report).toContain('aria-label="Buscar no histórico carregado"');
    expect(report).toContain('mode==="reports"&&report&&!busy&&valid&&<OperationsPrintableReport');
  });
  it("uses server-managed support, never a hardcoded Brazilian number",()=>{
    expect(phone).toContain("get_caronaa_support_whatsapp");
    expect(phone).not.toContain("5585987584347");
    expect(migration).toContain("admin_set_caronaa_support_whatsapp");
    expect(migration).toContain("caronaa_support_config_audit");
  });
});