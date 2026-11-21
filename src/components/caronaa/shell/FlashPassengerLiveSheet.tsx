import { Bike, CarFront, CheckCircle2, ChevronUp, Clock3, KeyRound, MapPin, Navigation2 } from "lucide-react";
import { formatBrl } from "@/lib/ride-cost";
import { QuickRideSearchActivity } from "../QuickRideSearchActivity";
import type { SheetSnap } from "./InteractiveBottomSheet";

type Ride={
  id:string;status:"SEARCHING"|"ACCEPTED"|"ARRIVED"|"IN_PROGRESS";
  vehicle_type:string;fare_cents?:number|null;
};
type Props={
  ride:Ride;snap:SheetSnap;origin:string;destination:string;
  searchSecondsLeft:number|null;searchDeadlinePassed:boolean;
  boardingCode:string;busy:boolean;rideRefreshError:boolean;
  onBoardingCode:()=>void;onCancel:()=>void;onRefresh:()=>void;
  onFollowMap?:()=>void;onExpand:()=>void;
};
const stages={
  SEARCHING:"Aguardando motorista",
  ACCEPTED:"Motorista a caminho",
  ARRIVED:"Motorista chegou",
  IN_PROGRESS:"Viagem em andamento",
} as const;
export function FlashPassengerLiveSheet({
  ride,snap,origin,destination,searchSecondsLeft,searchDeadlinePassed,
  boardingCode,busy,rideRefreshError,onBoardingCode,onCancel,onRefresh,
  onFollowMap,onExpand,
}:Props){
  const compact=snap==="peek";
  const searching=ride.status==="SEARCHING";
  const arrival=ride.status==="ARRIVED";
  const boardingReady=ride.status==="ACCEPTED"||arrival;
  const traveling=ride.status==="IN_PROGRESS";
  const vehicle=ride.vehicle_type==="MOTO";
  return <section aria-label="Painel da Corrida Rápida" data-passenger-live="true"
    className="caronaa-passenger-live flex h-full min-h-0 flex-col gap-2 text-white">
    <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1">
      <div className="min-w-0">
        <h2 className="truncate font-[family-name:var(--font-display)] text-base font-extrabold text-white">
          {stages[ride.status]}
        </h2>
        {!compact&&<p className="text-xs text-white/65">
          {searching?(searchDeadlinePassed?"Verificando encerramento da busca…":"Pedido ativo. Aguardando motorista disponível…"):
            arrival?"Informe o PIN ao motorista para iniciar a viagem":
            traveling?"Acompanhe seu trajeto no mapa":"Acompanhe a aproximação no mapa"}
        </p>}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFBB00]/10 px-2.5 py-1.5 text-xs font-extrabold text-[#FFBB00]">
        {searching?<Clock3 size={14} aria-hidden="true"/>:
          arrival?<KeyRound size={14} aria-hidden="true"/>:
          <CheckCircle2 size={14} aria-hidden="true"/>}
        {searching?(searchSecondsLeft===null?"Aguardando":`${Math.ceil(searchSecondsLeft/60)} min`):
          arrival?"No local":traveling?"Em viagem":"Aceita"}
      </span>
    </div>
    {compact ? <>
      {boardingReady?
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 p-2">
          <div className="min-w-0">
            <p className="text-xs text-white/70">Seu PIN de embarque</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[0.25em] text-[#FFBB00]">
              {boardingCode||"••••"}
            </p>
          </div>
          <button type="button" onClick={onExpand}
            className="min-h-11 shrink-0 rounded-xl border border-[#FFBB00]/50 px-3 text-sm font-bold text-[#FFBB00]">
            Ver código
          </button>
        </div>:
        <>
          {!traveling&&<QuickRideSearchActivity rideId={ride.id} status={ride.status} compact/>}
          {traveling&&<div className="flex min-w-0 items-center gap-2 px-1">
            {vehicle?<Bike size={17} className="shrink-0 text-[#FFBB00]"/>:
              <CarFront size={17} className="shrink-0 text-[#FFBB00]"/>}
            <span className="min-w-0 flex-1 truncate text-sm text-white/85">
              Destino: {destination||"Destino confirmado"}
            </span>
          </div>}
        </>}
      <div className="mt-auto flex shrink-0 gap-2 pb-1">
        <button type="button" onClick={onExpand}
          className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-white/25 px-2 text-xs font-bold">
          <ChevronUp size={16} aria-hidden="true"/> Detalhes
        </button>
        {onFollowMap&&<button type="button" onClick={onFollowMap}
          className="min-h-11 flex-[1.35] rounded-xl bg-[#FFBB00] px-2 text-sm font-extrabold text-[#121212]">
          Ver no mapa
        </button>}
      </div>
    </>:<>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-1">
        <QuickRideSearchActivity rideId={ride.id} status={ride.status} compact={false}/>
        {searching&&<p role="status" className="rounded-xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 px-3 py-2 text-xs text-white/85">
          O pedido continua visível aos motoristas elegíveis na sua área, mesmo que nenhum esteja online agora.
          Você pode cancelar a qualquer momento. Sem confirmação de um motorista, não há corrida iniciada.
        </p>}
        {boardingReady&&<div className="space-y-1 rounded-2xl border border-[#FFBB00]/65 bg-[#FFBB00]/10 p-3 text-center">
          <p className="text-sm font-bold text-white">{arrival?"Seu código de embarque":"Código para quando o motorista chegar"}</p>
          {boardingCode?
            <p role="status" className="font-[family-name:var(--font-display)] text-5xl font-black tracking-[0.15em] text-[#FFBB00]">
              {boardingCode}
            </p>:
            <button type="button" disabled={busy} onClick={onBoardingCode}
              className="min-h-12 w-full rounded-xl bg-[#FFBB00] text-sm font-extrabold text-[#121212] disabled:opacity-60">
              Gerar código de embarque
            </button>}
          <p className="text-xs text-white/75">Guarde estes quatro números. Informe ao motorista somente quando estiver no veículo.</p>
        </div>}
        {!compact&&<div data-trip-route-details="true" className="space-y-2 rounded-xl border border-white/15 bg-white/[0.045] p-3">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true"/>
            <div className="min-w-0"><p className="text-[11px] text-white/60">Embarque</p>
              <p className="line-clamp-2 text-xs font-semibold">{origin||"Local confirmado"}</p></div>
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <Navigation2 size={16} className="mt-0.5 shrink-0 text-[#FFBB00]" aria-hidden="true"/>
            <div className="min-w-0"><p className="text-[11px] text-white/60">Destino</p>
              <p className="line-clamp-2 text-xs font-semibold">{destination||"Destino confirmado"}</p></div>
          </div>
          {ride.fare_cents!=null&&Number.isFinite(ride.fare_cents)&&ride.fare_cents>0&&
            <div className="border-t border-white/10 pt-2 text-right">
              <p className="text-xs text-white/65">Valor da corrida</p>
              <p className="font-[family-name:var(--font-display)] text-xl font-extrabold text-[#FFBB00]">
                {formatBrl(ride.fare_cents/100)}
              </p>
            </div>}
        </div>}
        {rideRefreshError&&<p role="status" className="text-xs text-amber-200">
          Conexão instável. Mantemos a última situação confirmada.
        </p>}
      </div>
      <div className="mt-auto flex shrink-0 flex-wrap gap-2 border-t border-white/10 px-1 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {(searching||ride.status==="ACCEPTED"||arrival)&&
          <button type="button" onClick={onCancel} disabled={busy}
            className="min-h-12 flex-1 rounded-xl border border-white/30 bg-white/5 px-2 text-sm font-bold disabled:opacity-50">
            Cancelar pedido
          </button>}
        {onFollowMap&&<button type="button" onClick={onFollowMap}
          className="min-h-12 flex-[1.4] rounded-xl bg-[#FFBB00] px-2 text-sm font-extrabold text-[#121212]">
          <Navigation2 size={17} className="mr-1 inline" aria-hidden="true"/> Acompanhar no mapa
          </button>}
        {searching&&<button type="button" onClick={onRefresh}
          className="manual-status-refresh min-h-11 w-full text-xs font-semibold text-white/65">
          Atualizar situação
          </button>}
      </div>
    </>}
  </section>;
}
