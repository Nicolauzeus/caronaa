import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Navigation2, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { useQuickRideRealtime } from "@/lib/quick-rides/use-quick-ride-realtime";
import { QuickRideDriverSettlement } from "./QuickRideDriverSettlement";
import { QuickRideRatingModal } from "./QuickRideRatingModal";

type DriverQueueRide={
  id:string;vehicle_type:"CAR"|"MOTO";origin_label:string;
  destination_label:string;driver_receives_cents:number|null;
  fare_cents:number|null;distance_km?:number|null;
};
export type ActiveDriverRide={
  id:string;role:string;status:string;vehicle_type:string;
  origin_label:string;destination_label:string;
};

export function QuickRideDriverQueue({
  municipality,online,gpsReady,onActiveChange,onActiveRideChange,onHasPendingChange,
}:{
  municipality:string;online:boolean;gpsReady:boolean;
  onActiveChange?:(hasActive:boolean)=>void;
  onActiveRideChange?:(ride:ActiveDriverRide|null)=>void;
  onHasPendingChange?:(value:boolean)=>void;
}) {
  const [queue,setQueue]=useState<DriverQueueRide[]>([]);
  const [active,setActive]=useState<ActiveDriverRide|null>(null);
  const [lastCompleted,setLastCompleted]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [boardingPin,setBoardingPin]=useState("");
  const [dropoffDeadline,setDropoffDeadline]=useState<string|null>(null);
  const [dropoffResponse,setDropoffResponse]=useState<string|null>(null);
  const [ratingDismissed,setRatingDismissed]=useState<string|null>(null);
  const [completedDismissed,setCompletedDismissed]=useState<string|null>(null);
  const lastCompletedVisible=lastCompleted!==null && completedDismissed!==lastCompleted &&
    (()=>{try{return window.localStorage.getItem("caronaa-driver-dismissed:"+lastCompleted)!=="1";}catch{return true}})();
  useEffect(()=>{onHasPendingChange?.(queue.length>0 || lastCompletedVisible);},[queue.length,lastCompletedVisible,onHasPendingChange]);
  const releaseCompleted=()=>{
    if(!lastCompleted)return;
    try{
      window.localStorage.setItem("caronaa-driver-dismissed:"+lastCompleted,"1");
      window.localStorage.setItem("caronaa-rating-dismissed:"+lastCompleted,"1");
    }catch{}
    setCompletedDismissed(lastCompleted);
    setRatingDismissed(lastCompleted);
  };
  useEffect(()=>{
    onActiveChange?.(Boolean(active));
  },[active?.id,active?.status,onActiveChange]);
  useEffect(()=>()=>onActiveChange?.(false),[onActiveChange]);
  useEffect(()=>{ onActiveRideChange?.(active); },[active?.id,active?.status,onActiveRideChange]);
  const requestLock=useRef(false);
  const rejected=useRef(new Set<string>());
  const refreshVersion=useRef(0);

  const refresh=useCallback(async()=>{
    const version=++refreshVersion.current;
    const city=municipality.trim();
    if(!online||!gpsReady||!city){
      setQueue([]);
      // A driver must still see an accepted trip after GPS goes stale or a page reload.
      try{
        const {data,error:mineError}=await (supabase as any).rpc("quick_ride_my_requests");
        if(version!==refreshVersion.current||mineError)return;
        const requests:ActiveDriverRide[]=Array.isArray(data)?data:[];
        setActive(requests.find(r=>r.role==="DRIVER"&&
          ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(r.status))??null);
        setLastCompleted(requests.find(r=>r.role==="DRIVER"&&r.status==="COMPLETED")?.id??null);
      }catch{/* Availability stays blocked without a verified GPS fix. */}
      return;
    }
    try {
      const [offers,mine]=await Promise.all([
        (supabase as any).rpc("caronaa_quick_driver_queue",{p_municipality:city}),
        (supabase as any).rpc("quick_ride_my_requests"),
      ]);
      if(version!==refreshVersion.current)return;
      if(offers.error||mine.error){
        setError("Não foi possível consultar os chamados. Verifique conexão e GPS.");
        return;
      }
      const requests:ActiveDriverRide[]=Array.isArray(mine.data)?mine.data:[];
      setActive(requests.find(r=>r.role==="DRIVER" &&
        ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(r.status))??null);
      setLastCompleted(requests.find(r=>r.role==="DRIVER"&&r.status==="COMPLETED")?.id??null);
      setQueue((Array.isArray(offers.data)?offers.data:[]).filter(
        (ride:DriverQueueRide)=>!rejected.current.has(ride.id),
      ));
      setError("");
    }catch{
      if(version===refreshVersion.current)
        setError("Conexão temporariamente indisponível. Os chamados serão atualizados.");
    }
  },[municipality,online,gpsReady]);
  useEffect(()=>{void refresh();},[refresh]);
  useQuickRideRealtime(municipality,refresh,Boolean(active)||online&&gpsReady);
  const loadDropoff=useCallback(async(rideId:string)=>{
    const {data,error}=await (supabase as any).rpc("quick_ride_dropoff_state",{p_id:rideId});
    if(error)return;
    const entry=Array.isArray(data)?data[0]:null;
    setDropoffDeadline(entry?.deadline_at??null);
    setDropoffResponse(entry?.passenger_response??null);
  },[]);


  useEffect(()=>{
    if(!active?.id || active.status!=="IN_PROGRESS"){
      setDropoffDeadline(null);setDropoffResponse(null);return;
    }
    let alive=true;
    const load=async()=>{
      const {data,error}=await (supabase as any).rpc("quick_ride_dropoff_state",{p_id:active.id});
      if(!alive||error)return;
      const entry=Array.isArray(data)?data[0]:null;
      setDropoffDeadline(entry?.deadline_at??null);
      setDropoffResponse(entry?.passenger_response??null);
      if(entry?.deadline_at && !entry?.resolved_at && !entry?.passenger_response
        && Date.parse(entry.deadline_at)<=Date.now()){
        const {data:finished,error:finalError}=await (supabase as any).rpc(
          "quick_ride_finalize_after_timeout",{p_id:active.id});
        if(!finalError && finished===true && alive)void refresh();
      }
    };
    void load();
    const timer=window.setInterval(load,5000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[active?.id,active?.status,refresh]);
  useEffect(()=>{
    if(!online||!gpsReady||active?.status!=="ACCEPTED")return;
    let alive=true;
    const check=async()=>{
      const {data,error}=await (supabase as any).rpc("quick_ride_detect_arrival",{p_id:active.id});
      if(alive&&!error&&data===true)void refresh();
    };
    void check();
    const timer=window.setInterval(check,5000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[online,gpsReady,active?.id,active?.status,refresh]);
  const action=async(rideId:string,next:"ACCEPT"|"ARRIVED"|"IN_PROGRESS"|"COMPLETED")=>{
    if(requestLock.current)return;
    requestLock.current=true;
    setBusy(true);
    setError("");
    try {
      const accept=next==="ACCEPT";
      const rpc=next==="IN_PROGRESS"?"quick_ride_start_with_code":
        next==="COMPLETED"?"quick_ride_complete_ride":
        accept?"quick_ride_accept":"quick_ride_transition";
      const args=next==="IN_PROGRESS"?{p_id:rideId,p_code:boardingPin}:
        next==="COMPLETED"?{p_id:rideId}:
        accept?{p_id:rideId}:{p_id:rideId,p_status:next};
      const {data,error:rpcError}=await (supabase as any).rpc(rpc,args);
      if(rpcError)throw new Error(next==="IN_PROGRESS"
        ?"Código incorreto, expirado ou bloqueado. Confira com o passageiro."
        :next==="ARRIVED"
          ?"Não foi possível confirmar a chegada. Verifique se o GPS está recente, com precisão de até 50 m, e se você está a até 75 m do embarque."
          :"Não foi possível atualizar a corrida. Verifique GPS e disponibilidade.");
      if(accept && data!==true){
        rejected.current.add(rideId);
        setQueue(items=>items.filter(r=>r.id!==rideId));
        toast.error("Corrida já aceita por outro motorista da região.");
        await refresh();
        return;
      }
      if(data===false)throw new Error(next==="IN_PROGRESS"
        ?"Código de embarque inválido."
        :next==="ARRIVED"
          ?"Para confirmar a chegada, esteja a até 75 m do embarque, com precisão GPS de até 50 m e localização atualizada nos últimos 45 segundos."
          :"A atualização não foi autorizada para o estado atual.");
      if(next==="IN_PROGRESS")setBoardingPin("");
      if(next==="COMPLETED")await loadDropoff(rideId);
      if(accept){
        rejected.current.add(rideId);
        setQueue(items=>items.filter(r=>r.id!==rideId));
        toast.success("Corrida aceita. Continue no seu painel.");
      }else{
        toast.success(next==="ARRIVED"?"Chegada ao embarque registrada.":
          next==="IN_PROGRESS"?"Embarque validado. Viagem iniciada.":"Finalização enviada ao passageiro.");
      }
      await refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Não foi possível atualizar a corrida.");
    }finally{
      requestLock.current=false;
      setBusy(false);
    }
  };

  return <section aria-label="Chamados em tempo real na sua região"
    className="min-w-0 space-y-3 text-white">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FFBB00]/75">CARONAA · CORRIDAS</span>
        <h2 className="professional-cockpit__queue-heading text-white">{active ? "Corrida em andamento" : "Chamados em tempo real"}</h2>
        <p className="text-xs text-white/60">{municipality || "Município em verificação"}</p>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#FFBB00]/20 bg-[#FFBB00]/10 text-[#FFBB00]">
        <Route size={18} aria-hidden="true"/>
      </span>
    </div>
    {(!online||!gpsReady)&&!active?(
      <p role="status" className="text-sm text-white/75">
        {online?"Aguardando posição GPS publicada e válida no radar.":
          "Fique disponível e compartilhe o GPS para receber chamados."}
      </p>
    ):(
      <>
        {active&&<article className="space-y-4 rounded-2xl border border-[#FFBB00]/25 bg-white/[0.035] p-4" aria-label="Sua corrida em andamento">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-[Sora] text-base font-extrabold text-white">Sua corrida em andamento</h3>
            <span aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full border border-[#FFBB00]/25 bg-[#FFBB00]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#FFBB00]">
              <Navigation2 size={12} aria-hidden="true"/>
              {active.status==="ACCEPTED" ? "A caminho do embarque"
                : active.status==="ARRIVED" ? "No local · aguardando passageiro"
                  : active.status==="IN_PROGRESS" ? "Em viagem até o destino"
                    : active.status}
            </span>
          </div>
          <div className="professional-cockpit__timeline" aria-label="Origem e destino da corrida">
            <span className="professional-cockpit__timeline-marker" aria-hidden="true"/>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Embarque</p>
              <p className="mt-0.5 break-words text-sm font-semibold leading-relaxed text-white">{active.origin_label}</p>
            </div>
            <span className="professional-cockpit__timeline-line" aria-hidden="true"/>
            <span aria-hidden="true"/>
            <span className="professional-cockpit__timeline-marker professional-cockpit__timeline-marker--destination" aria-hidden="true"/>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Destino</p>
              <p className="mt-0.5 break-words text-sm font-semibold leading-relaxed text-white">{active.destination_label}</p>
            </div>
          </div>
          {active.status==="ACCEPTED"&&<p className="text-xs leading-relaxed text-white/65">
            Aproxime-se do local de embarque para liberar a confirmação de chegada. O servidor verifica o GPS.
          </p>}
          {active.status==="ACCEPTED"&&<button type="button" disabled={busy}
            onClick={()=>void action(active.id,"ARRIVED")}
            className="professional-cockpit__primary-action w-full">Cheguei no local</button>}
          {active.status==="ARRIVED"&&<>
            <label id="quick-ride-pin-help" htmlFor="quick-ride-driver-pin" className="block text-xs text-white/70">Informe os quatro dígitos fornecidos pelo passageiro.</label>
            <input id="quick-ride-driver-pin" type="text" inputMode="numeric" autoComplete="off"
              maxLength={4} value={boardingPin} onChange={event=>setBoardingPin(event.target.value.replace(/\D/g,"").slice(0,4))}
              placeholder="••••" aria-describedby="quick-ride-pin-help"
              className="h-14 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-center font-[Sora] text-2xl font-bold tracking-[0.5em] text-white placeholder:text-white/25 focus:border-[#FFBB00] focus:outline-none focus:ring-2 focus:ring-[#FFBB00]/25" />
            <button type="button"
              onClick={()=>void action(active.id,"IN_PROGRESS")} disabled={busy||boardingPin.length!==4}
              className="professional-cockpit__primary-action w-full">Validar código e iniciar viagem</button>
          </>}
          {active.status==="IN_PROGRESS"&&<>
            {dropoffResponse==="CONTESTED"?<p role="status" className="text-sm text-red-200">Desembarque contestado. Aguarde atendimento da plataforma.</p>:
             dropoffDeadline?<p role="status" className="text-sm text-white/80">Finalização solicitada. Aguardando confirmação do passageiro (janela de 30 segundos).</p>:
             <button type="button" disabled={busy} onClick={()=>void action(active.id,"COMPLETED")}
               className="professional-cockpit__primary-action w-full">Concluir Corrida</button>}
          </>}
        </article>}
        {!active&&lastCompletedVisible&&lastCompleted&&<div className="space-y-3">
          <QuickRideDriverSettlement rideId={lastCompleted}/>
          {ratingDismissed!==lastCompleted&&<QuickRideRatingModal rideId={lastCompleted} subject="passageiro"
            onClose={releaseCompleted}/>}
          <button type="button" onClick={releaseCompleted}
            className="professional-cockpit__primary-action flex w-full items-center justify-center gap-2 px-4">
            <CheckCircle2 size={18} aria-hidden="true"/> Liberar tela para novos chamados
          </button>
        </div>}
        {!active&&queue.length===0&&<p role="status" className="text-sm text-white/70">
          Nenhuma corrida aguardando motorista neste momento.
        </p>}
        {!active&&queue.map(ride=><article key={ride.id}
          className="min-w-0 space-y-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-[Sora] text-sm font-extrabold text-white">Nova solicitação</h3>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              {ride.vehicle_type==="MOTO"?"Mototáxi":"Carro"}
            </span>
          </div>
          <div className="professional-cockpit__timeline rounded-xl bg-white/[0.035] p-3" aria-label="Trajeto solicitado">
            <span className="professional-cockpit__timeline-marker" aria-hidden="true"/>
            <p className="min-w-0 break-words text-sm"><span className="font-bold text-emerald-300">Embarque</span> · {ride.origin_label}</p>
            <span className="professional-cockpit__timeline-line" aria-hidden="true"/>
            <span aria-hidden="true"/>
            <span className="professional-cockpit__timeline-marker professional-cockpit__timeline-marker--destination" aria-hidden="true"/>
            <p className="min-w-0 break-words text-sm"><span className="font-bold text-rose-300">Destino</span> · {ride.destination_label}</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/75">
            <Clock3 size={13} aria-hidden="true"/>
            {typeof ride.distance_km==="number"
              ?ride.distance_km.toFixed(1)+" km estimados"
              :"Distância detalhada após o aceite"}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-white/60">Você recebe</p>
            <p className="professional-cockpit__money text-2xl font-black tracking-tight text-[#FFBB00]">
              {typeof ride.driver_receives_cents==="number"
                ?formatBrl(ride.driver_receives_cents/100)
                :"Remuneração não informada"}
            </p>
          </div>
          {typeof ride.fare_cents==="number"&&
            <p className="text-xs text-white/55">Preço do passageiro: {formatBrl(ride.fare_cents/100)}</p>}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
            <button type="button" disabled={busy} aria-label="Dispensar esta solicitação"
              onClick={()=>{
                rejected.current.add(ride.id);
                setQueue(items=>items.filter(item=>item.id!==ride.id));
              }}
              className="min-h-[52px] rounded-xl border border-white/20 bg-white/5 px-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60">
              Dispensar
            </button>
            <button type="button" disabled={busy||!!active||
              typeof ride.driver_receives_cents!=="number"}
              onClick={()=>void action(ride.id,"ACCEPT")}
              className="professional-cockpit__primary-action px-2">
              {busy?"Processando…":"Aceitar corrida"}
            </button>
          </div>
        </article>)}
      </>
    )}
    {error&&<p role="alert" className="rounded-lg border border-red-300/40 p-3 text-xs text-red-200">{error}</p>}
  </section>;
}
