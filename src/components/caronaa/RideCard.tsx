import { useState } from "react";
import { ArrowUpRight, Check, Clock3, MapPin, UsersRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { requestRideOffer, type RideSummary } from "@/lib/rides.functions";
import { toast } from "sonner";
import { MatchOpportunityDetails } from "./MatchOpportunityDetails";
import { calculateRequestedGroupFare, formatBrl } from "@/lib/ride-cost";

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
  segmentRequest,
  onQuoteExpired,
}: {
  ride: RideSummary;
  passengerCount?: number;
  segmentRequest?: {
    quoteId: string;
    distanceKm: number;
    pricePerPassenger: number;
    rideDate: string;
    departureTime: string;
    timeToleranceMinutes: 5 | 15 | 30 | 60;
  };
  onQuoteExpired?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adjustmentAccepted, setAdjustmentAccepted] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [reviewedSeats, setReviewedSeats] = useState<number | null>(null);
  const requestOffer = useServerFn(requestRideOffer);
  const personName = getDisplayName(ride);
  const personAvatar = ride.driver?.avatarUrl ?? ride.passenger?.avatarUrl ?? null;
  const verifications = ride.driver?.verifications ?? ride.passenger?.verifications ?? [];
  const canRequest = ride.kind === "offer" && ride.role === "available" && ride.offerId;

  async function requestRide() {
    if (
      !ride.offerId ||
      requesting ||
      requested ||
      !segmentRequest ||
      (ride.matchEvaluation?.requiresAdjustment && !adjustmentAccepted)
    )
      return;
    if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 6) {
      toast.error("Quantidade de passageiros inválida.");
      return;
    }
    if (reviewedSeats !== passengerCount) {
      setReviewedSeats(passengerCount);
      return;
    }
    setRequesting(true);
    try {
      await requestOffer({
        data: {
          acceptAdjustment: adjustmentAccepted,
          expectedPickup: ride.matchEvaluation?.pickupAt,
          offerId: ride.offerId,
          quoteId: segmentRequest.quoteId,
          rideDate: segmentRequest.rideDate,
          departureTime: segmentRequest.departureTime,
          timeToleranceMinutes: segmentRequest.timeToleranceMinutes,
          passengerCount,
        },
      });
      setRequested(true);
      setReviewedSeats(null);
      toast.success("Carona solicitada", {
        description:
          "Seu trecho e preço foram enviados. A viagem só será confirmada após os dois aceites.",
      });
    } catch (error) {
      if (error instanceof Error && /cotação.*expir|quote.*expired/i.test(error.message))
        onQuoteExpired?.();
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar a carona.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <article className="rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-card sm:p-4">
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
      <div className="relative ml-1 mt-3 grid grid-cols-[20px_minmax(0,1fr)_auto] gap-x-2 gap-y-2 before:absolute before:left-[5px] before:top-3 before:bottom-3 before:w-px before:bg-border">
        <span className="relative z-10 mt-1 size-2.5 rounded-full border-[3px] border-primary bg-card" />
        <p className="line-clamp-2 break-words text-sm font-bold">{ride.origin}</p>
        <span className="text-xs font-semibold">{ride.departureTime}</span>
        <span className="relative z-10 mt-1 size-2.5 rounded-full bg-primary" />
        <p className="line-clamp-2 break-words text-sm font-bold">{ride.destination}</p>
        <span className="text-sm text-muted-foreground">Destino</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2.5 text-xs font-medium text-muted-foreground">
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
      {ride.matchEvaluation && <MatchOpportunityDetails fit={ride.matchEvaluation} />}
      {ride.pricePerPassenger != null && ride.routeDistanceKm != null && (
        <div className="mt-2.5 border-t border-border pt-2">
          <p className="font-bold text-primary">
            {formatBrl(ride.pricePerPassenger)} por passageiro
          </p>
          <p className="text-xs text-muted-foreground">
            Percurso completo ·{" "}
            {ride.routeDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
          </p>
          <p className="text-xs text-muted-foreground">
            Seu trecho será calculado antes da confirmação.
          </p>
        </div>
      )}
      {segmentRequest && (
        <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <p className="text-xs font-semibold text-muted-foreground">
            Seu trecho cotado por estrada
          </p>
          <p className="mt-0.5 font-bold text-primary">
            {formatBrl(segmentRequest.pricePerPassenger)} por pessoa
            {passengerCount > 1
              ? ` · grupo ${formatBrl(calculateRequestedGroupFare(segmentRequest.pricePerPassenger, passengerCount))}`
              : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {segmentRequest.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km ·
            valor congelado para esta proposta
          </p>
        </div>
      )}
      {expanded && (
        <div className="mt-3 space-y-2 rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
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
      {canRequest && segmentRequest && reviewedSeats === passengerCount && !requested && (
        <div role="status" className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
          <p className="font-semibold">Confirme a quantidade antes de solicitar</p>
          <p className="mt-1">
            {passengerCount} {passengerCount === 1 ? "vaga solicitada" : "vagas solicitadas"} ·
            {" "}{formatBrl(calculateRequestedGroupFare(segmentRequest.pricePerPassenger, passengerCount))} no total.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A capacidade total do carro não será cobrada. Pressione novamente para enviar.
          </p>
        </div>
      )}
      {canRequest && segmentRequest && ride.matchEvaluation?.requiresAdjustment && (
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={adjustmentAccepted}
            onChange={(event) => setAdjustmentAccepted(event.target.checked)}
            className="mt-0.5"
          />
          Posso embarcar no horário estimado acima e aceito ajustar meu pedido para solicitar esta
          proposta.
        </label>
      )}
      <div className="mt-3 flex gap-2">
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
            disabled={
              requested ||
              requesting ||
              !segmentRequest ||
              (!!ride.matchEvaluation?.requiresAdjustment && !adjustmentAccepted)
            }
            onClick={requestRide}
          >
            {requested ? (
              <>
                <Check size={16} /> Solicitada
              </>
              ) : requesting ? (
              "Solicitando..."
            ) : !segmentRequest ? (
              "Informe trecho e horário"
            ) : reviewedSeats === passengerCount ? (
              `Confirmar ${passengerCount} ${passengerCount === 1 ? "vaga" : "vagas"}`
            ) : (
              "Revisar vagas e valor"
            )}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
