import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LocateFixed, MapPin, CarFront, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { StsJourneyActivation } from "@/components/caronaa/StsJourneyActivation";
import { JourneyPreferences } from "@/components/caronaa/TravelPreferences";
import type { TravelPreferences } from "@/lib/travel-preferences";
import { getActiveHomeJourneys, getRecentHomeDestinations } from "@/lib/home.functions";
import { createRideRequest } from "@/lib/ride-matching.functions";
import type { FormLocationDetails } from "@/lib/location/types";
import { HomeRideMap } from "@/components/caronaa/HomeRideMap";
import { RequestFarePreview } from "@/components/caronaa/RequestFarePreview";
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
  const [originSource, setOriginSource] = useState<
    "CURRENT_LOCATION" | "MANUAL_ORIGIN" | "FORM_ORIGIN"
  >("CURRENT_LOCATION");
  const [resolvedAddress, setResolvedAddress] = useState<FormLocationDetails | null>(null);
  const [reverseFailed, setReverseFailed] = useState(false);
  const [formOrigin, setFormOrigin] = useState<FormLocationDetails | null>(null);
  const receiveFormOrigin = useCallback((value: FormLocationDetails) => setFormOrigin(value), []);
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
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
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
        new Date(`${active.ride_date}T${active.departure_time.slice(0, 8)}-03:00`).getTime() > Date.now()),
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

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <p className="pb-2 text-xs text-muted-foreground lg:hidden">
          Use sua localização para definir seu ponto de saída automaticamente.
        </p>
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
          className="relative -mx-4 rounded-t-2xl bg-background px-4 pt-5 sm:mx-0 sm:rounded-none sm:px-0 sm:pt-6"
        >
          <h1 id="journey-title" className="text-2xl font-extrabold sm:text-3xl">
            Para onde vamos?
          </h1>
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
            className="my-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
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
              if (requestSubmitting.current) return;
              requestSubmitting.current = true;
              setBusy(true);
              setError(null);
              try {
                await requestRide({
                  data: {
                    origin,
                    destination,
                    originLat: originLocation?.lat,
                    originLng: originLocation?.lng,
                    destinationLat: destinationLocation?.lat,
                    destinationLng: destinationLocation?.lng,
                    rideDate: date,
                    departureTime: time,
                    passengerCount: Number(count),
                    preferences,
                    idempotencyKey,
                  },
                });
                toast.success("Sua solicitação foi publicada.");
                setIdempotencyKey(crypto.randomUUID());
                refresh();
              } catch (reason) {
                setError("Não foi possível pedir a carona. Confira os dados e tente novamente.");
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
                  : originSource === "FORM_ORIGIN"
                    ? "Origem da inscrição STS"
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
                  {formOrigin && (
                    <button
                      type="button"
                      className="min-h-11 w-full px-3 text-left text-sm"
                      onClick={() => {
                        setOriginSource("FORM_ORIGIN");
                        setOrigin(formOrigin.formattedAddress || formOrigin.rawText);
                        setOriginLocation(formOrigin);
                      }}
                    >
                      Usar origem da inscrição STS
                    </button>
                  )}
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
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                Data
                <input
                  aria-label="Data da viagem"
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 font-normal"
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
                  className="mt-1 h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 font-normal"
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
              />
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {role === "request" && <JourneyPreferences kind="request" onChange={setPreferences} />}
            <Button type="submit" disabled={busy} className="min-h-12 w-full text-base font-bold">
              {busy ? "Publicando..." : role === "request" ? "Pedir carona" : "Continuar"}
              <ArrowRight size={18} />
            </Button>
          </form>
        </section>
        {active && (
          <section className="mt-6 border-t border-border py-5" aria-label="Seu trajeto ativo">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {activeIsCurrent ? "Sua carona atual" : "Sua última publicação"}
              </h2>
              {active.sts && <span className="text-xs text-muted-foreground">STS 26</span>}
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
        )}
        <StsJourneyActivation
          hasActive={Boolean(active)}
          onPublished={refresh}
          onOriginAvailable={receiveFormOrigin}
        />
      </div>
    </AppShell>
  );
}
