import { StrictPickupPanel } from "@/components/caronaa/StrictPickupPanel";
import { formatPickupAt } from "@/lib/intelligent-match";
import { RideOpportunities } from "@/components/caronaa/RideOpportunities";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { QuickRideTripHistory } from "@/components/caronaa/QuickRideTripHistory";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  calculateOfferRemainingPotential,
  calculateRideQuote,
} from "@/lib/ride-pricing.functions";
import { getMyRides, type RideSummary } from "@/lib/rides.functions";
import { transitionRideStatus } from "@/lib/ride-lifecycle-service";
import { getRideNextActions, type RideStatus } from "@/lib/ride-lifecycle";
import { RouteMap } from "@/components/caronaa/RouteMap";
import { RouteSuggestionPanel } from "@/components/caronaa/RouteSuggestionPanel";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { RideRoutineManager } from "@/components/caronaa/RideRoutineManager";
import { formatBrl } from "@/lib/ride-cost";
import {
  shouldRecalculateRoadEstimate,
  type RoadEstimateLocation,
} from "@/lib/ride-potential";
import { compareRideRecency } from "@/lib/ride-order";

export const Route = createFileRoute("/_authenticated/minhas-caronas")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Minhas viagens — CARONAA" },
      {
        property: "og:description",
        content: "Acompanhe seus pedidos e caronas disponíveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Minhas viagens — CARONAA" },
      {
        name: "description",
        content: "Acompanhe seus pedidos e caronas disponíveis.",
      },
    ],
  }),
  component: MinhasCaronas,
});

