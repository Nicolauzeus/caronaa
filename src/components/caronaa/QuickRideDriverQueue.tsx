import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock3, Navigation2, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { useQuickRideRealtime } from "@/lib/quick-rides/use-quick-ride-realtime";
import { QuickRidePostTripFlow } from "./QuickRidePostTripFlow";

type DriverQueueRide={
  id:string;vehicle_type:"CAR"|"MOTO";origin_label:string;
  destination_label:string;driver_receives_cents:number|null;
  fare_cents:number|null;distance_km?:number|null;expires_at:string;
};
export type ActiveDriverRide={
  id:string;role:string;status:string;vehicle_type:string;
  origin_label:string;destination_label:string;requested_at?:string|null;
};

function friendlyRideActionError(cause:{message?:string}|null,next:string):string{
  const message=typeof cause?.message==="string"?cause.message:"";
  if(next==="ACCEPT"){
    if(/VERIFIED_GPS_REQUIRED|GPS_STALE_SAMPLE|GPS_INVALID_FIX/i.test(message))
      return "Seu GPS expirou ou ficou impreciso. Ative a localização precisa, mantenha o app aberto e tente novamente.";
    if(/DRIVER_NOT_AUTHORIZED_OR_FEES|Motorista com 3 repasses/i.test(message))
      return "Acesso profissional ou repasses pendentes. Verifique sua conta antes de aceitar.";
    if(/OUTSIDE_DISPATCH_RADIUS/i.test(message))
      return "Este embarque está fora do raio permitido para sua localização atual.";
    if(/no longer approved|MUNICIPALITY_NOT_ENABLED/i.test(message))
      return "A cobertura ou tarifa deste trajeto mudou. Esta corrida não pode ser aceita agora.";
    if(/caronaa_quick_queue_events|column .*ride_id.*does not exist/i.test(message))
      return "O serviço de aceitação precisa ser atualizado. Tente novamente após a correção do sistema.";
    return "Falha na aceitação. Confira sua localização e tente novamente.";
  }
  if(next==="IN_PROGRESS")return "Código incorreto, expirado ou bloqueado. Confira com o passageiro.";
  if(next==="ARRIVED")return "Para registrar a chegada, esteja a até 75 m do embarque com GPS recente e preciso.";
  return "Não foi possível atualizar a corrida. Verifique sua conexão e disponibilidade.";
}

