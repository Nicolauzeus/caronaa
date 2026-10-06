import { ArrowRight, FileText, Users } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFormMetrics, type FormMetricsSummary } from "@/lib/formulario/metrics";

export const Route = createFileRoute("/admin/formularios/")({
  head: () => ({
    meta: [
      {
        title: "Formulários — Administração CARONAA",
      },
      {
        name: "description",
        content: "Acompanhe os formulários de validação do CARONAA.",
      },
      {
        property: "og:title",
        content: "Formulários — Administração CARONAA",
      },
      {
        property: "og:description",
        content: "Acompanhe os formulários de validação do CARONAA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  component: AdminFormsPage,
});

type FormsDashboardData = {
  all: FormMetricsSummary | null;
  today: FormMetricsSummary | null;
  last7Days: FormMetricsSummary | null;
};

function startOfTodayIso() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

function sevenDaysAgoIso() {
  const date = new Date();

  date.setDate(date.getDate() - 7);

  return date.toISOString();
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/D";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/D";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function profilePercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

function AdminFormsPage() {
  const [data, setData] = useState<FormsDashboardData>({
    all: null,
    today: null,
    last7Days: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    void Promise.allSettled([
      getFormMetrics(),
      getFormMetrics({
        periodStart: startOfTodayIso(),
      }),
      getFormMetrics({
        periodStart: sevenDaysAgoIso(),
      }),
    ]).then((results) => {
      if (!active) {
        return;
      }

      const [allResult, todayResult, weekResult] = results;

      setData({
        all: allResult.status === "fulfilled" ? allResult.value : null,
        today: todayResult.status === "fulfilled" ? todayResult.value : null,
        last7Days: weekResult.status === "fulfilled" ? weekResult.value : null,
      });

      const failed = results.filter((result) => result.status === "rejected").length;

      if (failed > 0) {
        setError(
          `${failed} conjunto${failed === 1 ? "" : "s"} de métricas não pôde${
            failed === 1 ? "" : "ram"
          } ser carregado${failed === 1 ? "" : "s"}.`,
        );
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const profiles = useMemo(() => {
    const totals = data.all?.totals;

    if (!totals) {
      return [];
    }

    const total = totals.passageiros + totals.motoristas + totals.ambos;

    return [
      {
        label: "Passageiros",
        value: totals.passageiros,
        percentage: profilePercent(totals.passageiros, total),
        icon: Users,
      },
      {
        label: "Motoristas",
        value: totals.motoristas,
        percentage: profilePercent(totals.motoristas, total),
        icon: Users,
      },
      {
        label: "Os dois",
        value: totals.ambos,
        percentage: profilePercent(totals.ambos, total),
        icon: FileText,
      },
    ];
  }, [data.all]);

  const funnel = useMemo(() => {
    const totals = data.all?.totals;

    if (!totals) {
      return [];
    }

    return [
      {
        label: "Alcançados",
        value: totals.reached,
      },
      {
        label: "Iniciados",
        value: totals.started,
      },
      {
        label: "Concluídos",
        value: totals.completed,
      },
      {
        label: "Leads",
        value: totals.leads,
      },
    ];
  }, [data.all]);

  const funnelBase = Math.max(1, data.all?.totals.reached ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Validação</p>

          <h1 className="mt-2 font-display text-3xl font-extrabold">Formulários</h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Indicadores reais das respostas e do funil de validação do CARONAA.
          </p>
        </div>

        <Link
          to="/admin/formularios/respostas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          Ver respostas
          <ArrowRight size={16} />
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          {error} Os indicadores disponíveis continuam sendo exibidos.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total"
          value={data.all ? formatNumber(data.all.totals.completed) : loading ? "..." : "N/D"}
          detail="Respostas concluídas"
        />

        <MetricCard
          label="Hoje"
          value={data.today ? formatNumber(data.today.totals.completed) : loading ? "..." : "N/D"}
          detail="Concluídas desde 00:00"
        />

        <MetricCard
          label="7 dias"
          value={
            data.last7Days ? formatNumber(data.last7Days.totals.completed) : loading ? "..." : "N/D"
          }
          detail="Concluídas nos últimos 7 dias"
        />

        <MetricCard
          label="Conclusão"
          value={data.all ? formatPercent(data.all.totals.completionRate) : loading ? "..." : "N/D"}
          detail="Iniciados que concluíram"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">
              Funil do formulário
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="py-8 text-sm text-muted-foreground">Carregando métricas...</p>
            ) : funnel.length > 0 ? (
              <div className="space-y-4">
                {funnel.map((item) => {
                  const width =
                    item.value === 0
                      ? 0
                      : Math.max(4, Math.min(100, (item.value / funnelBase) * 100));

                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{item.label}</span>

                        <span className="text-sm font-bold text-foreground">
                          {formatNumber(item.value)}
                        </span>
                      </div>

                      <div className="mt-2 h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-secondary/30 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Início
                    </p>

                    <p className="mt-2 font-bold">{formatPercent(data.all?.totals.startRate)}</p>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/30 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Conclusão
                    </p>

                    <p className="mt-2 font-bold">
                      {formatPercent(data.all?.totals.completionRate)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/30 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Lead
                    </p>

                    <p className="mt-2 font-bold">{formatPercent(data.all?.totals.leadRate)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Métricas do formulário indisponíveis no momento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">Perfil</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading ? (
              <p className="py-8 text-sm text-muted-foreground">Carregando perfis...</p>
            ) : profiles.length > 0 ? (
              profiles.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <Icon size={14} className="text-primary" />

                        {item.label}
                      </span>

                      <span className="font-bold text-foreground">
                        {formatPercent(item.percentage)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(item.value)} respostas</span>

                      <span>do total classificado</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Nenhum perfil disponível para exibição.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl font-extrabold">Distribuição geral</CardTitle>
        </CardHeader>

        <CardContent>
          {data.all ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Alcançados
                </p>

                <p className="mt-2 text-2xl font-extrabold">
                  {formatNumber(data.all.totals.reached)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Iniciados
                </p>

                <p className="mt-2 text-2xl font-extrabold">
                  {formatNumber(data.all.totals.started)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Concluídos
                </p>

                <p className="mt-2 text-2xl font-extrabold">
                  {formatNumber(data.all.totals.completed)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Leads
                </p>

                <p className="mt-2 text-2xl font-extrabold">
                  {formatNumber(data.all.totals.leads)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Dados indisponíveis no momento.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
