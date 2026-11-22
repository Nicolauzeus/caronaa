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
    expect(report).toContain("Pedidos feitos");
    expect(report).toContain("Sem aceite");
    expect(report).toContain("indisponível. É necessária coleta periódica");
    expect(report).toContain("admin_operations_history_report");
  });
  it("uses server-managed support, never a hardcoded Brazilian number",()=>{
    expect(phone).toContain("get_caronaa_support_whatsapp");
    expect(phone).not.toContain("5585987584347");
    expect(migration).toContain("admin_set_caronaa_support_whatsapp");
    expect(migration).toContain("caronaa_support_config_audit");
  });
});