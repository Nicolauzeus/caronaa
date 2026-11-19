import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PendingDropoff = {
  ride_id: string;
  origin_label: string | null;
  destination_label: string | null;
  vehicle_type: string | null;
  ride_status: string;
  requested_at: string;
  deadline_at: string;
};

/** One authenticated passenger prompt for every AppShell page.
 * Pending requests come from participant-scoped SQL, not browser storage.
 * Missing consent is never counted as a completed ride or a paid fare.
 */
export function QuickRidePendingDropoffPrompt({userId}:{userId:string}) {
  const navigate=useNavigate();
  const [pending,setPending]=useState<PendingDropoff|null>(null);
  const [now,setNow]=useState(Date.now());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const inFlight=useRef(false);
  const stillMounted=useRef(true);
  const deferredRide=useRef<string|null>(null);

  const refresh=useCallback(async()=>{
    if(inFlight.current||document.hidden)return;
    inFlight.current=true;
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_pending_dropoff");
      if(rpcError)throw rpcError;
      if(!stillMounted.current)return;
      const next=Array.isArray(data)?data[0]??null:null;
      setPending(next);
      if(!next||next.ride_id!==deferredRide.current)deferredRide.current=null;
      setError("");
    }catch{
      // The guard is a separate RPC deployed by migration 0215.
      // No guessed ride is ever presented when the database is unavailable.
      if(stillMounted.current&&pending)setError("Não foi possível atualizar a confirmação. Tente novamente.");
    }finally{inFlight.current=false;}
  },[userId,pending?.ride_id]);

  useEffect(()=>{
    stillMounted.current=true;
    void refresh();
    const foreground=()=>{
      if(document.hidden)return;
      // "Responder depois" is only a temporary choice: on returning to
      // the app the pending request must be visible again.
      deferredRide.current=null;
      void refresh();
    };
    const event=()=>{void refresh();};
    window.addEventListener("focus",foreground);
    window.addEventListener("caronaa:quick-ride-dropoff-updated",event);
    document.addEventListener("visibilitychange",foreground);
    return()=>{
      stillMounted.current=false;
      window.removeEventListener("focus",foreground);
      window.removeEventListener("caronaa:quick-ride-dropoff-updated",event);
      document.removeEventListener("visibilitychange",foreground);
    };
  },[refresh]);

  useEffect(()=>{
    const every=window.setInterval(()=>{if(!document.hidden)void refresh();},
      pending?8_000:20_000);
    return()=>window.clearInterval(every);
  },[pending?.ride_id,refresh]);

  useEffect(()=>{
    if(!pending)return;
    setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[pending?.ride_id,pending?.deadline_at]);

  const visible=Boolean(pending&&pending.ride_id!==deferredRide.current);
  useEffect(()=>{
    if(!visible)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous;};
  },[visible]);

  const respond=async(response:"CONFIRMED"|"NOT_YET"|"CONTESTED")=>{
    if(!pending||busy)return;
    const rideId=pending.ride_id;
    setBusy(true);
    setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_respond_dropoff",{
        p_id:rideId,p_response:response,
      });
      if(rpcError||data!==true)throw rpcError??new Error("Resposta não registrada.");
      setPending(null);
      deferredRide.current=null;
      window.dispatchEvent(new Event("caronaa:quick-ride-dropoff-updated"));
      if(response==="CONFIRMED"){
        toast.success("Desembarque confirmado. Confira o pagamento e a avaliação.");
        void navigate({to:"/home"});
      }else if(response==="NOT_YET"){
        toast.info("Desembarque ainda não confirmado. O motorista foi informado.");
      }else{
        toast.info("Desembarque contestado. A plataforma poderá analisar a ocorrência.");
      }
    }catch(cause){
      setError(cause instanceof Error&&/DROPOFF_DRIVER_ALREADY_REASSIGNED/.test(cause.message)
        ?"O motorista já iniciou outra corrida. Use Contestar para informar que não desembarcou."
        :"Não foi possível registrar a resposta. Verifique a conexão e tente novamente.");
      void refresh();
    }finally{setBusy(false);}
  };

  if(typeof document==="undefined"||!visible||!pending)return null;
  const seconds=Math.max(0,Math.ceil((Date.parse(pending.deadline_at)-now)/1000));
  const deadlineElapsed=seconds===0;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/85 px-2 pb-2 pt-8 sm:items-center sm:p-4"
      role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="f07-dropoff-prompt-title"
        aria-describedby="f07-dropoff-prompt-description"
        className="w-full max-w-md space-y-3 overflow-y-auto overscroll-contain rounded-3xl border border-[#FFBB00]/60 bg-[#121212] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl"
        style={{maxHeight:"calc(100dvh - 20px)"}}>
        <div className="flex items-center gap-2 text-[#FFBB00]">
          <ShieldCheck size={20} aria-hidden="true"/>
          <span className="text-xs font-extrabold uppercase tracking-wider">Confirmação de corrida</span>
        </div>
        <h2 id="f07-dropoff-prompt-title" className="font-[Sora] text-xl font-black text-white">
          Você já desembarcou?
        </h2>
        <p id="f07-dropoff-prompt-description" className="text-sm leading-relaxed text-white/80">
          O motorista solicitou o encerramento da viagem. Confirme apenas se realmente chegou ao destino.
        </p>
        <div className="rounded-xl border border-white/15 bg-white/[0.055] p-3">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[#FFBB00]" aria-hidden="true"/>
            <span className="break-words">{pending.destination_label||"Destino da corrida"}</span>
          </p>
          <p className="mt-1 text-xs text-white/60">
            {pending.vehicle_type==="MOTO"?"Mototáxi":"Carro"} · solicitação registrada no CARONAA
          </p>
        </div>
        <p role="status" className="flex items-center gap-2 text-xs font-semibold text-white/70">
          <Clock3 size={15} aria-hidden="true"/>
          {deadlineElapsed
            ?"Prazo inicial encerrado. Sua resposta ainda pode ser registrada antes de uma decisão administrativa."
            :`Tempo para responder antes da análise: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`}
        </p>
        {error&&<p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
        <div className="grid gap-2">
          <button type="button" disabled={busy} onClick={()=>void respond("CONFIRMED")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-3 text-sm font-extrabold text-[#121212] disabled:opacity-50">
            <CheckCircle2 size={19} aria-hidden="true"/>
            {busy?"Registrando resposta...":"Sim, já desembarquei"}
          </button>
          <button type="button" disabled={busy} onClick={()=>void respond("NOT_YET")}
            className="min-h-12 rounded-xl border border-white/35 bg-white/10 px-3 text-sm font-bold disabled:opacity-50">
            Ainda estou na corrida
          </button>
          <button type="button" disabled={busy} onClick={()=>void respond("CONTESTED")}
            className="min-h-11 rounded-xl border border-white/20 px-3 text-xs font-bold text-white/80 disabled:opacity-50">
            Contestar encerramento
          </button>
        </div>
        <button type="button" disabled={busy} onClick={()=>{
          deferredRide.current=pending.ride_id;
          setPending(null);
        }} className="min-h-10 w-full text-xs font-semibold text-white/60 underline">
          Responder depois
        </button>
        <p className="text-center text-[11px] leading-relaxed text-white/55">
          Sem confirmação, não é gerada cobrança Pix nem comissão da plataforma.
          Sua solicitação fica salva e reaparece ao retornar ao aplicativo.
        </p>
      </section>
    </div>,document.body);
}
