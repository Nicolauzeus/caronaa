import { useEffect, useRef, useState } from "react";
import { Clock3, MapPin, Navigation, Users } from "lucide-react";
import { formatBrl } from "@/lib/ride-cost";
import type { FlashDriverOrder } from "@/services/flash-driver-service";

type Props={
  order:FlashDriverOrder;onAnswer:(accept:boolean)=>Promise<void>;
  busy?:boolean;
};
const vibration=()=>{
  try{if(typeof navigator!=="undefined"&&"vibrate" in navigator)navigator.vibrate([200,100,200]);}
  catch{/* Optional phone feedback. */}
};
const tone=()=>{
  try {
    const Audio=(window as any).AudioContext||(window as any).webkitAudioContext;
    if(!Audio)return;
    const context=new Audio();
    for(const [index,freq] of [650,830].entries()){
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      const time=context.currentTime+index*0.14;
      oscillator.type="sine";oscillator.frequency.value=freq;
      gain.gain.setValueAtTime(0.001,time);
      gain.gain.exponentialRampToValueAtTime(0.06,time+0.025);
      gain.gain.exponentialRampToValueAtTime(0.001,time+0.12);
      oscillator.connect(gain);gain.connect(context.destination);
      oscillator.start(time);oscillator.stop(time+0.13);
    }
    void new Promise<void>(resolve=>setTimeout(resolve,360)).then(()=>context.close()).catch(()=>undefined);
  }catch{/* Autoplay policies can block sound; visual card remains usable. */}
};
export function FlashIncomingOrderCard({order,onAnswer,busy=false}:Props){
  // Never reset the deadline on Realtime refresh of the same offer ID.
  const deadline=useRef(Math.min(Date.parse(order.expiresAt),Date.now()+15000));
  const [remaining,setRemaining]=useState(()=>Math.max(0,Math.ceil((deadline.current-Date.now())/1000)));
  const answering=useRef(false);
  const answerRef=useRef(onAnswer);answerRef.current=onAnswer;
  useEffect(()=>{
    deadline.current=Math.min(Date.parse(order.expiresAt),Date.now()+15000);
    answering.current=false;
    setRemaining(Math.max(0,Math.ceil((deadline.current-Date.now())/1000)));
    vibration();
    tone();
    const tick=()=>{
      const left=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));
      setRemaining(left);
      if(left===0&&!answering.current){
        answering.current=true;
        void answerRef.current(false);
      }
    };
    tick();
    const clock=window.setInterval(tick,200);
    return()=>window.clearInterval(clock);
  },[order.id]);
  const respond=(accept:boolean)=>{
    if(answering.current||busy)return;
    answering.current=true;
    void answerRef.current(accept);
  };
  return <section aria-label="Novo chamado Flash" role="dialog" aria-modal="false"
    className="pointer-events-auto absolute left-3 right-3 top-[max(5rem,env(safe-area-inset-top))] z-40 mx-auto max-w-md space-y-3 rounded-3xl border-2 border-[#FFBB00] bg-[#121212]/95 p-4 text-white shadow-2xl backdrop-blur-xl"
    style={{fontFamily:"Manrope, sans-serif"}}>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
      <div className="h-full bg-[#FFBB00] transition-[width] duration-200"
        style={{width:remaining/15*100+"%"}}/>
    </div>
    <div className="flex items-center justify-between gap-2">
      <span className="rounded-full bg-[#FFBB00] px-3 py-1 text-xs font-black text-[#121212]">
        {order.mode==="ON_ROUTE"?"NA ROTA":"EXCLUSIVA"}
      </span>
      <span role="timer" className="flex items-center gap-1 font-[family-name:var(--font-display)] font-bold">
        <Clock3 size={16}/>{remaining}s
      </span>
    </div>
    <p className="flex items-center gap-2 text-sm text-white/75">
      <Users size={15}/> {order.seats} {order.seats===1?"vaga solicitada":"vagas solicitadas"}
      <span>· {order.distanceKm.toFixed(1)} km até o passageiro</span>
    </p>
    <div>
      <p className="text-xs text-white/65">Você recebe</p>
      <p className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[#FFBB00]">
        {formatBrl(order.driverEarnings)}
      </p>
    </div>
    <p className="flex items-start gap-2 text-sm"><MapPin size={16} className="shrink-0 text-[#FFBB00]"/>
      {order.pickupLabel}</p>
    <p className="flex items-start gap-2 text-sm"><Navigation size={16} className="shrink-0 text-[#FFBB00]"/>
      {order.dropoffLabel}</p>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={busy||remaining===0} onClick={()=>respond(false)}
        className="min-h-12 rounded-xl border border-white/30 bg-white/10 text-sm font-bold disabled:opacity-50">
        Recusar
      </button>
      <button type="button" disabled={busy||remaining===0} onClick={()=>respond(true)}
        className="min-h-12 rounded-xl bg-[#FFBB00] text-sm font-black text-[#121212] disabled:opacity-50">
        Aceitar Chamado
      </button>
    </div>
  </section>;
}
