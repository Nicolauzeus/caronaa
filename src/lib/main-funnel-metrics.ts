import { supabase } from "@/integrations/supabase/client";
import { getFunnelMetrics } from "@/lib/funnel-metrics";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export type MainFunnelStage = { key: string; label: string; count: number | null; fromPrevious: number | null; fromStart: number | null; unavailableReason?: string };
export type MainFunnelSummary = { stages: MainFunnelStage[]; largestDrop: MainFunnelStage | null };
const percent = (value: number, base: number) => base ? Math.round(value / base * 10000) / 100 : 0;

export function buildMainFunnel(reached: number, counts: Array<number | null>): MainFunnelSummary {
  const labels = ["Pessoas alcançadas", "Cadastros", "Ofertas/Solicitações", "Matches", "Caronas realizadas", "Pagamentos", "Nova carona"];
  const values = [reached, ...counts];
  const stages = values.map((count, index) => ({
    key: labels[index].toLowerCase(), label: labels[index], count,
    fromPrevious: index === 0 ? 100 : count === null || values[index - 1] === null ? null : percent(count, values[index - 1]!),
    fromStart: count === null ? null : percent(count, reached),
    ...(index === 5 ? { unavailableReason: "Indisponivel: gateway de pagamento ainda nao integrado." } : {}),
  }));
  const later = stages.slice(1).filter((stage): stage is typeof stage & { fromPrevious: number } => stage.fromPrevious !== null);
  return { stages, largestDrop: later.length ? later.reduce((lowest, stage) => stage.fromPrevious < lowest.fromPrevious ? stage : lowest) : null };
}

export async function getMainFunnelMetrics(filters: FormMetricsFilters = {}) {
  const [acquisition, product] = await Promise.all([
    getFunnelMetrics(filters),
    supabase.from("product_events").select("event_name, user_id, ride_id, metadata, created_at, source, campaign, trusted_source")
      .gte("created_at", filters.periodStart ?? "1970-01-01")
      .lt("created_at", filters.periodEnd ?? "9999-12-31"),
  ]);
  if (product.error) throw new Error(`Não foi possível carregar o funil principal: ${product.error.message}`);
  let rows = product.data ?? [];
  rows = rows.filter((row) => (!filters.source || row.source === filters.source) && (!filters.campaign || row.campaign === filters.campaign) && (!filters.tipoUsuario || (row.metadata as Record<string, unknown>)?.profile === filters.tipoUsuario));
  const countUsers = (names: string[], trustedOnly = false) => new Set(rows.filter((row) => names.includes(row.event_name) && (!trustedOnly || row.trusted_source)).map((row) => row.user_id)).size;
  const completedRides = new Set(rows.filter((row) => row.event_name === "RIDE_COMPLETED" && row.trusted_source && row.ride_id).map((row) => row.ride_id)).size;
  return buildMainFunnel(acquisition.reached, [
    countUsers(["USER_REGISTERED"]), countUsers(["RIDE_OFFER_CREATED", "RIDE_REQUEST_CREATED"], true),
    countUsers(["MATCH_CREATED"], true), completedRides, null, countUsers(["RIDE_REPEATED"], true),
  ]);
}
