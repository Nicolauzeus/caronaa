import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bike, CarFront, ChevronDown, Clock3, RefreshCw, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { QuickRidePixCard } from "./QuickRidePixCard";
import { QuickRideRatingModal } from "./QuickRideRatingModal";

type PassengerQuickRide = {
  id: string;
  status: string;
  vehicleType: "CAR" | "MOTO";
  municipality: string;
  fareCents: number | null;
  createdAt: string | null;
};

function asPassengerRide(value: unknown): PassengerQuickRide | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.role !== "PASSENGER" || typeof row.id !== "string" || !row.id) return null;
  return {
    id: row.id,
    status: typeof row.status === "string" ? row.status : "UNKNOWN",
    vehicleType: row.vehicle_type === "MOTO" ? "MOTO" : "CAR",
    municipality: typeof row.municipality === "string" ? row.municipality : "",
    fareCents: typeof row.fare_cents === "number" && Number.isSafeInteger(row.fare_cents) &&
      row.fare_cents >= 0 ? row.fare_cents : null,
    createdAt: typeof row.created_at === "string" && !Number.isNaN(Date.parse(row.created_at))
      ? row.created_at : null,
  };
}

function statusLabel(status: string): string {
  switch (status) {
    case "SEARCHING": return "Buscando motorista";
    case "ACCEPTED": return "Motorista a caminho";
    case "ARRIVED": return "Motorista chegou";
    case "IN_PROGRESS": return "Em andamento";
    case "PENDING_REVIEW": return "Desembarque pendente";
    case "COMPLETED": return "Concluída";
    case "CANCELLED": return "Cancelada";
    case "EXPIRED": return "Expirada";
    default: return "Consultar situação";
  }
}

export function QuickRideTripHistory() {
  const [rides,setRides] = useState<PassengerQuickRide[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [expandedPix,setExpandedPix] = useState<string | null>(null);
  const [ratingOpen,setRatingOpen] = useState<string | null>(null);

  const refresh = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError("");
    try {
      const { data, error: requestError } = await (supabase as any).rpc("quick_ride_my_requests");
      if (requestError || !Array.isArray(data)) throw new Error("UNAVAILABLE");
      const results = data.map(asPassengerRide).filter(
        (item: PassengerQuickRide | null): item is PassengerQuickRide => item !== null,
      );
      setRides(results.sort((left: PassengerQuickRide,right: PassengerQuickRide) =>
        (right.createdAt ? Date.parse(right.createdAt) : 0) -
        (left.createdAt ? Date.parse(left.createdAt) : 0)));
    } catch {
      setError("Não foi possível consultar suas corridas rápidas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(false); };
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  return (
    <section aria-label="Histórico de corridas rápidas" className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-extrabold">Corridas Rápidas</h2>
          <p className="mt-1 text-xs text-muted-foreground">Acompanhe viagens de carro e moto, valores contratados e pagamento.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw size={16} aria-hidden="true" /> Atualizar
        </button>
      </div>
      {loading ? <div role="status" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Carregando corridas rápidas…</div> :
      error ? <div role="alert" className="space-y-2 rounded-2xl border border-destructive/30 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <button type="button" onClick={() => void refresh()} className="min-h-11 rounded-xl bg-[#FFBB00] px-4 text-sm font-bold text-[#121212]">Tentar novamente</button>
      </div> :
      rides.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <p>Você ainda não solicitou uma Corrida Rápida.</p>
        <Link to="/home" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#FFBB00] px-4 text-sm font-bold text-[#121212]">
          Pedir uma corrida
        </Link>
      </div> :
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {rides.map(ride => {
          const VehicleIcon = ride.vehicleType === "MOTO" ? Bike : CarFront;
          const pixOpen = expandedPix === ride.id;
          return <article key={ride.id} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FFBB00]/15 text-[#9C7100] dark:text-[#FFBB00]">
                  <VehicleIcon size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-extrabold">Corrida {ride.vehicleType === "MOTO" ? "Moto" : "Carro"}</h3>
                  {ride.municipality && <p className="mt-1 truncate text-xs text-muted-foreground">{ride.municipality}</p>}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">{statusLabel(ride.status)}</span>
            </div>
            {ride.createdAt && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 size={14} aria-hidden="true" />
              {new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Fortaleza", dateStyle:"short", timeStyle:"short"}).format(new Date(ride.createdAt))}
            </p>}
            {ride.fareCents !== null && <p className="mt-3 font-display text-xl font-black">{formatBrl(ride.fareCents / 100)}
              <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">valor contratado</span>
            </p>}
            {["SEARCHING", "ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(ride.status) && (
              <Link to="/home" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#FFBB00] px-3 text-sm font-bold text-[#121212]">
                Acompanhar no mapa
              </Link>
            )}
            {ride.status === "PENDING_REVIEW" && <p role="status"
              className="mt-3 rounded-xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 p-3 text-sm">
              Aguardando confirmação do desembarque. Se estiver tudo certo, confirme na página inicial. O Pix aparecerá após essa confirmação. Se houver contestação, o atendimento poderá analisar o caso.
              <Link to="/home" className="mt-2 block font-semibold underline">Abrir confirmação de desembarque</Link>
            </p>}
            {ride.status === "COMPLETED" && (
              <div className="mt-3">
                <button type="button" aria-expanded={pixOpen} aria-controls={"quick-pix-"+ride.id}
                  onClick={() => setExpandedPix(previous => previous === ride.id ? null : ride.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-[#FFBB00]/60 bg-[#FFBB00]/10 px-3 text-sm font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]">
                  <span className="flex items-center gap-2"><Wallet size={17} aria-hidden="true" /> Consultar Pix e pagamento</span>
                  <ChevronDown size={18} className={pixOpen ? "rotate-180" : ""} aria-hidden="true" />
                </button>
                {pixOpen && <div id={"quick-pix-"+ride.id} className="dark mt-3 rounded-2xl bg-[#121212] p-2 text-white">
                  <QuickRidePixCard rideId={ride.id} />
                </div>}
                <button type="button" onClick={()=>setRatingOpen(ride.id)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-border text-sm font-semibold">
                  Avaliar motorista (opcional)
                </button>
                {ratingOpen===ride.id&&<QuickRideRatingModal rideId={ride.id} subject="motorista"
                  forceOpen onClose={()=>setRatingOpen(null)}/>}

              </div>
            )}
          </article>;
        })}
      </div>}
    </section>
  );
}
