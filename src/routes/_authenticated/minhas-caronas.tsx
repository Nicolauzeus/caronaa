import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, CarFront, Clock3, MapPin, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createRideRequest } from "@/lib/ride-matching.functions";
import { getMyRides, type RideSummary } from "@/lib/rides.functions";
import { transitionRideStatus } from "@/lib/ride-lifecycle-service";
import type { RideStatus } from "@/lib/ride-lifecycle";

export const Route = createFileRoute("/_authenticated/minhas-caronas")({
  head: () => ({
    meta: [
      { title: "Minhas viagens — CARONAA" },
      { name: "description", content: "Acompanhe seus pedidos e caronas disponíveis." },
    ],
  }),
  component: MinhasCaronas,
});

type FormState = {
  origin: string;
  destination: string;
  date: string;
  time: string;
  seats: string;
  price: string;
  meeting: string;
  notes: string;
};
const initialForm: FormState = {
  origin: "",
  destination: "",
  date: "",
  time: "",
  seats: "1",
  price: "",
  meeting: "",
  notes: "",
};

function MinhasCaronas() {
  const publishRequest = useServerFn(createRideRequest);
  const loadMyRides = useServerFn(getMyRides);
  const [tab, setTab] = useState<"pedidos" | "disponiveis">("pedidos");
  const [form, setForm] = useState(initialForm);
  const [passengerRides, setPassengerRides] = useState<RideSummary[]>([]);
  const [driverRides, setDriverRides] = useState<RideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshRides() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadMyRides();
      setPassengerRides(data.passenger);
      setDriverRides(data.driver);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar suas viagens.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshRides();
  }, [loadMyRides]);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await publishRequest({
        data: {
          origin: form.origin,
          destination: form.destination,
          rideDate: form.date,
          departureTime: form.time,
          passengerCount: Number(form.seats),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar o pedido.");
      return;
    }
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
          <Field
            label="Origem"
            value={form.origin}
            onChange={(value) => update("origin", value)}
            placeholder="De onde você sai?"
            required
          />
          <Field
            label="Destino"
            value={form.destination}
            onChange={(value) => update("destination", value)}
            placeholder="Para onde você vai?"
            required
          />
          <div className="relative min-h-40 overflow-hidden rounded-lg border border-border bg-[#dfeadf] lg:row-span-2">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(28deg,transparent_46%,#fff_47%,#fff_49%,transparent_50%),linear-gradient(110deg,transparent_44%,#fff_45%,#fff_47%,transparent_48%)] [background-size:70px_70px]" />
            {form.origin && (
              <span className="absolute left-1/4 top-1/2 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground shadow">
                A
              </span>
            )}
            {form.destination && (
              <span className="absolute right-1/4 top-1/3 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-extrabold text-background shadow">
                B
              </span>
            )}
            {form.origin && form.destination && (
              <div className="absolute left-1/4 right-1/4 top-[45%] h-1 rotate-[-12deg] rounded-full bg-primary/80" />
            )}
            <span className="absolute bottom-2 left-2 rounded bg-white/85 px-2 py-1 text-[10px] font-bold text-foreground">
              Mapa do trajeto
            </span>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            <Field
              label="Ponto de embarque"
              value={form.meeting}
              onChange={(value) => update("meeting", value)}
              placeholder="Ex.: Praça Portugal"
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
          <Button type="submit">
            Publicar pedido <ArrowRight size={16} />
          </Button>
        </div>
      </form>
      <div className="mt-7 border-b border-border">
        <div className="flex gap-5">
          <Tab active={tab === "pedidos"} onClick={() => setTab("pedidos")}>
            Meus pedidos ({passengerRides.length})
          </Tab>
          <Tab active={tab === "disponiveis"} onClick={() => setTab("disponiveis")}>
            Minhas ofertas ({driverRides.length})
          </Tab>
        </div>
      </div>
      {loading ? (
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
            <Trip key={item.id} ride={item} onChanged={refreshRides} />
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
    matched: "Com match",
    available: "Publicada",
    full: "Lotada",
    MATCHED: "Match criado",
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

function nextActions(
  status: string,
): Array<{ label: string; status: RideStatus; variant?: "outline" }> {
  if (status === "MATCHED") {
    return [
      { label: "Confirmar", status: "CONFIRMED" },
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ];
  }

  if (status === "CONFIRMED") {
    return [
      { label: "Iniciar", status: "IN_PROGRESS" },
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ];
  }

  if (status === "IN_PROGRESS") {
    return [
      { label: "Concluir", status: "COMPLETED" },
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ];
  }

  return [];
}

function Trip({ ride, onChanged }: { ride: RideSummary; onChanged: () => Promise<void> }) {
  const [details, setDetails] = useState(false);
  const [updating, setUpdating] = useState<RideStatus | null>(null);
  const person = ride.role === "driver" ? ride.passenger : (ride.driver ?? ride.passenger);
  const name =
    ride.role === "driver" ? person?.fullName || "Passageiro" : person?.fullName || "Você";
  const actions = ride.rideId ? nextActions(ride.status) : [];

  async function updateStatus(nextStatus: RideStatus) {
    if (!ride.rideId) return;
    setUpdating(nextStatus);
    try {
      const result = await transitionRideStatus(ride.rideId, nextStatus);
      toast.success(
        result === "AWAITING_OTHER_PARTICIPANT" ? "Confirmação registrada" : "Viagem atualizada",
        {
          description:
            result === "AWAITING_OTHER_PARTICIPANT"
              ? "A conclusão será efetivada quando a outra pessoa confirmar."
              : `Novo status: ${statusLabel(String(result))}.`,
        },
      );
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a viagem.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <article className="card-interactive rounded-xl border border-border bg-card p-4 shadow-soft">
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
        <div className="mt-3 space-y-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin size={15} /> {ride.origin} → {ride.destination}
          </p>
          <p className="flex items-center gap-2">
            <UsersRound size={15} /> {ride.seatsRemaining ?? ride.seats}{" "}
            {(ride.seatsRemaining ?? ride.seats) === 1 ? "vaga" : "vagas"}
          </p>
          <p>
            <CarFront size={15} className="mr-2 inline" />
            Acompanhe aqui os detalhes da viagem.
          </p>
        </div>
      )}
      {actions.length ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {actions.map((action) => (
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
    </article>
  );
}
