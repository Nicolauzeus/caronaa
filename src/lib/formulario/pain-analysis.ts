import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

import type { FormMetricsFilters } from "./metrics";

export type PainAnalysisSortBy = "frequency" | "intensity" | "primaryPain" | "interest";

export type OpportunityScoreWeights = {
  frequency: number;
  intensity: number;
  primaryPain: number;
  interest: number;
};

export type PainAnalysisFilters = FormMetricsFilters & {
  sortBy?: PainAnalysisSortBy;
  weights?: Partial<OpportunityScoreWeights>;
};

export type PainOpportunityScores = {
  frequencyScore: number;
  intensityScore: number;
  primaryPainScore: number;
  interestScore: number;
  opportunityScore: number;
};

export type PainAnalysisItem = {
  codigoDor: Enums<"form_dor_codigo">;
  label: string;
  selectedCount: number;
  selectedPercentage: number;
  principalCount: number;
  principalPercentage: number;
  averageIntensity: number | null;
  intensityDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  averageInterest: number | null;
  scores: PainOpportunityScores;
};

export type PainAnalysisFormula = {
  description: string;
  frequencyScore: string;
  intensityScore: string;
  primaryPainScore: string;
  interestScore: string;
  interestScale: Record<Enums<"form_intencao">, number>;
  weights: OpportunityScoreWeights;
};

export type PainAnalysisSummary = {
  filters: Required<FormMetricsFilters>;
  sampleSize: number;
  formula: PainAnalysisFormula;
  sortBy: PainAnalysisSortBy;
  painPoints: PainAnalysisItem[];
};

export type PainAnalysisInputSubmission = {
  intencaoPassageiro?: Enums<"form_intencao"> | null;
  intencaoMotorista?: Enums<"form_intencao"> | null;
  painPoints: {
    codigoDor: Enums<"form_dor_codigo">;
    selecionada: boolean;
    principal: boolean;
    intensidade?: number | null;
  }[];
};

const painCatalog: { codigoDor: Enums<"form_dor_codigo">; label: string }[] = [
  {
    codigoDor: "DOR_01",
    label: "Acesso a uma opção adequada para determinado trajeto",
  },
  {
    codigoDor: "DOR_02",
    label: "Lotação e desconforto em horários de pico",
  },
  {
    codigoDor: "DOR_03",
    label: "Preço elevado de alternativas individuais",
  },
  {
    codigoDor: "DOR_04",
    label: "Tempo e complexidade do deslocamento",
  },
  {
    codigoDor: "DOR_05",
    label: "Lugares disponíveis em carros que poderiam ser compartilhados",
  },
  {
    codigoDor: "DOR_06",
    label: "Falta de confiança para pegar/oferecer carona a desconhecidos",
  },
];

const interestScale: Record<Enums<"form_intencao">, number> = {
  NAO: 1,
  PROVAVELMENTE_NAO: 2,
  TALVEZ: 3,
  PROVAVELMENTE: 4,
  HOJE: 5,
};

const defaultWeights: OpportunityScoreWeights = {
  frequency: 1,
  intensity: 1,
  primaryPain: 1,
  interest: 1,
};

const defaultFilters: Required<FormMetricsFilters> = {
  periodStart: null,
  periodEnd: null,
  source: null,
  campaign: null,
  event: null,
  tipoUsuario: null,
  ocupacao: null,
};

export const painAnalysisFormula = {
  description:
    "Opportunity Score = media ponderada de frequencyScore, intensityScore, primaryPainScore e interestScore, normalizada para 0-100.",
  frequencyScore: "percentual da amostra que selecionou a dor",
  intensityScore: "intensidade media / 5 * 100",
  primaryPainScore: "percentual da amostra que marcou a dor como principal",
  interestScore:
    "media de interesse convertida para 1-5 e normalizada: (media - 1) / 4 * 100",
  interestScale,
  weights: defaultWeights,
} satisfies PainAnalysisFormula;

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeWeight(value: number | null | undefined) {
  return Math.max(value ?? 0, 0);
}

function mergeWeights(weights?: Partial<OpportunityScoreWeights>): OpportunityScoreWeights {
  return {
    frequency: weights?.frequency ?? defaultWeights.frequency,
    intensity: weights?.intensity ?? defaultWeights.intensity,
    primaryPain: weights?.primaryPain ?? defaultWeights.primaryPain,
    interest: weights?.interest ?? defaultWeights.interest,
  };
}

function calculateOpportunityScore({
  frequencyScore,
  intensityScore,
  primaryPainScore,
  interestScore,
  weights,
}: {
  frequencyScore: number;
  intensityScore: number;
  primaryPainScore: number;
  interestScore: number;
  weights: OpportunityScoreWeights;
}) {
  const frequencyWeight = sanitizeWeight(weights.frequency);
  const intensityWeight = sanitizeWeight(weights.intensity);
  const primaryPainWeight = sanitizeWeight(weights.primaryPain);
  const interestWeight = sanitizeWeight(weights.interest);
  const totalWeight = frequencyWeight + intensityWeight + primaryPainWeight + interestWeight;

  if (totalWeight === 0) return 0;

  return roundMetric(
    (frequencyScore * frequencyWeight +
      intensityScore * intensityWeight +
      primaryPainScore * primaryPainWeight +
      interestScore * interestWeight) /
      totalWeight,
  );
}

