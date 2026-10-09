import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, CarFront, Clock3, MapPin, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createRideRequest } from "@/lib/ride-matching.functions";
import { getMyRides, type RideSummary } from "@/lib/rides.functions";
import { transitionRideStatus } from "@/lib/ride-lifecycle-service";
import { getRideNextActions, type RideStatus } from "@/lib/ride-lifecycle";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { RouteMap } from "@/components/caronaa/RouteMap";
import { RideSafetyPanel } from "@/components/caronaa/RideSafetyPanel";
import { RideRoutineForm, RideScheduleMode } from "@/components/caronaa/RideRoutineForm";
import { RideRoutineManager } from "@/components/caronaa/RideRoutineManager";
import type { FormLocationDetails } from "@/lib/location/types";
import {
  TimeToleranceSelector,
  type TimeToleranceMinutes,
} from "@/components/caronaa/TimeToleranceSelector";
import { formatBrl } from "@/lib/ride-cost";
import { JourneyPreferences } from "@/components/caronaa/TravelPreferences";
import type { TravelPreferences } from "@/lib/travel-preferences";
import { getMatchProposalState } from "@/lib/ride-match-acceptance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/minhas-caronas")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Minhas viagens — CARONAA" },
      { property: "og:description", content: "Acompanhe seus pedidos e caronas disponíveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Minhas viagens — CARONAA" },
      { name: "description", content: "Acompanhe seus pedidos e caronas disponíveis." },
    ],
  }),
  component: MinhasCaronas,
});

type FormState = {
  origin: string;
  destination: string;
  originLocation?: FormLocationDetails;
  destinationLocation?: FormLocationDetails;
  meetingLocation?: FormLocationDetails;
  date: string;
  time: string;
  seats: string;
  price: string;
  meeting: string;
  notes: string;
  timeTolerance: TimeToleranceMinutes;
};
const initialForm: FormState = {
  origin: "",
  destination: "",
  originLocation: undefined,
  destinationLocation: undefined,
  meetingLocation: undefined,
  date: "",
  time: "",
  seats: "1",
  price: "",
  meeting: "",
  notes: "",
  timeTolerance: 15,
};

