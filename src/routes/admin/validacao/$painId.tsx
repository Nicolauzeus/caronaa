import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Filter, Loader2, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  listFormSubmissions,
  type FormSubmissionRow,
} from "@/lib/formulario/form-submission-service";
import type { Enums } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/validacao/$painId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.painId} — Validação de Mercado CARONAA` },
      {
        name: "description",
        content: "Análise detalhada de dor da validação de mercado do CARONAA.",
      },
    ],
  }),
  component: PainDetailPage,
});

type PainCode = Enums<"form_dor_codigo">;
type Profile = "all" | Enums<"form_tipo_usuario">;
type Interest = Enums<"form_intencao">;

type FilterState = {
  periodStart: string;
  periodEnd: string;
  source: string;
  event: string;
  profile: Profile;
  occupation: string;
  transport: string;
};

type DistributionRow = {
  label: string;
  value: number;
  percentage: number;
};

type RoutePair = DistributionRow & {
  origin: string;
  destination: string;
};

const painLabels: Record<PainCode, string> = {
  DOR_01: "Acesso a uma opção adequada para determinado trajeto",
  DOR_02: "Lotação e desconforto em horários de pico",
  DOR_03: "Preço elevado de alternativas individuais",
  DOR_04: "Tempo e complexidade do deslocamento",
  DOR_05: "Lugares disponíveis em carros que poderiam ser compartilhados",
  DOR_06: "Falta de confiança para pegar/oferecer carona a desconhecidos",
};

const profileLabels: Record<Enums<"form_tipo_usuario">, string> = {
  PASSAGEIRO: "Passageiro",
  MOTORISTA: "Motorista",
  AMBOS: "Ambos",
};

const interestLabels: Record<Interest, string> = {
  HOJE: "Usaria hoje",
  PROVAVELMENTE: "Provavelmente",
  TALVEZ: "Talvez",
  PROVAVELMENTE_NAO: "Provavelmente não",
  NAO: "Não usaria",
};

const interestOrder: Interest[] = ["HOJE", "PROVAVELMENTE", "TALVEZ", "PROVAVELMENTE_NAO", "NAO"];
const interestScore: Record<Interest, number> = {
  HOJE: 5,
  PROVAVELMENTE: 4,
  TALVEZ: 3,
  PROVAVELMENTE_NAO: 2,
  NAO: 1,
};

const initialFilters: FilterState = {
  periodStart: "",
  periodEnd: "",
  source: "",
  event: "",
  profile: "all",
  occupation: "",
  transport: "",
};

function isPainCode(value: string): value is PainCode {
  return Object.keys(painLabels).includes(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function normalizeLabel(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  const label = normalizeLabel(key);
  map.set(label, (map.get(label) ?? 0) + 1);
}

function toRows(map: Map<string, number>, total: number, limit?: number): DistributionRow[] {
  const rows = Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: total === 0 ? 0 : (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  return typeof limit === "number" ? rows.slice(0, limit) : rows;
}

function selectedPain(row: FormSubmissionRow, painId: PainCode) {
  return row.pain_points.find((pain) => pain.codigo_dor === painId && pain.selecionada);
}

function rowInterests(row: FormSubmissionRow) {
  return [row.intencao_passageiro, row.intencao_motorista].filter((value): value is Interest =>
    Boolean(value),
  );
}

function matchesFilters(row: FormSubmissionRow, filters: FilterState) {
  const createdAt = row.created_at.slice(0, 10);
  const matchesStart = !filters.periodStart || createdAt >= filters.periodStart;
  const matchesEnd = !filters.periodEnd || createdAt <= filters.periodEnd;
  const matchesSource =
    !filters.source || row.source.toLowerCase().includes(filters.source.toLowerCase());
  const matchesEvent =
    !filters.event || row.campaign_event.toLowerCase().includes(filters.event.toLowerCase());
  const matchesProfile = filters.profile === "all" || row.tipo_usuario === filters.profile;
  const matchesOccupation =
    !filters.occupation ||
    normalizeLabel(row.ocupacao).toLowerCase().includes(filters.occupation.toLowerCase());
  const matchesTransport =
    !filters.transport ||
    normalizeLabel(row.transporte_atual).toLowerCase().includes(filters.transport.toLowerCase());

  return (
    matchesStart &&
    matchesEnd &&
    matchesSource &&
    matchesEvent &&
    matchesProfile &&
    matchesOccupation &&
    matchesTransport
  );
}

function buildAnalysis(rows: FormSubmissionRow[], painId: PainCode, filters: FilterState) {
  const sample = rows.filter((row) => matchesFilters(row, filters));
  const affected = sample.filter((row) => selectedPain(row, painId));
  const affectedCount = affected.length;
  const sampleSize = sample.length;
  let intensitySum = 0;
  let intensityCount = 0;
  let principalCount = 0;
  let interestSum = 0;
  let interestCount = 0;

  const profiles = new Map<string, number>();
  const occupations = new Map<string, number>();
  const origins = new Map<string, number>();
  const destinations = new Map<string, number>();
  const routePairs = new Map<string, number>();
  const windows = new Map<string, number>();
  const frequencies = new Map<string, number>();
  const transports = new Map<string, number>();
  const costs = new Map<string, number>();
  const costReferences = new Map<string, number>();
  const interests = new Map<string, number>();

  for (const row of affected) {
    const pain = selectedPain(row, painId);

    increment(profiles, profileLabels[row.tipo_usuario]);
    increment(occupations, row.ocupacao);
    increment(origins, row.origem_trajeto);
    increment(destinations, row.destino_trajeto);
    increment(windows, row.faixa_horario);
    increment(frequencies, row.frequencia_semanal);
    increment(transports, row.transporte_atual);
    increment(costs, row.custo_atual_faixa);
    increment(costReferences, row.custo_referencia);

    const origin = normalizeLabel(row.origem_trajeto);
    const destination = normalizeLabel(row.destino_trajeto);
    const pairKey = `${origin} -> ${destination}`;
    routePairs.set(pairKey, (routePairs.get(pairKey) ?? 0) + 1);

    if (pain?.principal) principalCount += 1;
    if (typeof pain?.intensidade === "number") {
      intensitySum += pain.intensidade;
      intensityCount += 1;
    }

    for (const interest of rowInterests(row)) {
      increment(interests, interestLabels[interest]);
      interestSum += interestScore[interest];
      interestCount += 1;
    }
  }

  const routeRows: RoutePair[] = Array.from(routePairs.entries())
    .map(([label, value]) => {
      const [origin, destination] = label.split(" -> ");
      return {
        label,
        origin,
        destination,
        value,
        percentage: affectedCount === 0 ? 0 : (value / affectedCount) * 100,
      };
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const averageInterest = interestCount === 0 ? null : interestSum / interestCount;
  const interestScorePercent = averageInterest === null ? 0 : ((averageInterest - 1) / 4) * 100;
  const affectedPercentage = sampleSize === 0 ? 0 : (affectedCount / sampleSize) * 100;
  const averageIntensity = intensityCount === 0 ? null : intensitySum / intensityCount;
  const intensityScorePercent = averageIntensity === null ? 0 : (averageIntensity / 5) * 100;
  const principalPercentage = sampleSize === 0 ? 0 : (principalCount / sampleSize) * 100;
  const opportunityScore =
    (affectedPercentage + intensityScorePercent + principalPercentage + interestScorePercent) / 4;

  return {
    sampleSize,
    affectedCount,
    affectedPercentage,
    averageIntensity,
    principalPercentage,
    averageInterest,
    opportunityScore,
    profiles: toRows(profiles, affectedCount),
    occupations: toRows(occupations, affectedCount, 8),
    origins: toRows(origins, affectedCount, 8),
    destinations: toRows(destinations, affectedCount, 8),
    routePairs: routeRows,
    windows: toRows(windows, affectedCount),
    frequencies: toRows(frequencies, affectedCount),
    transports: toRows(transports, affectedCount),
    costs: toRows(costs, affectedCount),
    costReferences: toRows(costReferences, affectedCount),
    interests: interestOrder.map((interest) => {
      const label = interestLabels[interest];
      const value = interests.get(label) ?? 0;
      return {
        label,
        value,
        percentage: interestCount === 0 ? 0 : (value / interestCount) * 100,
      };
    }),
  };
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-l border-border px-4 py-3 first:border-l-0">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
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

function DistributionList({ rows }: { rows: DistributionRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">Sem dados para estes filtros.</p>;
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

function RouteDrillDown({ rows }: { rows: RoutePair[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, 8);

  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">Sem rotas para estes filtros.</p>;
  }

  return (
    <div className="space-y-3">
      {visibleRows.map((row) => (
        <div key={row.label} className="rounded-xl border border-border bg-secondary/30 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{row.origin}</p>
              <p className="text-xs text-muted-foreground">para {row.destination}</p>
            </div>
            <span className="text-sm font-semibold text-primary">
              {formatNumber(row.value)} · {formatPercent(row.percentage)}
            </span>
          </div>
        </div>
      ))}
      {rows.length > 8 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Mostrar menos" : `Ver mais ${rows.length - 8}`}
        </Button>
      ) : null}
    </div>
  );
}

function PainDetailPage() {
  const { painId } = Route.useParams();
  const [filters, setFilters] = useState(initialFilters);
  const [responses, setResponses] = useState<FormSubmissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);

    void listFormSubmissions()
      .then((data) => {
        if (!active) return;
        setResponses(data);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar respostas.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!isPainCode(painId)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-semibold text-destructive">Dor não encontrada.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/admin/validacao">Voltar para validação</Link>
        </Button>
      </div>
    );
  }

  const analysis = buildAnalysis(responses, painId, filters);
  const strongestProfile = analysis.profiles[0]?.label ?? "Sem perfil dominante";
  const strongestOccupation = analysis.occupations[0]?.label ?? "Sem ocupação dominante";
  const strongestRoute = analysis.routePairs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link to="/admin/validacao">
              <ArrowLeft size={16} />
              Voltar
            </Link>
          </Button>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Análise detalhada
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            {painId} — {painLabels[painId]}
          </h1>
        </div>
        <Badge variant="secondary" className="w-fit px-3 py-1.5 text-xs font-semibold">
          {formatNumber(analysis.sampleSize)} respostas no recorte
        </Badge>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter size={16} className="text-primary" />
          Filtros da dor
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
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
              setFilters((current) => ({ ...current, profile: value as Profile }))
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
          <Input
            value={filters.occupation}
            onChange={(event) =>
              setFilters((current) => ({ ...current, occupation: event.target.value }))
            }
            placeholder="Ocupação"
            className="h-10 border-border bg-background"
          />
          <Input
            value={filters.transport}
            onChange={(event) =>
              setFilters((current) => ({ ...current, transport: event.target.value }))
            }
            placeholder="Transporte atual"
            className="h-10 border-border bg-background"
          />
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
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <SectionHeader title="Resumo" />
        </div>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            Carregando análise...
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-6">
            <SummaryMetric label="Pessoas afetadas" value={formatNumber(analysis.affectedCount)} />
            <SummaryMetric
              label="% da amostra"
              value={formatPercent(analysis.affectedPercentage)}
            />
            <SummaryMetric
              label="Intensidade média"
              value={analysis.averageIntensity?.toFixed(1) ?? "N/D"}
              detail="escala 1 a 5"
            />
            <SummaryMetric
              label="% principal"
              value={formatPercent(analysis.principalPercentage)}
            />
            <SummaryMetric
              label="Nível de interesse"
              value={analysis.averageInterest?.toFixed(1) ?? "N/D"}
              detail="escala 1 a 5"
            />
            <SummaryMetric
              label="Opportunity Score"
              value={String(Math.round(analysis.opportunityScore))}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
        <div className="flex items-start gap-3">
          <Target size={20} className="mt-1 text-primary" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
              Onde atacar primeiro
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              Priorize {strongestProfile.toLowerCase()} · {strongestOccupation.toLowerCase()}
              {strongestRoute
                ? ` · rota ${strongestRoute.origin} para ${strongestRoute.destination}`
                : ""}
              .
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esse insight usa os maiores grupos dentro das pessoas que selecionaram esta dor.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Quem sente essa dor" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Perfil
            </h3>
            <div className="mt-4">
              <DistributionList rows={analysis.profiles} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Ocupação
            </h3>
            <div className="mt-4">
              <DistributionList rows={analysis.occupations} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Onde" eyebrow="Origem x destino" />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Cruzamentos principais
            </h3>
            <div className="mt-4">
              <RouteDrillDown rows={analysis.routePairs} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Origens
              </h3>
              <div className="mt-4">
                <DistributionList rows={analysis.origins} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Destinos
              </h3>
              <div className="mt-4">
                <DistributionList rows={analysis.destinations} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Quando" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Faixa de horário
            </h3>
            <div className="mt-4">
              <DistributionList rows={analysis.windows} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Frequência semanal
            </h3>
            <div className="mt-4">
              <DistributionList rows={analysis.frequencies} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <SectionHeader title="Como se desloca hoje" />
          <div className="mt-4">
            <DistributionList rows={analysis.transports} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <SectionHeader title="Quanto gasta" />
          <div className="mt-4">
            <DistributionList rows={analysis.costs} />
          </div>
          {analysis.costReferences.length ? (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Referência
              </h3>
              <div className="mt-3">
                <DistributionList rows={analysis.costReferences} />
              </div>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <SectionHeader title="Interesse" />
          <div className="mt-4">
            <DistributionList rows={analysis.interests} />
          </div>
        </div>
      </section>
    </div>
  );
}

