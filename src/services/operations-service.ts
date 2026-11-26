import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const serviceSchema = z.enum(["all", "flash", "shared"]);
const orderServiceSchema = z.enum(["flash", "shared"]);
const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const period = z.object({ from: day, to: day, service: serviceSchema }).refine(
  p => p.from <= p.to && Date.parse(p.to) - Date.parse(p.from) <= 366 * 86400000,
);
export type OperationsPeriod = z.infer<typeof period>;
export type OrderService = z.infer<typeof orderServiceSchema>;
export const cancellationReasonSchema = z.enum([
  "WAIT_TOO_LONG", "CHANGED_PLANS", "PRICE", "FOUND_ALTERNATIVE", "WRONG_ROUTE",
  "TECHNICAL_PROBLEM", "OTHER", "PREFER_NOT_TO_SAY",
]);
export type CancellationReason = z.infer<typeof cancellationReasonSchema>;
const count = z.number().int().nonnegative();
const numeric = z.number().finite().nonnegative();
const optionalCount = count.nullable();
const optionalNumber = numeric.nullable();
const notes = z.record(z.string());
const scope = z.object({ from: day, to: day, service: serviceSchema });
const summary = z.object({
  requested: count, accepted: count, never_accepted: count, unserved: count,
  completed: count, cancelled: count, expired: count, in_progress: count, waiting: count, other: count,
  cancelled_after_acceptance: count, cancelled_before_acceptance: count, wait_samples: count,
  mean_wait_seconds: optionalNumber, median_wait_seconds: optionalNumber,
  acceptance_pct: optionalNumber, completion_pct: optionalNumber, unserved_pct: optionalNumber,
  unserved_quoted_value_cents: optionalCount, unserved_unknown_fare: count,
  completed_quoted_value_cents: optionalCount, passengers: count,
}).refine(s => s.requested === s.accepted + s.never_accepted &&
  s.requested === s.completed + s.cancelled + s.expired + s.in_progress + s.waiting + s.other &&
  s.cancelled === s.cancelled_before_acceptance + s.cancelled_after_acceptance &&
  s.unserved <= s.never_accepted);
