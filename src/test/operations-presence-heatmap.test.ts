import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("0233 operational report accuracy & historical presence",()=>{
  const sql=readFileSync("drizzle/migrations/0233_operations_presence_heatmap_and_quote_fares.sql","utf8");
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  it("uses actual per-ride fare quotes for completed-ride totals",()=>{
    expect(sql).toContain("LEFT JOIN public.caronaa_quick_fare_quotes fq ON fq.ride_id=q.id");
    expect(sql).toContain("coalesce(fq.customer_pays_cents,q.estimated_fare_cents)");
    expect(sql).toContain("completed_unpriced");
    expect(ui).toContain("Tarifas de corridas concluídas");
  });
  it("records only consented and recent operational signals without raw location",()=>{
    expect(sql).toContain("public.caronaa_operational_presence_hours");
    expect(sql).toContain("NEW.is_online");
    expect(sql).toContain("NEW.is_available");
    expect(sql).toContain("NEW.last_seen_at");
    expect(sql).not.toContain("NEW.lat");
    expect(sql).not.toContain("NEW.lng");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("interval '90 days'");
  });
  it("returns seven-by-twenty-four matrices and does not invent past presence",()=>{
    expect(sql).toContain("generate_series(0,6)");
    expect(sql).toContain("generate_series(0,23)");
    expect(sql).toContain("'presence_hour_days'");
    expect(ui).toContain("Mapa de calor");
    expect(ui).toContain("Nenhum valor de presença anterior foi estimado");
  });
});
