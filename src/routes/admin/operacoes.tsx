import { AdminDataError } from "@/components/admin/AdminDataError";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getOperationalMetrics, type OperationalMetrics } from "@/lib/operational-metrics";
import { InsightChart } from "@/components/admin/InsightChart";
import { statusTextClass } from "@/lib/admin/chart-utils";
import { ProfessionalLiveMonitor } from "@/components/admin/ProfessionalLiveMonitor";
import { QuickRideAdminPanel } from "@/components/admin/QuickRideAdminPanel";

export const Route = createFileRoute("/admin/operacoes")({ component: MobilityOperationsCenter });
const display = (value: number | null | undefined, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + suffix
    : "N/D";
function MobilityOperationsCenter() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    const start = new Date();
    start.setDate(start.getDate() - days);
    void getOperationalMetrics({ periodStart: start.toISOString() })
      .then((data) => {
        if (active) setMetrics(data);
      })
      .catch((err) => {
        if (active) {
          setMetrics(null);
          setError(err instanceof Error ? err.message : "Indicadores indisponíveis");
        }
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [days, refresh]);
  const totals = useMemo(
    () =>
      metrics
        ? [
            { label: "Solicitações elegíveis", value: metrics.request.eligibleRequests },
            { label: "Sem correspondência", value: metrics.request.unmatchedRequests },
            { label: "Ofertas elegíveis", value: metrics.offer.eligibleOffers },
            { label: "Combinações", value: metrics.match.total },
            { label: "Viagens concluídas", value: metrics.match.completed },
            { label: "Cancelamentos", value: metrics.match.cancelled },
          ]
        : [],
    [metrics],
  );
  const comparison = useMemo(
    () =>
      metrics
        ? [
            {
              name: "Solicitações",
              total: metrics.request.eligibleRequests,
              comMatch: metrics.request.matchedRequests,
            },
            {
              name: "Ofertas",
              total: metrics.offer.eligibleOffers,
              comMatch: metrics.offer.utilizedOffers,
            },
          ]
        : [],
    [metrics],
  );
  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          <label className="text-sm">
            Período
            <select
              aria-label="Período das operações"
              className="ml-2 rounded-lg border bg-background p-2"
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </label>
          <button
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => setRefresh((v) => v + 1)}
          >
            Atualizar
          </button>
        </div>
      </div>
      <AdminDataError error={error} />
      <section
        aria-label="Indicadores operacionais"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {(pending
          ? Array.from({ length: 6 }, (_, i) => ({
              label: [
                "Solicitações elegíveis",
                "Sem correspondência",
                "Ofertas elegíveis",
                "Combinações",
                "Viagens concluídas",
                "Cancelamentos",
              ][i],
              value: null,
            }))
          : totals.length
            ? totals
            : Array.from({ length: 6 }, (_, i) => ({
                label: [
                  "Solicitações elegíveis",
                  "Sem correspondência",
                  "Ofertas elegíveis",
                  "Combinações",
                  "Viagens concluídas",
                  "Cancelamentos",
                ][i],
                value: null,
              }))
        ).map((m) => (
          <article key={m.label} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{m.label}</p>
            <p
              className={
                "mt-3 text-3xl font-extrabold " + (m.value == null ? "text-foreground" : statusTextClass(m.label))
              }
            >
              {pending ? "…" : display(m.value)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Eventos operacionais · {days} dias
            </p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {pending ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">
            Carregando indicadores…
          </p>
        ) : (
          <InsightChart
            title="Oferta e demanda"
            description="Contagens absolutas: correspondências são parte do total, não devem ser somadas novamente."
            rows={comparison.flatMap((item) => [
              { name: item.name + " • total", value: item.total },
              { name: item.name + " • com match", value: item.comMatch },
            ])}
          />
        )}

        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-bold">Eficiência operacional</h2>
          <dl className="space-y-4 text-sm">
            {[
              ["Taxa de correspondência de solicitações", metrics?.request.requestMatchRate, "%"],
              ["Taxa de utilização das ofertas", metrics?.offer.offerMatchRate, "%"],
              ["Ocupação dos assentos", metrics?.seats.seatFillRate, "%"],
              ["Tempo médio até o match", metrics?.match.averageMinutesToMatch, " min"],
            ].map(([label, value, suffix]) => (
              <div key={String(label)} className="flex justify-between gap-3 border-b pb-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-bold">
                  {pending ? "…" : display(value as number | null | undefined, String(suffix))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Taxas calculadas pela fonte de métricas operacionais. N/D indica ausência de medição
            válida.
          </p>
        </div>
      </section>

      <ProfessionalLiveMonitor />
      <QuickRideAdminPanel />
      <section className="rounded-xl border bg-secondary/20 p-4">
        <h2 className="font-bold">Mobilidade profissional local</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A presença profissional já é acompanhada acima. Despacho, coordenadas GPS, rotas e corrida
          profissional permanecem indisponíveis até homologação específica.
        </p>
      </section>
    </main>
  );
}
