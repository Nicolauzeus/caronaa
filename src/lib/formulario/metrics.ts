// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type FormMetricsFilters = {
  periodStart?: string | null;
  periodEnd?: string | null;
  source?: string | null;
  campaign?: string | null;
  event?: string | null;
  tipoUsuario?: Enums<"form_tipo_usuario"> | null;
  ocupacao?: string | null;
};

export type FormMetricsTotals = {
  reached: number;
  started: number;
  completed: number;
  leads: number;
  startRate: number;
  completionRate: number | null;
  leadRate: number | null;
  passageiros: number;
  motoristas: number;
  ambos: number;
};

export type FormMetricsDistributions = {
  ocupacao: Record<string, number>;
  faixaHorario: Record<string, number>;
  frequenciaSemanal: Record<string, number>;
  transporteAtual: Record<string, number>;
  custoAtualFaixa: Record<string, number>;
};

export type PainPointMetric = {
  codigoDor: Enums<"form_dor_codigo">;
  selectedCount: number;
  selectedPercentage: number;
  principalCount: number;
  principalPercentage: number;
  averageIntensity: number | null;
};

export type IntentByProfileMetric = {
  tipoUsuario: Enums<"form_tipo_usuario">;
  passageiro: Partial<Record<Enums<"form_intencao">, number>>;
  motorista: Partial<Record<Enums<"form_intencao">, number>>;
};

export type FormMetricsSummary = {
  filters: Required<FormMetricsFilters>;
  totals: FormMetricsTotals;
  distributions: FormMetricsDistributions;
  painPoints: PainPointMetric[];
  intentByProfile: IntentByProfileMetric[];
};

export type FormMetricsInputSubmission = {
  tipoUsuario: Enums<"form_tipo_usuario">;
  ocupacao?: string | null;
  faixaHorario?: string | null;
  frequenciaSemanal?: string | null;
  transporteAtual?: string | null;
  custoAtualFaixa?: string | null;
  intencaoPassageiro?: Enums<"form_intencao"> | null;
  intencaoMotorista?: Enums<"form_intencao"> | null;
  painPoints: {
    codigoDor: Enums<"form_dor_codigo">;
    selecionada: boolean;
    principal: boolean;
    intensidade?: number | null;
  }[];
};

const painCodes: Enums<"form_dor_codigo">[] = [
  "DOR_01",
  "DOR_02",
  "DOR_03",
  "DOR_04",
  "DOR_05",
  "DOR_06",
];

const defaultFilters: Required<FormMetricsFilters> = {
  periodStart: null,
  periodEnd: null,
  source: null,
  campaign: null,
  event: null,
  tipoUsuario: null,
  ocupacao: null,
};

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function increment(distribution: Record<string, number>, key?: string | null) {
  if (!key) return;
  distribution[key] = (distribution[key] ?? 0) + 1;
}

