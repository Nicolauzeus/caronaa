import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Download, Filter, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getFormMetrics,
  type FormMetricsFilters,
  type FormMetricsSummary,
} from "@/lib/formulario/metrics";
import { getFunnelMetrics, type FunnelMetricsSummary } from "@/lib/funnel-metrics";
import { getMainFunnelMetrics, type MainFunnelSummary } from "@/lib/main-funnel-metrics";
import { getRetentionMetrics, type RetentionMetrics } from "@/lib/retention-metrics";
import { getPainAnalysis, type PainAnalysisSummary } from "@/lib/formulario/pain-analysis";
import { downloadValidationExport, type ValidationExportKind } from "@/lib/validation-export";
import type { Enums } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/validacao")({
  head: () => ({
    meta: [
      { title: "ValidaÃ§Ã£o de Mercado â€” AdministraÃ§Ã£o CARONAA" },
      {
        name: "description",
        content: "VisÃ£o executiva da validaÃ§Ã£o de mercado do CARONAA.",
      },
      { property: "og:title", content: "ValidaÃ§Ã£o de Mercado â€” AdministraÃ§Ã£o CARONAA" },
      {
        property: "og:description",
        content:
          "Acompanhe intenÃ§Ã£o, perfis, deslocamento atual e dores da validaÃ§Ã£o de mercado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketValidationPage,
});

type FilterState = {
  periodStart: string;
  periodEnd: string;
  campaign: string;
  source: string;
  event: string;
  profile: "all" | Enums<"form_tipo_usuario">;
  cohortEvent: "landing_view" | "user_registered";
};

type DistributionRow = {
  label: string;
  value: number;
  percentage: number;
};

const profileLabels: Record<Enums<"form_tipo_usuario">, string> = {
  PASSAGEIRO: "Passageiros",
  MOTORISTA: "Motoristas",
  AMBOS: "Ambos",
};

const intentLabels: Partial<Record<Enums<"form_intencao">, string>> = {
  HOJE: "Alta",
  PROVAVELMENTE: "Alta",
  TALVEZ: "MÃ©dia",
  PROVAVELMENTE_NAO: "Baixa",
  NAO: "Baixa",
};

const initialFilters: FilterState = {
  periodStart: "",
  periodEnd: "",
  campaign: "",
  source: "",
  event: "",
  profile: "all",
  cohortEvent: "landing_view",
};

function toMetricFilters(filters: FilterState): FormMetricsFilters {
  return {
    periodStart: filters.periodStart || null,
    periodEnd: filters.periodEnd || null,
    campaign: filters.campaign.trim() || null,
    source: filters.source.trim() || null,
    event: filters.event.trim() || null,
    tipoUsuario: filters.profile === "all" ? null : filters.profile,
  };
}

function formatPercent(value: number | null) {
  if (value === null) return "N/D";
  return `${Math.round(value * 10) / 10}%`;
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") return "N/D";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function distributionRows(distribution: Record<string, number>, total: number): DistributionRow[] {
  return Object.entries(distribution)
    .map(([label, value]) => ({
      label,
      value,
      percentage: total === 0 ? 0 : (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function highIntentCount(metrics: FormMetricsSummary | null) {
  if (!metrics) return 0;

  return metrics.intentByProfile.reduce((sum, profile) => {
    const passengerHigh = (profile.passageiro.HOJE ?? 0) + (profile.passageiro.PROVAVELMENTE ?? 0);
    const driverHigh = (profile.motorista.HOJE ?? 0) + (profile.motorista.PROVAVELMENTE ?? 0);

    return sum + passengerHigh + driverHigh;
  }, 0);
}

function profileDistribution(metrics: FormMetricsSummary | null) {
  if (!metrics) return [];

  return [
    { label: profileLabels.PASSAGEIRO, value: metrics.totals.passageiros },
    { label: profileLabels.MOTORISTA, value: metrics.totals.motoristas },
    { label: profileLabels.AMBOS, value: metrics.totals.ambos },
  ].map((item) => ({
    ...item,
    percentage: metrics.totals.completed === 0 ? 0 : (item.value / metrics.totals.completed) * 100,
  }));
}

function CompactMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-h-24 border-l border-border px-4 py-3 first:border-l-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function DistributionList({ rows }: { rows: DistributionRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">Sem dados para os filtros atuais.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{row.label}</span>
            <span className="text-muted-foreground">
              {formatNumber(row.value)} Â· {formatPercent(row.percentage)}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(row.percentage, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground">{title}</h2>
    </div>
  );
}

function MarketValidationPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [metrics, setMetrics] = useState<FormMetricsSummary | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<FunnelMetricsSummary | null>(null);
  const [mainFunnel, setMainFunnel] = useState<MainFunnelSummary | null>(null);
  const [retention, setRetention] = useState<RetentionMetrics | null>(null);
  const [painAnalysis, setPainAnalysis] = useState<PainAnalysisSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ValidationExportKind | null>(null);

  const metricFilters = useMemo(() => toMetricFilters(filters), [filters]);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);

    void Promise.all([
      getFormMetrics(metricFilters),
      getPainAnalysis({ ...metricFilters, sortBy: "frequency" }),
      getFunnelMetrics(metricFilters).catch((caught) => {
        console.warn(
          caught instanceof Error ? caught.message : "NÃ£o foi possÃ­vel carregar funil.",
        );
        return null;
      }),
      getMainFunnelMetrics(metricFilters, filters.cohortEvent),
      getRetentionMetrics(metricFilters),
    ])
      .then(([nextMetrics, nextPainAnalysis, nextFunnelMetrics, nextMainFunnel, nextRetention]) => {
        if (!active) return;
        setMetrics(nextMetrics);
        setPainAnalysis(nextPainAnalysis);
        setFunnelMetrics(nextFunnelMetrics);
        setMainFunnel(nextMainFunnel);
        setRetention(nextRetention);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "NÃ£o foi possÃ­vel carregar a validaÃ§Ã£o de mercado.",
        );
        setMetrics(null);
        setFunnelMetrics(null);
        setMainFunnel(null);
        setRetention(null);
        setPainAnalysis(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [metricFilters, filters.cohortEvent]);

  const completed = metrics?.totals.completed ?? 0;
  const topMetrics = [
    {
      label: "Pessoas alcanÃ§adas",
      value: funnelMetrics ? formatNumber(funnelMetrics.reached) : "N/D",
      detail: funnelMetrics ? "SessÃµes Ãºnicas com landing_view" : "Aguardando eventos de funil",
    },
    {
      label: "FormulÃ¡rios iniciados",
      value: formatNumber(funnelMetrics?.started ?? metrics?.totals.started),
      detail: funnelMetrics
        ? `${formatPercent(funnelMetrics.rates.reachedToStarted)} do alcance`
        : undefined,
    },
    {
      label: "FormulÃ¡rios concluÃ­dos",
      value: formatNumber(funnelMetrics?.completed ?? metrics?.totals.completed),
      detail: funnelMetrics
        ? `${formatPercent(funnelMetrics.rates.startedToCompleted)} dos inÃ­cios`
        : undefined,
    },
    {
      label: "Taxa de conclusÃ£o",
      value: metrics ? formatPercent(metrics.totals.completionRate) : "N/D",
    },
    { label: "Passageiros", value: formatNumber(metrics?.totals.passageiros) },
    { label: "Motoristas", value: formatNumber(metrics?.totals.motoristas) },
    { label: "Ambos", value: formatNumber(metrics?.totals.ambos) },
    { label: "Alta intenÃ§Ã£o", value: formatNumber(highIntentCount(metrics)) },
    {
      label: "Viraram lead",
      value: funnelMetrics
        ? formatNumber(funnelMetrics.leads)
        : formatNumber(metrics?.totals.completed),
      detail: funnelMetrics
        ? `${formatPercent(funnelMetrics.rates.completedToLead)} dos concluÃ­dos`
        : "Fallback: formulÃ¡rios concluÃ­dos",
    },
  ];
  const profiles = profileDistribution(metrics);
  const occupation = distributionRows(metrics?.distributions.ocupacao ?? {}, completed);
  const frequency = distributionRows(metrics?.distributions.frequenciaSemanal ?? {}, completed);
  const departureWindow = distributionRows(metrics?.distributions.faixaHorario ?? {}, completed);
  const transport = distributionRows(metrics?.distributions.transporteAtual ?? {}, completed);
  const costRange = distributionRows(metrics?.distributions.custoAtualFaixa ?? {}, completed);
  const painRows = (painAnalysis?.painPoints ?? []).slice(0, 6);
  const exportCsv = async (kind: ValidationExportKind) => {
    setExporting(kind);
    try {
      await downloadValidationExport(kind, metricFilters);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "NÃ£o foi possÃ­vel exportar os dados.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">ValidaÃ§Ã£o</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">ValidaÃ§Ã£o de Mercado</h1>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1.5 text-xs font-semibold">
          Dados reais do formulÃ¡rio
        </Badge>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter size={16} className="text-primary" />
          Filtros globais
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input
            type="date"
            value={filters.periodStart}
            onChange={(event) =>
              setFilters((current) => ({ ...current, periodStart: event.target.value }))
            }
            aria-label="InÃ­cio do perÃ­odo"
            className="h-10 border-border bg-background"
          />
          <Input
            type="date"
            value={filters.periodEnd}
            onChange={(event) =>
              setFilters((current) => ({ ...current, periodEnd: event.target.value }))
            }
            aria-label="Fim do perÃ­odo"
            className="h-10 border-border bg-background"
          />
          <Input
            value={filters.campaign}
            onChange={(event) =>
              setFilters((current) => ({ ...current, campaign: event.target.value }))
            }
            placeholder="Campanha"
            className="h-10 border-border bg-background"
          />
          <Input
            value={filters.source}
            onChange={(event) =>
              setFilters((current) => ({ ...current, source: event.target.value }))
            }
            placeholder="Source"
            className="h-10 border-border bg-background"
          />
          <Input
            value={filters.event}
            onChange={(event) =>
              setFilters((current) => ({ ...current, event: event.target.value }))
            }
            placeholder="Evento"
            className="h-10 border-border bg-background"
          />
          <Select
            value={filters.profile}
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, profile: value as FilterState["profile"] }))
            }
          >
            <SelectTrigger className="h-10 border-border bg-background">
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              <SelectItem value="PASSAGEIRO">Passageiro</SelectItem>
              <SelectItem value="MOTORISTA">Motorista</SelectItem>
              <SelectItem value="AMBOS">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilters(initialFilters)}
          >
            Limpar filtros
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Exportar resultados</p>
            <p className="text-xs text-muted-foreground">
              Os CSVs aplicam os filtros globais atuais. A exportaÃ§Ã£o analÃ­tica nÃ£o inclui dados
              pessoais.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            CSV
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["raw_analytics", "Respostas analÃ­ticas"],
              ["pain_ranking", "Ranking de dores"],
              ["profile", "Perfil"],
              ["transport", "Alternativas atuais"],
              ["costs", "Custos"],
              ["intent", "IntenÃ§Ã£o de uso"],
              ["funnel", "Funil"],
              ["match", "MÃ©tricas de match"],
            ] as const
          ).map(([kind, label]) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportCsv(kind)}
            >
              <Download size={14} className="mr-1" />
              {exporting === kind ? "Exportandoâ€¦" : label}
            </Button>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Leads contÃ©m nome, telefone e e-mail, quando informados. Acesso exclusivo de
            administradores autorizados.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={exporting !== null}
            onClick={() => void exportCsv("leads")}
          >
            <Download size={14} className="mr-1" />
            {exporting === "leads" ? "Exportandoâ€¦" : "Exportar leads"}
          </Button>
        </div>
      </section>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <SectionHeader title="VisÃ£o executiva" />
        </div>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            Carregando validaÃ§Ã£o...
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            {topMetrics.map((item) => (
              <CompactMetric key={item.label} {...item} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <SectionHeader title="RecorrÃªncia" eyebrow="Apenas caronas realizadas" />
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando recorrÃªncia...</p>
        ) : retention ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CompactMetric
              label="repeat_rate_7d"
              value={formatPercent(retention.repeatRate7d)}
              detail="voltaram apÃ³s a 1Âª carona em atÃ© 7 dias"
            />
            <CompactMetric
              label="repeat_rate_30d"
              value={formatPercent(retention.repeatRate30d)}
              detail="voltaram apÃ³s a 1Âª carona em atÃ© 30 dias"
            />
            <CompactMetric label="2 caronas" value={formatNumber(retention.usersWith2Rides)} />
            <CompactMetric
              label="3 ou mais"
              value={formatNumber(retention.usersWith3OrMoreRides)}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Sem caronas realizadas nos filtros atuais.
          </p>
        )}
        {retention ? (
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-4">
            <span>
              1 carona: <strong>{formatNumber(retention.distribution.one)}</strong>
            </span>
            <span>
              2 caronas: <strong>{formatNumber(retention.distribution.two)}</strong>
            </span>
            <span>
              3â€“5: <strong>{formatNumber(retention.distribution.threeToFive)}</strong>
            </span>
            <span>
              6+: <strong>{formatNumber(retention.distribution.sixOrMore)}</strong>
            </span>
          </div>
        ) : null}
        {retention ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Por perfil: Passageiro{" "}
            {formatNumber(
              (retention.byProfile.PASSAGEIRO?.one ?? 0) +
                (retention.byProfile.PASSAGEIRO?.two ?? 0) +
                (retention.byProfile.PASSAGEIRO?.threeOrMore ?? 0),
            )}{" "}
            Â· Motorista{" "}
            {formatNumber(
              (retention.byProfile.MOTORISTA?.one ?? 0) +
                (retention.byProfile.MOTORISTA?.two ?? 0) +
                (retention.byProfile.MOTORISTA?.threeOrMore ?? 0),
            )}{" "}
            Â· Ambos{" "}
            {formatNumber(
              (retention.byProfile.AMBOS?.one ?? 0) +
                (retention.byProfile.AMBOS?.two ?? 0) +
                (retention.byProfile.AMBOS?.threeOrMore ?? 0),
            )}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <SectionHeader
            title="Funil principal da CARONAA"
            eyebrow="Coorte adquirida no perÃ­odo"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Select
              value={filters.cohortEvent}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  cohortEvent: value as FilterState["cohortEvent"],
                }))
              }
            >
              <SelectTrigger className="h-9 w-56 border-border bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landing_view">Coorte: landing_view</SelectItem>
                <SelectItem value="user_registered">Coorte: user_registered</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Base: {formatNumber(mainFunnel?.cohortSize)} identidades adquiridas no período.
              Conversão = membros da coorte na etapa ÷ membros da coorte na etapa anterior.
              Atividade no período é um conceito separado.
            </p>
          </div>
          {mainFunnel?.largestDrop ? (
            <p className="mt-2 text-sm text-destructive">
              Maior queda: entrada em {mainFunnel.largestDrop.label} (
              {formatPercent(mainFunnel.largestDrop.fromPrevious)} da etapa anterior).
            </p>
          ) : null}
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-muted-foreground">Carregando funil...</div>
        ) : mainFunnel ? (
          <div className="divide-y divide-border">
            {mainFunnel.stages.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {index ? "â†“ " : ""}
                    {stage.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {index
                      ? `${formatPercent(stage.fromPrevious)} dos usuÃ¡rios da coorte na etapa anterior Â· ${formatPercent(stage.fromStart)} da coorte adquirida`
                      : "Denominador: usuÃ¡rios adquiridos no perÃ­odo selecionado"}
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-foreground">
                  {stage.count === null ? "N/D" : formatNumber(stage.count)}
                </p>
                {index && stage.fromPrevious !== null ? (
                  <Badge
                    variant={
                      mainFunnel.largestDrop?.key === stage.key ? "destructive" : "secondary"
                    }
                  >
                    {formatPercent(stage.fromPrevious)}
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">
            Sem dados reais para os filtros atuais.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title="Quem respondeu?" />
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Perfil
            </h3>
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profiles} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={92}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                OcupaÃ§Ã£o
              </h3>
              <div className="mt-4">
                <DistributionList rows={occupation} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                FrequÃªncia
              </h3>
              <div className="mt-4">
                <DistributionList rows={frequency} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                HorÃ¡rio
              </h3>
              <div className="mt-4">
                <DistributionList rows={departureWindow} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Como essas pessoas se deslocam hoje?" />
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft xl:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Alternativa atual
            </h3>
            <div className="mt-4">
              <DistributionList rows={transport} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Faixa de custo
            </h3>
            <div className="mt-4">
              <DistributionList rows={costRange} />
            </div>
            <p className="mt-4 rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
              O custo por trecho/dia usa o campo real de referencia salvo no formulÃ¡rio. A funÃ§Ã£o
              agregada atual ainda nÃ£o separa esse recorte.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Quais sÃ£o as maiores dores?" eyebrow="Ranking" />
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead className="min-w-72 px-4 py-3">Dor</TableHead>
                <TableHead className="px-4 py-3 text-right">% relata</TableHead>
                <TableHead className="px-4 py-3 text-right">Intensidade mÃ©dia</TableHead>
                <TableHead className="px-4 py-3 text-right">% principal</TableHead>
                <TableHead className="px-4 py-3 text-right">Opportunity Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {painRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Sem dores registradas para estes filtros.
                  </TableCell>
                </TableRow>
              ) : (
                painRows.map((pain, index) => (
                  <TableRow key={pain.codigoDor}>
                    <TableCell className="px-4 py-4">
                      <Link
                        to="/admin/validacao/$painId"
                        params={{ painId: pain.codigoDor }}
                        className="flex items-start gap-3 rounded-lg outline-none ring-primary transition-colors hover:text-primary focus-visible:ring-2"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{pain.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pain.codigoDor} Â· abrir anÃ¡lise detalhada
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right font-semibold">
                      {formatPercent(pain.selectedPercentage)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      {pain.averageIntensity?.toFixed(1) ?? "N/D"}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      {formatPercent(pain.principalPercentage)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                        {Math.round(pain.scores.opportunityScore)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          {intentLabels.HOJE ? "Alta intenÃ§Ã£o considera respostas HOJE e PROVAVELMENTE." : null}
        </p>
      </section>
    </div>
  );
}
