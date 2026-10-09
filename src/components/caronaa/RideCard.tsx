import { useState } from "react";
import { ArrowUpRight, Check, Clock3, MapPin, UsersRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { requestRideOffer, type RideSummary } from "@/lib/rides.functions";
import { toast } from "sonner";
import { formatBrl } from "@/lib/ride-cost";

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDisplayName(ride: RideSummary) {
  const profile = ride.driver ?? ride.passenger;
  return profile?.fullName?.trim() || "Usuário CARONAA";
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "CA";
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    available: "Disponível",
    full: "Lotada",
    open: "Aberto",
    matched: "Com match",
    MATCHED: "Combinação encontrada",
    CONFIRMED: "Confirmada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
    NO_SHOW: "Não compareceu",
  };

  return labels[status] ?? status;
}

export function RideCard({
  ride,
  passengerCount = 1,
}: {
  ride: RideSummary;
  passengerCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const requestOffer = useServerFn(requestRideOffer);
  const personName = getDisplayName(ride);
  const personAvatar = ride.driver?.avatarUrl ?? ride.passenger?.avatarUrl ?? null;
  const verifications = ride.driver?.verifications ?? ride.passenger?.verifications ?? [];
  const canRequest = ride.kind === "offer" && ride.role === "available" && ride.offerId;

  async function requestRide() {
    if (!ride.offerId) return;
    setRequesting(true);
    try {
      await requestOffer({ data: { offerId: ride.offerId, passengerCount } });
      setRequested(true);
      toast.success("Carona solicitada", {
        description: "Seu pedido foi registrado e o matching será atualizado automaticamente.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar a carona.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <article className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-card md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11 shrink-0">
            {personAvatar ? (
              <AvatarImage src={personAvatar} alt={personName} className="object-cover" />
            ) : null}
            <AvatarFallback>{getInitials(personName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{personName}</p>
            <VerificationBadges verifications={verifications} compact />
          </div>
        </div>
        <span className="shrink-0 rounded-sm bg-secondary px-2 py-1 text-[11px] font-semibold text-primary">
          {getStatusLabel(ride.status)}
        </span>
      </div>
      <div className="relative ml-1 mt-6 grid grid-cols-[20px_1fr_auto] gap-x-2 gap-y-4 before:absolute before:left-[5px] before:top-4 before:bottom-4 before:w-px before:bg-border">
        <span className="relative z-10 mt-1 size-2.5 rounded-full border-[3px] border-primary bg-card" />
        <p className="font-bold">{ride.origin}</p>
        <span className="font-bold">{ride.departureTime}</span>
        <span className="relative z-10 mt-1 size-2.5 rounded-full bg-primary" />
        <p className="font-bold">{ride.destination}</p>
        <span className="text-sm text-muted-foreground">Destino</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
        {ride.scheduleType && (
          <span>{ride.scheduleType === "routine" ? "Recorrente" : "Pontual"}</span>
        )}
        <span className="flex items-center gap-1.5">
          <Clock3 size={14} />
          {formatDate(ride.rideDate)}
        </span>
        <span className="flex items-center gap-1.5">
          <UsersRound size={14} />
          {ride.seatsRemaining ?? ride.seats}{" "}
          {(ride.seatsRemaining ?? ride.seats) === 1 ? "vaga" : "vagas"}
        </span>
        {typeof ride.matchScore === "number" && (
          <span className="font-semibold text-primary">Adequação {ride.matchScore}/100</span>
        )}
      </div>
      {ride.pricePerPassenger != null && ride.routeDistanceKm != null && <div className="mt-4 border-t border-border pt-3">
        <p className="font-bold text-primary">{formatBrl(ride.pricePerPassenger)} por passageiro</p>
        <p className="text-xs text-muted-foreground">Percurso completo · {ride.routeDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km</p>
        <p className="text-xs text-muted-foreground">Seu trecho será calculado antes da confirmação.</p>
      </div>}
      {expanded && (
        <div className="mt-4 space-y-2 rounded-md bg-secondary p-4 text-sm text-secondary-foreground">
          <p className="flex items-center gap-2">
            <MapPin size={15} /> {ride.origin} → {ride.destination}
          </p>
          <p>Status: {getStatusLabel(ride.status)}</p>
          {typeof ride.matchScore === "number" && (
            <p>
              Adequação estimada: {ride.matchScore}/100. É um critério de ordenação, não uma
              probabilidade de sucesso.
            </p>
          )}
          {ride.matchReasons?.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {ride.matchReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 flex-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          <ArrowUpRight size={15} />
        </Button>
        {canRequest ? (
          <Button
            type="button"
            className="h-10 flex-1"
            disabled={requested || requesting}
            onClick={requestRide}
          >
            {requested ? (
              <>
                <Check size={16} /> Solicitada
              </>
            ) : requesting ? (
              "Solicitando..."
            ) : (
              "Solicitar carona"
            )}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
