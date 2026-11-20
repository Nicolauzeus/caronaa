import { useState } from "react";
import { CircleCheck, Clock3, ChevronUp, MapPin, Navigation2, Radio, UserRound } from "lucide-react";
import type { FlashDriverRide, FlashPassengerDetails } from "@/services/flash-driver-service";
import type { SheetSnap } from "./InteractiveBottomSheet";

type Props={
  ride:FlashDriverRide;passenger:FlashPassengerDetails|null;snap:SheetSnap;whatsappUrl?:string|null;
  pin:string;onPinChange:(pin:string)=>void;
  busy:boolean;dropoffSent:boolean;
  manualCloseOpen:boolean;onToggleManualClose:()=>void;
  manualCloseReason:string;onManualCloseReason:(value:string)=>void;
  onArrived:()=>void;onStart:()=>void;onDropoff:()=>void;onManualClose:()=>void;
  onCancel:(reason:string)=>void;
  onSnapChange:(value:SheetSnap)=>void;
};
const status={
  ACCEPTED:"A caminho do embarque",
  ARRIVED:"Motorista no embarque",
  IN_PROGRESS:"Em viagem",
} as const;

export function FlashDriverActiveSheet({
  ride,passenger,snap,whatsappUrl,pin,onPinChange,busy,dropoffSent,
  manualCloseOpen,onToggleManualClose,manualCloseReason,onManualCloseReason,
  onArrived,onStart,onDropoff,onManualClose,onCancel,onSnapChange,
}:Props){
  const [confirmCancel,setConfirmCancel]=useState(false);
  const [cancelReason,setCancelReason]=useState("");
  const compact=snap==="peek";
  const name=passenger?.name||"Passageiro confirmado";
  const actionLabel=ride.status==="ACCEPTED"?"Cheguei ao embarque":
    ride.status==="ARRIVED"?"Inserir código de embarque":
    dropoffSent?"Aguardando confirmação":"Cheguei ao destino";
  const primaryAction=()=>{
    if(ride.status==="ACCEPTED")onArrived();
    else if(ride.status==="ARRIVED")onSnapChange("half");
    else onDropoff();
  };
  const isPending=ride.status==="IN_PROGRESS"&&dropoffSent;
  return <section aria-label="Corrida Flash em andamento" data-ride-active="true"
    className="caronaa-active-trip flex h-full min-h-0 flex-col text-white"
    style={{fontFamily:"Manrope, sans-serif"}}>
    <div className="shrink-0 space-y-1.5 px-1 pt-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-extrabold text-[#FFBB00]">
          <Radio size={14} className="shrink-0" aria-hidden="true"/>
          <span className="truncate">{status[ride.status]}</span>
        </span>
        <span className="ml-auto shrink-0 text-[11px] text-white/60">{ride.vehicleType==="MOTO"?"Flash Moto":"Flash Carro"}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FFBB00]/35 bg-white/10">
          {passenger?.photo?<img src={passenger.photo} alt="Foto do passageiro" className="size-full object-cover"/>:
            <UserRound size={20} className="text-white/80" aria-hidden="true"/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{name}</p>
          <p className="truncate text-xs text-white/65">
            {ride.status==="IN_PROGRESS"?"Destino: ":"Embarque: "}
            {ride.status==="IN_PROGRESS"?ride.destinationLabel:ride.originLabel}
          </p>
        </div>
        {compact&&<button type="button" aria-label="Expandir detalhes da corrida"
          onClick={()=>onSnapChange("half")}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/5">
          <ChevronUp size={19} aria-hidden="true"/>
        </button>}
      </div>
    </div>
    {compact?
      <div className="mt-auto grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 pt-2 pb-1">
        <button type="button" onClick={()=>onSnapChange("half")}
          className="flex min-h-12 items-center gap-1 rounded-xl border border-white/25 px-2.5 text-xs font-semibold">
          <ChevronUp size={16} aria-hidden="true"/> Detalhes
        </button>
        <button type="button" onClick={primaryAction} disabled={busy||isPending}
          className="min-h-12 min-w-0 rounded-xl bg-[#FFBB00] px-2 text-sm font-extrabold text-[#121212] disabled:opacity-60">
          {actionLabel}
        </button>
      </div>:
      <>
        <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-1 pb-2">
          <div data-trip-route-details="true" className="space-y-2 rounded-2xl border border-white/15 bg-white/[0.05] p-3">
            <div className="flex min-w-0 items-start gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true"/>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Embarque</p>
                <p className="break-words text-sm font-semibold">{ride.originLabel||"Ponto confirmado"}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <Navigation2 size={18} className="mt-0.5 shrink-0 text-[#FFBB00]" aria-hidden="true"/>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Destino</p>
                <p className="break-words text-sm font-semibold">{ride.destinationLabel||"Destino confirmado"}</p>
              </div>
            </div>
          </div>
          {ride.status==="ARRIVED"&&<div className="space-y-2 rounded-2xl border border-[#FFBB00]/45 bg-[#FFBB00]/[0.08] p-3">
            <label htmlFor="flash-rider-pin" className="block text-sm font-bold text-white">
              Código de embarque informado pelo passageiro
            </label>
            <input id="flash-rider-pin" type="text" inputMode="numeric" pattern="[0-9]*"
              autoComplete="one-time-code" maxLength={4} value={pin}
              onChange={event=>onPinChange(event.target.value.replace(/\D/g,"").slice(0,4))}
              placeholder="0000"
              className="h-14 w-full rounded-xl border border-[#FFBB00]/50 bg-[#121212] px-4 text-center text-2xl font-black tracking-[0.35em] text-[#FFBB00] outline-none focus:border-[#FFBB00]"/>
            <p className="text-xs text-white/70">Peça o PIN ao passageiro. Não inicie a viagem sem a confirmação.</p>
          </div>}
          {ride.status==="IN_PROGRESS"&&<p className="rounded-xl bg-white/[0.06] p-2.5 text-xs text-white/75">
            {dropoffSent?"Desembarque solicitado. Aguarde a confirmação do passageiro.":
              "Siga a rota no mapa. Solicite o desembarque ao chegar ao destino."}
          </p>}
          {ride.status==="IN_PROGRESS"&&!dropoffSent&&
            <div className="space-y-2">
              <button type="button" aria-expanded={manualCloseOpen} onClick={onToggleManualClose}
                className="min-h-11 w-full rounded-xl border border-white/20 px-3 text-sm font-semibold text-white/80">
                Sem GPS no destino? Solicitar revisão
              </button>
              {manualCloseOpen&&<div className="space-y-2 rounded-xl border border-[#FFBB00]/30 p-3">
                <p className="text-xs text-white/70">Descreva o problema para análise. Não haverá cobrança automática durante a revisão.</p>
                <label htmlFor="flash-close-reason" className="block text-sm font-semibold">Motivo da revisão</label>
                <textarea id="flash-close-reason" rows={2} maxLength={1000}
                  value={manualCloseReason} onChange={e=>onManualCloseReason(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/25 bg-[#121212] p-3 text-base text-white"/>
                <button type="button" disabled={busy||manualCloseReason.trim().length<20}
                  onClick={onManualClose}
                  className="min-h-12 w-full rounded-xl border border-[#FFBB00]/50 font-bold text-[#FFBB00] disabled:opacity-50">
                  Enviar para análise
                </button>
              </div>}
            </div>}
          <div className="rounded-xl border border-white/15 p-2">
            {!confirmCancel?<button type="button" disabled={busy}
              onClick={()=>setConfirmCancel(true)}
              className="min-h-11 w-full text-xs font-semibold text-rose-300">
              Cancelar corrida
            </button>:<div className="space-y-2" role="group" aria-label="Confirmar cancelamento da corrida">
              <p className="text-xs text-white/90">Cancelar esta corrida? O passageiro será avisado.</p>
              <input value={cancelReason} maxLength={500} aria-label="Motivo do cancelamento (opcional)"
                placeholder="Motivo (opcional)" onChange={e=>setCancelReason(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-white/30 bg-[#121212] px-3 text-base text-white"/>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>{setConfirmCancel(false);setCancelReason("");}}
                  className="min-h-11 rounded-lg border border-white/30 text-sm">Voltar</button>
                <button type="button" disabled={busy} onClick={()=>onCancel(cancelReason)}
                  className="min-h-11 rounded-lg bg-rose-700 text-sm font-bold disabled:opacity-50">Confirmar cancelamento</button>
              </div>
            </div>}
          </div>
          {snap==="full"&&whatsappUrl&&<a href={whatsappUrl}
            target="_blank" rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center rounded-xl border border-[#FFBB00]/40 px-3 text-sm font-bold text-[#FFBB00]">
            Falar com passageiro no WhatsApp
          </a>}
        </div>
        <div className="mt-auto grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-white/10 bg-[#121212] px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={()=>onSnapChange("peek")}
            className="flex min-h-12 items-center gap-1.5 rounded-xl border border-white/25 px-2.5 text-xs font-bold">
            <Navigation2 size={16} aria-hidden="true"/> Ver mapa
          </button>
          {ride.status==="ARRIVED"?
            <button type="button" disabled={busy||pin.length!==4} onClick={onStart}
              className="min-h-12 rounded-xl bg-[#FFBB00] px-2 text-sm font-black text-[#121212] disabled:opacity-50">
              Validar PIN e iniciar
            </button>:
            <button type="button" disabled={busy||isPending} onClick={primaryAction}
              className="min-h-12 rounded-xl bg-[#FFBB00] px-2 text-sm font-black text-[#121212] disabled:opacity-50">
              {actionLabel}
            </button>}
        </div>
      </>}
  </section>;
}
