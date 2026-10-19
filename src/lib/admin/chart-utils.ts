export type ChartDatum = { name: string; value: number };
export type ChartKind = "horizontal" | "vertical" | "line" | "ranking";
export type MetricTone = "danger" | "warning" | "success" | "neutral";

export function validChartRows(rows: ChartDatum[]): ChartDatum[] {
  return rows.filter(row => row.name.trim().length > 0 && Number.isFinite(row.value) && row.value >= 0);
}
export function rankChartRows(rows: ChartDatum[]): ChartDatum[] {
  return [...validChartRows(rows)].sort((a,b) => b.value - a.value || a.name.localeCompare(b.name,"pt-BR"));
}

function normalizedLabel(label: string): string {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")
    .replace(/[_/-]+/g," ").replace(/\s+/g," ").trim();
}

/**
 * Chart tones describe MEANING, never the quantity or the rank.
 * Word boundaries prevent "inativa" or "negativa" being mistaken for "ativa".
 * A cancellation can be harmful even when it is the largest slice.
 */
export function semanticMetricTone(label: string): MetricTone {
  const value = normalizedLabel(label);
  if (/\b(cancelad[oa]s?|cancelament[oa]s?|cancelled|canceled|falh(?:a|as|ou)|failed|failure|reembolsad[oa]s?|refunded|refunds?|critic[oa]s?|incidentes?|denuncias?|erros?|grave(?:s)?|deficit|atrasos?|inativ[oa]s?|negativ[oa]s?|rejeitad[oa]s?)\b/.test(value)) return "danger";
  if (/\b(pendent(?:e|es)|pending|aguardand[oa]s?|pausad[oa]s?|suspens[oa]s?|negociac(?:ao|oes)|em analise|em andamento|sem match|sem correspondencia|nao pago|nao paga|unpaid|em aberto|atencao|nao (?:confirmad[oa]s?|concluid[oa]s?|pag[oa]s?|realizad[oa]s?))\b/.test(value)) return "warning";
  if (/\b(paid|completed|resolved|convertid[oa]s?|ativ[oa]s?|concluid[oa]s?|resolvid[oa]s?|confirmad[oa]s?|validad[oa]s?|pag[oa]s?|sucesso|aprovad[oa]s?|disponivel|finalizad[oa]s?)\b/.test(value)) return "success";
  return "neutral";
}

/** Chart colors are scoped CSS custom properties (light/dark) in styles.css. */
export const CHART_TONE_COLORS: Record<MetricTone, string> = {
  danger: "var(--admin-chart-danger)",
  warning: "var(--admin-chart-warning)",
  success: "var(--admin-chart-success)",
  neutral: "var(--admin-chart-neutral)",
};

export const CHART_TONE_LABELS: Record<Exclude<MetricTone,"neutral">, string> = {
  danger: "Atenção crítica",
  warning: "Pendente / atenção",
  success: "Concluído / favorável",
};

/** Two unrelated neutral series remain distinct without introducing new brand colors. */
export function chartSeriesColor(label: string, seriesIndex: number): string {
  const tone = semanticMetricTone(label);
  if (tone !== "neutral") return CHART_TONE_COLORS[tone];
  return [
    CHART_TONE_COLORS.neutral,
    "var(--admin-chart-comparison)",
    "var(--admin-chart-comparison-alt)",
  ][Math.abs(seriesIndex) % 3];
}

/** Tailwind-safe text states aligned with chart meanings. */
export function statusTextClass(value: string): string {
  const tone = semanticMetricTone(value);
  return tone === "danger" ? "text-red-700 dark:text-red-300 font-semibold" :
    tone === "warning" ? "text-amber-700 dark:text-amber-300 font-semibold" :
    tone === "success" ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-foreground";
}
