import type { FormLocationDetails } from "@/lib/location/types";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { calculateRequestedGroupFare, formatBrl } from "@/lib/ride-cost";
import { previewRequestFare } from "@/lib/ride-pricing.functions";

export type FarePreview = {
  quoteId: string;
  distanceKm: number;
  pricePerPassenger: number;
  tariffReference: string;
  originPoint?: { lat: number; lng: number };
  destinationPoint?: { lat: number; lng: number };
};

export function RequestFarePreview({
  origin,
  destination,
  passengerCount,
  originLocation,
  destinationLocation,
  onQuote,
  refreshKey = 0,
}: {
  origin: string;
  destination: string;
  passengerCount: number;
  originLocation?: FormLocationDetails;
  destinationLocation?: FormLocationDetails;
  onQuote?: (quote: FarePreview | null) => void;
  refreshKey?: number;
}) {
  const preview = useServerFn(previewRequestFare);
  const [fare, setFare] = useState<FarePreview | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const routeIsReady = Boolean(origin.trim() && destination.trim());

  const originLat = originLocation?.lat,
    originLng = originLocation?.lng;
  const destinationLat = destinationLocation?.lat,
    destinationLng = destinationLocation?.lng;
  useEffect(() => {
    let active = true;
    setFare(null);
    setError("");
    onQuote?.(null);
    if (!routeIsReady)
      return () => {
        active = false;
      };

    const timer = setTimeout(() => {
      void preview({
        data: {
          origin,
          destination,
          ...(originLat != null && originLng != null ? { originLat, originLng } : {}),
          ...(destinationLat != null && destinationLng != null
            ? { destinationLat, destinationLng }
            : {}),
        },
      })
        .then((result) => {
          if (active) {
            setFare(result);
            onQuote?.(result);
          }
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
  }, [
    origin,
    destination,
    preview,
    retry,
    routeIsReady,
    onQuote,
    refreshKey,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
  ]);

  const groupTotal =
    fare && Number.isInteger(passengerCount) && passengerCount >= 1 && passengerCount <= 6
      ? calculateRequestedGroupFare(fare.pricePerPassenger, passengerCount)
      : null;

  return (
    <section
      aria-label="Estimativa de preço da carona"
      className="rounded-lg border border-border bg-muted/30 p-3"
    >
      <p className="text-sm font-semibold">Estimativa para as vagas deste pedido</p>
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
            · {passengerCount}{" "}
            {passengerCount === 1 ? "passageiro solicitado" : "passageiros solicitados"}:{" "}
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
        Estimativa baseada no seu trecho. O valor final é confirmado antes da combinação da viagem.
      </p>
    </section>
  );
}
