import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, CarFront, MapPin, Navigation, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type UnifiedTrip = {
  id: string;
  source: string;
  category: "AGENDADAS" | "EM_ANDAMENTO";
  status: string;
  departureAt: string;
  origin: string;
  destination: string;
  mode: "EXCLUSIVE" | "ON_ROUTE";
  vehicleType: "CAR" | "MOTO";
  seats: number;
  estimatedFare: number | null;
  canCancel: boolean;
  operationalRideId: string | null;
};

type Props = {
  onClose: () => void;
  onShowOnMap?: (trip: UnifiedTrip) => void;
  refreshKey?: number;
};

function normalizedTrip(value: unknown): UnifiedTrip | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const id = data.id ?? data.request_id;
  const when = data.departure_at ?? data.departureAt;
  const category = data.category ?? data.group;
  if (typeof id !== "string" || !id || typeof when !== "string" ||
      !Number.isFinite(Date.parse(when))) return null;
  const status = String(data.status ?? "WAITING");
  return {
    id,
    source: String(data.source ?? "SCHEDULED"),
    category: category === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : "AGENDADAS",
    status,
    departureAt: when,
    origin: String(data.origin ?? ""),
    destination: String(data.destination ?? ""),
    mode: data.mode === "ON_ROUTE" ? "ON_ROUTE" : "EXCLUSIVE",
    vehicleType: data.vehicle_type === "MOTO" || data.vehicleType === "MOTO" ? "MOTO" : "CAR",
    seats: typeof data.seats === "number" && data.seats >= 1 ? data.seats : 1,
    estimatedFare: typeof data.estimated_fare === "number" ? data.estimated_fare
      : typeof data.estimatedFare === "number" ? data.estimatedFare : null,
    canCancel: data.can_cancel === true || data.canCancel === true,
    operationalRideId: typeof data.operational_ride_id === "string" ? data.operational_ride_id :
      typeof data.operationalRideId === "string" ? data.operationalRideId : null,
  };
}
function prettyDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const todayDate = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(today);
  const rideDate = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  const tomorrowDate = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(today.getTime()+86400000));
  const time = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",hour:"2-digit",minute:"2-digit"}).format(date);
  if (rideDate === todayDate) return "Hoje às "+time;
  if (rideDate === tomorrowDate) return "Amanhã às "+time;
  return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
}
const isWaiting = (status: string) =>
  ["WAITING","PENDING","OPEN","AGUARDANDO_MOTORISTA"].includes(status.toUpperCase());
const isConfirmed = (status: string) =>
  ["CONFIRMED","CONFIRMADA"].includes(status.toUpperCase());