function MinhasCaronas() {
  const { user } = useAuth();
  const publishRequest = useServerFn(createRideRequest);
  const loadMyRides = useServerFn(getMyRides);
  const [tab, setTab] = useState<"pedidos" | "disponiveis" | "rotinas">("pedidos");
  const [mode, setMode] = useState<"point" | "routine">("point");
  const [form, setForm] = useState<FormState>(initialForm);
  const [preferences, setPreferences] = useState<TravelPreferences>();
  const [passengerRides, setPassengerRides] = useState<RideSummary[]>([]);
  const [driverRides, setDriverRides] = useState<RideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const publishingRef = useRef(false);
  const hashHandled = useRef(false);

  const refreshRides = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const data = await loadMyRides();
        setPassengerRides(data.passenger);
        setDriverRides(data.driver);
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
    if (hashHandled.current || !window.location.hash.startsWith("#ride-")) return;
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
      () => document.getElementById(`ride-${targetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      150,
    );
  }, [driverRides, passengerRides]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`ride-proposals:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            notification_id?: string;
            ride_id?: string;
            event_name?: string;
          };
          if (!notification.ride_id) return;
          window.dispatchEvent(new Event("caronaa:rides-updated"));

          const eventName = notification.event_name || "MATCH_PROPOSED";
          let title = "Nova combinação encontrada";
          let description = "Abra a proposta e aceite ou recuse dentro do prazo.";
          let actionLabel = "Ver combinação";

          if (eventName === "BOTH_ACCEPTED") {
            title = "Carona confirmada por ambos!";
            description = "O acompanhamento em tempo real está liberado.";
            actionLabel = "Acompanhar";
          } else if (eventName === "DRIVER_EN_ROUTE") {
            title = "Motorista a caminho!";
            description = "O motorista iniciou o trajeto até o ponto de encontro.";
            actionLabel = "Acompanhar";
          } else if (eventName === "DRIVER_ARRIVED") {
            title = "Motorista no ponto de encontro!";
            description = "O motorista chegou. Prepare seu QR Code ou PIN para o embarque.";
            actionLabel = "Ver embarque";
          } else if (eventName === "RIDE_CANCELLED") {
            title = "Carona cancelada";
            description = "A viagem foi cancelada pelo outro participante.";
            actionLabel = "Ver detalhes";
          } else if (eventName === "RIDE_COMPLETED") {
            title = "Viagem concluída!";
            description = "A viagem foi finalizada. Registre sua avaliação.";
            actionLabel = "Avaliar";
          }

          toast.info(title, {
            description,
            action: {
              label: actionLabel,
              onClick: () => {
                if (notification.notification_id) {
                  void supabase
                    .rpc("mark_ride_notification_read", {
                      p_notification_id: notification.notification_id,
                    })
                    .then(({ error }) => {
                      if (error) toast.error("Não foi possível marcar o aviso como lido.");
                    });
                }
                window.setTimeout(
                  () =>
                    document
                      .getElementById(`ride-${notification.ride_id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  150,
                );
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const allPublications = [...passengerRides, ...driverRides].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const hasFutureDeparture = (ride: RideSummary) =>
    new Date(`${ride.rideDate}T${ride.departureTime}:00-03:00`).getTime() > Date.now();
  const currentRide =
    allPublications.find((ride) => ride.status === "IN_PROGRESS") ??
    allPublications.find((ride) => ride.status === "CONFIRMED" && hasFutureDeparture(ride)) ??
    allPublications.find((ride) => ride.status === "MATCHED" && hasFutureDeparture(ride)) ??
    allPublications.find(
      (ride) => ["open", "matched", "available", "full"].includes(ride.status) && hasFutureDeparture(ride),
    ) ??
    allPublications[0];
  const currentRideIsActive = Boolean(
    currentRide &&
      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(currentRide.status) &&
      (currentRide.status === "IN_PROGRESS" ||
        new Date(`${currentRide.rideDate}T${currentRide.departureTime}:00-03:00`).getTime() >
          Date.now()),
  );
  const currentRideAction = !currentRide
    ? ""
    : currentRide.status === "IN_PROGRESS"
      ? "Acompanhar viagem"
      : currentRide.status === "CONFIRMED"
        ? "Ver embarque e acompanhar"
        : currentRide.status === "MATCHED"
          ? currentRide.role === "driver"
            ? currentRide.driverAcceptedAt
              ? "Aguardando a outra pessoa"
              : "Ver combinação"
            : currentRide.passengerAcceptedAt
              ? "Aguardando a outra pessoa"
              : "Ver combinação"
          : currentRide.status === "COMPLETED"
            ? "Ver resumo e Pix"
            : currentRide.kind === "offer"
              ? "Ver oferta"
              : "Ver pedido";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    try {
      await publishRequest({
        data: {
          origin: form.origin,
          destination: form.destination,
          rideDate: form.date,
          departureTime: form.time,
          passengerCount: Number(form.seats),
          timeToleranceMinutes: form.timeTolerance,
          price: form.price ? Number(form.price) : undefined,
          preferences,
          idempotencyKey,
          meetingPoint: form.meeting,
          meetingLat: form.meetingLocation?.lat,
          meetingLng: form.meetingLocation?.lng,
          notes: form.notes,
          originLat: form.originLocation?.lat,
          originLng: form.originLocation?.lng,
          destinationLat: form.destinationLocation?.lat,
          destinationLng: form.destinationLocation?.lng,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar o pedido.");
      return;
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
    setIdempotencyKey(crypto.randomUUID());
    toast.success("Pedido publicado", {
      description: "Seu trajeto já está disponível para a comunidade.",
    });
    setForm(initialForm);
    void refreshRides();
  }
  const items = tab === "pedidos" ? passengerRides : driverRides;
  return (
    <AppShell>
      <PageHeading
        eyebrow="SEUS TRAJETOS"
        title="Minhas viagens"
        description="Publique um pedido e acompanhe suas conexões em um só lugar."
      />
      {currentRide && (
        <section
          aria-label="Sua carona atual"
          className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-soft"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {currentRideIsActive ? "Sua carona atual" : "Sua última publicação"}
              </p>
              <p className="mt-2 font-bold">{currentRide.origin} → {currentRide.destination}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(currentRide.rideDate)} · {currentRide.departureTime} · {statusLabel(currentRide.status)}
              </p>
              {!currentRideIsActive && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta publicação está encerrada e não representa uma viagem ativa.
                </p>
              )}
            </div>
            {currentRideAction && (
              <Button
                type="button"
                variant={currentRideAction === "Aguardando a outra pessoa" ? "outline" : "default"}
                onClick={() => {
                  setTab(currentRide.role === "driver" || currentRide.kind === "offer" ? "disponiveis" : "pedidos");
                  window.setTimeout(
                    () => document.getElementById(`ride-${currentRide.rideId ?? currentRide.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
                    150,
                  );
                }}
              >
                {currentRideAction}
              </Button>
            )}
          </div>
        </section>
      )}
      <RideScheduleMode value={mode} onChange={setMode} />
      {mode === "routine" ? (
        <RideRoutineForm
          kind="request"
          initial={{
            origin: form.origin,
            destination: form.destination,
            originLat: form.originLocation?.lat ?? null,
            originLng: form.originLocation?.lng ?? null,
            destinationLat: form.destinationLocation?.lat ?? null,
            destinationLng: form.destinationLocation?.lng ?? null,
            departureTime: form.time || "07:30",
            seats: Number(form.seats),
            timeToleranceMinutes: form.timeTolerance,
          }}
          onSaved={async () => {
            setMode("point");
            setTab("rotinas");
            await refreshRides(false);
          }}
        />
      ) : (
        <form
          onSubmit={submit}
          className="rounded-xl border border-border bg-card p-4 shadow-soft md:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Pedir carona</p>
              <p className="text-xs text-muted-foreground">
                Um mapa compartilhado orienta origem e destino.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">
              A / B
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.1fr]">
            <LocationAutocomplete
              id="pedido-origem"
              label="Origem"
              value={form.origin}
              onChange={(v, details) => {
                setForm((prev) => ({
                  ...prev,
                  origin: details?.formattedAddress || v,
                  originLocation: details,
                }));
              }}
              placeholder="De onde você sai?"
              required
              variant="simple"
            />
            <LocationAutocomplete
              id="pedido-destino"
              label="Destino"
              value={form.destination}
              onChange={(v, details) => {
                setForm((prev) => ({
                  ...prev,
                  destination: details?.formattedAddress || v,
                  destinationLocation: details,
                }));
              }}
              placeholder="Para onde você vai?"
              required
              variant="simple"
            />
            <div className="lg:row-span-2">
              <RouteMap
                origin={form.origin}
                destination={form.destination}
                originLocation={form.originLocation}
                destinationLocation={form.destinationLocation}
                heightClassName="min-h-48 h-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field
                label="Data"
                value={form.date}
                onChange={(value) => update("date", value)}
                type="date"
                required
              />
              <Field
                label="Horário"
                value={form.time}
                onChange={(value) => update("time", value)}
                type="time"
                required
              />
              <Field
                label="Lugares"
                value={form.seats}
                onChange={(value) => update("seats", value)}
                type="number"
                required
              />
              <Field
                label="Valor (R$)"
                value={form.price}
                onChange={(value) => update("price", value)}
                type="number"
                placeholder="0"
              />
            </div>
            <div className="lg:col-span-2 rounded-lg border border-border/70 bg-muted/15 p-3">
              <TimeToleranceSelector
                value={form.timeTolerance}
                onChange={(val) => setForm((prev) => ({ ...prev, timeTolerance: val }))}
                baseTime={form.time}
                label="Tolerância de horário do pedido"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <LocationAutocomplete
                id="pedido-meeting"
                label="Ponto de embarque"
                value={form.meeting}
                onChange={(value, details) =>
                  setForm((prev) => ({
                    ...prev,
                    meeting: details?.formattedAddress || value,
                    meetingLocation: details,
                  }))
                }
                placeholder="Ex.: Praça Portugal"
                variant="simple"
              />
              <label className="block text-xs font-bold text-muted-foreground">
                OBSERVAÇÕES
                <textarea
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Algum detalhe importante?"
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={publishing}>
              {publishing ? "Publicando..." : "Publicar pedido"} <ArrowRight size={16} />
            </Button>
          </div>
          <JourneyPreferences kind="request" onChange={setPreferences} />
        </form>
      )}
      <div className="mt-7 border-b border-border">
        <div className="flex flex-wrap gap-5">
          <Tab active={tab === "pedidos"} onClick={() => setTab("pedidos")}>
            Meus pedidos ({passengerRides.length})
          </Tab>
          <Tab active={tab === "disponiveis"} onClick={() => setTab("disponiveis")}>
            Minhas ofertas ({driverRides.length})
          </Tab>
          <Tab active={tab === "rotinas"} onClick={() => setTab("rotinas")}>
            Rotinas
          </Tab>
        </div>
      </div>
      {tab === "rotinas" ? (
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
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Trip key={item.id} ride={item} onChanged={() => refreshRides(false)} />
          ))}
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
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0" : undefined}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
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