export const kpiSchema = scope.extend({
  summary, recurring_passengers: count,
  cancellation_reasons: z.array(z.object({ reason_code: z.string(), orders: count })),
  hours: z.array(z.object({ hour: z.number().int().min(0).max(23), requests: count, unserved: count })),
  territories: z.array(z.object({ service: orderServiceSchema, municipality: z.string(), requests: count, unserved: count })),
  notification_observations: z.array(z.object({ stage: z.string(), observed_events: count, observed_order_driver_pairs: count, observed_unique_drivers: count })),
  notes,
});
export const conversionSchema = scope.extend({
  previous_from: day, previous_to: day,
  quote_conversion: z.array(z.object({
    service: orderServiceSchema, issued: count, linked_to_request: count, linked_to_offer: count,
    linked_to_both: count, no_persisted_link: count, request_link_pct: optionalNumber,
  }).refine(q => q.issued === q.linked_to_request + q.linked_to_offer - q.linked_to_both + q.no_persisted_link)),
  retention: z.object({
    current_passengers: count, first_observed_in_period: count, retained_from_previous: count,
    returned_after_gap: count, repeated_in_period: count, completed_passengers: count,
    previous_passengers: count, previous_not_returned: count, previous_cohort_retention_pct: optionalNumber,
  }).refine(r => r.current_passengers === r.first_observed_in_period + r.retained_from_previous + r.returned_after_gap &&
    r.previous_passengers === r.retained_from_previous + r.previous_not_returned),
  notes,
});
export const driverSchema = scope.extend({
  total_drivers: count,
  rows: z.array(z.object({
    driver_id: uuid, driver_name: z.string().nullable(), observed_order_pairs: count,
    recorded_views: count, recorded_skips: count, accepted_orders: count, completed_orders: count,
    driver_cancelled_orders: count, observed_eligible_orders: optionalCount, observed_delivered_orders: optionalCount,
    view_samples: count, mean_view_seconds: optionalNumber, accept_samples: count,
    mean_accept_seconds: optionalNumber, arrival_samples: count, mean_arrival_seconds: optionalNumber,
  })), notes,
});
export const cancellationSchema = scope.extend({
  total_cancelled: count,
  groups: z.array(z.object({
    actor: z.enum(["PASSENGER", "DRIVER", "ADMIN", "OTHER_RECORDED_ACTOR", "AMBIGUOUS", "UNKNOWN"]),
    reason_code: z.string(), cancelled_orders: count, after_acceptance: count, before_acceptance: count,
  })), notes,
}).refine(x => x.total_cancelled === x.groups.reduce((n, g) => n + g.cancelled_orders, 0));
export const diagnosticSchema = scope.extend({
  flash_hourly_supply_demand: z.array(z.object({
    hour: z.number().int().min(0).max(23), requests: count, unserved: count,
    observed_driver_hours: optionalCount, observed_hour_buckets: optionalCount,
  })),
  notification_diagnostics: z.object({
    orders: count, orders_with_receipts: count, orders_with_observed_send_failure: count,
    failures_without_recorded_delivery: count, orders_with_observed_delivery: count,
    orders_without_receipts: count, unserved_with_observed_send_failure: count, unserved_without_receipts: count,
  }),
  flash_manual_pix: z.object({
    completed_flash_orders: count, bilateral_pix_orders: count, passenger_declared_only: count,
    acknowledgement_without_declaration: count, no_bilateral_evidence: count,
    bilateral_quoted_value_cents: optionalCount, bilateral_unknown_fare: count,
  }).nullable(),
  recorded_incidents: z.array(z.object({ category: z.string(), recorded_incidents: count, resolved_incidents: count })),
  notes,
});
export const evidenceSchema = z.object({
  order: z.object({ id: uuid, service: orderServiceSchema, requested_at: z.string(), passenger_id: uuid }).passthrough(),
  events: z.array(z.object({
    event_type: z.string(), occurred_at: z.string(), actor_id: uuid.nullable(), source: z.string(),
    detail: z.record(z.unknown()),
  })),
  counts: z.record(z.union([count, z.boolean(), z.string(), z.null()])),
}).passthrough();
export const funnelSchema = scope.extend({
  rows: z.array(z.object({
    service: orderServiceSchema, quotes_issued: count, quotes_with_request: count,
    quotes_with_acceptance: count, quotes_with_completion: count,
    request_pct: optionalNumber, completion_pct: optionalNumber,
  }).refine(x => x.quotes_issued >= x.quotes_with_request &&
    x.quotes_with_request >= x.quotes_with_acceptance &&
    x.quotes_with_acceptance >= x.quotes_with_completion)),
  notes,
});
export const overviewSchema = z.object({
  kpis: kpiSchema, conversion: conversionSchema, funnel: funnelSchema,
  cancellations: cancellationSchema, diagnostics: diagnosticSchema,
}).refine(x => {
  const k = x.kpis;
  return [x.conversion,x.funnel,x.cancellations,x.diagnostics].every(s =>
    s.from===k.from && s.to===k.to && s.service===k.service) &&
    k.summary.cancelled===x.cancellations.total_cancelled;
});
export const personHistorySchema=scope.extend({
  person_id:uuid,role:z.enum(["driver","passenger"]),
  summary:z.object({orders:count,accepted:count,completed:count,cancelled:count,recorded_views:optionalCount,recorded_skips:optionalCount,observed_eligible:optionalCount,view_samples:count,mean_view_seconds:optionalNumber,accept_samples:count,mean_accept_seconds:optionalNumber,arrival_samples:count,mean_arrival_seconds:optionalNumber}),
  rows:z.array(z.object({id:uuid,service:orderServiceSchema,requested_at:z.string(),origin:z.string(),destination:z.string(),status:z.string(),fare_cents:z.number().int().nullable(),accepted:z.boolean(),completed:z.boolean(),cancelled:z.boolean(),viewed:z.boolean().nullable(),skipped:z.boolean().nullable(),eligible:z.boolean().nullable()})),
  notes,
});
export type OperationalPersonHistory=z.infer<typeof personHistorySchema>;
export type OperationalFunnel = z.infer<typeof funnelSchema>;
export type OperationalOverview = z.infer<typeof overviewSchema>;
export type OperationalKpis = z.infer<typeof kpiSchema>;
export type OperationalConversion = z.infer<typeof conversionSchema>;
export type OperationalDrivers = z.infer<typeof driverSchema>;
export type OperationalCancellations = z.infer<typeof cancellationSchema>;
export type OperationalDiagnostics = z.infer<typeof diagnosticSchema>;
export type OperationalEvidence = z.infer<typeof evidenceSchema>;

