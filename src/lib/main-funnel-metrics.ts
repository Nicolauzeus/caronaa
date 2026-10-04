import { supabase } from "@/integrations/supabase/client";
import { getFunnelMetrics } from "@/lib/funnel-metrics";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export type MainFunnelStage = { key: string; label: string; count: number; fromPrevious: number; fromStart: number };
export type MainFunnelSummary = { stages: MainFunnelStage[]; largestDrop: MainFunnelStage | null };
const percent = (value: number, base: number) => base ? Math.round(value / base * 10000) / 100 : 0;

export function buildMainFunnel(reached: number, counts: number[]): MainFunnelSummary {
  const labels = ["Pessoas alcançadas", "Cadastros", "Ofertas/Solicitações", "Matches", "Caronas realizadas", "Pagamentos", "Nova carona"];
  const stages = [reached, ...counts].map((count, index) => ({
    key: labels[index].toLowerCase(), label: labels[index], count,
    fromPrevious: index === 0 ? 100 : percent(count, [reached, ...counts][index - 1]),
    fromStart: percent(count, reached),
  }));
  const later = stages.slice(1);
  return { stages, largestDrop: later.length ? later.reduce((lowest, stage) => stage.fromPrevious < lowest.fromPrevious ? stage : lowest) : null };
}

export async function getMainFunnelMetrics(filters: FormMetricsFilters = {}) {
  const [acquisition, product] = await Promise.all([
    getFunnelMetrics(filters),
    supabase.from("product_events").select("event_name, user_id, metadata, created_at, source, campaign")
      .gte("created_at", filters.periodStart ?? "1970-01-01")
      .lt("created_at", filters.periodEnd ?? "9999-12-31"),
  ]);
  if (product.error) throw new Error(`Não foi possível carregar o funil principal: ${product.error.message}`);
  let rows = product.data ?? [];
  rows = rows.filter((row) => (!filters.source || row.source === filters.source) && (!filters.campaign || row.campaign === filters.campaign) && (!filters.tipoUsuario || (row.metadata as Record<string, unknown>)?.profile === filters.tipoUsuario));
  const countUsers = (names: string[]) => new Set(rows.filter((row) => names.includes(row.event_name)).map((row) => row.user_id)).size;
  return buildMainFunnel(acquisition.reached, [
    countUsers(["USER_REGISTERED"]), countUsers(["RIDE_OFFER_CREATED", "RIDE_REQUEST_CREATED"]),
    countUsers(["MATCH_CREATED"]), countUsers(["RIDE_COMPLETED"]), countUsers(["PAYMENT_COMPLETED"]), countUsers(["RIDE_REPEATED"]),
  ]);
}