function Trip({ ride, onChanged }: { ride: RideSummary; onChanged: () => Promise<void> }) {
  const [details, setDetails] = useState(false);
  const [updating, setUpdating] = useState<RideStatus | null>(null);
  const updateInFlight = useRef(false);
  const person = ride.role === "driver" ? ride.passenger : (ride.driver ?? ride.passenger);
  const name =
    ride.role === "driver" ? person?.fullName || "Passageiro" : person?.fullName || "Você";
  const acceptedByViewer =
    ride.role === "driver" ? Boolean(ride.driverAcceptedAt) : Boolean(ride.passengerAcceptedAt);
  const acceptedByOther =
    ride.role === "driver" ? Boolean(ride.passengerAcceptedAt) : Boolean(ride.driverAcceptedAt);
  const proposalState = getMatchProposalState({
    status: ride.status,
    role: ride.role === "driver" ? "driver" : "passenger",
    driverAcceptedAt: ride.driverAcceptedAt,
    passengerAcceptedAt: ride.passengerAcceptedAt,
    responseExpiresAt: ride.responseExpiresAt,
  });
  const actions = ride.rideId
    ? getRideNextActions(ride.status, ride.role, { acceptedByViewer })
    : [];

  async function updateStatus(nextStatus: RideStatus) {
    if (!ride.rideId || updateInFlight.current) return;
    updateInFlight.current = true;
    setUpdating(nextStatus);
    try {
      const result = await transitionRideStatus(ride.rideId, nextStatus);
      const waitingForOther = result === "AWAITING_OTHER_PARTICIPANT";
      toast.success(
        nextStatus === "CONFIRMED"
          ? waitingForOther
            ? "Aceite registrado"
            : "Carona confirmada pelos dois"
          : nextStatus === "CANCELLED" && ride.status === "MATCHED"
            ? "Combinação recusada"
            : "Viagem atualizada",
        {
          description: waitingForOther
            ? nextStatus === "CONFIRMED"
              ? "A combinação só fica confirmada quando a outra pessoa também aceitar."
              : "A conclusão será efetivada quando a outra pessoa confirmar."
            : nextStatus === "CANCELLED" && ride.status === "MATCHED"
              ? "As vagas foram liberadas e a busca por outra combinação foi retomada."
              : `Novo status: ${statusLabel(String(result))}.`,
        },
      );
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a viagem.");
    } finally {
      updateInFlight.current = false;
      setUpdating(null);
    }
  }

  return (
    <article
      id={`ride-${ride.rideId ?? ride.id}`}
      className="card-interactive rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        {ride.routineId ? "Recorrente" : "Pontual"}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <CalendarDays size={15} className="text-primary" />
          {formatDate(ride.rideDate)}
        </span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
          {statusLabel(ride.status)}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3 text-lg font-extrabold">
        <span>{ride.origin}</span>
        <ArrowRight size={16} className="shrink-0 text-primary" />
        <span>{ride.destination}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Clock3 size={14} /> Saída às {ride.departureTime}
      </p>

      {ride.status === "CONFIRMED" && ride.role === "passenger" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs font-medium text-primary">
          <CarFront size={14} className="shrink-0" />
          <span>Viagem confirmada! Aguardando o motorista iniciar o trajeto.</span>
        </div>
      )}

      {ride.status === "MATCHED" && (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <p>
            {proposalState === "awaiting-other-participant"
              ? "Você aceitou — aguardando a outra pessoa."
              : acceptedByOther
                ? "A outra pessoa aceitou. Falta a sua resposta."
                : "Combinação encontrada. A viagem só será confirmada após os dois aceitarem."}
          </p>
          {ride.responseExpiresAt ? (
            <p className="font-normal">
              Responda até{" "}
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                new Date(ride.responseExpiresAt),
              )}
              .
            </p>
          ) : null}
        </div>
      )}

      <div
        className="mt-3 rounded-lg border border-border/80 bg-secondary/50 p-3 text-xs space-y-1.5"
        data-testid="ride-cost-breakdown"
      >
        <div className="flex justify-between font-medium text-foreground">
          <span className="text-muted-foreground">Valor da viagem:</span>
          <span className="font-bold">{formatBrl(ride.totalPrice)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Passageiros confirmados:</span>
          <span className="font-semibold text-foreground">{ride.confirmedPassengers}</span>
        </div>
        <div className="flex justify-between font-bold text-primary pt-1.5 border-t border-border/60">
          <span>Contribuição por passageiro:</span>
          <span>{formatBrl(ride.passengerContribution)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            {person?.avatarUrl ? (
              <AvatarImage src={person.avatarUrl} alt={name} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold">
            {ride.role === "driver" ? `Passageiro: ${name}` : name}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDetails((value) => !value)}>
          {details ? "Ocultar" : "Detalhes"} <ArrowRight size={15} />
        </Button>
      </div>
      {details && (
        <div className="mt-3 space-y-3 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin size={15} /> {ride.origin} → {ride.destination}
          </p>
          <p className="flex items-center gap-2">
            <UsersRound size={15} /> {ride.seatsRemaining ?? ride.seats}{" "}
            {(ride.seatsRemaining ?? ride.seats) === 1 ? "vaga" : "vagas"}
          </p>
          {ride.vehicleDescription && <p>VeÃ­culo: {ride.vehicleDescription}</p>}
          {ride.meetingPoint && <p>Ponto de encontro/embarque: {ride.meetingPoint}</p>}
          {ride.notes && <p>ObservaÃ§Ãµes: {ride.notes}</p>}
          <RouteMap
            origin={ride.origin}
            destination={ride.destination}
            heightClassName="min-h-36"
            showRouteDetails={false}
          />
        </div>
      )}
      {actions.length ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {actions.filter((action) => action.status !== "COMPLETED").map((action) => (
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
      {ride.rideId && (
        <RideSafetyPanel
          rideId={ride.rideId}
          role={ride.role}
          viewerUserId={ride.viewerUserId}
          status={ride.status}
          onChanged={onChanged}
        />
      )}
    </article>
  );
}