export class OperationsServiceError extends Error {
  constructor(public readonly code: "INVALID" | "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE") {
    super(code); this.name = "OperationsServiceError";
  }
}
type RpcName = "admin_operational_order_kpis" | "admin_operational_conversion_retention" |
  "admin_operational_driver_performance" | "admin_operational_cancellation_breakdown" |
  "admin_operational_diagnostics" | "admin_operations_order_evidence" | "caronaa_record_passenger_cancel_reason" |
  "admin_operational_quote_funnel" | "admin_operational_overview" |
  "admin_operational_person_history" | "caronaa_record_shared_attempt_cancel_reason" | "quick_ride_transition";
type RpcPort = { rpc(name: RpcName, args: Record<string, unknown>): PromiseLike<{
  data: unknown; error: { code?: string } | null;
}> };
function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OperationsServiceError("INVALID");
  return parsed.data;
}
function argsFor(input: OperationsPeriod) {
  const p = validate(period, input);
  return { p_from: p.from, p_to: p.to, p_service: p.service };
}
export function createOperationsService(db: RpcPort) {
  async function call<T>(name: RpcName, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    let result: Awaited<ReturnType<RpcPort["rpc"]>>;
    try { result = await db.rpc(name, args); }
    catch { throw new OperationsServiceError("UNAVAILABLE"); }
    if (result.error) throw new OperationsServiceError(result.error.code === "42501" ? "FORBIDDEN" :
      result.error.code === "22023" ? "INVALID" : "UNAVAILABLE");
    const parsed = schema.safeParse(result.data);
    if (!parsed.success) throw new OperationsServiceError("INVALID_RESPONSE");
    return parsed.data;
  }
  return {
    getPersonHistory: (personId:string, role:"driver"|"passenger",p:OperationsPeriod,limit=20,offset=0) =>
      call("admin_operational_person_history",{...argsFor(p),p_person_id:validate(uuid,personId),
        p_role:validate(z.enum(["driver","passenger"]),role),p_limit:validate(z.number().int().min(1).max(100),limit),
        p_offset:validate(z.number().int().min(0).max(100000),offset)},personHistorySchema.nullable()),
    getFunnel: (p: OperationsPeriod) => call("admin_operational_quote_funnel", argsFor(p), funnelSchema),
    getOverview: (p: OperationsPeriod) => call("admin_operational_overview", argsFor(p), overviewSchema),
    getKpis: (p: OperationsPeriod) => call("admin_operational_order_kpis", argsFor(p), kpiSchema),
    getConversion: (p: OperationsPeriod) => call("admin_operational_conversion_retention", argsFor(p), conversionSchema),
    getDrivers: (p: OperationsPeriod, limit = 50, offset = 0) => call("admin_operational_driver_performance",
      { ...argsFor(p), p_limit: validate(z.number().int().min(1).max(100), limit),
        p_offset: validate(z.number().int().min(0).max(100000), offset) }, driverSchema),
    getCancellations: (p: OperationsPeriod) => call("admin_operational_cancellation_breakdown", argsFor(p), cancellationSchema),
    getDiagnostics: (p: OperationsPeriod) => call("admin_operational_diagnostics", argsFor(p), diagnosticSchema),
    getEvidence: (service: OrderService, id: string) => call("admin_operations_order_evidence",
      { p_service: validate(orderServiceSchema, service), p_request_id: validate(uuid, id) }, evidenceSchema.nullable()),
    recordSharedAttemptReason: (rideId:string,reason:CancellationReason) => call("caronaa_record_shared_attempt_cancel_reason",
      {p_ride_id:validate(uuid,rideId),p_reason_code:validate(cancellationReasonSchema,reason)},z.boolean()),
    recordCancellationReason: (service: OrderService, id: string, reason: CancellationReason) =>
      call("caronaa_record_passenger_cancel_reason", {
        p_service: validate(orderServiceSchema, service), p_request_id: validate(uuid, id),
        p_reason_code: validate(cancellationReasonSchema, reason),
      }, z.boolean()),
    // The established transition remains authoritative; do not make a cancellation depend on optional analytics.
    cancelFlash: async (id: string) => {
      const cancelled = await call("quick_ride_transition", { p_id: validate(uuid, id), p_status: "CANCELLED" }, z.boolean());
      if (!cancelled) throw new OperationsServiceError("UNAVAILABLE");
    },
  };
}
// Only the caller's authenticated session. Never import the service-role client here.
// New RPCs are not yet present in generated Supabase types; keep the compatibility cast confined to this boundary.
export const operationsService = createOperationsService(supabase as unknown as RpcPort);
