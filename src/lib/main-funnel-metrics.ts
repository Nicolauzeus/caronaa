// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
﻿import { supabase } from "@/integrations/supabase/client";
import type { FormMetricsFilters } from "@/lib/formulario/metrics";

export type MainFunnelStage = {
  key: string;
  label: string;
  count: number | null;
  fromPrevious: number | null;
  fromStart: number | null;
  unavailableReason?: string | null;
  denominatorLabel?: string;
};
export type MainFunnelSummary = {
  cohortEvent: "landing_view" | "user_registered";
  cohortSize: number;
  stages: MainFunnelStage[];
  largestDrop: MainFunnelStage | null;
};

/** Reference cohort reducer for deterministic tests; production aggregates come from SQL. */
export function buildMainFunnel(
  cohort: Array<{ userId: string; events: string[] }>,
  cohortEvent: "landing_view" | "user_registered" = "landing_view",
): MainFunnelSummary {
  const labels: string[] = [
    "Coorte adquirida",
    "Cadastros",
    "Ofertas/Solicitações",
    "Matches",
    "Caronas realizadas",
    "Pagamentos",
    "Nova carona",
  ];
  const reached = new Set(cohort.map((person) => person.userId)).size;
  const eventGroups = [
    null,
    ["USER_REGISTERED"],
    ["RIDE_REQUEST_CREATED", "RIDE_OFFER_CREATED"],
    ["MATCH_CREATED"],
    ["RIDE_COMPLETED"],
    null,
    ["RIDE_REPEATED"],
  ];
  const values: Array<number | null> = labels.map((_, index) => {
    if (index === 0) return reached;
    const group = eventGroups[index];
    if (!group) return null;
    return new Set(
      cohort
        .filter((person) => person.events.some((event) => group.includes(event)))
        .map((person) => person.userId),
    ).size;
  });
  const stages: MainFunnelStage[] = values.map((count, index) => ({
    key: (labels[index] ?? "etapa").toLowerCase(),
    label: labels[index] ?? "Etapa",
    count,
    fromPrevious:
      index === 0
        ? 100
        : count === null || values[index - 1] == null
          ? null
          : Math.round((count / values[index - 1]!) * 10000) / 100,
    fromStart: count === null ? null : reached ? Math.round((count / reached) * 10000) / 100 : 0,
    ...(index === 5
      ? { unavailableReason: "Indisponível: gateway de pagamento ainda não integrado." }
      : {}),
  }));
  const candidates = stages.slice(1).filter((stage) => stage.fromPrevious !== null);
  const largestDrop = candidates.reduce<MainFunnelStage | null>(
    (lowest, stage) => (!lowest || stage.fromPrevious! < lowest.fromPrevious! ? stage : lowest),
    null,
  );
  return { cohortEvent, cohortSize: reached, stages, largestDrop };
}

export async function getMainFunnelMetrics(
  filters: FormMetricsFilters = {},
  cohortEvent: "landing_view" | "user_registered" = "landing_view",
) {
  const { data, error } = await supabase.rpc("get_main_funnel_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_profile: filters.tipoUsuario ?? null,
    p_cohort_event: cohortEvent,
  });
  if (error) throw new Error(`Não foi possível carregar o funil principal: ${error.message}`);
  const summary = data as MainFunnelSummary;
  const labels = ["Coorte adquirida", "Cadastros", "Ofertas e solicitações", "Combinações", "Caronas realizadas", "Pagamentos", "Nova carona"];
  return {
    ...summary,
    cohortEvent,
    cohortSize: summary.cohortSize ?? summary.stages?.[0]?.count ?? 0,
    stages: (summary.stages ?? []).map((stage, index) => ({
      ...stage,
      label: labels[index] ?? stage.label,
      unavailableReason: index === 5 ? "Pagamento integrado ainda indisponível." : stage.unavailableReason,
    })),
  } as MainFunnelSummary;
}
