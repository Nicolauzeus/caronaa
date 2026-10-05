import { supabase } from "@/integrations/supabase/client";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export type CompletedRideEvent = { userId: string; completedAt: string; profile?: string | null };
export type RetentionMetrics = {
  usersWith1Ride: number; usersWith2Rides: number; usersWith3OrMoreRides: number;
  repeatRate7d: number; repeatRate30d: number;
  distribution: { one: number; two: number; threeToFive: number; sixOrMore: number };
  byProfile: Record<string, { one: number; two: number; threeOrMore: number }>;
};

const percentage = (value: number, base: number) => base ? Math.round(value / base * 10000) / 100 : 0;

export function buildRetentionMetrics(events: CompletedRideEvent[]): RetentionMetrics {
  const byUser = new Map<string, CompletedRideEvent[]>();
  for (const event of events) byUser.set(event.userId, [...(byUser.get(event.userId) ?? []), event]);
  const distribution = { one: 0, two: 0, threeToFive: 0, sixOrMore: 0 };
  const byProfile: RetentionMetrics["byProfile"] = {};
  let usersWith1Ride = 0; let usersWith2Rides = 0; let usersWith3OrMoreRides = 0; let returned7 = 0; let returned30 = 0;
  for (const rides of byUser.values()) {
    const ordered = rides.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    const total = ordered.length;
    if (total === 1) { usersWith1Ride++; distribution.one++; }
    else if (total === 2) { usersWith2Rides++; distribution.two++; }
    else if (total <= 5) { usersWith3OrMoreRides++; distribution.threeToFive++; }
    else { usersWith3OrMoreRides++; distribution.sixOrMore++; }
    const profile = ordered[0]?.profile ?? "SEM_PERFIL";
    const profileBucket = byProfile[profile] ?? { one: 0, two: 0, threeOrMore: 0 };
    if (total === 1) profileBucket.one++; else if (total === 2) profileBucket.two++; else profileBucket.threeOrMore++;
    byProfile[profile] = profileBucket;
    if (total > 1) {
      const elapsed = Date.parse(ordered[1].completedAt) - Date.parse(ordered[0].completedAt);
      if (elapsed <= 7 * 86400000) returned7++;
      if (elapsed <= 30 * 86400000) returned30++;
    }
  }
  return { usersWith1Ride, usersWith2Rides, usersWith3OrMoreRides, repeatRate7d: percentage(returned7, byUser.size), repeatRate30d: percentage(returned30, byUser.size), distribution, byProfile };
}

async function getRetentionMetricsInMemory(filters: FormMetricsFilters = {}) {
  let query = supabase.from("product_events").select("user_id, created_at, metadata, source, campaign").eq("event_name", "RIDE_COMPLETED").eq("trusted_source", true);
  if (filters.periodStart) query = query.gte("created_at", filters.periodStart);
  if (filters.periodEnd) query = query.lt("created_at", filters.periodEnd);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.campaign) query = query.eq("campaign", filters.campaign);
  const { data, error } = await query;
  if (error) throw new Error(`Não foi possível carregar recorrência: ${error.message}`);
  return buildRetentionMetrics((data ?? []).filter((event) => !filters.tipoUsuario || (event.metadata as Record<string, unknown>)?.profile === filters.tipoUsuario).map((event) => ({ userId: event.user_id, completedAt: event.created_at, profile: (event.metadata as Record<string, string>)?.profile ?? null })));
}

export async function getRetentionMetrics(filters: FormMetricsFilters = {}) {
  const { data, error } = await supabase.rpc("get_retention_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_tipo_usuario: filters.tipoUsuario ?? null,
  });
  if (error) throw new Error(`Unable to load retention metrics: ${error.message}`);
  return data as RetentionMetrics;
}
