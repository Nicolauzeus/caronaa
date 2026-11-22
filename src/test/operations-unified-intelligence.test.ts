import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { findActiveModule,getDepartmentOfPath,getModules } from "@/lib/admin/module-navigation";

describe("CARONAA unified operations closeout",()=>{
  const route=readFileSync("src/routes/admin/operacoes.tsx","utf8");
  const history=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const cockpit=readFileSync("src/components/admin/F07OperationsCockpit.tsx","utf8");
  const people=readFileSync("src/components/admin/OperationPage.tsx","utf8");
  const menu=readFileSync("src/lib/admin/module-navigation.ts","utf8");
  const sqlShared=readFileSync("drizzle/migrations/0241_admin_shared_active_ride_map.sql","utf8");
  const sqlIntel=readFileSync("drizzle/migrations/0240_admin_operations_intelligence.sql","utf8");
  const sqlDedup=readFileSync("drizzle/migrations/0242_admin_intelligence_shared_request_dedupe.sql","utf8");

  it("uses six grouped tabs and retains old deep links",()=>{
    expect(getModules("operations").map(x=>x.label)).toEqual([
      "Central","Viagens","Pessoas","Relatórios","Inteligência","Configurações"
    ]);
    expect(getDepartmentOfPath("/admin/caronas")).toBe("operations");
    expect(getDepartmentOfPath("/admin/matching")).toBe("operations");
    expect(findActiveModule("operations","/admin/caronas","")?.id).toBe("journeys");
    expect(findActiveModule("operations","/admin/motoristas","")?.id).toBe("people");
    expect(menu).toContain("hidden: category.hidden === true");
    expect(route).toContain('<OperationPage kind={journeyTab} embedded/>');
    expect(route).toContain('<OperationPage kind={peopleTab} embedded/>');
    expect(route).toContain('<OperationsHistoryReport mode="reports"/>');
    expect(route).toContain('<OperationsHistoryReport mode="intelligence"/>');
  });
  it("keeps historical reporting and intelligence isolated, with shared date/service filters",()=>{
    expect(history).toContain('mode==="reports"&&<>');
    expect(history).toContain('mode==="intelligence"&&<>');
    expect(history).toContain('"admin_operations_intelligence"');
    expect(history).toContain("p_from:dates.from,p_to:dates.to,p_service:service");
    expect(history).toContain("OperationsMobilityIntelligence");
    expect(history).toContain("OperationsReportSchedules");
    expect(history).toContain("OperationsPrintableReport");
  });
  it("plots real shared requests/offers and booked pickup places without faking GPS",()=>{
    expect(cockpit).toContain('rpc("admin_shared_operations_live")');
    expect(cockpit).toContain('serviceLayer');
    expect(cockpit).toContain("Embarque previsto de carona confirmada (não é GPS ao vivo)");
    expect(cockpit).toContain('kind:item.kind==="offer"?"meeting"');
    expect(cockpit).toContain("points={points}");
    expect(sqlShared).toContain("public.has_role(auth.uid(),'admin'");
    expect(sqlShared).toContain("o.status='available'");
    expect(sqlShared).toContain("r.status IN ('open','matched')");
    expect(sqlShared).toContain("JOIN public.ride_requests q ON q.request_id=r.request_id");
    expect(sqlShared).toContain("q.origin_lat");
    expect(sqlShared).not.toContain("professional_driver_locations");
  });
  it("reports unique, real quoted/requesting/completed accounts and verifiable F07 territory",()=>{
    expect(sqlIntel).toContain("count(DISTINCT user_id)");
    expect(sqlIntel).toContain("public.caronaa_quick_fare_quotes");
    expect(sqlIntel).toContain("public.offer_route_quotes");
    expect(sqlIntel).toContain("public.professional_quick_rides");
    expect(sqlIntel).toContain("coalesce(nullif(btrim(q.municipality)");
    expect(sqlIntel).toContain("p_service IN('all','flash')");
    expect(sqlIntel).toContain("public.has_role(auth.uid(),'admin'");
    expect(sqlIntel).not.toContain("INSERT INTO public.professional_quick_rides");
    expect(sqlDedup).toContain("LEFT JOIN LATERAL");
    expect(sqlDedup).toContain("bool_or(r.driver_accepted_at");
    expect(sqlDedup).toContain("r.request_id=q.request_id");
    expect(sqlDedup).not.toContain("INSERT INTO public.rides");
  });
  it("adds observed last authenticated access without pretending a registered account is online",()=>{
    expect(people).toContain("admin_caronaa_app_engagement");
    expect(people).toContain("Último acesso");
    expect(people).toContain("Sem registro recente");
    expect(people).toContain("embedded = false");
  });
});