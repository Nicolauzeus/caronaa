import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStrategicCrossings, type StrategicCrossings } from "@/lib/strategic-crossings";

export const Route = createFileRoute("/admin/oportunidades")({
  component: OpportunitiesPage,
  head: () => ({ meta: [{ title: "Oportunidades — CARONAA" }] }),
});
const minimumSample = 30;
const pains: Record<string, string> = {
  DOR_01: "Acesso a opção adequada",
  DOR_02: "Lotação e desconforto",
  DOR_03: "Preço elevado",
  DOR_04: "Tempo e complexidade",
  DOR_05: "Vagas em carros",
  DOR_06: "Confiança",
};
const profiles: Record<string, string> = {
  PASSAGEIRO: "Passageiros",
  MOTORISTA: "Motoristas",
  AMBOS: "Ambos",
};
const number = (value: number | null) =>
  value === null
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);

function Sample({ count }: { count: number }) {
  const adequate = count >= minimumSample;
  return (
    <Badge
      variant={adequate ? "secondary" : "outline"}
      className={
        adequate ? "bg-emerald-500/10 text-emerald-700" : "border-amber-500/40 text-amber-700"
      }
    >
      {count} respostas · {adequate ? "amostra adequada" : "amostra pequena"}
    </Badge>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border border-border bg-card/85 shadow-soft">
      <CardHeader>
        <CardTitle className="font-display text-xl font-extrabold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
function Evidence({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">{children}</ul>
  );
}

function OpportunitiesPage() {
  const [data, setData] = useState<StrategicCrossings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void getStrategicCrossings()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  if (failed)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
        <AlertCircle className="mr-2 inline" size={16} />
        Não foi possível carregar as oportunidades.
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-56 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        Carregando métricas reais…
      </div>
    );
  const gaps = data.supplyDemandByRoute.filter((item) => item.requestGap > 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Decisão baseada em dados
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Oportunidades</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Rankings calculados de respostas e eventos reais. Match não é contabilizado como carona
            realizada.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground">
          <BarChart3 size={15} />
          Amostra mínima: {minimumSample}
        </div>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800">
        Amostras menores que {minimumSample} são sinais exploratórios, não conclusões isoladas.
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="1. Dores prioritárias">
          {data.painIntent.map((item, index) => (
            <div
              key={item.painCode}
              className="rounded-xl border border-border bg-secondary/25 p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {index + 1}. {pains[item.painCode] ?? item.painCode}
                </strong>
                <Sample count={item.respondents} />
              </div>
              <Evidence>
                <li>
                  Intensidade média:{" "}
                  <b className="text-foreground">{number(item.averageIntensity)}/5</b>
                </li>
                <li>
                  Intenção média: <b className="text-foreground">{number(item.averageIntent)}/5</b>
                </li>
              </Evidence>
            </div>
          ))}
        </Panel>
        <Panel title="2. Públicos prioritários">
          {data.profilePainAndIntent.map((item, index) => (
            <div key={item.profile} className="rounded-xl border border-border bg-secondary/25 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {index + 1}. {profiles[item.profile] ?? item.profile}
                </strong>
                <Sample count={item.respondents} />
              </div>
              <Evidence>
                <li>
                  Intensidade média:{" "}
                  <b className="text-foreground">{number(item.averagePainIntensity)}/5</b>
                </li>
                <li>
                  Intenção média: <b className="text-foreground">{number(item.averageIntent)}/5</b>
                </li>
              </Evidence>
            </div>
          ))}
        </Panel>
        <Panel title="3. Rotas prioritárias">
          {data.routesWithStrongPain.map((item, index) => (
            <div
              key={`${item.origin}-${item.destination}`}
              className="rounded-xl border border-border bg-secondary/25 p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {index + 1}. {item.origin} → {item.destination}
                </strong>
                <Sample count={item.strongPainRespondents} />
              </div>
              <Evidence>
                <li>
                  Dores fortes: <b className="text-foreground">{item.strongPainRespondents}</b>
                </li>
                <li>
                  Intensidade média:{" "}
                  <b className="text-foreground">{number(item.averagePainIntensity)}/5</b>
                </li>
              </Evidence>
            </div>
          ))}
        </Panel>
        <Panel title="4. Horários prioritários">
          {data.demandByTime.map((item, index) => (
            <div
              key={item.timeWindow ?? "unknown"}
              className="flex items-center justify-between rounded-xl border border-border bg-secondary/25 p-4"
            >
              <strong>
                {index + 1}. {item.timeWindow ?? "Não informado"}
              </strong>
              <Sample count={item.respondents} />
            </div>
          ))}
        </Panel>
        <Panel title="5. Regiões com maior demanda sem oferta">
          {gaps.length ? (
            gaps.map((item, index) => (
              <div
                key={`${item.origin}-${item.destination}-${item.timeWindow}`}
                className="rounded-xl border border-border bg-secondary/25 p-4"
              >
                <strong>
                  {index + 1}. {item.origin} → {item.destination} · {item.timeWindow}
                </strong>
                <Evidence>
                  <li>
                    Solicitações: <b className="text-foreground">{item.requests}</b>
                  </li>
                  <li>
                    Ofertas: <b className="text-foreground">{item.offers}</b>
                  </li>
                  <li>
                    Saldo sem oferta: <b className="text-foreground">{item.requestGap}</b>
                  </li>
                </Evidence>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Não há desequilíbrio de demanda sem oferta nos dados atuais.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
