import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";

type ProfessionalRide = {
  id: string;
  role: string;
  status: string;
  vehicle_type?: string | null;
  origin_label?: string | null;
  destination_label?: string | null;
  requested_at?: string | null;
  fare_cents?: number | null;
  driver_receives_cents?: number | null;
};
const rideStatus: Record<string, string> = {
  SEARCHING: "Buscando motorista",
  ACCEPTED: "Aceita",
  ARRIVED: "Chegada confirmada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export const Route = createFileRoute("/_authenticated/viagens-profissionais")({
  component: ProfessionalTripsPage,
  head: () => ({ meta: [{ title: "Minhas viagens profissionais | CARONAA" }] }),
});

function ProfessionalTripsPage() {
  const [rides, setRides] = useState<ProfessionalRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await (supabase as any).rpc("quick_ride_my_requests");
      if (fetchError) throw fetchError;
      const items: ProfessionalRide[] = Array.isArray(data) ? data : [];
      setRides(items.filter((ride) => ride.role === "DRIVER")
        .sort((a, b) => Date.parse(b.requested_at ?? "") - Date.parse(a.requested_at ?? "")));
    } catch {
      setError("Não foi possível carregar suas viagens. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const active = rides.filter((ride) => ["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(ride.status));
  const past = rides.filter((ride) => !["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(ride.status));
  const card = (ride: ProfessionalRide) => (
    <article key={ride.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">{rideStatus[ride.status] ?? ride.status}</strong>
        <span className="text-xs text-muted-foreground">{ride.vehicle_type === "MOTO" ? "Moto" : ride.vehicle_type === "CAR" ? "Carro" : "Viagem"}</span>
      </div>
      <p className="break-words text-sm">{ride.origin_label || "Origem não informada"} → {ride.destination_label || "Destino não informado"}</p>
      {typeof ride.driver_receives_cents === "number" && (
        <p className="mt-2 font-bold text-primary">Seu ganho: {formatBrl(ride.driver_receives_cents / 100)}</p>
      )}
      {ride.requested_at && <p className="mt-1 text-xs text-muted-foreground">{new Date(ride.requested_at).toLocaleString("pt-BR")}</p>}
      {["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(ride.status) && (
        <Link className="mt-3 inline-flex min-h-11 items-center font-bold text-primary underline" to="/disponibilidade-profissional">
          Continuar atendimento no painel
        </Link>
      )}
    </article>
  );
  return <AppShell>
    <div className="mx-auto max-w-3xl space-y-5 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">CARONAA</p>
          <h1 className="text-2xl font-extrabold">Minhas viagens</h1>
          <p className="text-sm text-muted-foreground">Acompanhe as corridas e os seus ganhos.</p></div>
        <button onClick={() => void reload()} disabled={loading} className="min-h-11 rounded-xl border border-primary/30 px-4 font-semibold">Atualizar</button>
      </div>
      {loading && <p role="status">Carregando viagens…</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {!loading && !error && rides.length === 0 && <p className="rounded-xl border p-4 text-sm">Nenhuma viagem profissional registrada ainda.</p>}
      {active.length > 0 && <section className="space-y-3"><h2 className="font-bold">Em atendimento</h2>{active.map(card)}</section>}
      {past.length > 0 && <section className="space-y-3"><h2 className="font-bold">Histórico</h2>{past.map(card)}</section>}
    </div>
  </AppShell>;
}
