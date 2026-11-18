import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CarFront, Check, Clock3, MapPin, Radio, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import {
  acceptDriverScheduledRequest, getDriverScheduledOpportunities, getDriverScheduledTrips,
  type DriverOpportunity, type DriverScheduledTrip,
} from "@/services/driver-scheduled-service";
import { formatBrl } from "@/lib/ride-cost";

type Request = { offer: DriverScheduledTrip; opportunity: DriverOpportunity };
type Props = {
  onOffer: () => void;
  onOpenTrips: () => void;
  refreshKey?: number;
};
const departureLabel = (timestamp: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza", day: "2-digit", month: "short",
  hour: "2-digit", minute: "2-digit",
}).format(new Date(timestamp));

/** Shared-car driver inbox. No F07 presence/GPS or fabricated incoming orders. */
export function DriverHomeDashboard({ onOffer, onOpenTrips, refreshKey = 0 }: Props) {
  const [offers, setOffers] = useState<DriverScheduledTrip[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const published = await getDriverScheduledTrips();
      const upcoming = published.filter(item =>
        Date.parse(item.departureAt) >= Date.now() - 30 * 60_000
      );
      const outcomes = await Promise.allSettled(
        upcoming.map(async offer => ({
          offer, matches: await getDriverScheduledOpportunities(offer.offerId),
        }))
      );
      const pending: Request[] = [];
      let failures = 0;
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") { failures++; continue; }
        for (const opportunity of outcome.value.matches)
          pending.push({ offer: outcome.value.offer, opportunity });
      }
      setOffers(upcoming);
      setRequests(pending);
      setWarning(failures ? "Algumas solicitações não puderam ser consultadas. Atualize para tentar novamente." : "");
      setError("");
    } catch {
      setError("Não conseguimos consultar suas caronas e pedidos agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => { if (active) void refresh(); };
    load();
    const interval = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [refresh, refreshKey]);

  const accept = async (item: Request) => {
    if (accepting) return;
    setAccepting(item.opportunity.requestId);
    try {
      await acceptDriverScheduledRequest(item.offer.offerId, item.opportunity.requestId);
      toast.success("Passageiro confirmado na sua carona.");
      await refresh();
    } catch {
      toast.error("Não foi possível confirmar o passageiro. Atualize os pedidos e tente novamente.");
      await refresh();
    } finally {
      setAccepting(null);
    }
  };

  const confirmed = offers.reduce((count, offer) => count + offer.passengers.length, 0);

  return <section aria-label="Início do motorista" className="space-y-3 pb-4 text-white">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#FFBB00]">CARONAA · Condutor compartilhado</p>
        <h1 className="mt-1 font-[Sora] text-xl font-black">Painel do motorista</h1>
        <p className="mt-1 text-xs leading-relaxed text-white/65">
          Publique trajetos, acompanhe solicitações e confirme passageiros.
        </p>
      </div>
      <button type="button" onClick={() => void refresh()} aria-label="Atualizar pedidos"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-[#FFBB00]">
        <RefreshCw size={19} aria-hidden="true"/>
      </button>
    </div>

    <div className="grid grid-cols-3 gap-2" aria-label="Resumo das caronas">
      {([
        ["Ofertas", offers.length, CarFront],
        ["Pedidos", requests.length, Radio],
        ["Confirmados", confirmed, Check],
      ] as const).map(([label, count, Icon]) =>
        <div key={label} className="min-w-0 rounded-xl border border-white/15 bg-white/5 px-2 py-3 text-center">
          <Icon size={18} className="mx-auto mb-1 text-[#FFBB00]" aria-hidden="true"/>
          <strong className="block font-[Sora] text-lg tabular-nums">{loading ? "…" : count}</strong>
          <span className="text-[10px] text-white/65">{label}</span>
        </div>
      )}
    </div>

    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={onOffer}
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-2 text-xs font-extrabold text-[#121212]">
        <CarFront size={18} aria-hidden="true"/> Oferecer carona
      </button>
      <button type="button" onClick={onOpenTrips}
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-2 text-xs font-bold">
        <CalendarClock size={18} aria-hidden="true"/> Minhas viagens
      </button>
    </div>

    {error ? <div role="alert" className="rounded-xl border border-amber-400/30 bg-white/5 p-3 text-xs">
      <p>{error}</p>
      <button type="button" onClick={() => void refresh()}
        className="mt-2 min-h-11 rounded-lg bg-[#FFBB00] px-3 font-bold text-[#121212]">Tentar novamente</button>
    </div> : warning ? <p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-xs text-amber-200">{warning}</p> : null}

    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-extrabold"><Users size={18} className="text-[#FFBB00]"/> Solicitações para suas caronas</h2>
      {loading ? <p role="status" className="rounded-xl border border-white/15 p-3 text-xs text-white/65">Consultando solicitações…</p>
        : requests.length ? requests.map(item => <article key={item.offer.offerId + ":" + item.opportunity.requestId}
          className="space-y-2 rounded-xl border border-[#FFBB00]/30 bg-white/5 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">{item.opportunity.passengerName}</strong>
            <strong className="text-[#FFBB00]">{formatBrl(item.opportunity.potentialEarnings)}</strong>
          </div>
          <p className="flex items-center gap-1.5 text-white/70"><Clock3 size={14}/> {departureLabel(item.offer.departureAt)}</p>
          <p className="flex items-start gap-1.5 text-white/70"><MapPin size={14} className="shrink-0"/> {item.opportunity.meetingName}</p>
          <p className="text-white/60">{item.opportunity.passengers} {item.opportunity.passengers === 1 ? "passageiro" : "passageiros"} · {item.offer.destination}</p>
          <button type="button" disabled={Boolean(accepting) || item.opportunity.passengers > item.offer.seatsRemaining}
            onClick={() => void accept(item)}
            className="min-h-11 w-full rounded-lg bg-[#FFBB00] px-3 font-bold text-[#121212] disabled:opacity-50">
            {accepting === item.opportunity.requestId ? "Confirmando…" : "Aceitar solicitação"}
          </button>
        </article>) : !error && <div className="rounded-xl border border-white/15 bg-white/[0.035] p-3">
          <p className="text-sm font-semibold">{offers.length ? "Aguardando solicitações" : "Ainda não há trajetos publicados"}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            {offers.length
              ? "Suas ofertas estão publicadas. Novos pedidos compatíveis aparecem aqui quando encontrados."
              : "Ofereça uma carona para que passageiros possam encontrar seu trajeto e solicitar vagas."}
          </p>
        </div>}
    </div>
    <p className="text-[11px] leading-relaxed text-white/45">
      Carona comum não ativa disponibilidade profissional, GPS contínuo ou corridas Flash.
    </p>
  </section>;
}
