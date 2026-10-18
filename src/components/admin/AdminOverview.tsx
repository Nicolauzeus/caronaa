import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "./AdminPageHeader";
import { AttentionQueue } from "./AttentionQueue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminUsers } from "@/lib/admin.functions";
import { getOperationalMetrics } from "@/lib/operational-metrics";
import { getFormMetrics } from "@/lib/formulario/metrics";
import { getMainFunnelMetrics } from "@/lib/main-funnel-metrics";
import { getRetentionMetrics } from "@/lib/retention-metrics";
import { useAdminModuleSection } from "@/lib/admin/use-admin-module-section";
import { AdminDataError as SourceError } from "./AdminDataError";

const number = (value: number | null | undefined, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + suffix
    : "Sem medição";

function Values({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-3 text-sm">
          <dt className="min-w-0 text-muted-foreground">{label}</dt>
          <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminOverview() {
  const [period] = useState(() => {
    const end = new Date();
    return {
      periodStart: new Date(end.getTime() - 30 * 86400000).toISOString(),
      periodEnd: end.toISOString(),
    };
  });
  const [tab, setTab] = useAdminModuleSection(
    { funnel: "funnel", results: "results", people: "people" },
    "funnel",
  );
  const users = useQuery({
    queryKey: ["admin", "overview", "users"],
    queryFn: () => getAdminUsers(),
    staleTime: 60000,
  });
  const operations = useQuery({
    queryKey: ["admin", "overview", "operations", period],
    queryFn: () => getOperationalMetrics(period),
    staleTime: 60000,
  });
  const forms = useQuery({
    queryKey: ["admin", "overview", "forms", period],
    queryFn: () => getFormMetrics(period),
    staleTime: 60000,
  });
  const funnel = useQuery({
    queryKey: ["admin", "overview", "funnel", period],
    queryFn: () => getMainFunnelMetrics(period, "user_registered"),
    staleTime: 60000,
  });
  const retention = useQuery({
    queryKey: ["admin", "overview", "retention", period],
    queryFn: () => getRetentionMetrics(period),
    staleTime: 60000,
  });
  const op = operations.isError ? undefined : operations.data;
  const totalUsers = users.isError ? undefined : users.data;
  const essential = [
    {
      label: "Usuários cadastrados",
      value: totalUsers?.length,
      query: users,
      period: "Base completa · situação atual",
      to: "/admin/usuarios",
    },
    {
      label: "Solicitações elegíveis",
      value: op?.request.eligibleRequests,
      query: operations,
      period: "Últimos 30 dias",
      to: "/admin/solicitacoes",
    },
    {
      label: "Ofertas elegíveis",
      value: op?.offer.eligibleOffers,
      query: operations,
      period: "Últimos 30 dias",
      to: "/admin/caronas",
    },
    {
      label: "Caronas concluídas",
      value: op?.match.completed,
      query: operations,
      period: "Últimos 30 dias",
      to: "/admin/operacoes",
    },
  ];
  const verified = totalUsers?.filter((user) =>
    user.verifications.some((v) => v.status === "VERIFIED"),
  ).length;
  const queries = [users, operations, forms, funnel, retention];
  const date = (value: string) =>
    new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Visão Geral"
        description="Acompanhe os principais indicadores, pendências e atividades do CARONAA."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={queries.some((query) => query.isFetching)}
            onClick={() => {
              queries.forEach((query) => {
                void query.refetch();
              });
            }}
          >
            <RefreshCw size={15} /> Atualizar indicadores
          </Button>
        }
      />
      <section
        aria-label="Indicadores essenciais"
        className="grid grid-cols-2 border-y border-border xl:grid-cols-4"
      >
        {essential.map((metric) => (
          <Link
            key={metric.label}
            to={metric.to}
            className="min-w-0 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`${metric.label}: ${metric.query.isPending ? "Carregando" : metric.query.isError ? "Dados indisponíveis" : number(metric.value)}`}
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>{metric.label}</span>
              <ArrowUpRight size={15} className="shrink-0 text-muted-foreground" />
            </div>
            <p
              className="my-3 min-h-9 text-xl font-bold tabular-nums sm:text-2xl"
              aria-busy={metric.query.isPending}
            >
              {metric.query.isPending
                ? "Carregando…"
                : metric.query.isError
                  ? "Indisponível"
                  : number(metric.value)}
            </p>
            <p className="text-xs text-muted-foreground">{metric.period}</p>
          </Link>
        ))}
      </section>
      {users.isError && (
        <SourceError
          error={users.error}
          retry={() => {
            void users.refetch();
          }}
        />
      )}
      {operations.isError && (
        <SourceError
          error={operations.error}
          retry={() => {
            void operations.refetch();
          }}
        />
      )}

      <AttentionQueue />

      <section
        aria-labelledby="overview-followup"
        className="space-y-4 border-b border-border pb-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="overview-followup" className="text-lg font-bold">
            Acompanhamento
          </h2>
          <p className="text-xs text-muted-foreground">
            {date(period.periodStart)} a {date(period.periodEnd)} · últimos 30 dias
          </p>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList className="flex h-auto max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="funnel">Aquisição</TabsTrigger>
            <TabsTrigger value="results">Operação e pesquisa</TabsTrigger>
            <TabsTrigger value="people">Pessoas e recorrência</TabsTrigger>
          </TabsList>
          <TabsContent value="funnel" className="space-y-3 pt-3">
            <h3 className="font-semibold">Funil de ativação</h3>
            <p className="text-xs text-muted-foreground">
              Coorte de cadastros do período. Etapas não devem ser somadas como pessoas distintas.
            </p>
            {funnel.isPending ? (
              <p role="status">Carregando funil…</p>
            ) : funnel.isError ? (
              <SourceError
                error={funnel.error}
                retry={() => {
                  void funnel.refetch();
                }}
              />
            ) : funnel.data?.stages.length ? (
              <Values
                rows={funnel.data.stages.map((stage) => [
                  stage.label,
                  stage.count === null ? "Sem medição" : number(stage.count),
                ])}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa disponível neste período.
              </p>
            )}
            {funnel.data?.stages.map(
              (stage, index) =>
                (stage.unavailableReason || (index > 0 && stage.fromPrevious !== null)) && (
                  <p key={stage.key} className="text-xs text-muted-foreground">
                    {stage.label}:{" "}
                    {stage.unavailableReason
                      ? "medição indisponível."
                      : `${number(stage.fromPrevious, "%")} da etapa anterior.`}
                  </p>
                ),
            )}
            <Link
              to="/admin/executivo"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              Análise executiva <ArrowUpRight size={14} />
            </Link>
          </TabsContent>
          <TabsContent value="results" className="grid gap-6 pt-3 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="font-semibold">Eficiência operacional</h3>
              {operations.isPending ? (
                <p role="status">Carregando operação…</p>
              ) : operations.isError ? (
                <SourceError
                  error={operations.error}
                  retry={() => {
                    void operations.refetch();
                  }}
                />
              ) : (
                <Values
                  rows={[
                    ["Correspondências criadas", number(op?.match.total)],
                    ["Solicitações com correspondência", number(op?.request.matchedRequests)],
                    ["Taxa de correspondência", number(op?.request.requestMatchRate, "%")],
                    ["Solicitações sem correspondência", number(op?.request.unmatchedRequests)],
                    ["Ofertas utilizadas", number(op?.offer.utilizedOffers)],
                    ["Taxa de utilização das ofertas", number(op?.offer.offerMatchRate, "%")],
                    ["Ofertas sem utilização", number(op?.offer.unmatchedOffers)],
                    [
                      "Tempo médio até correspondência",
                      number(op?.match.averageMinutesToMatch, " min"),
                    ],
                    ["Ocupação dos assentos", number(op?.seats.seatFillRate, "%")],
                    [
                      "Assentos ocupados / disponíveis",
                      `${number(op?.seats.occupiedSeats)} / ${number(op?.seats.availableSeats)}`,
                    ],
                    ["Correspondências canceladas", number(op?.match.cancelled)],
                  ]}
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Formulários</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Respostas históricas da fonte de métricas; biblioteca de pesquisas disponível no
                departamento.
              </p>
              {forms.isPending ? (
                <p role="status">Carregando formulários…</p>
              ) : forms.isError ? (
                <SourceError
                  error={forms.error}
                  retry={() => {
                    void forms.refetch();
                  }}
                />
              ) : (
                <Values
                  rows={[
                    ["Iniciados", number(forms.data?.totals.started)],
                    ["Concluídos", number(forms.data?.totals.completed)],
                    ["Leads", number(forms.data?.totals.leads)],
                    ["Taxa de conclusão", number(forms.data?.totals.completionRate, "%")],
                  ]}
                />
              )}
              <Link
                to="/admin/formularios"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:underline"
              >
                Gerenciar formulários <ArrowUpRight size={14} />
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="people" className="grid gap-6 pt-3 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="font-semibold">Recorrência de caronas</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Viagens concluídas no recorte. Retorno após a primeira carona.
              </p>
              {retention.isPending ? (
                <p role="status">Carregando recorrência…</p>
              ) : retention.isError ? (
                <SourceError
                  error={retention.error}
                  retry={() => {
                    void retention.refetch();
                  }}
                />
              ) : (
                <Values
                  rows={[
                    ["Retorno em 7 dias", number(retention.data?.repeatRate7d, "%")],
                    ["Retorno em 30 dias", number(retention.data?.repeatRate30d, "%")],
                    ["Usuários com 1 carona", number(retention.data?.distribution.one)],
                    ["Usuários com 2 caronas", number(retention.data?.distribution.two)],
                    [
                      "Usuários com 3 a 5 caronas",
                      number(retention.data?.distribution.threeToFive),
                    ],
                    [
                      "Usuários com 6 ou mais caronas",
                      number(retention.data?.distribution.sixOrMore),
                    ],
                  ]}
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Vínculos verificados</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Base completa · situação atual. Selos não representam verificação de identidade
                civil.
              </p>
              {users.isPending ? (
                <p role="status">Carregando vínculos…</p>
              ) : users.isError ? (
                <SourceError
                  error={users.error}
                  retry={() => {
                    void users.refetch();
                  }}
                />
              ) : (
                <Values
                  rows={[
                    ["Com vínculo verificado", number(verified)],
                    ...(["UNIFOR", "STS_2026"] as const).map(
                      (type) =>
                        [
                          type === "UNIFOR" ? "UNIFOR" : "STS 2026",
                          number(
                            totalUsers?.filter((user) =>
                              user.verifications.some(
                                (v) => v.type === type && v.status === "VERIFIED",
                              ),
                            ).length,
                          ),
                        ] as [string, string],
                    ),
                    [
                      "Sem vínculo verificado",
                      number(
                        totalUsers && verified !== undefined
                          ? totalUsers.length - verified
                          : undefined,
                      ),
                    ],
                  ]}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>
      <section
        aria-label="Atividades"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-lg font-bold">Atividades</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe as metas e decisões em andamento.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/executivo" hash="okrs">
            Objetivos e metas <ArrowUpRight size={15} />
          </Link>
        </Button>
      </section>
    </div>
  );
}