export function UnifiedMyTripsPanel({onClose,onShowOnMap,refreshKey=0}: Props) {
  const [tab,setTab] = useState<"AGENDADAS"|"EM_ANDAMENTO">("AGENDADAS");
  const [trips,setTrips] = useState<UnifiedTrip[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [cancelId,setCancelId] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const load = useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const {data,error:rpcError}=await (supabase as any).rpc("get_my_unified_trips");
      if(rpcError || !Array.isArray(data))throw new Error("UNIFIED_TRIPS_UNAVAILABLE");
      setTrips(data.map(normalizedTrip).filter((t:UnifiedTrip|null):t is UnifiedTrip=>t!==null));
    }catch{
      setError("Não conseguimos carregar suas viagens. Tente novamente.");
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load,refreshKey]);
  useEffect(()=>{
    const onFocus=()=>{if(document.visibilityState==="visible")void load();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    return ()=>{window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onFocus);};
  },[load]);
  const cancel=async()=>{
    if(!cancelId||busy)return;
    setBusy(true);
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("cancel_scheduled_caronaa_request",{p_request_id:cancelId});
      // Never treat an absent/ambiguous RPC response as a successful cancellation.
      const confirmed=data===true ||
        (data && typeof data==="object" &&
          (data.cancelled===true || data.success===true || data.status==="CANCELLED"));
      if(rpcError||!confirmed)throw new Error("CANCEL_FAILED");
      setCancelId(null);
      toast.success("Agendamento cancelado.");
      await load();
    }catch{
      toast.error("Não foi possível cancelar o agendamento.");
    }finally{setBusy(false);}
  };
  const visible=trips.filter(t=>t.category===tab);
  return <section aria-label="Minhas Viagens" className="space-y-4 pb-4 text-white" style={{fontFamily:"Manrope, sans-serif"}}>
    <header className="flex items-center justify-between gap-2">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Minhas Viagens</h2>
      <button type="button" onClick={onClose} aria-label="Fechar Minhas Viagens"
        className="flex size-11 items-center justify-center rounded-xl border border-white/20"><X size={20}/></button>
    </header>
    <div role="tablist" aria-label="Categorias de viagens" className="grid grid-cols-2 gap-2">
      {(["AGENDADAS","EM_ANDAMENTO"] as const).map(next=>
        <button key={next} type="button" role="tab" aria-selected={tab===next} onClick={()=>setTab(next)}
          className={"min-h-11 rounded-xl border px-3 text-sm font-bold "+(tab===next?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/25")}>
          {next==="AGENDADAS"?"Agendadas":"Em andamento"}
        </button>)}
    </div>
    {loading?<p role="status" className="text-sm text-white/70">Carregando suas viagens...</p>
    :error?<div role="alert" className="space-y-2"><p className="text-sm">{error}</p>
        <button type="button" onClick={()=>void load()} className="min-h-11 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">Tentar novamente</button>
      </div>
    :visible.length===0?<p className="rounded-xl border border-white/15 p-4 text-sm text-white/70">
      {tab==="AGENDADAS"?"Você ainda não tem viagens agendadas.":"Nenhuma viagem em andamento."}
    </p>
    :<div className="space-y-3">
      {visible.map(trip=><article key={trip.source+":"+trip.id} className="space-y-2 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className={"rounded-full px-2 py-1 text-xs font-bold "+(isConfirmed(trip.status)?"bg-emerald-700 text-white":isWaiting(trip.status)?"bg-[#FFBB00] text-[#121212]":"bg-white/15 text-white")}>
            {isConfirmed(trip.status)?"Confirmada":isWaiting(trip.status)?"Aguardando motorista":trip.status}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-white/75"><CalendarClock size={15}/>{prettyDate(trip.departureAt)}</span>
        </div>
        <p className="flex items-start gap-2"><MapPin size={16} className="shrink-0 text-[#FFBB00]"/>{trip.origin}</p>
        <p className="flex items-start gap-2"><Navigation size={16} className="shrink-0 text-[#FFBB00]"/>{trip.destination}</p>
        <p className="flex items-center gap-2 text-white/80"><CarFront size={16}/>
          {trip.mode==="EXCLUSIVE"?"Exclusiva":"Na Rota — "+trip.seats+" vaga(s)"} · {trip.vehicleType==="MOTO"?"Moto":"Carro"}
        </p>
        {trip.estimatedFare!==null&&<p className="font-[family-name:var(--font-display)] text-xl font-bold text-[#FFBB00]">
          {formatBrl(trip.estimatedFare)} <span className="text-xs font-normal text-white/60">estimado</span>
        </p>}
        {tab==="AGENDADAS"&&isWaiting(trip.status)&&
          new Date(trip.departureAt).getTime()-Date.now()<3600000&&
          new Date(trip.departureAt).getTime()>Date.now()&&
          <p role="alert" className="rounded-xl border border-[#FFBB00]/50 p-3 text-xs">
            Nenhum motorista confirmou ainda. Sugerimos mudar o horário ou trocar para Exclusiva.
          </p>}
        {tab==="AGENDADAS"&&trip.canCancel&&
          <button type="button" onClick={()=>setCancelId(trip.id)}
            className="min-h-11 rounded-xl border border-white/30 px-4 font-semibold">Cancelar viagem</button>}
        {tab==="EM_ANDAMENTO"&&trip.operationalRideId&&
          <button type="button" onClick={()=>onShowOnMap?.(trip)}
            className="min-h-11 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">Ver no mapa</button>}
      </article>)}
    </div>}
    <Dialog open={cancelId!==null} onOpenChange={open=>{if(!open&&!busy)setCancelId(null);}}>
      <DialogContent className="max-w-sm border-[#FFBB00]/50 bg-[#121212] text-white">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)]">Confirmar cancelamento</DialogTitle>
          <DialogDescription className="text-white/70">
            Deseja cancelar seu agendamento? Não haverá cobrança pelo aplicativo.
            O servidor precisa confirmar o cancelamento.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={()=>setCancelId(null)}
            className="min-h-12 flex-1 rounded-xl border border-white/30">Voltar</button>
          <button type="button" disabled={busy} onClick={()=>void cancel()}
            className="min-h-12 flex-1 rounded-xl bg-[#FFBB00] font-bold text-[#121212]">
            {busy?"Cancelando...":"Confirmar cancelamento"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    <button type="button" onClick={onClose} className="flex min-h-11 items-center gap-2 text-sm text-white/75">
      <ArrowLeft size={16}/> Voltar ao planejamento
    </button>
  </section>;
}