function MinhasCaronas() {
  const loadMyRides = useServerFn(getMyRides);
  const [tab, setTab] = useState<"pedidos" | "disponiveis" | "rotinas" | "flash">(
    "pedidos",
  );
  const [passengerRides, setPassengerRides] = useState<RideSummary[]>([]);
  const [driverRides, setDriverRides] = useState<RideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hashHandled = useRef(false);
  const initialTabSelected = useRef(false);

  const refreshRides = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const data = await loadMyRides();
        setPassengerRides(data.passenger);
        setDriverRides(data.driver);
        if (!initialTabSelected.current) {
          initialTabSelected.current = true;
          if (data.driver.length > 0 && data.passenger.length === 0)
            setTab("disponiveis");
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar suas viagens.",
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [loadMyRides],
  );

  useEffect(() => {
    void refreshRides();

    // Revalidação em foco/visibilidade da janela
    const onFocus = () => void refreshRides(false);
    window.addEventListener("caronaa:rides-updated", onFocus);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // Polling leve periódico como fallback caso o websocket esteja desconectado
    const interval = setInterval(() => {
      void refreshRides(false);
    }, 4000);

    return () => {
      window.removeEventListener("caronaa:rides-updated", onFocus);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(interval);
    };
  }, [refreshRides]);

  useEffect(() => {
    if (hashHandled.current || !window.location.hash.startsWith("#ride-"))
      return;
    const targetId = window.location.hash.slice("#ride-".length);
    const isDriverRide = driverRides.some(
      (ride) => ride.id === targetId || ride.rideId === targetId,
    );
    const isPassengerRide = passengerRides.some(
      (ride) => ride.id === targetId || ride.rideId === targetId,
    );
    if (!isDriverRide && !isPassengerRide) return;
    hashHandled.current = true;
    setTab(isDriverRide ? "disponiveis" : "pedidos");
    window.setTimeout(
      () =>
        document
          .getElementById(`ride-${targetId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      150,
    );
  }, [driverRides, passengerRides]);

  const allPublications = [...passengerRides, ...driverRides].sort(
    compareRideRecency,
  );
  const hasFutureDeparture = (ride: RideSummary) =>
    new Date(`${ride.rideDate}T${ride.departureTime}:00-03:00`).getTime() >
    Date.now();
  const currentRide =
    allPublications.find((ride) => ride.status === "IN_PROGRESS") ??
    allPublications.find(
      (ride) => ride.status === "CONFIRMED" && hasFutureDeparture(ride),
    ) ??
    allPublications.find(
      (ride) => ride.status === "MATCHED" && hasFutureDeparture(ride),
    ) ??
    allPublications.find(
      (ride) =>
        ["open", "matched", "available", "full"].includes(ride.status) &&
        hasFutureDeparture(ride),
    ) ??
    allPublications[0];
  const currentRideIsActive = Boolean(
    currentRide &&
    !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(currentRide.status) &&
    (currentRide.status === "IN_PROGRESS" ||
      new Date(
        `${currentRide.rideDate}T${currentRide.departureTime}:00-03:00`,
      ).getTime() > Date.now()),
  );
  const currentRideAction = !currentRide
    ? ""
    : currentRide.status === "IN_PROGRESS"
      ? "Acompanhar viagem"
      : currentRide.status === "CONFIRMED"
        ? "Ver embarque e acompanhar"
        : currentRide.status === "MATCHED"
          ? currentRide.role === "driver"
            ? currentRide.passengerAcceptedAt
              ? currentRide.driverAcceptedAt
                ? "Aguardando confirmação da viagem"
                : "Confirmar passageiro"
              : "Aguardando aceite do passageiro"
            : currentRide.passengerAcceptedAt
              ? "Aguardando confirmação do motorista"
              : "Aceitar combinação"
          : currentRide.status === "COMPLETED"
            ? "Ver resumo e Pix"
            : currentRide.kind === "offer"
              ? "Ver oferta"
              : "Ver pedido";
  const currentRideHasOperationScreen = Boolean(
    currentRide?.rideId &&
    ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(currentRide.status),
  );

  function focusCurrentRide() {
    if (!currentRide) return;
    setTab(
      currentRide.role === "driver" || currentRide.kind === "offer"
        ? "disponiveis"
        : "pedidos",
    );
    window.setTimeout(
      () =>
        document
          .getElementById(`ride-${currentRide.rideId ?? currentRide.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      150,
    );
  }

  const items = tab === "pedidos" ? passengerRides : driverRides;
  const activeItems = items.filter((ride) =>
    [
      "open",
      "available",
      "full",
      "matched",
      "MATCHED",
      "CONFIRMED",
      "IN_PROGRESS",
    ].includes(ride.status),
  );
  const historyItems = items.filter((ride) => !activeItems.includes(ride));
  const groupByOffer = (rides: RideSummary[]) => {
    const groups = new Map<string, RideSummary[]>();
    for (const ride of rides) {
      const key = ride.offerId ?? `ride:${ride.id}`;
      groups.set(key, [...(groups.get(key) ?? []), ride]);
    }
    return [...groups.values()].sort((left, right) =>
      compareRideRecency(left[0], right[0]),
    );
  };
  const activeOfferGroups =
    tab === "disponiveis" ? groupByOffer(activeItems) : [];
  const historyOfferGroups =
    tab === "disponiveis" ? groupByOffer(historyItems) : [];
  return (
    <AppShell>
      <PageHeading
        eyebrow="SEUS TRAJETOS"
        title="Minhas viagens"
        description="Pedidos, corridas rápidas, reservas e histórico em um só lugar."
      />
      {currentRide && tab !== "flash" && (
        <section
          aria-label="Sua carona atual"
          className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-soft"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {currentRideIsActive
                  ? "Sua carona atual"
                  : "Sua última publicação"}
              </p>
              <p className="mt-2 font-bold">
                {currentRide.origin} → {currentRide.destination}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(currentRide.rideDate)} · {currentRide.departureTime}{" "}
                · {statusLabel(currentRide.status)}
              </p>
              {!currentRideIsActive && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta publicação está encerrada e não representa uma viagem
                  ativa.
                </p>
              )}
            </div>
            {currentRide?.status === "MATCHED" &&
            currentRide.role === "driver" &&
            currentRide.offerId ? (
              <Button asChild>
                <Link
                  to="/minha-carona/$offerId"
                  params={{ offerId: currentRide.offerId }}
                >
                  Ver solicitações <ArrowRight size={16} />
                </Link>
              </Button>
            ) : currentRideAction && currentRideHasOperationScreen ? (
              <Button asChild>
                <Link
                  to="/viagem/$rideId"
                  params={{ rideId: currentRide.rideId! }}
                >
                  {currentRideAction} <ArrowRight size={16} />
                </Link>
              </Button>
            ) : currentRideAction ? (
              <Button
                type="button"
                variant={
                  currentRideAction.startsWith("Aguardando")
                    ? "outline"
                    : "default"
                }
                onClick={focusCurrentRide}
              >
                {currentRideAction} <ArrowRight size={16} />
              </Button>
            ) : null}
          </div>
        </section>
      )}
      <section
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
        aria-label="Criar outra publicação"
      >
        <p className="text-sm text-muted-foreground">
          Sua próxima viagem e suas solicitações ficam em primeiro plano.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/oferecer">
              <Plus size={16} /> Oferecer outra carona
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/home">Pedir carona</Link>
          </Button>
        </div>
      </section>
      <div className="mt-7 border-b border-border">
        <div role="tablist" aria-label="Categorias de viagens" className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] sm:gap-5">
          <Tab active={tab === "pedidos"} onClick={() => setTab("pedidos")}>
            Meus pedidos ({passengerRides.length})
          </Tab>
          <Tab
            active={tab === "disponiveis"}
            onClick={() => setTab("disponiveis")}
          >
            Minhas ofertas ({driverRides.length})
          </Tab>
          <Tab active={tab === "rotinas"} onClick={() => setTab("rotinas")}>
            Rotinas
          </Tab>
          <Tab active={tab === "flash"} onClick={() => setTab("flash")}>
            Corridas Rápidas
          </Tab>
        </div>
      </div>
      {tab !== "rotinas" && tab !== "flash" && (
        <RideOpportunities
          role={tab === "disponiveis" ? "driver" : "passenger"}
        />
      )}
      {tab === "flash" ? (
        <QuickRideTripHistory />
      ) : tab === "rotinas" ? (
        <RideRoutineManager onChanged={() => refreshRides(false)} />
      ) : loading ? (
        <div className="mt-5 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando suas viagens...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : items.length ? (
        <div className="mt-5 space-y-6">
          <section aria-label="Publicações ativas">
            <h2 className="mb-2 text-sm font-bold">
              {tab === "disponiveis"
                ? "Ofertas ativas"
                : "Ativas e aguardando combinação"}{" "}
              (
              {tab === "disponiveis"
                ? activeOfferGroups.length
                : activeItems.length}
              )
            </h2>
            {activeItems.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {tab === "disponiveis"
                  ? activeOfferGroups.map((group) => (
                      <DriverOfferSummary
                        key={group[0].offerId ?? group[0].id}
                        rides={group}
                      />
                    ))
                  : activeItems.map((item) => (
                      <Trip
                        key={item.id}
                        ride={item}
                        onChanged={() => refreshRides(false)}
                      />
                    ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhuma publicação ativa. Seus pedidos abertos após cancelamento
                aparecem aqui novamente.
              </p>
            )}
          </section>
          {historyItems.length ? (
            <details className="rounded-lg border border-border bg-card p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Histórico (
                {tab === "disponiveis"
                  ? historyOfferGroups.length
                  : historyItems.length}
                )
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {tab === "disponiveis"
                  ? historyOfferGroups.map((group) => (
                      <DriverOfferSummary
                        key={group[0].offerId ?? group[0].id}
                        rides={group}
                      />
                    ))
                  : historyItems.map((item) => (
                      <Trip
                        key={item.id}
                        ride={item}
                        onChanged={() => refreshRides(false)}
                      />
                    ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-bold">
            {tab === "pedidos"
              ? "Você ainda não tem pedidos de carona."
              : "Você ainda não publicou ofertas de carona."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "pedidos"
              ? "Publique um pedido ou explore caronas disponíveis."
              : "Ofereça uma carona para aparecer nesta lista."}
          </p>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to="/buscar">
            Explorar caronas <ArrowRight size={15} />
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-1 pb-3 text-sm font-bold ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}

function DriverOfferSummary({ rides }: { rides: RideSummary[] }) {
  const offer = rides.find((ride) => ride.kind === "offer") ?? rides[0];
  const proposals = rides.filter(
    (ride) => ride.rideId && ride.status === "MATCHED",
  );
  const waitingDriver = proposals.filter(
    (ride) => ride.passengerAcceptedAt && !ride.driverAcceptedAt,
  ).length;
  const waitingPassenger = proposals.length - waitingDriver;
  const confirmed = rides.filter((ride) =>
    ["CONFIRMED", "IN_PROGRESS"].includes(ride.status),
  );
  const confirmedTotal =
    rides.find((ride) => ride.driverConfirmedTotal != null)
      ?.driverConfirmedTotal ?? 0;
  if (!offer.offerId) {
    return <Trip ride={offer} onChanged={async () => undefined} />;
  }
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-muted-foreground">
          {formatDate(offer.rideDate)} · {offer.departureTime}
        </span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
          {statusLabel(offer.status)}
        </span>
      </div>
      <h3 className="mt-3 font-semibold">
        {offer.origin} → {offer.destination}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-secondary px-2.5 py-1">
          {offer.seatsRemaining ?? offer.seats} vagas livres
        </span>
        {waitingPassenger > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">
            {waitingPassenger} aguardando passageiro
          </span>
        )}
        {waitingDriver > 0 && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            {waitingDriver} aguardando você
          </span>
        )}
        {confirmed.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700">
            {confirmed.length} confirmada(s)
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Valor combinado com passageiros:{" "}
        <strong className="text-foreground">{formatBrl(confirmedTotal)}</strong>{" "}
        · não representa pagamento recebido.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Recebido: não verificável automaticamente sem integração de confirmação
        do pagamento.
      </p>
      <RemainingPotential
        offerId={offer.offerId}
        freeSeats={offer.seatsRemaining ?? 0}
      />
      {proposals.length > 0 ? (
        <RouteSuggestionPanel offerId={offer.offerId} />
      ) : null}
      <Button asChild className="mt-4 w-full sm:w-auto">
        <Link to="/minha-carona/$offerId" params={{ offerId: offer.offerId }}>
          {waitingDriver
            ? "Confirmar passageiro"
            : proposals.length
              ? "Ver solicitações"
              : confirmed.length
                ? "Acompanhar viagem"
                : "Gerenciar carona"}
          <ArrowRight size={15} />
        </Link>
      </Button>
    </article>
  );
}

type RemainingPotentialQuote = {
  distanceKm: number;
  freeSeats: number;
  pricePerPassenger: number;
  potentialTotal: number;
  calculatedAt: string;
};

function RemainingPotential({
  offerId,
  freeSeats,
}: {
  offerId: string;
  freeSeats: number;
}) {
  const calculate = useServerFn(calculateOfferRemainingPotential);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [estimate, setEstimate] = useState<RemainingPotentialQuote | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const watchId = useRef<number | null>(null);
  const inFlight = useRef(false);
  const lastSent = useRef<RoadEstimateLocation | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (!document.hidden || watchId.current === null) return;
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setSharingLocation(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  function stopLocationUpdates() {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    setSharingLocation(false);
  }

  function startLocationUpdates() {
    if (!navigator.geolocation) {
      setError("Este navegador não disponibiliza localização.");
      return;
    }
    setError(null);
    setSharingLocation(true);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const current: RoadEstimateLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: Date.now(),
        };
        if (current.accuracy > 200) {
          setError(
            "A localização está imprecisa. A última estimativa foi mantida.",
          );
          return;
        }
        // Recalculate a new road route after a meaningful movement and a
        // minimum interval; GPS jitter is never accumulated as trip distance.
        if (
          inFlight.current ||
          !shouldRecalculateRoadEstimate(lastSent.current, current)
        ) {
          return;
        }
        // Throttle failed as well as successful route calls to avoid repeatedly
        // sending the same precise location if the routing service is down.
        lastSent.current = current;
        inFlight.current = true;
        setError(null);
        void calculate({
          data: {
            offerId,
            latitude: current.latitude,
            longitude: current.longitude,
          },
        })
          .then((result) => {
            setEstimate(result);
          })
          .catch((reason) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Não foi possível atualizar a estimativa; a última foi mantida.",
            );
          })
          .finally(() => {
            inFlight.current = false;
          });
      },
      (reason) => {
        setError(
          reason.code === reason.PERMISSION_DENIED
            ? "Localização não autorizada. A última estimativa foi mantida."
            : "Não foi possível obter a localização. A última estimativa foi mantida.",
        );
        stopLocationUpdates();
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    );
  }

  const stale = !estimate || now - Date.parse(estimate.calculatedAt) > 120_000;
  const potential =
    Math.round((estimate?.pricePerPassenger ?? 0) * freeSeats * 100) / 100;

  return (
    <section
      className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
      aria-label="Potencial adicional nas vagas livres"
    >
      <p className="text-xs font-semibold">
        Potencial adicional nas vagas livres
      </p>
      {estimate ? (
        <p className="mt-1 text-sm">
          {freeSeats} vaga(s) livre(s) ·{" "}
          {estimate.distanceKm.toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })}{" "}
          km restantes · até <strong>{formatBrl(potential)}</strong>
          <span className="block text-xs text-muted-foreground">
            Estimativa pela rota rodoviária ·{" "}
            {stale ? "última posição desatualizada" : "posição atualizada"} ·
            não é valor combinado nem recebido.
          </span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Autorize a localização para estimar o percurso rodoviário restante e o
          potencial das vagas livres.
        </p>
      )}
      {error && (
        <p role="status" className="mt-1 text-xs text-amber-700">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={sharingLocation ? stopLocationUpdates : startLocationUpdates}
      >
        {sharingLocation
          ? "Parar atualização"
          : estimate
            ? "Atualizar com localização"
            : "Autorizar localização"}
      </Button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Enquanto ativada, as coordenadas são enviadas ao Google Maps para
        calcular a rota. A CARONAA não as armazena; atualizações param quando
        esta tela fica em segundo plano.
      </p>
      {freeSeats > 0 && (
        <p className="mt-2 text-xs font-medium text-primary">
          Ainda há {freeSeats} vaga(s) livres. Compartilhe sua oferta para mais
          pessoas encontrarem esse trajeto.
        </p>
      )}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Aberto",
    matched: "Match criado",
    available: "Publicada",
    full: "Lotada",
    MATCHED: "Combinação encontrada",
    AWAITING_OTHER_PARTICIPANT: "Aguardando confirmação",
    CONFIRMED: "Confirmada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
    NO_SHOW: "Não compareceu",
  };
  return labels[status] ?? status;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "CA"
  );
}

function Trip({
  ride,
  onChanged,
}: {
  ride: RideSummary;
  onChanged: () => Promise<void>;
}) {
  const [details, setDetails] = useState(false);
  const [updating, setUpdating] = useState<RideStatus | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteRide = useServerFn(calculateRideQuote);
  const autoQuoteAttempted = useRef<string | null>(null);
  const quoteDependencies = useRef({ quoteRide, onChanged });
  quoteDependencies.current = { quoteRide, onChanged };
  useEffect(() => {
    if (
      ride.status !== "MATCHED" ||
      !ride.rideId ||
      ride.routeDistanceKm != null ||
      autoQuoteAttempted.current === ride.rideId
    )
      return;
    autoQuoteAttempted.current = ride.rideId;
    let active = true;
    setQuoting(true);
    void quoteDependencies.current
      .quoteRide({ data: { rideId: ride.rideId } })
      .then(async () => {
        if (active) await quoteDependencies.current.onChanged();
      })
      .catch((error) => {
        if (active)
          setQuoteError(
            error instanceof Error
              ? error.message
              : "Não foi possível calcular o preço.",
          );
      })
      .finally(() => {
        if (active) setQuoting(false);
      });
    return () => {
      active = false;
    };
  }, [ride.rideId, ride.status, ride.routeDistanceKm]);
  const updateInFlight = useRef(false);
  const person =
    ride.role === "driver" ? ride.passenger : (ride.driver ?? ride.passenger);
  const name =
    ride.role === "driver"
      ? person?.fullName || "Passageiro"
      : person?.fullName || "Você";
  const acceptedByViewer =
    ride.role === "driver"
      ? Boolean(ride.driverAcceptedAt)
      : Boolean(ride.passengerAcceptedAt);
  const acceptedByOther =
    ride.role === "driver"
      ? Boolean(ride.passengerAcceptedAt)
      : Boolean(ride.driverAcceptedAt);
  const actions = ride.rideId
    ? getRideNextActions(ride.status, ride.role, {
        acceptedByViewer,
        acceptedByOther,
      })
    : [];

  async function updateStatus(nextStatus: RideStatus) {
    if (!ride.rideId || updateInFlight.current) return;
    updateInFlight.current = true;
    setUpdating(nextStatus);
    try {
      const result = await transitionRideStatus(ride.rideId, nextStatus);
      const waitingForOther = result === "AWAITING_OTHER_PARTICIPANT";
      if (result !== "CONFIRMED") {
        toast.success(
          nextStatus === "CONFIRMED"
            ? "Aceite registrado"
            : nextStatus === "CANCELLED" && ride.status === "MATCHED"
              ? "Combinação recusada"
              : "Viagem atualizada",
          {
            description: waitingForOther
              ? nextStatus === "CONFIRMED"
                ? ride.role === "passenger"
                  ? "O motorista foi notificado e precisa confirmar a combinação."
                  : "A combinação só fica confirmada após o aceite do passageiro."
                : "A conclusão será efetivada quando a outra pessoa confirmar."
              : nextStatus === "CANCELLED" && ride.status === "MATCHED"
                ? "As vagas foram liberadas e a busca por outra combinação foi retomada."
                : `Novo status: ${statusLabel(String(result))}.`,
          },
        );
      }
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a viagem.",
      );
    } finally {
      updateInFlight.current = false;
      setUpdating(null);
    }
  }

  async function calculateQuote() {
    if (!ride.rideId || quoting) return;
    setQuoting(true);
    setQuoteError(null);
    try {
      await quoteRide({ data: { rideId: ride.rideId } });
      toast.success("Preço do trecho calculado.");
      await onChanged();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível calcular o preço.";
      setQuoteError(message);
      toast.error(message);
    } finally {
      setQuoting(false);
    }
  }

  return (
    <article
      id={`ride-${ride.rideId ?? ride.id}`}
      className="card-interactive rounded-xl border border-border bg-card p-3 shadow-soft sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <CalendarDays size={15} className="text-primary" />
          {formatDate(ride.rideDate)}
        </span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
          {statusLabel(ride.status)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-bold leading-snug sm:text-base">
        <span className="line-clamp-2 break-words">{ride.origin}</span>
        <ArrowRight size={16} className="shrink-0 text-primary" />
        <span className="line-clamp-2 break-words">{ride.destination}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 size={14} />{" "}
        {ride.pickupEstimatedAt
          ? `Embarque estimado: ${formatPickupAt(ride.pickupEstimatedAt)}`
          : `Saída às ${ride.departureTime}`}
      </p>

      {ride.status === "MATCHED" && (
        <div className="mt-2 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <p>
            {ride.role === "passenger"
              ? acceptedByViewer
                ? "Você aceitou — aguardando confirmação do motorista."
                : "Combinação encontrada. Aceite para solicitar a confirmação do motorista."
              : acceptedByViewer
                ? "Você confirmou — aguardando a atualização da viagem."
                : acceptedByOther
                  ? "O passageiro aceitou. Confirme para fechar a viagem."
                  : "Aguardando o aceite do passageiro. Você poderá confirmar em seguida."}
          </p>
          {ride.responseExpiresAt ? (
            <p className="font-normal">
              Responda até{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(ride.responseExpiresAt))}
              .
            </p>
          ) : null}
        </div>
      )}

      {ride.pricePerPassenger != null &&
      ride.groupTotal != null &&
      ride.routeDistanceKm != null ? (
        <div
          className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs space-y-1"
          data-testid="ride-cost-breakdown"
        >
          <div className="flex justify-between text-muted-foreground">
            <span>Distância rodoviária do trecho:</span>
            <span className="font-semibold text-foreground">
              {ride.routeDistanceKm.toLocaleString("pt-BR", {
                maximumFractionDigits: 3,
              })}{" "}
              km
            </span>
          </div>
          <div className="flex justify-between font-bold text-primary">
            <span>Preço por passageiro:</span>
            <span>{formatBrl(ride.pricePerPassenger)}</span>
          </div>
          {ride.seats > 1 && (
            <div className="flex justify-between font-medium text-foreground">
              <span>Total do grupo ({ride.seats} pessoas):</span>
              <span>{formatBrl(ride.groupTotal)}</span>
            </div>
          )}
          {ride.role === "driver" && ride.driverConfirmedTotal != null && (
            <div className="flex justify-between border-t border-border/60 pt-1.5 font-semibold text-foreground">
              <span>Total previsto confirmado para o motorista:</span>
              <span>{formatBrl(ride.driverConfirmedTotal)}</span>
            </div>
          )}
          <p className="border-t border-border/60 pt-1.5 text-muted-foreground">
            Tarifa calculada proporcionalmente ao percurso.
          </p>
        </div>
      ) : ride.status === "MATCHED" ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
          <p>
            {quoteError || "Calculando automaticamente o preço do seu trecho…"}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            variant="outline"
            disabled={quoting}
            onClick={() => void calculateQuote()}
          >
            {quoting ? "Calculando percurso…" : "Tentar novamente"}
          </Button>
        </div>
      ) : ride.status !== "CANCELLED" && ride.status !== "NO_SHOW" ? (
        <div
          className="mt-3 rounded-lg border border-border/80 bg-secondary/50 p-3 text-xs space-y-1.5"
          data-testid="ride-cost-breakdown"
        >
          <div className="flex justify-between text-muted-foreground">
            <span>Preço histórico por passageiro:</span>
            <span className="font-bold text-foreground">
              {formatBrl(ride.passengerContribution)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        {person?.id && ride.rideId ? (
          <Link
            to="/perfil-viagem/$rideId/$userId"
            params={{ rideId: ride.rideId, userId: person.id }}
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver perfil de ${name}`}
          >
            <Avatar className="size-8 shrink-0">
              {person.avatarUrl ? (
                <AvatarImage
                  src={person.avatarUrl}
                  alt={name}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="text-xs">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block max-w-44 truncate text-xs font-semibold sm:text-sm">
                {ride.role === "driver" ? `Passageiro: ${name}` : name}
              </span>
              {person.verifications.length ? (
                <VerificationBadges
                  verifications={person.verifications}
                  compact
                />
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Ver perfil e avaliações
                </span>
              )}
            </span>
          </Link>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {name}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-xs"
          onClick={() => setDetails((value) => !value)}
        >
          {details ? "Fechar" : "Detalhes"} <ArrowRight size={14} />
        </Button>
      </div>
      {ride.rideId && ["MATCHED", "CONFIRMED"].includes(ride.status) && (
        <StrictPickupPanel rideId={ride.rideId} />
      )}
      {details && (
        <div className="mt-3 space-y-3 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin size={15} /> {ride.origin} → {ride.destination}
          </p>
          <p className="flex items-center gap-2">
            <UsersRound size={15} /> {ride.seatsRemaining ?? ride.seats}{" "}
            {(ride.seatsRemaining ?? ride.seats) === 1 ? "vaga" : "vagas"}
          </p>
          {ride.vehicleDescription && (
            <p>VeÃ­culo: {ride.vehicleDescription}</p>
          )}
          {ride.meetingPoint && (
            <p>Ponto de encontro/embarque: {ride.meetingPoint}</p>
          )}
          {ride.notes && <p>ObservaÃ§Ãµes: {ride.notes}</p>}
          <RouteMap
            origin={ride.origin}
            destination={ride.destination}
            heightClassName="min-h-36"
            showRouteDetails={false}
          />
        </div>
      )}
      {ride.status === "MATCHED" && actions.length ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {actions
            .filter(
              (action) =>
                action.status !== "COMPLETED" &&
                !(
                  ride.status === "MATCHED" &&
                  ride.pricePerPassenger == null &&
                  action.status === "CONFIRMED"
                ),
            )
            .map((action) => (
              <Button
                key={action.status}
                type="button"
                size="sm"
                variant={action.variant}
                disabled={updating !== null}
                onClick={() => void updateStatus(action.status)}
              >
                {updating === action.status ? "Atualizando..." : action.label}
              </Button>
            ))}
        </div>
      ) : null}
      {ride.rideId &&
      ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(ride.status) ? (
        <div className="mt-3 border-t border-border pt-3">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/viagem/$rideId" params={{ rideId: ride.rideId }}>
              {ride.status === "COMPLETED"
                ? "Ver resumo e Pix"
                : "Acompanhar viagem"}
              <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}

