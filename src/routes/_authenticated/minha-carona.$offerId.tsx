import { formatPickupAt } from "@/lib/intelligent-match";
import { RideOpportunities } from "@/components/caronaa/RideOpportunities";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { getMyRides, getRideParticipantProfile, type RideSummary } from "@/lib/rides.functions";
import { calculateRideQuote } from "@/lib/ride-pricing.functions";
import { transitionRideStatus } from "@/lib/ride-lifecycle-service";
import { formatBrl } from "@/lib/ride-cost";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/minha-carona/$offerId")({
  head: () => ({
    meta: [
      { title: "Gerenciar carona — CARONAA" },
      { name: "description", content: "Gerencie solicitações e passageiros da sua oferta." },
      { property: "og:title", content: "Gerenciar carona — CARONAA" },
      { property: "og:description", content: "Consulte seu percurso, veículo e passageiros da oferta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GerenciarOferta,
});

function GerenciarOferta() {
  const { offerId } = Route.useParams();
  const loadRides = useServerFn(getMyRides);
  const [items, setItems] = useState<RideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await loadRides();
      const matchingOffer = result.driver.filter(
        (ride) => ride.offerId === offerId && ride.role === "driver",
      );
      if (!matchingOffer.length) throw new Error("Carona não encontrada entre as suas ofertas.");
      setItems(matchingOffer);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar esta carona.");
    } finally {
      setLoading(false);
    }
  }, [loadRides, offerId]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 8000);
    const onUpdate = () => void refresh();
    window.addEventListener("caronaa:rides-updated", onUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("caronaa:rides-updated", onUpdate);
    };
  }, [refresh]);

  if (loading)
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Carregando sua carona…</div>
      </AppShell>
    );
  if (error || !items.length)
    return (
      <AppShell>
        <PageHeading
          eyebrow="MINHA CARONA"
          title="Não foi possível abrir esta oferta"
          description={error || "Oferta não encontrada."}
        />
        <Button asChild variant="outline">
          <Link to="/minhas-caronas">Voltar às minhas viagens</Link>
        </Button>
      </AppShell>
    );

  const active =
    items.find((item) => item.kind === "offer") ?? items.find(
      (item) =>
        item.status === "MATCHED" || item.status === "CONFIRMED" || item.status === "IN_PROGRESS",
    ) ?? items[0];
  const pendingPassenger = items.filter(
    (item) => item.status === "MATCHED" && !item.passengerAcceptedAt,
  );
  const needsDriver = items.filter(
    (item) => item.status === "MATCHED" && item.passengerAcceptedAt && !item.driverAcceptedAt,
  );
  const confirmed = items.filter((item) =>
    ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(item.status),
  );
  const unanswered = pendingPassenger.length + needsDriver.length;
  const confirmedTotal =
    items.find((item) => item.driverConfirmedTotal != null)?.driverConfirmedTotal ?? 0;
  const operationalRide = confirmed.find((ride) =>
    ride.rideId && ["CONFIRMED", "IN_PROGRESS"].includes(ride.status),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-3">
          <Button asChild variant="ghost">
            <Link to="/minhas-caronas">
              <ArrowLeft size={16} /> Minhas viagens
            </Link>
          </Button>
        </div>
        <PageHeading
          eyebrow="MINHA CARONA"
          title="Gerenciar passageiros"
          description="Uma oferta, com solicitações e confirmações organizadas por etapa."
        />
        <section
          className="rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-soft sm:p-5"
          aria-label="Resumo da oferta"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Sua oferta</p>
              <h2 className="mt-2 font-display text-lg font-bold">
                {active.origin} → {active.destination}
              </h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays size={15} />
                {new Date(`${active.rideDate}T12:00:00`).toLocaleDateString("pt-BR")}{" "}
                <Clock3 size={15} />
                {active.departureTime}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/oferecer">Oferecer outra</Link>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-background px-3 py-2">
              {active.seatsRemaining ?? active.seats} vagas livres
            </span>
            <span className="rounded-full bg-background px-3 py-2">
              {unanswered} aguardando resposta
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold">
            Total previsto dos confirmados: {formatBrl(confirmedTotal)}
          </p>
          <p className="text-xs text-muted-foreground">
            Propostas pendentes não entram no total. Previsão não significa pagamento recebido.
          </p>
          {active.offerRouteDistanceKm != null && active.offerReferencePrice != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Percurso completo:{" "}
              {active.offerRouteDistanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
              · referência: {formatBrl(active.offerReferencePrice)} por pessoa. Cada passageiro paga
              conforme o próprio trecho.
            </p>
          )}
          {operationalRide?.rideId && (
            <Button asChild className="mt-4">
              <Link
                to="/viagem/$rideId"
                params={{
                  rideId: operationalRide.rideId,
                }}
              >
                Acompanhar viagem <ArrowRight size={16} />
              </Link>
            </Button>
          )}
          {!items.some(
            (item) =>
              item.status === "MATCHED" || ["CONFIRMED", "IN_PROGRESS"].includes(item.status),
          ) && (
            <p className="mt-4 rounded-lg border border-dashed border-border bg-background p-3 text-sm text-muted-foreground">
              Oferta publicada. As solicitações compatíveis aparecerão aqui para você revisar.
            </p>
          )}
        </section>
        <RideOpportunities offerId={offerId} role="driver" />
        {pendingPassenger.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-base font-bold">
              Aguardando aceite do passageiro ({pendingPassenger.length})
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Você poderá confirmar depois que o passageiro aceitar.
            </p>
            <div className="space-y-3">
              {pendingPassenger.map((ride) => (
                <PassengerRequest key={ride.rideId} ride={ride} onChanged={refresh} />
              ))}
            </div>
          </section>
        )}
        {needsDriver.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-base font-bold">
              Aguardando sua confirmação ({needsDriver.length})
            </h2>
            <div className="space-y-3">
              {needsDriver.map((ride) => (
                <PassengerRequest key={ride.rideId} ride={ride} onChanged={refresh} />
              ))}
            </div>
          </section>
        )}
        {confirmed.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-base font-bold">
              Passageiros confirmados ({confirmed.length})
            </h2>
            <div className="space-y-2">
              {confirmed.map((ride) => (
                <ConfirmedPassenger key={ride.rideId} ride={ride} />
              ))}
            </div>
          </section>
        )}
        <details className="mt-6 rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Detalhes da oferta</summary>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>Veículo: {active.vehicleDescription || "Não informado"}</p>
            {active.notes && <p>Observações: {active.notes}</p>}
            <p>
              Tarifa calculada proporcionalmente ao percurso; cada passageiro paga
              conforme seu trecho.
            </p>
          </div>
        </details>
      </div>
    </AppShell>
  );
}

