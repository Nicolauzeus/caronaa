import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LocateFixed, MapPin, CarFront, UserRound, CalendarDays } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { JourneyPreferences } from "@/components/caronaa/TravelPreferences";
import type { TravelPreferences } from "@/lib/travel-preferences";
import { getActiveHomeJourneys, getRecentHomeDestinations } from "@/lib/home.functions";
import { createRideRequest } from "@/lib/ride-matching.functions";
import type { FormLocationDetails } from "@/lib/location/types";
import { HomeRideMap } from "@/components/caronaa/HomeRideMap";
import { RequestFarePreview, type FarePreview } from "@/components/caronaa/RequestFarePreview";
import { useUserLocation, locationFailureMessages } from "@/lib/location/use-user-location";
import { reverseGeocodeServerFn } from "@/lib/location.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Início — CARONAA" },
      { name: "description", content: "Peça ou ofereça uma carona pelo seu trajeto." },
      { property: "og:title", content: "Início — CARONAA" },
      { property: "og:description", content: "Peça ou ofereça uma carona pelo seu trajeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const loadJourneys = useServerFn(getActiveHomeJourneys);
  const loadRecent = useServerFn(getRecentHomeDestinations);
  const requestRide = useServerFn(createRideRequest);
  const reverseGeocode = useServerFn(reverseGeocodeServerFn);
  const location = useUserLocation();
  const [originSource, setOriginSource] = useState<"CURRENT_LOCATION" | "MANUAL_ORIGIN">(
    "CURRENT_LOCATION",
  );
  const [resolvedAddress, setResolvedAddress] = useState<FormLocationDetails | null>(null);
  const [reverseFailed, setReverseFailed] = useState(false);
  const [journeys, setJourneys] = useState<Awaited<ReturnType<typeof loadJourneys>>>([]);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof loadRecent>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"request" | "offer">("request");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originLocation, setOriginLocation] = useState<FormLocationDetails>();
  const [destinationLocation, setDestinationLocation] = useState<FormLocationDetails>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [count, setCount] = useState("1");
  const [requestFare, setRequestFare] = useState<
    (FarePreview & { origin: string; destination: string }) | null
  >(null);
  const [requestFareRefresh, setRequestFareRefresh] = useState(0);
  const receiveRequestFare = useCallback(
    (quote: FarePreview | null) => {
      setRequestFare(quote ? { ...quote, origin, destination } : null);
    },
    [origin, destination],
  );
  const [busy, setBusy] = useState(false);
  const requestSubmitting = useRef(false);
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const refresh = useCallback(() => {
    void loadJourneys()
      .then(setJourneys)
      .catch((reason) =>
        setError("Não foi possível carregar seu trajeto. Você pode continuar criando uma carona."),
      );
  }, [loadJourneys]);
  useEffect(refresh, [refresh]);
  useEffect(() => {
    let alive = true;
    void loadRecent()
      .then((value) => {
        if (alive) setRecent(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loadRecent]);
  const active = journeys[0];
  const activeIsCurrent = Boolean(
    active &&
    active.status !== "CANCELLED" &&
    active.status !== "COMPLETED" &&
    (active.status === "IN_PROGRESS" ||
      new Date(`${active.ride_date}T${active.departure_time.slice(0, 8)}-03:00`).getTime() >
        Date.now()),
  );
  const activeNextStep = !active
    ? ""
    : active.status === "IN_PROGRESS"
      ? "Acompanhar viagem"
      : active.status === "CONFIRMED"
        ? "Ver embarque e acompanhar"
        : active.status === "COMPLETED"
          ? "Ver resumo e Pix"
          : active.status === "MATCHED" || active.status === "matched"
            ? "Ver combinaÃ§Ã£o"
            : active.kind === "offer"
              ? "Ver oferta"
              : "Ver pedido";
  const point =
    originLocation ??
    (active?.origin_lat != null && active.origin_lng != null
      ? { lat: active.origin_lat, lng: active.origin_lng }
      : undefined);
  useEffect(() => {
    if (!location.addressPosition || originSource !== "CURRENT_LOCATION") return;
    let alive = true;
    setResolvedAddress(null);
    setReverseFailed(false);
    void reverseGeocode({
      data: { lat: location.addressPosition.lat, lng: location.addressPosition.lng },
    })
      .then((value) => {
        if (alive) {
          setResolvedAddress(value);
          setReverseFailed(!value);
        }
      })
      .catch(() => {
        if (alive) setReverseFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [location.addressPosition, reverseGeocode, originSource]);
  useEffect(() => {
    if (originSource !== "CURRENT_LOCATION" || !location.position) return;
    const { lat, lng } = location.position;
    const addressStillNear =
      resolvedAddress?.lat != null &&
      resolvedAddress.lng != null &&
      Math.abs(resolvedAddress.lat - lat) < 0.0003 &&
      Math.abs(resolvedAddress.lng - lng) < 0.0003;
    const label = addressStillNear
      ? resolvedAddress.formattedAddress || "Localização atual"
      : "Localização atual";
    setOrigin(label);
    setOriginLocation({
      rawText: label,
      formattedAddress: label,
      lat,
      lng,
      isApproximate: location.position.accuracy > 100,
    });
  }, [originSource, location.position, resolvedAddress]);
  function focusOrigin() {
    document.getElementById("home-origin")?.focus();
  }

  function setToday() {
    const now = new Date();
    setDate([now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-"));
  }

  function startJourney(nextRole: "request" | "offer") {
    setRole(nextRole);
    setError(null);
    const destinationInput = document.getElementById("home-destination");
    destinationInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Allow the form to become visible before opening the mobile keyboard.
    window.setTimeout(() => destinationInput?.focus({ preventScroll: true }), 250);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <section className="mb-4 space-y-3 sm:hidden" aria-label="Começar uma carona">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Sua próxima viagem começa aqui
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Para onde vamos?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha o destino e encontre uma carona no seu caminho.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => startJourney("request")}
              className="min-h-12 rounded-xl text-sm font-bold"
            >
              <UserRound size={17} aria-hidden="true" />
              Pedir carona
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => startJourney("offer")}
              className="min-h-12 rounded-xl text-sm font-bold"
            >
              <CarFront size={17} aria-hidden="true" />
              Oferecer
            </Button>
          </div>
        </section>
        {active && (
          <section
            className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-soft"
            aria-label="Sua carona atual"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
                </p>
                <p className="mt-2 truncate font-semibold">
                  {active.origin} → {active.destination}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.ride_date.split("-").reverse().join("/")} ·{" "}
                  {active.departure_time.slice(0, 5)} ·{" "}
                  {active.status === "IN_PROGRESS"
                    ? "Em andamento"
                    : active.status === "CONFIRMED"
                      ? "Confirmada"
                      : active.status === "COMPLETED"
                        ? "Concluída"
                        : active.status === "MATCHED"
                          ? "Combinação encontrada"
                          : "Oferta ativa"}
                </p>
                {"pendingCount" in active && active.pendingCount > 0 && (
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {active.pendingCount} solicitação(ões) aguardando sua confirmação
                  </p>
                )}
              </div>
              {active.status === "IN_PROGRESS" || active.status === "CONFIRMED" ? (
                <Button asChild>
                  <Link to="/viagem/$rideId" params={{ rideId: active.id }}>
                    {activeNextStep}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              ) : active.kind === "offer" ||
                ("role" in active &&
                  active.role === "driver" &&
                  "offerId" in active &&
                  Boolean(active.offerId)) ? (
                <Button asChild>
                  <Link
                    to="/minha-carona/$offerId"
                    params={{
                      offerId: "offerId" in active && active.offerId ? active.offerId : active.id,
                    }}
                  >
                    {activeNextStep}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to="/minhas-caronas" hash={`ride-${active.id}`}>
                    {activeNextStep}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              )}
            </div>
          </section>
        )}
        <div className="mb-2 flex items-center justify-between gap-3 sm:hidden">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <MapPin size={14} aria-hidden="true" className="text-primary" />
            Seu mapa e ponto de partida
          </span>
          <button
            type="button"
            onClick={() => startJourney(role)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-primary underline underline-offset-4"
          >
            Escolher destino <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <HomeRideMap
          userPosition={location.position}
          origin={point}
          destination={destinationLocation}
          originIsCurrent={originSource === "CURRENT_LOCATION" && Boolean(location.position)}
          following={location.isFollowingUser}
          recenterVersion={location.recenterVersion}
          locating={location.locating}
          onDrag={() => location.setFollowing(false)}
          onRecenter={location.locate}
        />
        <section
          aria-labelledby="journey-title"
          className="relative -mx-4 -mt-5 rounded-t-3xl border-t border-border/60 bg-background px-4 pb-5 pt-5 shadow-[0_-12px_30px_rgba(0,0,0,0.08)] sm:mx-0 sm:mt-0 sm:rounded-none sm:border-0 sm:px-0 sm:pt-6 sm:shadow-none"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
          <h2 id="journey-title" className="text-xl font-extrabold sm:text-3xl">
            <span className="sm:hidden">Planeje sua carona</span>
            <span className="hidden sm:inline">Para onde vamos?</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground sm:hidden">
            Informe o trajeto, escolha quando sair e confira os detalhes antes de continuar.
          </p>
          {location.failure && (
            <div role="alert" className="mt-3 text-sm text-muted-foreground">
              <p>{locationFailureMessages[location.failure]}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={focusOrigin}>
                  Informar saída
                </Button>
                {location.failure !== "UNSUPPORTED" && location.failure !== "INSECURE" && (
                  <Button type="button" variant="ghost" onClick={location.locate}>
                    Tentar novamente
                  </Button>
                )}
              </div>
            </div>
          )}
          <div
            role="group"
            aria-label="Papel nesta viagem"
            className="my-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:my-5"
          >
            {(
              [
                ["request", "Pedir carona", UserRound],
                ["offer", "Oferecer carona", CarFront],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => setRole(value)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold ${role === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (role === "offer") {
                const params = new URLSearchParams({
                  origem: origin,
                  destino: destination,
                  data: date,
                  horario: time,
                });
                if (originLocation?.lat != null && originLocation.lng != null) {
                  params.set("olat", String(originLocation.lat));
                  params.set("olng", String(originLocation.lng));
                }
                if (destinationLocation?.lat != null && destinationLocation.lng != null) {
                  params.set("dlat", String(destinationLocation.lat));
                  params.set("dlng", String(destinationLocation.lng));
                }
                window.location.assign(`/oferecer?${params}`);
                return;
              }
              if (
                !requestFare ||
                requestFare.origin !== origin ||
                requestFare.destination !== destination
              ) {
                setError("Aguarde a cotação atual do seu trecho antes de pedir a carona.");
                return;
              }
              if (requestSubmitting.current) return;
              requestSubmitting.current = true;
              setBusy(true);
              setError(null);
              try {
                await requestRide({
                  data: {
                    quoteId: requestFare.quoteId,
                    rideDate: date,
                    departureTime: time,
                    passengerCount: Number(count),
                    timeToleranceMinutes: 15,
                    preferences,
                  },
                });
                toast.success("Sua solicitação foi publicada.");
                setRequestFare(null);
                refresh();
              } catch (reason) {
                setError("Não foi possível pedir a carona. Confira os dados e tente novamente.");
                if (
                  reason instanceof Error &&
                  /cotação.*expir|quote.*expired/i.test(reason.message)
                ) {
                  setRequestFare(null);
                  setRequestFareRefresh((value) => value + 1);
                }
              } finally {
                requestSubmitting.current = false;
                setBusy(false);
              }
            }}
          >
            <LocationAutocomplete
              id="home-origin"
              label="Saída"
              value={origin}
              onChange={(text, details) => {
                setOriginSource("MANUAL_ORIGIN");
                setOrigin(details?.formattedAddress || text);
                setOriginLocation(details);
              }}
              variant="simple"
              required
              placeholder="De onde você sai?"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {originSource === "CURRENT_LOCATION" && location.position
                  ? location.position.accuracy > 100
                    ? "Localização aproximada"
                    : "Localização atual"
                  : "Saída escolhida por você"}
              </span>
              <details className="relative">
                <summary className="cursor-pointer py-2 font-semibold text-foreground">
                  Opções de saída
                </summary>
                <div className="absolute right-0 z-20 w-60 rounded-lg border border-border bg-background p-1 shadow-lg">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm"
                    onClick={() => {
                      setOriginSource("CURRENT_LOCATION");
                      location.locate();
                    }}
                  >
                    <LocateFixed size={16} />
                    Usar localização atual
                  </button>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm"
                    onClick={() => {
                      setOriginSource("MANUAL_ORIGIN");
                      focusOrigin();
                    }}
                  >
                    <MapPin size={16} />
                    Digitar endereço
                  </button>
                </div>
              </details>
            </div>
            {reverseFailed && originSource === "CURRENT_LOCATION" && (
              <p role="status" className="text-xs text-muted-foreground">
                Não conseguimos identificar o endereço. Suas coordenadas estão disponíveis; você
                pode ajustar a saída.
              </p>
            )}
            <LocationAutocomplete
              id="home-destination"
              label="Destino"
              value={destination}
              onChange={(text, details) => {
                setDestination(details?.formattedAddress || text);
                setDestinationLocation(details);
              }}
              variant="simple"
              required
              placeholder="Para onde você vai?"
            />
            {recent.length > 0 && (
              <div aria-label="Destinos recentes" className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Seus destinos recentes
                </p>
                {recent.map((item) => (
                  <button
                    key={item.destination}
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDestination(item.destination);
                      setDestinationLocation(
                        item.destination_lat != null && item.destination_lng != null
                          ? {
                              rawText: item.destination,
                              lat: item.destination_lat,
                              lng: item.destination_lng,
                            }
                          : undefined,
                      );
                    }}
                  >
                    <MapPin size={16} className="shrink-0" />
                    <span className="truncate">{item.destination}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Quando pretende sair?</span>
              <button type="button" onClick={setToday} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-xs font-bold text-foreground hover:bg-primary/20">
                <CalendarDays size={15} aria-hidden="true" /> Hoje
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                Data
                <input
                  aria-label="Data da viagem"
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 h-12 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-sm font-normal sm:px-3"
                />
              </label>
              <label className="text-sm font-semibold">
                Horário
                <input
                  aria-label="Horário de saída"
                  required
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 h-12 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-sm font-normal sm:px-3"
                />
              </label>
            </div>
            {role === "request" && (
              <label className="flex min-h-12 items-center justify-between text-sm font-semibold">
                Passageiros
                <select
                  aria-label="Passageiros"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-background px-3"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            {role === "request" && (
              <RequestFarePreview
                origin={origin}
                destination={destination}
                passengerCount={Number(count)}
                onQuote={receiveRequestFare}
                refreshKey={requestFareRefresh}
              />
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {role === "request" && <JourneyPreferences kind="request" onChange={setPreferences} />}
            <Button type="submit" disabled={busy} className="min-h-14 w-full rounded-xl text-base font-bold shadow-sm">
              {busy ? "Publicando..." : role === "request" ? "Pedir carona" : "Continuar"}
              <ArrowRight size={18} />
            </Button>
          </form>
        </section>
        {/*
          <section className="mt-6 border-t border-border py-5" aria-label="Seu trajeto ativo">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
              </h2>
            </div>
            <p className="mt-3 text-sm font-medium">{active.origin}</p>
            <ArrowRight size={16} className="my-2 rotate-90 text-primary" />
            <p className="text-sm font-medium">{active.destination}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {active.ride_date.split("-").reverse().join("/")} ·{" "}
              {active.departure_time.slice(0, 5)} ·{" "}
              {active.status === "IN_PROGRESS"
                ? "Em andamento"
                : active.status === "CONFIRMED"
                  ? "Confirmada"
                  : active.status === "COMPLETED"
                    ? "Concluída"
                    : active.status === "CANCELLED"
                      ? "Cancelada"
                      : active.status === "NO_SHOW"
                        ? "Não compareceu"
                        : active.kind === "offer"
                          ? "Oferta ativa"
                          : active.status === "matched"
                            ? "Compatibilidade encontrada"
                            : "Solicitação ativa"}
            </p>
            {!activeIsCurrent && (
              <p className="mt-1 text-xs text-muted-foreground">
                Esta publicação está encerrada e não representa uma viagem ativa.
              </p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link to="/minhas-caronas" hash={`ride-${active.id}`}>
                {activeNextStep} <ArrowRight size={16} />
              </Link>
            </Button>
          </section>
        */}
      </div>
    </AppShell>
  );
}
