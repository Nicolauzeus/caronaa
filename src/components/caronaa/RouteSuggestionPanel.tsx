import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LoaderCircle, Route as RouteIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/ride-cost";
import { getDriverOfferRoutePlan } from "@/lib/multi-stop-routing.functions";
import { RouteComparisonMap } from "./RouteComparisonMap";

export function RouteSuggestionPanel({ offerId }: { offerId: string }) {
  const createPlan = useServerFn(getDriverOfferRoutePlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof createPlan>> | null>(null);
  const [showMap, setShowMap] = useState(false);

  async function calculate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await createPlan({ data: { offerId } }));
      setShowMap(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível organizar a rota.");
    } finally {
      setBusy(false);
    }
  }

  const plan = result?.ok ? result.plan : null;
  const start = plan?.originalRoute.routePath[0];
  const finish = plan?.originalRoute.routePath.at(-1);

  return (
    <section
      className="mt-3 rounded-lg border border-border bg-card p-3"
      aria-label="Sugestão de rota com paradas"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <RouteIcon size={16} className="text-primary" />
          Organizar paradas das propostas
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void calculate()}
        >
          {busy ? (
            <>
              <LoaderCircle size={14} className="animate-spin" /> Calculando…
            </>
          ) : result ? (
            "Recalcular rota"
          ) : (
            "Ver sugestão"
          )}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Analisa propostas já encontradas. Não confirma passageiros nem reserva vagas.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Ao gerar a sugestão, os pontos da rota e das propostas são enviados ao serviço público OSRM
        para cálculo rodoviário.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {result && !result.ok ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {result.reason}
        </p>
      ) : null}

      {plan ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md bg-primary/5 p-3">
            <h4 className="text-sm font-bold">
              Sugestão de rota · {plan.requestCount} proposta(s)
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              +{plan.addedDurationMinutes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min
              {" · "}+{plan.addedDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
              km
              {" · "}
              <strong className="text-foreground">
                {formatBrl(plan.totalIncrementalEarnings)}
              </strong>{" "}
              em cotações incluídas
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cotações das propostas listadas, não receita garantida nem pagamento recebido. Cada
              viagem continua sujeita aos aceites existentes.
            </p>
          </div>

          <ol className="space-y-1 text-xs">
            {plan.stops.map((stop) => (
              <li key={`${stop.requestId}-${stop.kind}`} className="flex items-center gap-2">
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${stop.kind === "pickup" ? "bg-primary text-primary-foreground" : "bg-foreground text-background"}`}
                >
                  {stop.sequence}
                </span>
                <span>{stop.label}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowMap((value) => !value)}
            >
              {showMap ? "Ocultar mapa" : "Ver trajeto no mapa"}
            </Button>
            <Button asChild size="sm">
              <Link to="/minha-carona/$offerId" params={{ offerId }}>
                Revisar propostas e responder <ArrowRight size={14} />
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setResult(null);
                setShowMap(false);
              }}
            >
              Manter rota direta
            </Button>
          </div>

          {showMap && start && finish ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span>
                  <span className="mr-1 inline-block size-2 rounded-full bg-muted-foreground" />
                  Rota direta
                </span>
                <span>
                  <span className="mr-1 inline-block size-2 rounded-full bg-primary" />
                  Rota sugerida
                </span>
              </div>
              <RouteComparisonMap
                originalRoute={plan.originalRoute.routePath}
                suggestedRoute={plan.suggestedRoute.routePath}
                stops={plan.stops}
                origin={start}
                destination={finish}
              />
              <p className="text-[11px] text-muted-foreground">
                Mapa e tempos dependem do serviço público OSRM e dos dados rodoviários disponíveis.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
