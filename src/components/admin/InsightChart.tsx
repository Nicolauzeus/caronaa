import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_TONE_COLORS, CHART_TONE_LABELS, rankChartRows, semanticMetricTone, validChartRows,
  type ChartDatum, type ChartKind, type MetricTone,
} from "@/lib/admin/chart-utils";

type Props = {
  title: string;
  rows: ChartDatum[];
  description?: string;
  temporal?: boolean;
  metricLabel?: string;
  defaultKind?: ChartKind;
};
const OPTIONS: { value: ChartKind; label: string }[] = [
  { value: "horizontal", label: "Barras" },
  { value: "vertical", label: "Colunas" },
  { value: "line", label: "Linha" },
  { value: "ranking", label: "Ranking" },
];
const colorOf = (label: string) => CHART_TONE_COLORS[semanticMetricTone(label)];
const tooltipStyle = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
};
const textStyle = { color: "var(--card-foreground)" };

export function InsightChart({
  title, rows, description, temporal = false, metricLabel = "Registros", defaultKind = "horizontal",
}: Props) {
  const [kind, setKind] = useState<ChartKind>(defaultKind);
  const clean = validChartRows(rows);
  const ranking = rankChartRows(rows);
  const chartRows = kind === "line" ? clean : ranking;
  const maximum = Math.max(1, ...ranking.map(r => r.value));
  const statuses = [...new Set(clean.map(r => semanticMetricTone(r.name)))]
    .filter((tone): tone is Exclude<MetricTone, "neutral"> => tone !== "neutral");
  const chartDataDescription = chartRows.map(row =>
    row.name + ": " + row.value.toLocaleString("pt-BR") +
    (semanticMetricTone(row.name) !== "neutral" ? " (" + CHART_TONE_LABELS[semanticMetricTone(row.name) as Exclude<MetricTone,"neutral">] + ")" : ""),
  ).join("; ");

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 p-1" role="group" aria-label={"Visualização: " + title}>
          {OPTIONS.map(option => (
            <button type="button" key={option.value} aria-pressed={kind === option.value} onClick={() => setKind(option.value)}
              className={kind === option.value
                ? "rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
                : "rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}>
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {!!statuses.length && kind !== "line" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda de estados">
          {statuses.map(tone => (
            <span key={tone} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CHART_TONE_COLORS[tone] }} aria-hidden="true" />
              {CHART_TONE_LABELS[tone]}
            </span>
          ))}
        </div>
      )}

      {!clean.length ? (
        <p className="rounded-lg bg-secondary/30 p-5 text-sm text-muted-foreground">Nenhum dado disponível neste recorte.</p>
      ) : kind === "ranking" ? (
        <div className="space-y-2" aria-label={"Ranking de " + title}>
          {ranking.map((item,index) => (
            <div key={item.name + index} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{index + 1}º</span>
              <span className="w-28 min-w-0 shrink-0 truncate" title={item.name}>{item.name}</span>
              <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary/60">
                <div className="h-full rounded-full" style={{ width: item.value / maximum * 100 + "%", backgroundColor: colorOf(item.name) }} />
              </div>
              <strong className="w-12 text-right text-xs tabular-nums">{item.value.toLocaleString("pt-BR")}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[285px] min-w-0 w-full" role="img" aria-label={title + ". " + chartDataDescription}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={chartRows} margin={{ top: 12, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={textStyle} itemStyle={textStyle} />
                <Line type="monotone" dataKey="value" name={metricLabel}
                  stroke={CHART_TONE_COLORS.neutral} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <BarChart data={chartRows} layout={kind === "horizontal" ? "vertical" : "horizontal"}
                margin={{ top: 10, right: 20, left: kind === "horizontal" ? 20 : 0, bottom: kind === "vertical" ? 35 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                {kind === "horizontal" ? (
                  <>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 10 }} />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={65} tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                  </>
                )}
                <Tooltip contentStyle={tooltipStyle} labelStyle={textStyle} itemStyle={textStyle} />
                <Bar dataKey="value" name={metricLabel} radius={[4,4,0,0]}>
                  {chartRows.map((row,i) => <Cell key={row.name + i} fill={colorOf(row.name)} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {kind === "line" && !temporal && (
        <p className="text-xs text-muted-foreground">A linha compara categorias; não representa uma evolução no tempo. A cor dourada da linha não indica situação favorável.</p>
      )}
    </section>
  );
}
