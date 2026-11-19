import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Bike, CheckCircle2, ChevronDown, RefreshCw, Route as RouteIcon, Wallet } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { QuickRideDriverSettlement } from "@/components/caronaa/QuickRideDriverSettlement";
import { QuickRideRatingModal } from "@/components/caronaa/QuickRideRatingModal";

type ProfessionalRide = {
  id: string;
  role: string;
  status: string;
  vehicle_type?: string | null;
  origin_label?: string | null;
  destination_label?: string | null;
  requested_at?: string | null;
  completed_at?: string | null;
  fare_cents?: number | null;
  driver_receives_cents?: number | null;
  platform_commission_cents?: number | null;
};
const rideStatus: Record<string, string> = {
  SEARCHING: "Buscando motorista",
  ACCEPTED: "Aceita",
  ARRIVED: "Chegada confirmada",
  IN_PROGRESS: "Em andamento",
  PENDING_REVIEW: "Aguardando confirmação / análise",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};
const activeStatuses = ["ACCEPTED", "ARRIVED", "IN_PROGRESS"];
const dateInFortaleza = (value: string | Date) =>
  new Date(value).toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" });

export const Route = createFileRoute("/_authenticated/viagens-profissionais")({
  component: ProfessionalTripsPage,
  head: () => ({ meta: [{ title: "Minhas viagens profissionais | CARONAA" }] }),
});

