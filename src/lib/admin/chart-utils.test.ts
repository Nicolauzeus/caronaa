import { describe, expect, it } from "vitest";
import {
  CHART_TONE_COLORS, chartSeriesColor, rankChartRows, semanticMetricTone,
  statusTextClass, validChartRows,
} from "./chart-utils";

describe("Admin chart utilities and shared chart palette", () => {
  it("sorts without mutating input and keeps real zeros", () => {
    const input = [{ name: "B", value: 2 }, { name: "A", value: 8 }];
    expect(rankChartRows(input).map(x => x.name)).toEqual(["A", "B"]);
    expect(input[0].name).toBe("B");
    expect(validChartRows([{ name: "Zero", value: 0 }, { name: "NaN", value: NaN }, { name: "Negativo", value: -1 }]))
      .toEqual([{ name: "Zero", value: 0 }]);
  });

  it("colors semantic states, not numeric rank or amount", () => {
    const examples: [string, ReturnType<typeof semanticMetricTone>][] = [
      ["Cancelamentos", "danger"], ["Falhas", "danger"], ["CRÍTICA", "danger"],
      ["REFUNDED", "danger"], ["Contas INATIVAS", "danger"], ["Avaliações negativas", "danger"],
      ["Em análise", "warning"], ["EM_ANALISE", "warning"], ["PENDING", "warning"],
      ["Sem correspondência", "warning"], ["Não pagas", "warning"], ["Viagens não concluídas", "warning"],
      ["PAID", "success"], ["Viagens concluídas", "success"],
      ["Ativas", "success"], ["Resolvidos", "success"], ["Confirmado", "success"],
      ["Total de solicitações", "neutral"], ["Passageiros", "neutral"],
      ["Ofertas", "neutral"], ["Pesquisa A", "neutral"],
      ["Dificuldades de mobilidade", "neutral"], ["Segurança percebida", "neutral"],
    ];
    examples.forEach(([label, expected]) => expect(semanticMetricTone(label)).toBe(expected));
  });

  it("never treats inactive as active or an unpaid entry as paid", () => {
    expect(semanticMetricTone("INATIVO")).toBe("danger");
    expect(semanticMetricTone("Não confirmado")).toBe("warning");
    expect(semanticMetricTone("Não pago")).toBe("warning");
    expect(semanticMetricTone("Ativo")).toBe("success");
  });

  it("uses CSS tokens, with stable two-series contrast and predictable status colors", () => {
    expect(chartSeriesColor("Pesquisa A",0)).toBe(CHART_TONE_COLORS.neutral);
    expect(chartSeriesColor("Pesquisa B",1)).toBe("var(--admin-chart-comparison)");
    expect(chartSeriesColor("Déficit",0)).toBe(CHART_TONE_COLORS.danger);
    expect(chartSeriesColor("PAID",1)).toBe(CHART_TONE_COLORS.success);
    expect(CHART_TONE_COLORS.neutral).not.toBe(CHART_TONE_COLORS.warning);
    expect(statusTextClass("CANCELLED")).not.toBe(statusTextClass("PENDING"));
  });
});
