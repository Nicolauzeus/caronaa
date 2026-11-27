import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import type { OperationalOverview } from "@/services/operations-service";
const api=vi.hoisted(()=>({getOverview:vi.fn()}));
vi.mock("@/services/operations-service",()=>({operationsService:api}));
import { useOperationalOverview } from "@/hooks/use-operational-overview";
import { operationalAggregateRows } from "@/components/admin/OperationsAdvancedOverview";
const base={from:"2025-01-15",to:"2025-01-15",service:"all" as const};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
const a={kpis:{summary:{requested:1}}} as unknown as OperationalOverview;
const b={kpis:{summary:{requested:2}}} as unknown as OperationalOverview;
beforeEach(()=>api.getOverview.mockReset());
describe("advanced administrative integration",()=>{
 it("rejects stale responses after filter changes",async()=>{
  const older=deferred<OperationalOverview>(),newer=deferred<OperationalOverview>();
  api.getOverview.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const {result,rerender}=renderHook(({day})=>useOperationalOverview({...base,from:day,to:day},true,0),{initialProps:{day:base.from}});
  await waitFor(()=>expect(api.getOverview).toHaveBeenCalledTimes(1));
  rerender({day:"2025-01-16"});
  expect(result.current.data).toBeNull();
  await waitFor(()=>expect(api.getOverview).toHaveBeenCalledTimes(2));
  await act(async()=>newer.resolve(b));
  await waitFor(()=>expect(result.current.data).toEqual(b));
  await act(async()=>older.resolve(a));
  expect(result.current.data).toEqual(b);
 });
 it("reports unavailable data, never fabricated zeros",async()=>{
  api.getOverview.mockRejectedValueOnce(new Error("offline"));
  const {result}=renderHook(()=>useOperationalOverview(base,true,0));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.data).toBeNull();
  expect(result.current.error).toContain("indisponíveis");
 });
 it("does not fetch invalid or disabled periods",async()=>{
  const {result}=renderHook(()=>useOperationalOverview(base,false,0));
  expect(result.current.loading).toBe(false);
  expect(api.getOverview).not.toHaveBeenCalled();
 });
 it("exports only explicit aggregate metrics and preserves unknown money/rates",()=>{
  const data={kpis:{summary:{unserved:1,mean_wait_seconds:null,median_wait_seconds:null,wait_samples:0,unserved_quoted_value_cents:null}},
   conversion:{retention:{previous_cohort_retention_pct:null,returned_after_gap:0}},
   diagnostics:{notification_diagnostics:{orders_with_observed_send_failure:0,orders_without_receipts:1},flash_manual_pix:null},
   passenger_name:"private",driver_name:"private"} as unknown as OperationalOverview;
  const rows=operationalAggregateRows(data);
  expect(rows.find(x=>x.label==="Valor bruto cotado não atendido")?.value).toBe("—");
  expect(rows.find(x=>x.label==="Retenção do período anterior")?.value).toBe("—");
  expect(JSON.stringify(rows)).not.toContain("private");
 });
 it("connects evidence and aggregate exports without changing dispatch",()=>{
  const ui=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  const pdf=readFileSync("src/components/admin/operations-pdf-file.ts","utf8");
  const printable=readFileSync("src/components/admin/OperationsPrintableReport.tsx","utf8");
  expect(ui).toContain("useOperationalOverview(");
  expect(ui).toContain("OperationsOrderEvidenceDialog");
  expect(ui).toContain("advanced_metrics:advanced.data?operationalAggregateRows");
  expect(pdf).toContain("streamBase=4+2*n");
  expect(pdf).toContain("thirdPage");
  expect(printable).toContain("advancedMetrics.map");
  expect(pdf).not.toContain("passenger_name");
 });
});