function ProfessionalTripsPage() {
  const [rides, setRides] = useState<ProfessionalRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSettlement,setExpandedSettlement] = useState<string|null>(null);
  const [ratingOpen,setRatingOpen] = useState<string|null>(null);
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

  const active = rides.filter((ride) => activeStatuses.includes(ride.status));
  const completed = rides.filter((ride) => ride.status === "COMPLETED");
  const past = rides.filter((ride) => !activeStatuses.includes(ride.status));
  const stats = useMemo(() => {
    if (completed.length === 0) {
      return { earningsToday: formatBrl(0), completedCount: 0, fees: formatBrl(0), incomplete: false };
    }
    // No financial amounts or completion timestamps are synthesized.
    // Older quick_ride_my_requests versions return labels/status only.
    const hasDates = completed.every((ride) => !!ride.completed_at && Number.isFinite(Date.parse(ride.completed_at)));
    const today = dateInFortaleza(new Date());
    const todayRides = hasDates
      ? completed.filter((ride) => dateInFortaleza(ride.completed_at!) === today) : [];
    const earningsKnown = hasDates && todayRides.every((ride) => typeof ride.driver_receives_cents === "number");
    const feeKnown = completed.every((ride) => typeof ride.platform_commission_cents === "number");
    return {
      earningsToday: earningsKnown
        ? formatBrl(todayRides.reduce((sum, ride) => sum + (ride.driver_receives_cents ?? 0), 0) / 100) : "—",
      completedCount: completed.length,
      fees: feeKnown
        ? formatBrl(completed.reduce((sum, ride) => sum + (ride.platform_commission_cents ?? 0), 0) / 100) : "—",
      incomplete: !earningsKnown || !feeKnown,
    };
  }, [completed]);

  const card = (ride: ProfessionalRide) => (
    <article key={ride.id} className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.055] p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="rounded-full border border-[#FFBB00]/30 bg-[#FFBB00]/10 px-3 py-1 text-xs font-bold text-[#FFBB00]">
          {rideStatus[ride.status] ?? ride.status}
        </strong>
        <span className="text-xs font-semibold text-white/60">
          {ride.vehicle_type === "MOTO" ? "Mototáxi" : ride.vehicle_type === "CAR" ? "Carro" : "Viagem"}
        </span>
      </div>
      <p className="break-words text-sm leading-relaxed text-white/90">
        {ride.origin_label || "Origem não informada"} → {ride.destination_label || "Destino não informado"}
      </p>
      {typeof ride.driver_receives_cents === "number" && (
        <p className="font-[Sora] text-lg font-extrabold text-[#FFBB00]">
          Seu ganho: {formatBrl(ride.driver_receives_cents / 100)}
        </p>
      )}
      {ride.requested_at && <p className="text-xs text-white/55">
        {new Date(ride.requested_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}
      </p>}
      {ride.status === "PENDING_REVIEW" && <p role="status"
        className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm text-white/80">
        O motorista solicitou o desembarque. O passageiro poderá confirmar ao retornar ao
        aplicativo; caso não responda dentro do prazo, a plataforma poderá analisar.
        Até a conclusão confirmada não há cobrança Pix nem comissão. Você pode
        continuar recebendo novos chamados, se estiver habilitado.
      </p>}
      {ride.status === "COMPLETED" && <div className="space-y-2 border-t border-white/15 pt-3">
        <button type="button" aria-expanded={expandedSettlement===ride.id}
          onClick={()=>setExpandedSettlement(current=>current===ride.id?null:ride.id)}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-[#FFBB00]/50 px-3 text-sm font-bold text-[#FFBB00]">
          <span>Consultar cobrança e recebimento Pix</span>
          <ChevronDown size={17} className={expandedSettlement===ride.id?"rotate-180":""}/>
        </button>
        {expandedSettlement===ride.id&&<QuickRideDriverSettlement rideId={ride.id}/>}
        <button type="button" onClick={()=>setRatingOpen(ride.id)}
          className="min-h-11 text-sm font-semibold text-white/80 underline">
          Avaliar passageiro (opcional)
        </button>
        {ratingOpen===ride.id&&<QuickRideRatingModal rideId={ride.id} subject="passageiro"
          forceOpen onClose={()=>setRatingOpen(null)}/>}
      </div>}
      {activeStatuses.includes(ride.status) && (
        <Link className="inline-flex min-h-11 items-center gap-2 font-bold text-[#FFBB00] underline"
          to="/disponibilidade-profissional">
          Continuar atendimento <ArrowRight size={16} aria-hidden="true"/>
        </Link>
      )}
    </article>
  );

  return <AppShell>
    <div className="mx-auto max-w-4xl space-y-5 rounded-3xl bg-[#121212] px-4 py-5 font-[Manrope] text-white sm:px-7 sm:py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#FFBB00]">CARONAA MOTORISTA</p>
          <h1 className="mt-1 font-[Sora] text-2xl font-extrabold">Minhas viagens</h1>
          <p className="mt-1 text-sm text-white/65">Acompanhe suas corridas e seus ganhos.</p>
        </div>
        <button onClick={() => void reload()} disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FFBB00]/30 px-4 font-semibold text-[#FFBB00] disabled:opacity-50">
          <RefreshCw size={16} aria-hidden="true"/> Atualizar
        </button>
      </div>

      <section aria-label="Resumo operacional" className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3 sm:gap-3">
        {([
          { label: "Ganhos de hoje", value: stats.earningsToday, Icon: Wallet },
          { label: "Corridas concluídas", value: String(stats.completedCount), Icon: CheckCircle2 },
          { label: "Taxa plataforma", value: stats.fees, Icon: RouteIcon },
        ] as const).map(({ label, value, Icon }) =>
          <div key={label} className="min-w-0 rounded-2xl border border-white/15 bg-white/[0.055] p-3 sm:p-4">
            <Icon className="mb-2 size-4 text-[#FFBB00]" aria-hidden="true"/>
            <p className="text-[11px] font-semibold leading-snug text-white/65">{label}</p>
            <p className="mt-1 break-words font-[Sora] text-base font-black tabular-nums text-[#FFBB00] sm:text-xl">
              {loading ? "…" : value}
            </p>
          </div>
        )}
      </section>
      {!loading && !error && stats.incomplete &&
        <p className="text-xs text-white/50">— significa que o histórico não informou valores ou datas suficientes para este indicador.</p>}
      {loading && <div role="status" aria-label="Carregando viagens" className="space-y-3">
        <span className="sr-only">Carregando viagens…</span>
        <div className="h-24 animate-pulse rounded-2xl bg-white/10"/>
        <div className="h-20 animate-pulse rounded-2xl bg-white/10"/>
      </div>}
      {error && <div role="alert" className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/10 p-4 text-sm">
        {error}
        <button onClick={() => void reload()} className="mt-2 block min-h-11 font-bold text-[#FFBB00] underline">Tentar novamente</button>
      </div>}
      {!loading && !error && rides.length === 0 &&
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-white/15 bg-white/[0.045] px-5 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#FFBB00]/15">
            <Bike size={30} className="text-[#FFBB00]" aria-hidden="true"/>
          </div>
          <h2 className="font-[Sora] text-xl font-extrabold">Pronto para rodar hoje?</h2>
          <p className="max-w-sm text-sm leading-relaxed text-white/65">
            Fique online no seu painel para começar a receber chamadas de passageiros na sua região.
          </p>
          <Link to="/disponibilidade-profissional"
            className="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFBB00] px-5 font-bold text-[#121212] sm:w-auto">
            Acessar Cockpit Operacional <ArrowRight size={18} aria-hidden="true"/>
          </Link>
        </section>}
      {!loading && !error && active.length > 0 &&
        <section className="space-y-3"><h2 className="font-[Sora] font-bold">Em atendimento</h2>{active.map(card)}</section>}
      {!loading && !error && past.length > 0 &&
        <section className="space-y-3"><h2 className="font-[Sora] font-bold">Histórico</h2>{past.map(card)}</section>}
    </div>
  </AppShell>;
}