export function buildFormMetricsSummary({
  started,
  submissions,
  filters = {},
}: {
  started: number;
  submissions: FormMetricsInputSubmission[];
  filters?: FormMetricsFilters;
}): FormMetricsSummary {
  const completed = submissions.length;
  const distributions: FormMetricsDistributions = {
    ocupacao: {},
    faixaHorario: {},
    frequenciaSemanal: {},
    transporteAtual: {},
    custoAtualFaixa: {},
  };
  const totals: FormMetricsTotals = {
    reached: started,
    started,
    completed,
    leads: completed,
    startRate: 100,
    completionRate: started === 0 ? 0 : roundPercent((completed / started) * 100),
    leadRate: completed === 0 ? 0 : 100,
    passageiros: 0,
    motoristas: 0,
    ambos: 0,
  };
  const intentByProfileMap = new Map<Enums<"form_tipo_usuario">, IntentByProfileMetric>();

  for (const submission of submissions) {
    if (submission.tipoUsuario === "PASSAGEIRO") totals.passageiros += 1;
    if (submission.tipoUsuario === "MOTORISTA") totals.motoristas += 1;
    if (submission.tipoUsuario === "AMBOS") totals.ambos += 1;

    increment(distributions.ocupacao, submission.ocupacao);
    increment(distributions.faixaHorario, submission.faixaHorario);
    increment(distributions.frequenciaSemanal, submission.frequenciaSemanal);
    increment(distributions.transporteAtual, submission.transporteAtual);
    increment(distributions.custoAtualFaixa, submission.custoAtualFaixa);

    const intentGroup =
      intentByProfileMap.get(submission.tipoUsuario) ??
      ({
        tipoUsuario: submission.tipoUsuario,
        passageiro: {},
        motorista: {},
      } satisfies IntentByProfileMetric);

    if (submission.intencaoPassageiro) {
      intentGroup.passageiro[submission.intencaoPassageiro] =
        (intentGroup.passageiro[submission.intencaoPassageiro] ?? 0) + 1;
    }

    if (submission.intencaoMotorista) {
      intentGroup.motorista[submission.intencaoMotorista] =
        (intentGroup.motorista[submission.intencaoMotorista] ?? 0) + 1;
    }

    intentByProfileMap.set(submission.tipoUsuario, intentGroup);
  }

  const painPoints = painCodes.map((codigoDor) => {
    let selectedCount = 0;
    let principalCount = 0;
    let intensitySum = 0;
    let intensityCount = 0;

    for (const submission of submissions) {
      const painPoint = submission.painPoints.find((item) => item.codigoDor === codigoDor);

      if (!painPoint) continue;

      if (painPoint.selecionada) selectedCount += 1;
      if (painPoint.principal) principalCount += 1;
      if (typeof painPoint.intensidade === "number") {
        intensitySum += painPoint.intensidade;
        intensityCount += 1;
      }
    }

    return {
      codigoDor,
      selectedCount,
      selectedPercentage: completed === 0 ? 0 : roundPercent((selectedCount / completed) * 100),
      principalCount,
      principalPercentage: completed === 0 ? 0 : roundPercent((principalCount / completed) * 100),
      averageIntensity: intensityCount === 0 ? null : roundPercent(intensitySum / intensityCount),
    } satisfies PainPointMetric;
  });

  return {
    filters: { ...defaultFilters, ...filters },
    totals,
    distributions,
    painPoints,
    intentByProfile: Array.from(intentByProfileMap.values()).sort((a, b) =>
      a.tipoUsuario.localeCompare(b.tipoUsuario),
    ),
  };
}

export async function getFormMetrics(filters: FormMetricsFilters = {}) {
  const { data, error } = await supabase.rpc("get_form_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_tipo_usuario: filters.tipoUsuario ?? null,
    p_ocupacao: filters.ocupacao ?? null,
  });

  if (error) {
    throw new Error(`Não foi possível carregar métricas do formulário: ${error.message}`);
  }

  const summary = data as FormMetricsSummary;
  const { data: funnelData, error: funnelError } = await supabase.rpc("get_form_funnel_metrics", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_tipo_usuario: filters.tipoUsuario ?? null,
    p_ocupacao: filters.ocupacao ?? null,
  });

  if (funnelError) {
    throw new Error(`Não foi possível carregar métricas do funil: ${funnelError.message}`);
  }

  return {
    ...summary,
    totals: {
      ...summary.totals,
      // A contagem das submissões persistidas é a fonte de verdade para "completed".
      // Eventos do funil são telemetria e não podem zerar respostas reais.
      ...(() => {
        const funnelTotals = (funnelData as { totals: Partial<FormMetricsTotals> }).totals;
        const completed = summary.totals.completed;
        const started = funnelTotals.started ?? 0;
        return {
          reached: funnelTotals.reached ?? 0,
          started,
          completed,
          leads: funnelTotals.leads ?? 0,
          startRate: funnelTotals.startRate ?? 0,
          completionRate: started > 0 ? Math.min(100, Math.round((completed / started) * 10000) / 100) : null,
          leadRate: typeof funnelTotals.leadRate === "number" ? funnelTotals.leadRate : null,
        };
      })(),
    },
  };
}
