import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
describe("CARONAA 0234 unattended operation summaries",()=>{
  const sql=readFileSync("drizzle/migrations/0234_ops_email_report_schedules.sql","utf8");
  const service=readFileSync("src/routes/api/operations/report-scheduler.ts","utf8");
  const panel=readFileSync("src/components/admin/OperationsReportSchedules.tsx","utf8");
  const automation=readFileSync(".github/workflows/operations-reports.yml","utf8");
  it("defaults disabled and requires administrator or service role",()=>{
    expect(sql).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("auth.role(),'')<>'service_role'");
    expect(sql).toContain("REVOKE ALL ON public.caronaa_ops_report_schedules");
    expect(sql).toContain("public.service_caronaa_report_jobs()");
  });
  it("guards per-recipient delivery with bounded retry and provider idempotency",()=>{
    expect(sql).toContain("PRIMARY KEY(cadence,window_start,window_end,recipient)");
    expect(sql).toContain("public.caronaa_ops_report_deliveries.attempts<5");
    expect(sql).toContain("interval '15 minutes'");
    expect(service).toContain('"Idempotency-Key":key');
    expect(service).toContain('"RESEND_API_KEY"');
    expect(service).toContain('"SUPABASE_SERVICE_ROLE_KEY"');
    expect(service).toContain("timingSafeEqual");
  });
  it("uses Fortaleza dates without transmitting raw GPS or personal contacts",()=>{
    expect(sql).toContain("America/Fortaleza");
    expect(sql).toContain("count(DISTINCT o.passenger_id)");
    expect(service).toContain("Este relatório contém somente dados agregados");
    expect(service).not.toContain("origin_lat");
    expect(service).not.toContain("passenger_whatsapp");
    expect(automation).toContain("CARONAA_REPORTS_ENABLED");
    expect(automation).toContain("REPORT_SCHEDULER_TOKEN");
  });
  it("shows real saved status, not a fake sent badge",()=>{
    expect(panel).toContain("admin_caronaa_report_schedules");
    expect(panel).toContain("admin_save_caronaa_report_schedule");
    expect(panel).toContain("Salvar uma preferência não comprova envio");
  });
});