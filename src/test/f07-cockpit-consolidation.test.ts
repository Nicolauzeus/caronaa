import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const ui=readFileSync("src/components/admin/F07OperationsCockpit.tsx","utf8");
const page=readFileSync("src/routes/admin/operacoes.tsx","utf8");
const sql=readFileSync("drizzle/migrations/0230_f07_cockpit_live_bi_map.sql","utf8");
const map=readFileSync("src/components/caronaa/GoogleMapSurface.tsx","utf8");
const shell=readFileSync("src/components/admin/AdminShell.tsx","utf8");

describe("F07 admin cockpit consolidation",()=>{
  it("presents four source-backed operational decisions without competing dashboards",()=>{
    expect(page).toContain("F07OperationsCockpit");
    expect(page).toContain("Voltar ao Centro de Operações");
    expect(page).not.toContain('useState("bi")');
    for(const label of ["Passageiros aguardando","Motoristas aptos","Corridas em andamento","Situações críticas"]){
      expect(ui).toContain(label);
    }
    expect(ui).toContain('rpc("admin_f07_cockpit_live")');
    expect(ui).not.toContain('value={60}');
    expect(shell).toContain('!pathname.startsWith("/admin/operacoes")');
  });
  it("separates preparing, waiting, assigned, completed and cancelled with exact database counters",()=>{
    expect(sql).toContain("'waiting',(SELECT count(*)");
    expect(sql).toContain("'ready_drivers',v_ready");
    expect(sql).toContain("status='IN_PROGRESS'");
    expect(sql).toContain("'critical'");
    expect(sql).toContain("UNION");
    expect(sql).toContain("status IN ('COMPLETED','CANCELLED')");
    expect(sql).not.toContain("WHERE q.status IN ('COMPLETED','CANCELLED','EXPIRED')");
  });
  it("protects exact GPS from unauthorized users and never shows stale pins",()=>{
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.admin_f07_cockpit_live() FROM PUBLIC,anon");
    expect(sql).toContain("last_gps_at>now()-interval '90 seconds'");
    expect(sql).toContain("last_sampled_at>now()-interval '90 seconds'");
    expect(sql).toContain("NOT EXISTS (");
    expect(ui).toContain("points={points}");
    expect(ui).toContain("smoothTracking");
    expect(ui).toContain('fitMode="once"');
    expect(ui).toContain("Nenhuma localização operacional recente");
  });
  it("shares adaptive light/dark tokens and leaves passenger navigation maps intact",()=>{
    expect(ui).toContain('dark:bg-[#0B0F14]');
    expect(ui).toContain("border-border");
    expect(ui).toContain('appearance="adaptive"');
    expect(map).toContain('appearance = "standard"');
    expect(map).toContain("adminDarkRoadStyles");
    expect(map).toContain("MutationObserver(update)");
  });
  it("preserves administrative dispute, access, settings and audited incident handling",()=>{
    expect(page).toContain("F07OperationsCommandCenter");
    expect(page).toContain("QuickRideDisputesAdmin");
    expect(page).toContain("ProfessionalAccessQueue");
    expect(page).toContain("QuickRideAdminPanel");
    expect(ui).toContain("Acompanhar no mapa");
    expect(ui).toContain("Contatar");
    expect(ui).toContain("Gerenciar");
  });
});
