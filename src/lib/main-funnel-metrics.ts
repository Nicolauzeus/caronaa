import { supabase } from "@/integrations/supabase/client";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export type MainFunnelStage = {
  key: string;
  label: string;
  count: number | null;
  fromPrevious: number | null;
  fromStart: number | null;
  unavailableReason?: string | null;
};
export type MainFunnelSummary = { stages: MainFunnelStage[]; largestDrop: MainFunnelStage | null };

/** Reference stage mapper for deterministic formula tests; live counts/rates come from SQL. */
export function buildMainFunnel(reached: number, counts: Array<number | null>): MainFunnelSummary {
  const labels = ["Pessoas alcançadas", "Cadastros", "Ofertas/Solicitações", "Matches", "Caronas realizadas", "Pagamentos", "Nova carona"];
  const values = [reached, ...counts];
  const stages = values.map((count, index) => ({
    key: labels[index].toLowerCase(),
    label: labels[index],
    count,
    fromPrevious: index === 0 ? 100 : count === null || values[index - 1] === null ? null : Math.round((count / values[index - 1]!) * 10000) / 100,
    fromStart: count === null ? null : reached ? Math.round((count / reached) * 10000) / 100 : 0,
    ...(index === 5 ? { unavailableReason: "Indisponivel: gateway de pagamento ainda nao integrado." } : {}),
  }));
  const candidates = stages.slice(1).filter((stage) => stage.fromPrevious !== null);
  const largestDrop = candidates.reduce<MainFunnelStage | null>(
    (lowest, stage) => !lowest || stage.fromPrevious! < lowest.fromPrevious! ? stage : lowest,
    null,
  );
  return { stages, largestDrop };
}

export async function getMainFunnelMetrics(filters: FormMetricsFilters = {}) {
  const { data, error } = await supabase.rpc("get_main_funnel_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_profile: filters.tipoUsuario ?? null,
  });
  if (error) throw new Error(`NÃ£o foi possÃ­vel carregar o funil principal: ${error.message}`);
  return data as MainFunnelSummary;
}
