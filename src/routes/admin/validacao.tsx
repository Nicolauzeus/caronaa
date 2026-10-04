import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Filter, Loader2 } from "lucide-react";
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
import { getPainAnalysis, type PainAnalysisSummary } from "@/lib/formulario/pain-analysis";
import type { Enums } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/validacao")({
  head: () => ({
    meta: [
      { title: "Validação de Mercado — Administração CARONAA" },
      {
        name: "description",
        content: "Visão executiva da validação de mercado do CARONAA.",
      },
      { property: "og:title", content: "Validação de Mercado — Administração CARONAA" },
      {
        property: "og:description",
        content: "Acompanhe intenção, perfis, deslocamento atual e dores da validação de mercado.",
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
  TALVEZ: "Média",
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

function formatPercent(value: number) {
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
              {formatNumber(row.value)} · {formatPercent(row.percentage)}
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
  const [painAnalysis, setPainAnalysis] = useState<PainAnalysisSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metricFilters = useMemo(() => toMetricFilters(filters), [filters]);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);

    void Promise.all([
      getFormMetrics(metricFilters),
      getPainAnalysis({ ...metricFilters, sortBy: "frequency" }),
    ])
      .then(([nextMetrics, nextPainAnalysis]) => {
        if (!active) return;
        setMetrics(nextMetrics);
        setPainAnalysis(nextPainAnalysis);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar a validação de mercado.",
        );
        setMetrics(null);
        setPainAnalysis(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [metricFilters]);

  const completed = metrics?.totals.completed ?? 0;
  const topMetrics = [
    { label: "Pessoas alcançadas", value: "N/D", detail: "Sem evento de alcance conectado" },
    { label: "Formulários iniciados", value: formatNumber(metrics?.totals.started) },
    { label: "Formulários concluídos", value: formatNumber(metrics?.totals.completed) },
    {
      label: "Taxa de conclusão",
      value: metrics ? formatPercent(metrics.totals.completionRate) : "N/D",
    },
    { label: "Passageiros", value: formatNumber(metrics?.totals.passageiros) },
    { label: "Motoristas", value: formatNumber(metrics?.totals.motoristas) },
    { label: "Ambos", value: formatNumber(metrics?.totals.ambos) },
    { label: "Alta intenção", value: formatNumber(highIntentCount(metrics)) },
  ];
  const profiles = profileDistribution(metrics);
  const occupation = distributionRows(metrics?.distributions.ocupacao ?? {}, completed);
  const frequency = distributionRows(metrics?.distributions.frequenciaSemanal ?? {}, completed);
  const departureWindow = distributionRows(metrics?.distributions.faixaHorario ?? {}, completed);
  const transport = distributionRows(metrics?.distributions.transporteAtual ?? {}, completed);
  const costRange = distributionRows(metrics?.distributions.custoAtualFaixa ?? {}, completed);
  const painRows = (painAnalysis?.painPoints ?? []).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Validação</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Validação de Mercado</h1>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1.5 text-xs font-semibold">
          Dados reais do formulário
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
            aria-label="Início do período"
            className="h-10 border-border bg-background"
          />
          <Input
            type="date"
            value={filters.periodEnd}
            onChange={(event) =>
              setFilters((current) => ({ ...current, periodEnd: event.target.value }))
            }
            aria-label="Fim do período"
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

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <SectionHeader title="Visão executiva" />
        </div>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            Carregando validação...
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            {topMetrics.map((item) => (
              <CompactMetric key={item.label} {...item} />
            ))}
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
                Ocupação
              </h3>
              <div className="mt-4">
                <DistributionList rows={occupation} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Frequência
              </h3>
              <div className="mt-4">
                <DistributionList rows={frequency} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Horário
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
              O custo por trecho/dia usa o campo real de referencia salvo no formulário. A função
              agregada atual ainda não separa esse recorte.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Quais são as maiores dores?" eyebrow="Ranking" />
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead className="min-w-72 px-4 py-3">Dor</TableHead>
                <TableHead className="px-4 py-3 text-right">% relata</TableHead>
                <TableHead className="px-4 py-3 text-right">Intensidade média</TableHead>
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
                            {pain.codigoDor} · abrir análise detalhada
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
          {intentLabels.HOJE ? "Alta intenção considera respostas HOJE e PROVAVELMENTE." : null}
        </p>
      </section>
    </div>
  );
}

export default MarketValidationPage;
