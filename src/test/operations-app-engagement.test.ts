import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
describe("CARONAA authenticated app access analytics",()=>{
  const sql=readFileSync("drizzle/migrations/0237_authenticated_app_engagement.sql","utf8");
  const auth=readFileSync("src/lib/auth-context.tsx","utf8");
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const printable=readFileSync("src/components/admin/OperationsPrintableReport.tsx","utf8");
  const pdf=readFileSync("src/components/admin/operations-pdf-file.ts","utf8");
  it("records only verified authenticated identity, no raw geolocation",()=>{
    expect(sql).toContain("v_uid uuid:=auth.uid()");
    expect(sql).toContain("PRIMARY KEY(user_id,local_day,role_at_access)");
    expect(sql).toContain("now()-interval '5 minutes'");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.caronaa_app_access_days");
    expect(sql).not.toContain("latitude");
    expect(auth).toContain('rpc("record_caronaa_app_access")');
    expect(auth).toContain('window.addEventListener("pageshow"');
    expect(auth).toContain('document.addEventListener("visibilitychange"');
  });
  it("does not double count people who used both roles",()=>{
    expect(sql).toContain("count(DISTINCT user_id)::int AS unique_users");
    expect(sql).toContain("FILTER(WHERE role_at_access='PASSAGEIRO')");
    expect(sql).toContain("FILTER(WHERE role_at_access='MOTORISTA')");
    expect(sql).toContain("public.has_role(auth.uid(),'admin'");
    expect(sql).toContain("GROUP BY e.user_id");
  });
  it("puts real authenticated audience in admin dashboard and the two PDF workflows",()=>{
    expect(ui).toContain("admin_caronaa_app_engagement");
    expect(ui).toContain("OperationsAppEngagement");
    expect(ui).toContain("app_engagement:appEngagement??undefined");
    expect(ui).toContain("appEngagement={appEngagement}");
    expect(printable).toContain("Usuários autenticados únicos");
    expect(pdf).toContain("ACESSOS AUTENTICADOS AO APLICATIVO");
    expect(pdf).toContain("d.app_engagement.summary");
  });
});