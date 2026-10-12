import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/ride-cost";
import { previewRequestFare } from "@/lib/ride-pricing.functions";

type FarePreview = {
  distanceKm: number;
  pricePerPassenger: number;
  tariffReference: string;
};

export function RequestFarePreview({
  origin,
  destination,
  passengerCount,
}: {
  origin: string;
  destination: string;
  passengerCount: number;
}) {
  const preview = useServerFn(previewRequestFare);
  const [fare, setFare] = useState<FarePreview | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const routeIsReady = Boolean(origin.trim() && destination.trim());

  useEffect(() => {
    let active = true;
    setFare(null);
    setError("");
    if (!routeIsReady)
      return () => {
        active = false;
      };

    const timer = setTimeout(() => {
      void preview({ data: { origin, destination } })
        .then((result) => {
          if (active) setFare(result);
        })
        .catch((reason: unknown) => {
          if (active) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Não foi possível estimar o preço. Tente novamente.",
            );
          }
        });
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [origin, destination, preview, retry, routeIsReady]);

  const groupTotal = fare ? Math.round(fare.pricePerPassenger * passengerCount * 100) / 100 : null;

  return (
    <section
      aria-label="Estimativa de preço da carona"
      className="rounded-lg border border-border bg-muted/30 p-3"
    >
      <p className="text-sm font-semibold">Estimativa para o seu trecho</p>
      {!routeIsReady ? (
        <p role="status" className="mt-1 text-sm text-muted-foreground">
          Informe a saída e o destino para estimar o preço.
        </p>
      ) : fare ? (
        <div className="mt-1 space-y-1">
          <p className="text-lg font-bold text-primary">
            {formatBrl(fare.pricePerPassenger)} por pessoa
          </p>
          <p className="text-sm text-muted-foreground">
            {fare.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km pela estrada
            · {passengerCount} {passengerCount === 1 ? "passageiro" : "passageiros"}:{" "}
            {formatBrl(groupTotal ?? 0)} estimados
          </p>
        </div>
      ) : (
        <p role={error ? "alert" : "status"} className="mt-1 text-sm text-muted-foreground">
          {error || "Calculando a distância pela estrada…"}
        </p>
      )}
      {error && routeIsReady && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setRetry((value) => value + 1)}
        >
          Tentar novamente
        </Button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Estimativa: R$ 6 a cada 11 km por pessoa. O valor final é calculado e confirmado antes dos
        aceites da combinação.
      </p>
    </section>
  );
}
