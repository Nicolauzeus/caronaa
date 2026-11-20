import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0221_f07_operations_command_center.sql", "utf8");
const page = readFileSync("src/routes/admin/operacoes.tsx", "utf8");
const center = readFileSync("src/components/admin/F07OperationsCommandCenter.tsx", "utf8");

describe("F07 command center - real operations and guardrails", () => {
  it("is the first tab and distinguishes applications from real ride monitoring", () => {
    expect(page).toContain('useState("live")');
    expect(page).toContain('value="live"');
    expect(page).toContain("Central ao vivo");
    expect(page).toContain("Acessos ao radar");
    expect(page).toContain("Contestações");
    expect(page).toContain("F07OperationsCommandCenter");
  });
  it("uses a protected admin RPC without publishing coordinates or direct table access", () => {
    expect(sql).toContain("admin_f07_operations_snapshot()");
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_f07_operations_snapshot() TO authenticated");
    expect(sql).not.toContain("'gps_lat'");
    expect(sql).not.toContain("'gps_lng'");
    expect(center).toContain('rpc("admin_f07_operations_snapshot"');
    expect(center).not.toMatch(/\.from\(["']professional_quick_rides["']\)\.update/);
  });
  it("differentiates available, GPS-stale, active-trip and blocked states", () => {
    for (const status of ["IN_TRIP","TO_PICKUP","READY","GPS_STALE","OUTSIDE_COVERAGE",
      "NOT_AUTHORIZED","OFFLINE"]) {
      expect(sql).toContain("'" + status + "'");
      expect(center).toContain(status);
    }
    expect(sql).toContain("interval '90 seconds'");
    expect(sql).toContain("sr.dispatch_enabled IS DISTINCT FROM true");
    expect(sql).toContain("cm.moto_enabled IS DISTINCT FROM true");
  });
  it("only allows safe expiry of searching rides, not arbitrary completion", () => {
    expect(sql).toContain("admin_f07_expire_stale_search");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_ride.status<>'SEARCHING'");
    expect(sql).toContain("v_ride.driver_id IS NOT NULL");
    expect(sql).toContain("v_ride.expires_at>now()");
    expect(sql).toContain("SET status='EXPIRED',updated_at=now()");
    expect(sql).not.toMatch(/SET status='COMPLETED'/);
    expect(sql).not.toMatch(/UPDATE public\.quick_ride_payment_events/i);
    expect(center).toContain("Nenhum status de corrida será alterado por esta ação");
  });
  it("audits incident opening and resolutions without mutating actual ride states", () => {
    for (const key of ["INCIDENT_OPENED","INCIDENT_STARTED","INCIDENT_RESOLVED","SEARCH_EXPIRED"]) {
      expect(sql).toContain(key);
    }
    expect(sql).toContain("admin_f07_update_incident");
    expect(sql).toContain("admin_f07_open_incident");
    expect(sql).toContain("admin_f07_cancel_stale_assignment");
    expect(sql).toContain("v_ride.status NOT IN ('ACCEPTED','ARRIVED')");
    expect(sql).toContain("v_ride.pickup_confirmed_at IS NOT NULL");
    expect(sql).toContain("v_ride.in_trip_at IS NOT NULL");
    expect(sql).toContain("v_ride.updated_at>now()-interval '15 minutes'");
    expect(sql).toContain("STALE_ASSIGNMENT_CANCELLED");
    expect(center).toContain("Cancelar atribuição com auditoria");
    expect(center).toContain("Marcar ocorrência resolvida");
    expect(center).toContain("não conclui a corrida");
    expect(center).toContain("onGoToDisputes");
  });
});
