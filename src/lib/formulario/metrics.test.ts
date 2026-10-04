import { describe, expect, it } from "vitest";

import { buildFormMetricsSummary, type FormMetricsInputSubmission } from "./metrics";

const submissions: FormMetricsInputSubmission[] = [
  {
    tipoUsuario: "PASSAGEIRO",
    ocupacao: "ESTUDANTE",
    faixaHorario: "18_19",
    frequenciaSemanal: "3_4",
    transporteAtual: "ONIBUS",
    custoAtualFaixa: "6_10",
    intencaoPassageiro: "HOJE",
    painPoints: [
      { codigoDor: "DOR_01", selecionada: true, principal: true, intensidade: 5 },
      { codigoDor: "DOR_02", selecionada: true, principal: false },
    ],
  },
  {
    tipoUsuario: "MOTORISTA",
    ocupacao: "TRABALHADOR",
    faixaHorario: "18_19",
    frequenciaSemanal: "5_MAIS",
    transporteAtual: "CARRO_PROPRIO",
    custoAtualFaixa: "21_30",
    intencaoMotorista: "PROVAVELMENTE",
    painPoints: [
      { codigoDor: "DOR_01", selecionada: true, principal: false },
      { codigoDor: "DOR_03", selecionada: true, principal: true, intensidade: 3 },
    ],
  },
  {
    tipoUsuario: "AMBOS",
    ocupacao: "ESTUDANTE",
    faixaHorario: "19_20",
    frequenciaSemanal: "3_4",
    transporteAtual: "UBER_99",
    custoAtualFaixa: "11_20",
    intencaoPassageiro: "TALVEZ",
    intencaoMotorista: "NAO",
    painPoints: [
      { codigoDor: "DOR_01", selecionada: true, principal: true, intensidade: 4 },
      { codigoDor: "DOR_02", selecionada: true, principal: false },
    ],
  },
];

describe("form metrics", () => {
  it("calculates totals and completion rate", () => {
    const summary = buildFormMetricsSummary({ started: 4, submissions });

    expect(summary.totals).toEqual({
      reached: 4,
      started: 4,
      completed: 3,
      leads: 3,
      startRate: 100,
      completionRate: 75,
      leadRate: 100,
      passageiros: 1,
      motoristas: 1,
      ambos: 1,
    });
  });

  it("calculates distributions", () => {
    const summary = buildFormMetricsSummary({ started: 3, submissions });

    expect(summary.distributions.ocupacao).toEqual({ ESTUDANTE: 2, TRABALHADOR: 1 });
    expect(summary.distributions.faixaHorario).toEqual({ "18_19": 2, "19_20": 1 });
    expect(summary.distributions.frequenciaSemanal).toEqual({ "3_4": 2, "5_MAIS": 1 });
    expect(summary.distributions.transporteAtual).toEqual({
      ONIBUS: 1,
      CARRO_PROPRIO: 1,
      UBER_99: 1,
    });
    expect(summary.distributions.custoAtualFaixa).toEqual({
      "6_10": 1,
      "21_30": 1,
      "11_20": 1,
    });
  });

  it("calculates pain point counts, percentages and average intensity", () => {
    const summary = buildFormMetricsSummary({ started: 3, submissions });
    const dor01 = summary.painPoints.find((painPoint) => painPoint.codigoDor === "DOR_01");
    const dor02 = summary.painPoints.find((painPoint) => painPoint.codigoDor === "DOR_02");
    const dor06 = summary.painPoints.find((painPoint) => painPoint.codigoDor === "DOR_06");

    expect(dor01).toMatchObject({
      selectedCount: 3,
      selectedPercentage: 100,
      principalCount: 2,
      principalPercentage: 66.67,
      averageIntensity: 4.5,
    });
    expect(dor02).toMatchObject({
      selectedCount: 2,
      selectedPercentage: 66.67,
      principalCount: 0,
      principalPercentage: 0,
      averageIntensity: null,
    });
    expect(dor06).toMatchObject({
      selectedCount: 0,
      selectedPercentage: 0,
      principalCount: 0,
      principalPercentage: 0,
      averageIntensity: null,
    });
  });

  it("preserves passenger and driver intention for AMBOS", () => {
    const summary = buildFormMetricsSummary({ started: 3, submissions });
    const ambos = summary.intentByProfile.find((item) => item.tipoUsuario === "AMBOS");

    expect(ambos?.passageiro).toEqual({ TALVEZ: 1 });
    expect(ambos?.motorista).toEqual({ NAO: 1 });
  });
});
