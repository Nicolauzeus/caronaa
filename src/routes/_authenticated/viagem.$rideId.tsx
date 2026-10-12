import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CarFront,
  Clock3,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { RideSafetyPanel } from "@/components/caronaa/RideSafetyPanel";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getMyRides, type RideSummary } from "@/lib/rides.functions";
import { getRideNextActions, type RideStatus } from "@/lib/ride-lifecycle";
import { transitionRideStatus } from "@/lib/ride-lifecycle-service";
import { formatBrl } from "@/lib/ride-cost";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/viagem/$rideId")({
  head: () => ({
    meta: [
      { title: "Acompanhar viagem — CARONAA" },
      { name: "description", content: "Embarque, navegação e resumo da sua viagem CARONAA." },
    ],
  }),
  component: ViagemOperacional,
});

function ViagemOperacional() {
  const { rideId } = Route.useParams();
  const loadRides = useServerFn(getMyRides);
  const [ride, setRide] = useState<RideSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<RideStatus | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await loadRides();
      const candidate = [...data.driver, ...data.passenger].find((item) => item.rideId === rideId);
      setRide(candidate ?? null);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar a viagem.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadRides, rideId]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 4000);
    const onUpdate = () => void refresh();
    window.addEventListener("caronaa:rides-updated", onUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("caronaa:rides-updated", onUpdate);
    };
  }, [refresh]);

  async function updateStatus(status: RideStatus) {
    if (!ride?.rideId || inFlight.current) return;
    inFlight.current = true;
    setUpdating(status);
    try {
      const result = await transitionRideStatus(ride.rideId, status);
      if (status === "CONFIRMED") {
        toast.success(
          result === "CONFIRMED" ? "Viagem confirmada" : "Você aceitou — aguardando a outra pessoa",
        );
      } else {
        toast.success(
          status === "CANCELLED" ? "Combinação recusada e vagas liberadas." : "Viagem atualizada.",
        );
      }
      await refresh();
    } catch (actionError) {
      toast.error(
        actionError instanceof Error ? actionError.message : "Não foi possível atualizar a viagem.",
      );
    } finally {
      inFlight.current = false;
      setUpdating(null);
    }
  }

  if (loading)
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Carregando viagem…</div>
      </AppShell>
    );
  if (error || !ride)
    return (
      <AppShell>
        <PageHeading
          eyebrow="VIAGEM"
          title="Viagem indisponível"
          description={error ?? "Não encontramos esta viagem entre as suas caronas."}
        />
        <Button asChild variant="outline">
          <Link to="/minhas-caronas">Voltar às minhas viagens</Link>
        </Button>
      </AppShell>
    );

  const other = ride.role === "driver" ? ride.passenger : ride.driver;
  const otherName = other?.fullName || (ride.role === "driver" ? "Passageiro" : "Motorista");
  const acceptedByViewer =
    ride.role === "driver" ? Boolean(ride.driverAcceptedAt) : Boolean(ride.passengerAcceptedAt);
  const acceptedByOther =
    ride.role === "driver" ? Boolean(ride.passengerAcceptedAt) : Boolean(ride.driverAcceptedAt);
  const actions = getRideNextActions(ride.status, ride.role, { acceptedByViewer, acceptedByOther });
  const date = new Date(`${ride.rideDate}T00:00:00`);
  const navigationTarget =
    ride.status === "IN_PROGRESS" ? ride.destination : ride.meetingPoint || ride.origin;
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navigationTarget)}`;
  const canNavigate = ride.role === "driver" && ["CONFIRMED", "IN_PROGRESS"].includes(ride.status);
  const nextActionLabel =
    ride.status === "CONFIRMED" ? "Ir buscar passageiro" : "Abrir navegação ao destino";

  return (
    <AppShell>
      <div className="mb-4">
        <Button variant="ghost" asChild>
          <Link to="/minhas-caronas">
            <ArrowLeft size={16} /> Minhas viagens
          </Link>
        </Button>
      </div>
      <PageHeading
        eyebrow={ride.role === "driver" ? "PAINEL DO MOTORISTA" : "SUA VIAGEM"}
        title={ride.status === "COMPLETED" ? "Resumo da viagem" : "Acompanhar viagem"}
        description="Informações e ações da sua combinação, visíveis apenas aos participantes."
      />
      <main className="mx-auto max-w-6xl space-y-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start lg:gap-4 lg:space-y-0">
        <section
          className="rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6 lg:col-start-2 lg:row-start-1"
          aria-label="Resumo da viagem"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays size={16} />
              {Number.isNaN(date.getTime())
                ? ride.rideDate
                : date.toLocaleDateString("pt-BR", { dateStyle: "full" })}{" "}
              · <Clock3 size={15} />
              {ride.departureTime}
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {ride.status === "CONFIRMED"
                ? "Viagem confirmada"
                : ride.status === "IN_PROGRESS"
                  ? "Em andamento"
                  : ride.status === "COMPLETED"
                    ? "Concluída"
                    : ride.status}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-base font-bold sm:text-lg">
            <span className="break-words">{ride.origin}</span>
            <ArrowRight className="text-primary" size={18} />
            <span className="break-words">{ride.destination}</span>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 shrink-0" size={16} />
              <span>
                {ride.meetingPoint ? `Embarque: ${ride.meetingPoint}` : `Embarque: ${ride.origin}`}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <UsersRound className="mt-0.5 shrink-0" size={16} />
              <span>
                {ride.seats} {ride.seats === 1 ? "pessoa" : "pessoas"}
                {ride.role === "driver" && ride.seatsRemaining != null
                  ? ` · ${ride.seatsRemaining} vagas restantes`
                  : ""}
              </span>
            </p>
            {ride.vehicleDescription && (
              <p className="flex items-center gap-2">
                <CarFront size={16} />
                {ride.vehicleDescription}
              </p>
            )}
          </div>
          {ride.pricePerPassenger != null && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm font-semibold">
                {formatBrl(ride.pricePerPassenger)} por passageiro
                {ride.seats > 1 && ride.groupTotal != null
                  ? ` · ${formatBrl(ride.groupTotal)} pelo grupo`
                  : ""}
              </p>
              {ride.routeDistanceKm != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Trecho rodoviário cotado:{" "}
                  {ride.routeDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} km
                </p>
              )}
            </div>
          )}
        </section>

        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 lg:col-start-2 lg:row-start-2"
          aria-label="Outra pessoa da viagem"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage src={other?.avatarUrl ?? undefined} alt={otherName} />
              <AvatarFallback>
                {otherName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{otherName}</p>
              {other?.verifications.length ? (
                <VerificationBadges verifications={other.verifications} compact />
              ) : (
                <p className="text-xs text-muted-foreground">Veja perfil e avaliações</p>
              )}
            </div>
          </div>
          {other?.id && ride.rideId && (
            <Button asChild size="sm" variant="outline">
              <Link
                to="/perfil-viagem/$rideId/$userId"
                params={{ rideId: ride.rideId, userId: other.id }}
              >
                Ver perfil
              </Link>
            </Button>
          )}
        </section>

        {ride.status === "MATCHED" && (
          <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 lg:col-start-2 lg:row-start-3">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={17} />
              Combinação encontrada — ainda não é uma viagem confirmada.
            </p>
            <p className="text-sm text-muted-foreground">
              {ride.role === "passenger"
                ? acceptedByViewer
                  ? "Você aceitou — aguardando o motorista confirmar."
                  : "Aceite a proposta para solicitar a confirmação do motorista."
                : acceptedByOther
                  ? acceptedByViewer
                    ? "Os dois aceitaram. Atualizando a confirmação."
                    : "O passageiro aceitou. Confirme para fechar a viagem."
                  : "Aguardando o aceite do passageiro. Você pode recusar a proposta."}
            </p>
            {ride.responseExpiresAt && (
              <p className="text-xs text-muted-foreground">
                Responda até{" "}
                {new Date(ride.responseExpiresAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {actions
                .filter((action) => action.status !== "CONFIRMED" || ride.pricePerPassenger != null)
                .map((action) => (
                  <Button
                    key={action.status}
                    variant={action.variant}
                    disabled={updating !== null}
                    onClick={() => void updateStatus(action.status)}
                  >
                    {updating === action.status ? "Enviando…" : action.label}
                  </Button>
                ))}
            </div>
          </section>
        )}

        {canNavigate && (
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-4 lg:col-start-2 lg:row-start-3">
            <p className="mb-3 text-sm text-muted-foreground">
              A navegação abre o aplicativo de mapas. A CARONAA não fornece ETA rodoviário nesta
              tela.
            </p>
            <Button asChild className="h-12 w-full sm:w-auto">
              <a href={navigationUrl} target="_blank" rel="noreferrer">
                <CarFront size={17} />
                {nextActionLabel}
              </a>
            </Button>
          </section>
        )}

        {ride.rideId && ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(ride.status) && (
          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-4">
            <RideSafetyPanel
              rideId={ride.rideId}
              role={ride.role}
              viewerUserId={ride.viewerUserId}
              status={ride.status}
              onChanged={refresh}
            />
          </div>
        )}
      </main>
    </AppShell>
  );
}
