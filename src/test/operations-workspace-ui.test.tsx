import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { OperationalOverview } from "@/services/operations-service";
import { OperationsAdvancedOverview } from "@/components/admin/OperationsAdvancedOverview";

const fixture={
 kpis:{service:"all",summary:{requested:8,unserved:2,unserved_pct:25,mean_wait_seconds:119.8,median_wait_seconds:60,wait_samples:3,unserved_quoted_value_cents:null,unserved_unknown_fare:2},hours:[{hour:18,requests:3,unserved:2}]},
 conversion:{retention:{previous_cohort_retention_pct:null,retained_from_previous:0,previous_passengers:0,returned_after_gap:1}},
 funnel:{rows:[{service:"flash",quotes_issued:10,quotes_with_request:8,quotes_with_acceptance:5,quotes_with_completion:3,completion_pct:30}]},
 cancellations:{total_cancelled:2,groups:[{actor:"PASSENGER",reason_code:"WAIT_TOO_LONG",before_acceptance:1,after_acceptance:0,cancelled_orders:1},{actor:"UNKNOWN",reason_code:"REASON_NOT_RECORDED",before_acceptance:0,after_acceptance:1,cancelled_orders:1}]},
 diagnostics:{notification_diagnostics:{orders_with_observed_send_failure:0,orders_without_receipts:4,unserved_with_observed_send_failure:0},flash_manual_pix:null},
 audience:null,
} as unknown as OperationalOverview;
describe("Operations F09 visual system",()=>{
 it("renders measured values, preserves missing rates/money, and rounds seconds consistently",()=>{
  render(<OperationsAdvancedOverview data={fixture} loading={false} error=""/>);
  const metrics=screen.getByLabelText("Indicadores de atendimento");
  expect(metrics).toBeTruthy();
  expect(within(metrics).getByText("2m 0s")).toBeTruthy();
  expect(within(metrics).getAllByText("—")).toHaveLength(2);
  expect(screen.getByText("Captura de candidatos e confirmação do app indisponíveis.")).toBeTruthy();
 });
 it("keeps the funnel in quote units and cancellation attribution separate from expiry",()=>{
  render(<OperationsAdvancedOverview data={fixture} loading={false} error=""/>);
  expect(screen.getByText("Conversão por cotação")).toBeTruthy();
  expect(screen.getByText("Conclusão: 30%")).toBeTruthy();
  expect(screen.getByRole("img",{name:"Passageiro: 1; Desconhecido: 1"})).toBeTruthy();
  expect(screen.getByText(/Expiração é um resultado separado/)).toBeTruthy();
 });
 it("does not draw invented KPIs when a query is unavailable",()=>{
  render(<OperationsAdvancedOverview data={null} loading={false} error="Dados indisponíveis"/>);
  expect(screen.getByRole("status").textContent).toContain("Dados indisponíveis");
  expect(screen.queryByText("Conversão por cotação")).toBeNull();
 });
 it("isolates styling from printing and keeps live map and queue reachable",()=>{
  const css=readFileSync("src/components/admin/operations-workspace.css","utf8");
  const live=readFileSync("src/components/admin/F07OperationsCockpit.tsx","utf8");
  const history=readFileSync("src/components/admin/OperationsHistoryReport.tsx","utf8");
  expect(css).toContain("@media screen");
  expect(css).toContain("@container operations (max-width:879px)");
  expect(live).toContain("queueRows=list.slice(currentQueuePage*5,currentQueuePage*5+5)");
  expect(live).toContain("points={points}");
  expect(live).toContain("OperationsOrderEvidenceDialog");
  expect(history).toContain("HISTORY_PAGE_SIZE");
  expect(history).toContain("OperationsPrintableReport");
  expect(history).toContain("ops-history-mobile");
 });
});