function PassengerRequest({
  ride,
  onChanged,
}: {
  ride: RideSummary;
  onChanged: () => Promise<void>;
}) {
  const loadProfile = useServerFn(getRideParticipantProfile);
  const quoteRide = useServerFn(calculateRideQuote);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof loadProfile>> | null>(null);
  const [profileState, setProfileState] = useState<"loading" | "loaded" | "unavailable">("loading");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const quoteAttempted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    if (!ride.rideId || !ride.passenger?.id) return;
    void loadProfile({ data: { rideId: ride.rideId, userId: ride.passenger.id } })
      .then((value) => {
        if (active) {
          setProfile(value);
          setProfileState("loaded");
        }
      })
      .catch(() => {
        if (active) setProfileState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [loadProfile, ride.rideId, ride.passenger?.id]);
  useEffect(() => {
    if (
      ride.status !== "MATCHED" ||
      !ride.rideId ||
      ride.pricePerPassenger != null ||
      quoteAttempted.current
    )
      return;
    quoteAttempted.current = true;
    let active = true;
    setQuoting(true);
    void quoteRide({ data: { rideId: ride.rideId } })
      .then(async () => {
        if (active) await onChanged();
      })
      .catch((reason) => {
        if (active)
          setQuoteError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível calcular o preço do trecho.",
          );
      })
      .finally(() => {
        if (active) setQuoting(false);
      });
    return () => {
      active = false;
    };
  }, [onChanged, quoteRide, ride.pricePerPassenger, ride.rideId, ride.status]);
  async function respond(response: "CONFIRMED" | "CANCELLED") {
    if (!ride.rideId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await transitionRideStatus(ride.rideId, response);
      toast.success(
        response === "CONFIRMED"
          ? result === "CONFIRMED"
            ? "Viagem confirmada"
            : "Você aceitou — aguardando o passageiro."
          : "Solicitação recusada; a vaga foi liberada.",
      );
      await onChanged();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível responder à solicitação.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const passenger = ride.passenger;
  const name = profile?.fullName ?? passenger?.fullName ?? "Passageiro";
  const canConfirm = Boolean(
    ride.passengerAcceptedAt && !ride.driverAcceptedAt && ride.pricePerPassenger != null,
  );
  async function retryQuote() {
    if (!ride.rideId || quoting) return;
    quoteAttempted.current = true;
    setQuoting(true);
    setQuoteError("");
    try {
      await quoteRide({ data: { rideId: ride.rideId } });
      await onChanged();
    } catch (reason) {
      setQuoteError(
        reason instanceof Error ? reason.message : "Não foi possível calcular o preço do trecho.",
      );
    } finally {
      setQuoting(false);
    }
  }
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          to="/perfil-viagem/$rideId/$userId"
          params={{ rideId: ride.rideId!, userId: passenger!.id }}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar className="size-11">
            <AvatarImage src={profile?.avatarUrl ?? passenger?.avatarUrl ?? undefined} />
            <AvatarFallback>
              {name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-semibold">{name}</span>
            {profile?.verifications.length ? (
              <VerificationBadges verifications={profile.verifications} compact />
            ) : (
              <span className="text-xs text-muted-foreground">
                {profileState === "loading"
                  ? "Carregando verificações…"
                  : profileState === "unavailable"
                    ? "Verificações indisponíveis"
                    : "Nenhum selo concedido"}
              </span>
            )}
          </span>
        </Link>
        <span className="text-xs font-semibold text-muted-foreground">
          {ride.passengerAcceptedAt ? "Aceitou · falta você" : "Aguardando passageiro"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {!profile
          ? profileState === "unavailable"
            ? "Avaliações indisponíveis"
            : "Carregando avaliações…"
          : profile.averageRating == null
            ? "Ainda sem avaliações"
            : `★ ${profile.averageRating.toFixed(1)} · ${profile.ratingCount} avaliações`}
      </p>
      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
        <p>Embarque: {ride.meetingPoint || ride.origin}</p>
        {ride.pickupEstimatedAt && <p>Horário estimado de embarque: {formatPickupAt(ride.pickupEstimatedAt)}</p>}
        <p>Desembarque: {ride.destination}</p>
        <p className="flex items-center gap-1">
          <UsersRound size={14} />
          {ride.seats} {ride.seats === 1 ? "vaga" : "vagas"}
          {ride.pricePerPassenger != null
            ? ` · ${formatBrl(ride.pricePerPassenger)} por pessoa`
            : " · cotação pendente"}
          {ride.groupTotal != null ? ` · total ${formatBrl(ride.groupTotal)}` : ""}
        </p>
      </div>
      {ride.responseExpiresAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Responder até{" "}
          {new Date(ride.responseExpiresAt).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      )}
      {ride.status === "MATCHED" && ride.pricePerPassenger == null && (
        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-muted-foreground">
          <p>
            {quoteError ||
              (quoting
                ? "Calculando preço do trecho…"
                : "A cotação do trecho é necessária antes dos aceites.")}
          </p>
          {quoteError && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={quoting}
              onClick={() => void retryQuote()}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void respond("CANCELLED")}>
          Recusar
        </Button>
        {canConfirm && (
          <Button disabled={busy} onClick={() => void respond("CONFIRMED")}>
            {busy ? "Enviando…" : "Confirmar passageiro"}
          </Button>
        )}
      </div>
    </article>
  );
}

function ConfirmedPassenger({ ride }: { ride: RideSummary }) {
  const passenger = ride.passenger;
  const name = passenger?.fullName ?? "Passageiro";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <Link
        to="/perfil-viagem/$rideId/$userId"
        params={{ rideId: ride.rideId!, userId: passenger!.id }}
        className="flex items-center gap-2"
      >
        <Avatar className="size-9">
          <AvatarImage src={passenger?.avatarUrl ?? undefined} />
          <AvatarFallback>{name[0]}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">
          {name} · {ride.seats} {ride.seats === 1 ? "vaga" : "vagas"}
        </span>
      </Link>
      <span className="text-xs text-muted-foreground">
        {ride.status === "COMPLETED"
          ? "Concluída"
          : ride.status === "IN_PROGRESS"
            ? "Em viagem"
            : "Confirmado"}
      </span>
      <Button asChild size="sm" variant="outline">
        <Link to="/viagem/$rideId" params={{ rideId: ride.rideId! }}>
          Acompanhar
        </Link>
      </Button>
    </div>
  );
}

