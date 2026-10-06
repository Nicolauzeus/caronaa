import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  Gauge,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/admin/MetricCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAdminUsers,
  type AdminUser,
} from "@/lib/admin.functions";
import {
  getFormMetrics,
  type FormMetricsSummary,
} from "@/lib/formulario/metrics";
import {
  getMainFunnelMetrics,
  type MainFunnelSummary,
} from "@/lib/main-funnel-metrics";
import {
  getOperationalMetrics,
  type OperationalMetrics,
} from "@/lib/operational-metrics";
import {
  getRetentionMetrics,
  type RetentionMetrics,
} from "@/lib/retention-metrics";

export const Route = createFileRoute("/admin/usuarios/")({
  head: () => ({
    meta: [
      { title: "Administração — CARONAA" },
      {
        name: "description",
        content: "Visão geral da operação do CARONAA.",
      },
      {
        property: "og:title",
        content: "Administração — CARONAA",
      },
      {
        property: "og:description",
        content: "Visão geral da operação do CARONAA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  loader: async () => {
    return getAdminUsers();
  },

  component: DashboardPage,
});

type DashboardMetrics = {
  form: FormMetricsSummary | null;
  funnel: MainFunnelSummary | null;
  operational: OperationalMetrics | null;
  retention: RetentionMetrics | null;
};

const quickActions = [
  {
    label: "Ver usuários",
    to: "/admin/usuarios",
  },
  {
    label: "Ver caronas",
    to: "/admin/caronas",
  },
  {
    label: "Ver respostas",
    to: "/admin/formularios/respostas",
  },
  {
    label: "Analisar validação",
    to: "/admin/validacao",
  },
] as const;

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

function hasVerification(
  user: AdminUser,
  type: "UNIFOR" | "STS_2026",
) {
  return user.verifications.some(
    (verification) =>
      verification.type === type &&
      verification.status === "VERIFIED",
  );
}

function hasAnyVerification(user: AdminUser) {
  return user.verifications.some(
    (verification) => verification.status === "VERIFIED",
  );
}

function getPeriodStart() {
  const date = new Date();

  date.setDate(date.getDate() - 30);

  return date.toISOString();
}

function getFunnelWidth(
  count: number | null,
  cohortSize: number,
) {
  if (count === null || cohortSize <= 0) {
    return 0;
  }

  if (count === 0) {
    return 0;
  }

  return Math.max(
    4,
    Math.min(100, (count / cohortSize) * 100),
  );
}

function DashboardPage() {
  const users = Route.useLoaderData() as AdminUser[];

  const [data, setData] = useState<DashboardMetrics>({
    form: null,
    funnel: null,
    operational: null,
    retention: null,
  });

  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    const periodStart = getPeriodStart();

    setLoading(true);
    setMetricsError(null);

    void Promise.allSettled([
      getFormMetrics({
        periodStart,
      }),
      getMainFunnelMetrics(
        {
          periodStart,
        },
        "user_registered",
      ),
      getOperationalMetrics({
        periodStart,
      }),
      getRetentionMetrics({
        periodStart,
      }),
    ]).then((results) => {
      if (!active) {
        return;
      }

      const [
        formResult,
        funnelResult,
        operationalResult,
        retentionResult,
      ] = results;

      setData({
        form:
          formResult.status === "fulfilled"
            ? formResult.value
            : null,
        funnel:
          funnelResult.status === "fulfilled"
            ? funnelResult.value
            : null,
        operational:
          operationalResult.status === "fulfilled"
            ? operationalResult.value
            : null,
        retention:
          retentionResult.status === "fulfilled"
            ? retentionResult.value
            : null,
      });

      const failures = results.filter(
        (result) => result.status === "rejected",
      );

      if (failures.length > 0) {
        setMetricsError(
          `${failures.length} conjunto${
            failures.length === 1 ? "" : "s"
          } de métricas não pôde${
            failures.length === 1 ? "" : "ram"
          } ser carregado${
            failures.length === 1 ? "" : "s"
          }.`,
        );
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const userMetrics = useMemo(() => {
    const withVerification = users.filter(
      hasAnyVerification,
    ).length;

    const unifor = users.filter((user) =>
      hasVerification(user, "UNIFOR"),
    ).length;

    const sts = users.filter((user) =>
      hasVerification(user, "STS_2026"),
    ).length;

    return {
      total: users.length,
      withVerification,
      withoutVerification: users.length - withVerification,
      unifor,
      sts,
    };
  }, [users]);

  const funnelStages = data.funnel?.stages ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            CARONAA admin
          </p>

          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Visão geral da operação
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Indicadores persistidos do CARONAA. Métricas
            operacionais consideram os últimos 30 dias.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Últimos 30 dias
        </div>
      </div>

      {metricsError ? (
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          {metricsError} Os demais indicadores continuam
          representando somente dados carregados com sucesso.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Usuários"
          value={formatNumber(userMetrics.total)}
          detail="Cadastros existentes"
        />

        <MetricCard
          label="Com vínculo"
          value={formatNumber(
            userMetrics.withVerification,
          )}
          detail="UNIFOR e/ou STS 2026"
        />

        <MetricCard
          label="UNIFOR"
          value={formatNumber(userMetrics.unifor)}
          detail="Vínculo institucional"
        />

        <MetricCard
          label="STS 2026"
          value={formatNumber(userMetrics.sts)}
          detail="Participação registrada"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-display text-2xl font-extrabold">
                Funil CARONAA
              </CardTitle>

              <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Dados persistidos
              </span>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="py-8 text-sm text-muted-foreground">
                Carregando funil...
              </p>
            ) : funnelStages.length > 0 ? (
              <div className="space-y-3">
                {funnelStages.map((step, index) => {
                  const unavailable =
                    step.count === null;

                  return (
                    <div key={`${step.key}-${index}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-40 text-sm font-medium text-muted-foreground">
                          {step.label}
                        </div>

                        <div className="flex-1 rounded-full bg-secondary px-2 py-1.5">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{
                              width: `${getFunnelWidth(
                                step.count,
                                data.funnel?.cohortSize ??
                                  0,
                              )}%`,
                            }}
                          />
                        </div>

                        <span className="w-20 text-right text-sm font-semibold text-foreground">
                          {unavailable
                            ? "N/D"
                            : formatNumber(step.count)}
                        </span>
                      </div>

                      {step.unavailableReason ? (
                        <p className="ml-40 mt-1 pl-3 text-xs text-muted-foreground">
                          {step.unavailableReason}
                        </p>
                      ) : step.fromPrevious !== null &&
                        index > 0 ? (
                        <p className="ml-40 mt-1 pl-3 text-xs text-muted-foreground">
                          {formatPercent(
                            step.fromPrevious,
                          )}{" "}
                          da etapa anterior
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Métricas do funil indisponíveis no momento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="font-display text-2xl font-extrabold">
              Ações rápidas
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <span>{action.label}</span>

                <ArrowRight
                  size={16}
                  className="text-primary"
                />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Solicitações"
          value={
            data.operational
              ? formatNumber(
                  data.operational.request
                    .eligibleRequests,
                )
              : "N/D"
          }
          detail="Elegíveis nos últimos 30 dias"
        />

        <MetricCard
          label="Ofertas"
          value={
            data.operational
              ? formatNumber(
                  data.operational.offer.eligibleOffers,
                )
              : "N/D"
          }
          detail="Elegíveis nos últimos 30 dias"
        />

        <MetricCard
          label="Matches"
          value={
            data.operational
              ? formatNumber(
                  data.operational.match.total,
                )
              : "N/D"
          }
          detail="Criados nos últimos 30 dias"
        />

        <MetricCard
          label="Caronas concluídas"
          value={
            data.operational
              ? formatNumber(
                  data.operational.match.completed,
                )
              : "N/D"
          }
          detail="Conclusões registradas"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Gauge
                size={19}
                className="text-primary"
              />
              Oferta e demanda
            </CardTitle>
          </CardHeader>

          <CardContent>
            {data.operational ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Solicitações com match
                  </p>

                  <p className="mt-2 text-2xl font-extrabold">
                    {formatNumber(
                      data.operational.request
                        .matchedRequests,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPercent(
                      data.operational.request
                        .requestMatchRate,
                    )}{" "}
                    das solicitações elegíveis
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Ofertas utilizadas
                  </p>

                  <p className="mt-2 text-2xl font-extrabold">
                    {formatNumber(
                      data.operational.offer
                        .utilizedOffers,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPercent(
                      data.operational.offer
                        .offerMatchRate,
                    )}{" "}
                    das ofertas elegíveis
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Tempo médio até match
                  </p>

                  <p className="mt-2 text-2xl font-extrabold">
                    {data.operational.match
                      .averageMinutesToMatch === null
                      ? "N/D"
                      : `${new Intl.NumberFormat(
                          "pt-BR",
                          {
                            maximumFractionDigits: 1,
                          },
                        ).format(
                          data.operational.match
                            .averageMinutesToMatch,
                        )} min`}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Ocupação dos assentos
                  </p>

                  <p className="mt-2 text-2xl font-extrabold">
                    {formatPercent(
                      data.operational.seats
                        .seatFillRate,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.operational.seats
                      .availableSeats === null
                      ? "Capacidade indisponível"
                      : `${formatNumber(
                          data.operational.seats
                            .occupiedSeats,
                        )} de ${formatNumber(
                          data.operational.seats
                            .availableSeats,
                        )} assentos`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Métricas operacionais indisponíveis no
                momento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <FileText
                size={19}
                className="text-primary"
              />
              Formulários
            </CardTitle>
          </CardHeader>

          <CardContent>
            {data.form ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Iniciados
                  </span>

                  <strong>
                    {formatNumber(
                      data.form.totals.started,
                    )}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Concluídos
                  </span>

                  <strong>
                    {formatNumber(
                      data.form.totals.completed,
                    )}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Leads
                  </span>

                  <strong>
                    {formatNumber(
                      data.form.totals.leads,
                    )}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                  <span className="text-sm text-muted-foreground">
                    Taxa de conclusão
                  </span>

                  <strong>
                    {formatPercent(
                      data.form.totals
                        .completionRate,
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Métricas dos formulários indisponíveis no
                momento.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card/85 shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-xl font-extrabold">
              Recorrência
            </CardTitle>

            <span className="text-xs text-muted-foreground">
              Caronas realizadas
            </span>
          </div>
        </CardHeader>

        <CardContent>
          {data.retention ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Retorno em 7 dias"
                  value={formatPercent(
                    data.retention.repeatRate7d,
                  )}
                  detail="Após a primeira carona"
                />

                <MetricCard
                  label="Retorno em 30 dias"
                  value={formatPercent(
                    data.retention.repeatRate30d,
                  )}
                  detail="Após a primeira carona"
                />

                <MetricCard
                  label="1 / 2 caronas"
                  value={`${formatNumber(
                    data.retention.distribution.one,
                  )} / ${formatNumber(
                    data.retention.distribution.two,
                  )}`}
                  detail="Usuários por recorrência"
                />

                <MetricCard
                  label="3–5 / 6+"
                  value={`${formatNumber(
                    data.retention.distribution
                      .threeToFive,
                  )} / ${formatNumber(
                    data.retention.distribution
                      .sixOrMore,
                  )}`}
                  detail="Usuários recorrentes"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Métricas de recorrência indisponíveis no
              momento.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <ShieldCheck
                size={19}
                className="text-primary"
              />
              Vínculos verificados
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2
                  size={15}
                  className="text-primary"
                />
                Com pelo menos um vínculo
              </span>

              <strong>
                {formatNumber(
                  userMetrics.withVerification,
                )}
              </strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-sm text-muted-foreground">
                UNIFOR
              </span>

              <strong>
                {formatNumber(userMetrics.unifor)}
              </strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-sm text-muted-foreground">
                STS 2026
              </span>

              <strong>
                {formatNumber(userMetrics.sts)}
              </strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-sm text-muted-foreground">
                Sem vínculo verificado
              </span>

              <strong>
                {formatNumber(
                  userMetrics.withoutVerification,
                )}
              </strong>
            </div>

            <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
              Os selos indicam vínculo ou participação
              verificados. Eles não representam verificação
              de identidade civil ou KYC.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Activity
                size={19}
                className="text-primary"
              />
              Estado operacional
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-sm text-muted-foreground">
                Solicitações sem match
              </span>

              <strong>
                {data.operational
                  ? formatNumber(
                      data.operational.request
                        .unmatchedRequests,
                    )
                  : "N/D"}
              </strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-sm text-muted-foreground">
                Ofertas sem utilização
              </span>

              <strong>
                {data.operational
                  ? formatNumber(
                      data.operational.offer
                        .unmatchedOffers,
                    )
                  : "N/D"}
              </strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-sm text-muted-foreground">
                Matches cancelados
              </span>

              <strong>
                {data.operational
                  ? formatNumber(
                      data.operational.match
                        .cancelled,
                    )
                  : "N/D"}
              </strong>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users size={15} />
                Usuários cadastrados
              </span>

              <strong>
                {formatNumber(userMetrics.total)}
              </strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;