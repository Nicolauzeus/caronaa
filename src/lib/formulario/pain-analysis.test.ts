import { describe, expect, it } from "vitest";

import { buildPainAnalysisSummary, type PainAnalysisInputSubmission } from "./pain-analysis";

const submissions: PainAnalysisInputSubmission[] = [
  {
    intencaoPassageiro: "HOJE",
    painPoints: [
      { codigoDor: "DOR_01", selecionada: true, principal: true, intensidade: 5 },
      { codigoDor: "DOR_02", selecionada: true, principal: false, intensidade: 3 },
    ],
  },
  {
    intencaoMotorista: "PROVAVELMENTE",
    painPoints: [
      { codigoDor: "DOR_01", selecionada: true, principal: false, intensidade: 4 },
      { codigoDor: "DOR_03", selecionada: true, principal: true, intensidade: 2 },
    ],
  },
  {
    intencaoPassageiro: "TALVEZ",
    intencaoMotorista: "NAO",
    painPoints: [
      { codigoDor: "DOR_01", selecionada: true, principal: true, intensidade: 1 },
      { codigoDor: "DOR_02", selecionada: true, principal: false, intensidade: 5 },
    ],
  },
];

describe("pain analysis", () => {
  it("returns all six pain points, including zero-value pains", () => {
    const summary = buildPainAnalysisSummary({ submissions });
    const dor06 = summary.painPoints.find((painPoint) => painPoint.codigoDor === "DOR_06");

    expect(summary.painPoints).toHaveLength(6);
    expect(dor06).toMatchObject({
      selectedCount: 0,
      selectedPercentage: 0,
      principalCount: 0,
      principalPercentage: 0,
      averageIntensity: null,
      averageInterest: null,
      intensityDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      scores: {
        frequencyScore: 0,
        intensityScore: 0,
        primaryPainScore: 0,
        interestScore: 0,
        opportunityScore: 0,
      },
    });
  });

  it("calculates counts, percentages, intensity distribution and interest", () => {
    const summary = buildPainAnalysisSummary({ submissions });
    const dor01 = summary.painPoints.find((painPoint) => painPoint.codigoDor === "DOR_01");

    expect(dor01).toMatchObject({
      selectedCount: 3,
      selectedPercentage: 100,
      principalCount: 2,
      principalPercentage: 66.67,
      averageIntensity: 3.33,
      averageInterest: 3.25,
      intensityDistribution: { "1": 1, "2": 0, "3": 0, "4": 1, "5": 1 },
    });
    expect(dor01?.scores).toMatchObject({
      frequencyScore: 100,
      intensityScore: 66.6,
      primaryPainScore: 66.67,
      interestScore: 56.25,
      opportunityScore: 72.38,
    });
  });

  it("supports configurable opportunity score weights", () => {
    const summary = buildPainAnalysisSummary({
      submissions,
      weights: { frequency: 1, intensity: 0, primaryPain: 0, interest: 0 },
    });
    const dor01 = summary.painPoints.find((painPoint) => painPoint.codigoDor === "DOR_01");

    expect(dor01?.scores.opportunityScore).toBe(100);
  });

  it("sorts by intensity, primary pain and interest", () => {
    expect(buildPainAnalysisSummary({ submissions, sortBy: "intensity" }).painPoints[0]?.codigoDor).toBe(
      "DOR_02",
    );
    expect(
      buildPainAnalysisSummary({ submissions, sortBy: "primaryPain" }).painPoints[0]?.codigoDor,
    ).toBe("DOR_01");
    expect(buildPainAnalysisSummary({ submissions, sortBy: "interest" }).painPoints[0]?.codigoDor).toBe(
      "DOR_03",
    );
  });

  it("does not emit NaN or divide by zero with an empty sample", () => {
    const summary = buildPainAnalysisSummary({ submissions: [] });

    expect(summary.sampleSize).toBe(0);
    for (const painPoint of summary.painPoints) {
      expect(Number.isNaN(painPoint.selectedPercentage)).toBe(false);
      expect(Number.isNaN(painPoint.principalPercentage)).toBe(false);
      expect(Number.isNaN(painPoint.scores.opportunityScore)).toBe(false);
    }
  });
});