function toInterestValues(submission: PainAnalysisInputSubmission) {
  return [submission.intencaoPassageiro, submission.intencaoMotorista]
    .map((interest) => (interest ? interestScale[interest] : null))
    .filter((value): value is number => typeof value === "number");
}

export function buildPainAnalysisSummary({
  submissions,
  filters = {},
  sortBy = "frequency",
  weights,
}: {
  submissions: PainAnalysisInputSubmission[];
  filters?: FormMetricsFilters;
  sortBy?: PainAnalysisSortBy;
  weights?: Partial<OpportunityScoreWeights>;
}): PainAnalysisSummary {
  const sampleSize = submissions.length;
  const mergedWeights = mergeWeights(weights);

  const painPoints = painCatalog.map(({ codigoDor, label }) => {
    let selectedCount = 0;
    let principalCount = 0;
    let intensitySum = 0;
    let intensityCount = 0;
    let interestSum = 0;
    let interestCount = 0;
    const intensityDistribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

    for (const submission of submissions) {
      const painPoint = submission.painPoints.find((item) => item.codigoDor === codigoDor);

      if (!painPoint?.selecionada) continue;

      selectedCount += 1;
      if (painPoint.principal) principalCount += 1;

      if (
        typeof painPoint.intensidade === "number" &&
        painPoint.intensidade >= 1 &&
        painPoint.intensidade <= 5
      ) {
        const intensityKey = String(painPoint.intensidade) as keyof typeof intensityDistribution;
        intensityDistribution[intensityKey] += 1;
        intensitySum += painPoint.intensidade;
        intensityCount += 1;
      }

      for (const interestValue of toInterestValues(submission)) {
        interestSum += interestValue;
        interestCount += 1;
      }
    }

    const selectedPercentage =
      sampleSize === 0 ? 0 : roundMetric((selectedCount / sampleSize) * 100);
    const principalPercentage =
      sampleSize === 0 ? 0 : roundMetric((principalCount / sampleSize) * 100);
    const averageIntensity = intensityCount === 0 ? null : roundMetric(intensitySum / intensityCount);
    const averageInterest = interestCount === 0 ? null : roundMetric(interestSum / interestCount);
    const frequencyScore = selectedPercentage;
    const intensityScore = roundMetric(((averageIntensity ?? 0) / 5) * 100);
    const primaryPainScore = principalPercentage;
    const interestScore = roundMetric((((averageInterest ?? 1) - 1) / 4) * 100);

    return {
      codigoDor,
      label,
      selectedCount,
      selectedPercentage,
      principalCount,
      principalPercentage,
      averageIntensity,
      intensityDistribution,
      averageInterest,
      scores: {
        frequencyScore,
        intensityScore,
        primaryPainScore,
        interestScore,
        opportunityScore: calculateOpportunityScore({
          frequencyScore,
          intensityScore,
          primaryPainScore,
          interestScore,
          weights: mergedWeights,
        }),
      },
    } satisfies PainAnalysisItem;
  });

  painPoints.sort((a, b) => {
    const scoreBySort = {
      frequency: [b.scores.frequencyScore, a.scores.frequencyScore],
      intensity: [b.scores.intensityScore, a.scores.intensityScore],
      primaryPain: [b.scores.primaryPainScore, a.scores.primaryPainScore],
      interest: [b.scores.interestScore, a.scores.interestScore],
    }[sortBy];

    const scoreDiff = scoreBySort[0] - scoreBySort[1];
    return scoreDiff || a.codigoDor.localeCompare(b.codigoDor);
  });

  return {
    filters: { ...defaultFilters, ...filters },
    sampleSize,
    formula: { ...painAnalysisFormula, weights: mergedWeights },
    sortBy,
    painPoints,
  };
}

export async function getPainAnalysis({
  sortBy = "frequency",
  weights,
  ...filters
}: PainAnalysisFilters = {}) {
  const mergedWeights = mergeWeights(weights);
  const { data, error } = await supabase.rpc("get_form_pain_analysis", {
    p_period_start: filters.periodStart ?? null,
    p_period_end: filters.periodEnd ?? null,
    p_source: filters.source ?? null,
    p_campaign: filters.campaign ?? null,
    p_event: filters.event ?? null,
    p_tipo_usuario: filters.tipoUsuario ?? null,
    p_ocupacao: filters.ocupacao ?? null,
    p_sort_by: sortBy,
    p_frequency_weight: mergedWeights.frequency,
    p_intensity_weight: mergedWeights.intensity,
    p_primary_weight: mergedWeights.primaryPain,
    p_interest_weight: mergedWeights.interest,
  });

  if (error) {
    throw new Error(`Não foi possível carregar a análise das dores: ${error.message}`);
  }

  return data as PainAnalysisSummary;
}