export function QuickRideDriverQueue({
  municipality,online,gpsReady,onActiveChange,onActiveRideChange,onHasPendingChange,
}:{
  municipality:string;online:boolean;gpsReady:boolean;
  onActiveChange?:(hasActive:boolean)=>void;
  onActiveRideChange?:(ride:ActiveDriverRide|null)=>void;
  onHasPendingChange?:(value:boolean)=>void;
}) {
  const [queue,setQueue]=useState<DriverQueueRide[]>([]);
  const [queueNow,setQueueNow]=useState(Date.now());
  const [active,setActive]=useState<ActiveDriverRide|null>(null);
  const [lastCompleted,setLastCompleted]=useState<ActiveDriverRide|null>(null);
  const [pendingReview,setPendingReview]=useState<ActiveDriverRide|null>(null);
  const [manualReviewOpen,setManualReviewOpen]=useState(false);
  const [manualReason,setManualReason]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [boardingPin,setBoardingPin]=useState("");
  const [dropoffDeadline,setDropoffDeadline]=useState<string|null>(null);
  const [dropoffResponse,setDropoffResponse]=useState<string|null>(null);
  const [dropoffNow,setDropoffNow]=useState(Date.now());
  const visibleQueue=queue.filter(ride=>Number.isFinite(Date.parse(ride.expires_at))&&
    Date.parse(ride.expires_at)>queueNow);
  useEffect(()=>{
    if(queue.length===0)return;
    const timer=window.setInterval(()=>setQueueNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[queue.length>0]);
  // Completed rides no longer hold the driver's cockpit or block new jobs.
  // Payment and optional feedback are accessible through Minhas viagens.
  useEffect(()=>{onHasPendingChange?.(visibleQueue.length>0);},
    [visibleQueue.length,onHasPendingChange]);
  useEffect(()=>{if(!dropoffDeadline)return;const timer=window.setInterval(()=>setDropoffNow(Date.now()),1000);return()=>window.clearInterval(timer);},[dropoffDeadline]);
  const remainingDropoffSeconds=dropoffDeadline?Math.max(0,Math.ceil((Date.parse(dropoffDeadline)-dropoffNow)/1000)):0;
  // The post-trip flow presents Pix and optional rating when the active ride becomes completed.
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
        setLastCompleted(requests.find(r=>r.role==="DRIVER"&&r.status==="COMPLETED")??null);
      setPendingReview(requests.find(r=>r.role==="DRIVER"&&r.status==="PENDING_REVIEW")??null);
        setPendingReview(requests.find(r=>r.role==="DRIVER"&&r.status==="PENDING_REVIEW")??null);
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
      setLastCompleted(requests.find(r=>r.role==="DRIVER"&&r.status==="COMPLETED")??null);
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
  // Time-based expiry does not emit a database UPDATE or Realtime event.
  // Revalidate the queue periodically while the driver is eligible; only
  // current, server-validated offers may be accepted.
  // Reconcile ACTIVE rides as well: Realtime events can be missed when
  // switching apps or when iOS suspends Safari. Without this, the cockpit
  // could remain IN_PROGRESS after the passenger confirmed dropoff.
  useEffect(()=>{
    if(!active&&(!online||!gpsReady))return;
    const timer=window.setInterval(()=>{
      if(!document.hidden)void refresh();
    },active?7000:15000);
    const onVisible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",onVisible);
    return()=>{
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",onVisible);
    };
  },[online,gpsReady,active?.id,active?.status,refresh]);
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
    if(next==="ACCEPT"){
      const offer=queue.find(ride=>ride.id===rideId);
      if(!offer||!Number.isFinite(Date.parse(offer.expires_at))||Date.parse(offer.expires_at)<=Date.now()){
        setQueue(items=>items.filter(item=>item.id!==rideId));
        setError("Esta solicitação expirou. Buscando chamados disponíveis.");
        void refresh();return;
      }
      if(!online||!gpsReady){
        setError("Seu GPS precisa estar publicado e atualizado antes de aceitar uma corrida.");
        return;
      }
    }
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
      if(rpcError){
        const message=String(rpcError?.message??"");
        if(next==="COMPLETED"&&/DROPOFF_GPS_UNVERIFIED|DROPOFF_TOO_FAR_FROM_DESTINATION/i.test(message)){
          setManualReviewOpen(true);
          throw new Error(/DROPOFF_TOO_FAR_FROM_DESTINATION/i.test(message)
            ?"O GPS não confirma que você chegou ao destino. Confira o local ou solicite análise manual sem cobrança."
            :"GPS do destino indisponível ou impreciso. Reative a localização ou solicite análise manual.");
        }
        throw new Error(friendlyRideActionError(rpcError,next));
      }
      if(accept && data!==true){
        rejected.current.add(rideId);
        setQueue(items=>items.filter(r=>r.id!==rideId));
        toast.error("Solicitação indisponível: pode ter expirado ou sido aceita por outro motorista.");
        await refresh();
        return;
      }
      if(data===false)throw new Error(next==="IN_PROGRESS"
        ?"Código de embarque inválido."
        :next==="ARRIVED"
          ?"Para confirmar a chegada, esteja a até 75 m do embarque, com precisão GPS de até 50 m e localização atualizada nos últimos 45 segundos."
          :"A atualização não foi autorizada para o estado atual.");
      if(next==="IN_PROGRESS")setBoardingPin("");
      if(next==="COMPLETED"){setManualReviewOpen(false);await loadDropoff(rideId);}
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
      if(next==="ACCEPT")void refresh();
    }finally{
      requestLock.current=false;
      setBusy(false);
    }
  };

  const requestManualReview=async(rideId:string)=>{
    const reason=manualReason.trim();
    if(busy||requestLock.current||reason.length<20||reason.length>1000){
      setError("Explique o motivo da solicitação manual em 20 a 1000 caracteres.");
      return;
    }
    requestLock.current=true;
    setBusy(true);setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc(
        "quick_ride_request_manual_review",{p_id:rideId,p_reason:reason});
      if(rpcError||data!==true)throw new Error("Não foi possível solicitar a análise manual. Tente novamente.");
      setManualReviewOpen(false);setManualReason("");
      toast.info("Corrida encaminhada para revisão administrativa, sem gerar cobrança.");
      await refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Erro ao abrir análise manual.");
    }finally{
      requestLock.current=false;setBusy(false);
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
             dropoffDeadline?<p role="status" className="rounded-xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 p-3 text-sm text-white/90">
               {remainingDropoffSeconds>0?`Aguardando confirmação do passageiro (${String(Math.floor(remainingDropoffSeconds/60)).padStart(2,"0")}:${String(remainingDropoffSeconds%60).padStart(2,"0")})`:
                 "Prazo encerrado. Aguardando conclusão confirmada pelo servidor."}
              </p>:
             <button type="button" disabled={busy} onClick={()=>void action(active.id,"COMPLETED")}
               className="professional-cockpit__primary-action w-full">Solicitar confirmação de desembarque</button>}
            {!dropoffDeadline&&<div className="rounded-xl border border-white/15 p-3">
              <button type="button" aria-expanded={manualReviewOpen}
                onClick={()=>setManualReviewOpen(value=>!value)}
                className="min-h-11 w-full text-sm font-semibold text-[#FFBB00]">
                GPS indisponível? Solicitar revisão do encerramento
              </button>
              {manualReviewOpen&&<div className="mt-2 space-y-2">
                <p className="text-xs text-white/70">O atendimento será liberado para análise, mas não será concluído nem cobrado automaticamente.</p>
                <label htmlFor="quick-manual-review-reason" className="block text-xs font-semibold">Explique por que não foi possível confirmar o destino</label>
                <textarea id="quick-manual-review-reason" rows={3} maxLength={1000}
                  value={manualReason} onChange={event=>setManualReason(event.target.value)}
                  placeholder="Ex.: GPS sem sinal no destino; passageiro já desembarcou"
                  className="min-h-24 w-full rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white"/>
                <button type="button" disabled={busy||manualReason.trim().length<20}
                  onClick={()=>void requestManualReview(active.id)}
                  className="min-h-12 w-full rounded-xl border border-[#FFBB00]/50 px-3 font-bold text-[#FFBB00] disabled:opacity-50">
                  Encaminhar para análise, sem cobrança
                </button>
              </div>}
            </div>}
          </>}
        </article>}
        {!active&&pendingReview&&<div role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
          <p className="font-bold text-[#FFBB00]">Encerramento em análise</p>
          <p className="mt-1 text-white/75">Esta corrida aguarda decisão administrativa. Sem cobrança ou comissão até a conclusão confirmada. Sua disponibilidade para novos chamados não depende desta revisão.</p>
        </div>}
        {!active&&visibleQueue.length===0&&<p role="status" className="text-sm text-white/70">
          Nenhuma corrida aguardando motorista neste momento.
        </p>}
        {!active&&visibleQueue.map(ride=><article key={ride.id}
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
    <QuickRidePostTripFlow role="DRIVER" activeRideId={active?.id??pendingReview?.id??null} completedRide={lastCompleted}/>
    {error&&<p role="alert" className="rounded-lg border border-red-300/40 p-3 text-xs text-red-200">{error}</p>}
  </section>;
}
