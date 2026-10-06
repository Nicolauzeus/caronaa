// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { supabase } from "@/integrations/supabase/client";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export type FunnelMetricEvent = {
  event_id: string;
  event_name:
    "landing_view" | "form_started" | "form_completed" | "lead_created" | "form_step_completed";
  user_id: string | null;
  anonymous_session_id: string | null;
};

export type FunnelMetricsSummary = {
  reached: number;
  started: number;
  completed: number;
  leads: number;
  rates: {
    reachedToStarted: number;
    startedToCompleted: number;
    completedToLead: number;
  };
};

const eventOrder: FunnelMetricEvent["event_name"][] = [
  "landing_view",
  "form_started",
  "form_completed",
  "lead_created",
];

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function conversionRate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : roundPercent((numerator / denominator) * 100);
}

function eventIdentity(event: FunnelMetricEvent) {
  if (event.user_id) return `user:${event.user_id}`;
  if (event.anonymous_session_id) return `session:${event.anonymous_session_id}`;
  return `event:${event.event_id}`;
}

/** Small in-memory reference reducer used to compare the SQL RPC against fixtures. */
export function buildFunnelMetrics(events: FunnelMetricEvent[]): FunnelMetricsSummary {
  const buckets = Object.fromEntries(eventOrder.map((name) => [name, new Set<string>()])) as Record<
    FunnelMetricEvent["event_name"],
    Set<string>
  >;
  for (const event of events) {
    if (eventOrder.includes(event.event_name)) buckets[event.event_name].add(eventIdentity(event));
  }
  const reached = buckets.landing_view.size;
  const started = buckets.form_started.size;
  const completed = buckets.form_completed.size;
  const leads = buckets.lead_created.size;
  return {
    reached,
    started,
    completed,
    leads,
    rates: {
      reachedToStarted: conversionRate(started, reached),
      startedToCompleted: conversionRate(completed, started),
      completedToLead: conversionRate(leads, completed),
    },
  };
}

export async function getFunnelMetrics(filters: FormMetricsFilters = {}) {
  const { data, error } = await supabase.rpc("get_acquisition_funnel_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_profile: filters.tipoUsuario ?? null,
  });
  if (error) throw new Error(`NÃ£o foi possÃ­vel carregar o funil: ${error.message}`);
  return data as FunnelMetricsSummary;
}
