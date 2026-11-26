import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { createOperationsService, evidenceSchema, kpiSchema } from "@/services/operations-service";

const period = { from: "2025-01-15", to: "2025-01-15", service: "all" as const };
const id = "10000000-0000-4000-8000-000000000001";
function setup(data: unknown = null, error: {code: string} | null = null) {
  const rpc = vi.fn(async () => ({data, error}));
  return {rpc, service: createOperationsService({rpc})};
}
const kpis = {
  ...period, summary: {
    requested: 0, accepted: 0, never_accepted: 0, unserved: 0, completed: 0, cancelled: 0,
    expired: 0, in_progress: 0, waiting: 0, other: 0, cancelled_after_acceptance: 0,
    cancelled_before_acceptance: 0, wait_samples: 0, mean_wait_seconds: null, median_wait_seconds: null,
    acceptance_pct: null, completion_pct: null, unserved_pct: null, unserved_quoted_value_cents: null,
    unserved_unknown_fare: 0, completed_quoted_value_cents: null, passengers: 0,
  }, recurring_passengers: 0, cancellation_reasons: [], hours: [], territories: [],
  notification_observations: [], notes: {},
};
describe("operational RPC boundary", () => {
  it("preserves unknown rates and money rather than converting them to zero", async () => {
    const {rpc, service} = setup(kpis);
    const r = await service.getKpis(period);
    expect(r.summary.acceptance_pct).toBeNull();
    expect(r.summary.completed_quoted_value_cents).toBeNull();
    expect(rpc).toHaveBeenCalledWith("admin_operational_order_kpis", {p_from:period.from,p_to:period.to,p_service:"all"});
  });
  it("rejects inconsistent totals and malformed responses", async () => {
    expect(kpiSchema.safeParse({...kpis,summary:{...kpis.summary,requested:1}}).success).toBe(false);
    const {service} = setup({summary:{}});
    await expect(service.getKpis(period)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
  });
  it("rejects invalid periods and paging without database calls", async () => {
    const {rpc, service} = setup();
    expect(() => service.getKpis({...period,from:"2025-02-30"})).toThrow("INVALID");
    expect(() => service.getDrivers(period,101)).toThrow("INVALID");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("preserves authorization failures without leaking server details", async () => {
    const {service} = setup(null,{code:"42501"});
    await expect(service.getDrivers(period)).rejects.toMatchObject({code:"FORBIDDEN"});
  });
  it("does not fabricate an empty report on unavailable migrations", async () => {
    const {service} = setup(null,{code:"PGRST202"});
    await expect(service.getDiagnostics(period)).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
  it("accepts observed evidence coverage and null unknown delivery", async () => {
    const payload = {order:{id,service:"flash",requested_at:"2025-01-15T10:00:00Z",passenger_id:id},
      events:[],counts:{notification_coverage:"partial",drivers_delivery_confirmed_observed:null}};
    expect(evidenceSchema.safeParse(payload).success).toBe(true);
    const {service} = setup(payload);
    expect((await service.getEvidence("flash",id))?.counts.drivers_delivery_confirmed_observed).toBeNull();
  });
  it("retains cancellation authority in the existing transition and rejects false", async () => {
    const {rpc,service} = setup(false);
    await expect(service.cancelFlash(id)).rejects.toMatchObject({code:"UNAVAILABLE"});
    expect(rpc).toHaveBeenCalledExactlyOnceWith("quick_ride_transition",{p_id:id,p_status:"CANCELLED"});
  });
  it("records an optional reason separately and preserves false result", async () => {
    const {rpc,service} = setup(false);
    expect(await service.recordCancellationReason("flash",id,"WAIT_TOO_LONG")).toBe(false);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("caronaa_record_passenger_cancel_reason",
      {p_service:"flash",p_request_id:id,p_reason_code:"WAIT_TOO_LONG"});
  });
});
