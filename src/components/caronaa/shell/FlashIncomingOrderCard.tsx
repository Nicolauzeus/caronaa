import { useEffect, useRef, useState } from "react";
import { Clock3, MapPin, Navigation, Users } from "lucide-react";
import { formatBrl } from "@/lib/ride-cost";
import { isNotificationAudioReady, playNotificationSound, startLoop, stopLoop, unlockNotificationAudio } from "@/lib/notification-sound";
import { readNotificationSettings } from "@/lib/notification-settings";
import type { FlashDriverOrder } from "@/services/flash-driver-service";
import { QuickRidePassengerIdentity } from "../QuickRidePassengerIdentity";
import { stopQuickRideRequestView } from "@/lib/quick-rides/request-audience";

type Props={
  order:FlashDriverOrder;onAnswer:(accept:boolean)=>Promise<void>;
  busy?:boolean;
};
export function FlashIncomingOrderCard({order,onAnswer,busy=false}:Props){
  // Never reset the deadline on Realtime refresh of the same offer ID.
  const deadline=useRef(Math.min(Date.parse(order.expiresAt),Date.now()+30000));
  const [remaining,setRemaining]=useState(()=>Math.max(0,Math.ceil((deadline.current-Date.now())/1000)));
  const answering=useRef(false);
  const answerRef=useRef(onAnswer);answerRef.current=onAnswer;
  useEffect(()=>{
    deadline.current=Math.min(Date.parse(order.expiresAt),Date.now()+30000);
    answering.current=false;
    setRemaining(Math.max(0,Math.ceil((deadline.current-Date.now())/1000)));
    startLoop(order.id, deadline.current);
    const tick=()=>{
      const left=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));
      setRemaining(left);
      if(left===0&&!answering.current){
        stopLoop(order.id);
        void stopQuickRideRequestView(order.id).catch(()=>undefined);
        answering.current=true;
        void answerRef.current(false);
      }
    };
    tick();
    const clock=window.setInterval(tick,200);
    return()=>{window.clearInterval(clock);stopLoop(order.id);};
  },[order.id]);
  const respond=(accept:boolean)=>{
    if(answering.current||busy)return;
    answering.current=true;
    stopLoop(order.id);
    void stopQuickRideRequestView(order.id).catch(()=>undefined);
    void answerRef.current(accept);
  };
  return <section aria-label="Novo chamado Flash" role="dialog" aria-modal="false"
    data-testid="flash-request-drawer"
    className="pointer-events-auto fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-h-[78dvh] w-full max-w-lg flex-col gap-2.5 overflow-hidden rounded-t-[28px] border-x border-t border-[#FFBB00]/40 bg-[#121212] px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white shadow-[0_-18px_65px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:bottom-4 sm:rounded-3xl sm:border sm:pb-4"
    style={{fontFamily:"Manrope, sans-serif"}}>
    <div aria-hidden="true" className="mx-auto h-1.5 w-12 shrink-0 rounded-full bg-white/45"/>
    <div className="flex shrink-0 items-center justify-between gap-2">
      <h2 className="min-w-0 font-[family-name:var(--font-display)] text-lg font-black leading-tight sm:text-xl">
        Nova solicitação
      </h2>
      <span role="timer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#FFBB00]/70 bg-[#FFBB00]/10 px-2.5 py-1.5 text-sm font-extrabold tabular-nums text-[#FFBB00]">
        <Clock3 size={16} aria-hidden="true"/> 00:{String(remaining).padStart(2,"0")}
      </span>
    </div>
    <div className="h-1 shrink-0 overflow-hidden rounded-full bg-white/15">
      <div className="h-full rounded-full bg-[#FFBB00] transition-[width] duration-200 motion-reduce:transition-none"
        style={{width:remaining/30*100+"%"}}/>
    </div>
    <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain [scrollbar-width:none]">
      <QuickRidePassengerIdentity rideId={order.id}
        initialName={order.passengerName} initialPhoto={order.passengerPhoto}/>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/65">
        <span className="rounded-full bg-[#FFBB00]/15 px-2 py-1 font-bold text-[#FFBB00]">
          {order.mode==="ON_ROUTE"?"NA ROTA":"EXCLUSIVA"}
        </span>
        <span className="inline-flex items-center gap-1"><Users size={14} aria-hidden="true"/>{order.seats} {order.seats===1?"vaga":"vagas"}</span>
        <span>· {order.distanceKm.toFixed(1)} km até o embarque</span>
      </div>
      <div className="space-y-2 rounded-2xl bg-white/[0.055] p-2.5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            <MapPin size={15} aria-hidden="true"/>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white/60">Embarque</p>
            <p className="line-clamp-2 text-sm font-bold leading-snug">{order.pickupLabel}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FFBB00]/15 text-[#FFBB00]">
            <Navigation size={15} aria-hidden="true"/>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white/60">Destino</p>
            <p className="line-clamp-2 text-sm font-bold leading-snug">{order.dropoffLabel}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] text-white/60">Valor a receber</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-black text-[#FFBB00]">
            {formatBrl(order.driverEarnings)}
          </p>
        </div>
        <p className="text-right text-xs text-white/65">{order.distanceKm.toFixed(1)} km até o passageiro</p>
      </div>
      {remaining>0&&readNotificationSettings().soundEnabled&&!isNotificationAudioReady()&&
        <button type="button"
          className="min-h-11 w-full rounded-xl border border-[#FFBB00]/45 bg-[#FFBB00]/10 px-3 text-xs font-semibold text-[#FFBB00]"
          onClick={()=>{
            void unlockNotificationAudio().then(()=>{
              if(!answering.current&&Date.now()<deadline.current)
                void playNotificationSound("order_incoming_loop",order.id);
            });
          }}>
          Ativar som do chamado
        </button>}
    </div>
    <div className="grid shrink-0 grid-cols-[1fr_1.35fr] gap-2 border-t border-white/10 pt-2">
      <button type="button" aria-label="Recusar" disabled={busy||remaining===0}
        onClick={()=>respond(false)}
        className="min-h-12 rounded-xl border border-white/30 bg-white/[0.08] px-2 text-sm font-bold disabled:opacity-50">
        Dispensar
      </button>
      <button type="button" aria-label="Aceitar Chamado" disabled={busy||remaining===0}
        onClick={()=>respond(true)}
        className="min-h-12 rounded-xl bg-[#FFBB00] px-2 text-sm font-black text-[#121212] disabled:opacity-50">
        Aceitar corrida
      </button>
    </div>
  </section>;
}
