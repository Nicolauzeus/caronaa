import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Search, SlidersHorizontal, UsersRound } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { RideCard } from "@/components/caronaa/RideCard";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { searchRideOffers, type RideSummary } from "@/lib/rides.functions";
import {
  TimeToleranceSelector,
  type TimeToleranceMinutes,
} from "@/components/caronaa/TimeToleranceSelector";
import type { FormLocationDetails } from "@/lib/location/types";
import { previewRequestFare } from "@/lib/ride-pricing.functions";
import { formatBrl } from "@/lib/ride-cost";

export const Route = createFileRoute("/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar carona — CARONAA" },
      {
        name: "description",
        content: "Busque caronas urbanas e intermunicipais compartilhadas com sua comunidade.",
      },
      { property: "og:title", content: "Buscar carona — CARONAA" },
      {
        property: "og:description",
        content: "Busque caronas urbanas e intermunicipais compartilhadas com sua comunidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Buscar,
});
function Buscar() {
  const searchOffers = useServerFn(searchRideOffers);
  const previewFare = useServerFn(previewRequestFare);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originLocation, setOriginLocation] = useState<FormLocationDetails | undefined>();
  const [destinationLocation, setDestinationLocation] = useState<FormLocationDetails | undefined>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [timeTolerance, setTimeTolerance] = useState<TimeToleranceMinutes>(15);
  const [submitted, setSubmitted] = useState({
    origin: "",
    destination: "",
    date: "",
    time: "",
    passengers: "1",
    timeTolerance: 15 as TimeToleranceMinutes,
    originLocation: undefined as FormLocationDetails | undefined,
    destinationLocation: undefined as FormLocationDetails | undefined,
  });
  const [matches, setMatches] = useState<RideSummary[]>([]);
  const [requestQuote, setRequestQuote] = useState<{
    quoteId: string;
    expiresAt: string;
    distanceKm: number;
    pricePerPassenger: number;
  } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("origem") || "";
    const to = params.get("destino") || "";
    const when = params.get("data") || "";
    if (from || to || when) {
      setOrigin(from);
      setDestination(to);
      setDate(when);
      setSubmitted({
        origin: from,
        destination: to,
        date: when,
        time: "",
        passengers: "1",
        timeTolerance: 15,
        originLocation: undefined,
        destinationLocation: undefined,
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void searchOffers({
      data: {
        origin: submitted.origin || undefined,
        destination: submitted.destination || undefined,
        originLat: submitted.originLocation?.lat,
        originLng: submitted.originLocation?.lng,
        destinationLat: submitted.destinationLocation?.lat,
        destinationLng: submitted.destinationLocation?.lng,
        rideDate: submitted.date || undefined,
        departureTime: submitted.time || undefined,
        passengerCount: Number(submitted.passengers) || 1,
        timeToleranceMinutes: submitted.timeTolerance,
      },
    })
      .then((data) => {
        if (active) setMatches(data);
      })
      .catch((searchError) => {
        if (!active) return;
        setMatches([]);
        setError(
          searchError instanceof Error ? searchError.message : "Não foi possível buscar caronas.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchOffers, submitted]);

  useEffect(() => {
    let active = true;
    setRequestQuote(null);
    setQuoteError(null);
    if (!submitted.origin.trim() || !submitted.destination.trim()) {
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void previewFare({ data: { origin: submitted.origin, destination: submitted.destination } })
        .then((quote) => {
          if (active) setRequestQuote(quote);
        })
        .catch((quoteFailure) => {
          if (active)
            setQuoteError(
              quoteFailure instanceof Error
                ? quoteFailure.message
                : "Não foi possível calcular o preço do trecho.",
            );
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [previewFare, submitted.origin, submitted.destination, quoteRefresh]);

  return (
    <AppShell>
      <PageHeading
        eyebrow="VÁ PELO MESMO CAMINHO"
        title="Encontre sua próxima carona"
        description="Descubra trajetos compartilhados e escolha a companhia ideal para o seu caminho."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({
            origin,
            destination,
            date,
            time,
            passengers,
            timeTolerance,
            originLocation,
            destinationLocation,
          });
        }}
        className="rounded-lg border border-border bg-card p-4 shadow-soft space-y-4"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
          <LocationAutocomplete
            id="buscar-origem"
            label="ORIGEM"
            value={origin}
            onChange={(val, details) => {
              setOrigin(details?.formattedAddress || val);
              setOriginLocation(details);
            }}
            placeholder="De onde?"
            variant="simple"
          />
          <LocationAutocomplete
            id="buscar-destino"
            label="DESTINO"
            value={destination}
            onChange={(val, details) => {
              setDestination(details?.formattedAddress || val);
              setDestinationLocation(details);
            }}
            placeholder="Para onde?"
            variant="simple"
          />
          <label className="text-xs font-bold text-muted-foreground">
            DATA
            <div className="mt-2 flex h-11 items-center gap-2 rounded-md border border-input px-3">
              <CalendarDays size={16} className="text-primary" />
              <input
                aria-label="Data da viagem"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none"
              />
            </div>
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            HORÁRIO
            <div className="mt-2 flex h-11 items-center rounded-md border border-input px-3">
              <input
                aria-label="Horário aproximado"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground outline-none"
              />
            </div>
          </label>
          <Button type="submit" className="h-11">
            <Search /> Buscar
          </Button>
        </div>

        <div className="border-t border-border/60 pt-3">
          <TimeToleranceSelector
            value={timeTolerance}
            onChange={(val) => {
              setTimeTolerance(val);
              setSubmitted((prev) => ({ ...prev, timeTolerance: val }));
            }}
            baseTime={time}
            label="Tolerância de horário"
          />
        </div>
      </form>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SlidersHorizontal size={17} className="mr-1 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Matching real por origem, destino, data, horário e vagas.
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <UsersRound size={16} /> Passageiros{" "}
          <select
            value={passengers}
            onChange={(e) => {
              setPassengers(e.target.value);
              setSubmitted((current) => ({ ...current, passengers: e.target.value }));
            }}
            className="rounded-md border border-input bg-card px-2 py-1 text-foreground"
          >
            <option>1</option>
            <option>2</option>
            <option>3</option>
          </select>
        </label>
      </div>
      {submitted.origin && submitted.destination && (
        <div
          className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
          role={quoteError ? "alert" : "status"}
        >
          {requestQuote ? (
            <>
              <p className="font-semibold text-primary">
                Seu trecho: {formatBrl(requestQuote.pricePerPassenger)} por pessoa
                {Number(submitted.passengers) > 1
                  ? ` · grupo ${formatBrl(Math.round(requestQuote.pricePerPassenger * Number(submitted.passengers) * 100) / 100)}`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {requestQuote.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
                por estrada · tarifa R$ 6 a cada 11 km.
                {submitted.date && submitted.time
                  ? " Este mesmo valor será enviado na solicitação."
                  : " Informe data e horário para solicitar uma vaga."}
              </p>
            </>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">
                {quoteError ||
                  (quoteLoading
                    ? "Calculando preço rodoviário do seu trecho…"
                    : "Não foi possível calcular o preço do trecho.")}
              </p>
              {quoteError && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setQuoteRefresh((value) => value + 1)}
                >
                  Tentar cotação novamente
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="mb-5 mt-9 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold">Caronas disponíveis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Buscando trajetos..."
              : `${matches.length} ${matches.length === 1 ? "trajeto encontrado" : "trajetos encontrados"}`}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Carregando caronas disponíveis...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 py-16 text-center">
          <Search className="mx-auto mb-3 text-destructive" />
          <p className="font-bold text-destructive">Não foi possível buscar caronas</p>
          <p className="mt-1 text-sm text-destructive/80">{error}</p>
        </div>
      ) : matches.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              passengerCount={Number(submitted.passengers) || 1}
              segmentRequest={
                requestQuote && submitted.date && submitted.time
                  ? {
                      quoteId: requestQuote.quoteId,
                      distanceKm: requestQuote.distanceKm,
                      pricePerPassenger: requestQuote.pricePerPassenger,
                      rideDate: submitted.date,
                      departureTime: submitted.time,
                      timeToleranceMinutes: submitted.timeTolerance,
                    }
                  : undefined
              }
              onQuoteExpired={() => setQuoteRefresh((value) => value + 1)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Search className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-bold">Nenhuma carona encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Não encontramos uma oferta dentro dos critérios atuais. Você pode ampliar a tolerância
            de horário, revisar os endereços escolhidos ou buscar outra data.
          </p>
          <Button
            variant="link"
            className="mt-3"
            onClick={() => {
              setOrigin("");
              setDestination("");
              setOriginLocation(undefined);
              setDestinationLocation(undefined);
              setDate("");
              setTime("");
              setPassengers("1");
              setSubmitted({
                origin: "",
                destination: "",
                date: "",
                time: "",
                passengers: "1",
                timeTolerance: 15,
                originLocation: undefined,
                destinationLocation: undefined,
              });
            }}
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </AppShell>
  );
}
