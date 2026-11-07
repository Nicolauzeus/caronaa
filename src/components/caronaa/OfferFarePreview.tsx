import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { quoteOfferRoute } from "@/lib/offer-pricing.functions";
import { formatBrl } from "@/lib/ride-cost";
import { Button } from "@/components/ui/button";

export type OfferQuote = {
  quoteId: string;
  distanceKm: number;
  pricePerPassenger: number;
  origin: string;
  destination: string;
};

export function OfferFarePreview({
  origin,
  destination,
  seats,
  onQuote,
}: {
  origin: string;
  destination: string;
  seats: number;
  onQuote: (quote: OfferQuote | null) => void;
}) {
  const calculate = useServerFn(quoteOfferRoute);
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setQuote(null);
    setError("");
    onQuote(null);
    if (!origin.trim() || !destination.trim()) return;
    const timer = setTimeout(() => {
      void calculate({ data: { origin, destination } })
        .then((result) => {
          if (!active) return;
          const value = { ...result, origin, destination };
          setQuote(value);
          onQuote(value);
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error ? reason.message : "Não foi possível calcular o preço.",
            );
        });
    }, 800);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [origin, destination, retry, calculate, onQuote]);
  return (
    <section className="border-y border-border py-4" aria-label="Preço da oferta">
      <p className="text-sm font-semibold">Contribuição estimada por vaga · percurso completo</p>
      {quote ? (
        <p className="mt-1 text-xl font-bold text-primary">
          {formatBrl(quote.pricePerPassenger)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {quote.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
          </span>
        </p>
      ) : (
        <p role={error ? "alert" : "status"} className="mt-1 text-sm text-muted-foreground">
          {error || (origin && destination ? "Calculando preço…" : "Preço pendente do trajeto")}
        </p>
      )}
      {error && (
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
      {quote && Number.isInteger(seats) && seats > 0 && (
        <p className="mt-2 rounded-lg bg-primary/5 p-3 text-sm">
          <strong>Potencial estimado:</strong> até{" "}
          {formatBrl(Math.round(quote.pricePerPassenger * seats * 100) / 100)} se as {seats} vagas
          forem ocupadas durante todo o percurso. É uma estimativa, não receita garantida.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Valor sugerido proporcional por vaga ocupada. Cada passageiro contribui de acordo com o
        trecho percorrido.
      </p>
    </section>
  );
}
