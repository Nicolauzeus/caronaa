import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

type FunnelEvent = Tables<"funnel_events">;

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

const eventOrder: Enums<"funnel_event_name">[] = [
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

function eventIdentity(event: FunnelEvent) {
  if (event.user_id) return `user:${event.user_id}`;
  if (event.anonymous_session_id) return `session:${event.anonymous_session_id}`;
  return `event:${event.event_id}`;
}

export async function getFunnelMetrics(filters: FormMetricsFilters = {}) {
  let query = supabase
    .from("funnel_events")
    .select("*")
    .in("event_name", eventOrder)
    .order("created_at", { ascending: false });

  if (filters.periodStart) query = query.gte("created_at", filters.periodStart);
  if (filters.periodEnd) query = query.lt("created_at", filters.periodEnd);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.campaign) query = query.eq("campaign", filters.campaign);
  if (filters.event) query = query.eq("campaign_event", filters.event);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível carregar o funil: ${error.message}`);
  }

  const buckets = {
    landing_view: new Set<string>(),
    form_started: new Set<string>(),
    form_completed: new Set<string>(),
    lead_created: new Set<string>(),
  };

  for (const event of data ?? []) {
    buckets[event.event_name].add(eventIdentity(event));
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
  } satisfies FunnelMetricsSummary;
}
