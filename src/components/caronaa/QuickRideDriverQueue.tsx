import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { useQuickRideRealtime } from "@/lib/quick-rides/use-quick-ride-realtime";
import { QuickRidePixCard } from "./QuickRidePixCard";

type DriverQueueRide={
  id:string;vehicle_type:"CAR"|"MOTO";origin_label:string;
  destination_label:string;driver_receives_cents:number|null;
  fare_cents:number|null;distance_km?:number|null;
};
type ActiveDriverRide={
  id:string;role:string;status:string;vehicle_type:string;
  origin_label:string;destination_label:string;
};

export function QuickRideDriverQueue({
  municipality,online,gpsReady,
}:{
  municipality:string;online:boolean;gpsReady:boolean;
}) {
  const [queue,setQueue]=useState<DriverQueueRide[]>([]);
  const [active,setActive]=useState<ActiveDriverRide|null>(null);
  const [lastCompleted,setLastCompleted]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [boardingPin,setBoardingPin]=useState("");
  const [dropoffDeadline,setDropoffDeadline]=useState<string|null>(null);
  const [dropoffResponse,setDropoffResponse]=useState<string|null>(null);
  const requestLock=useRef(false);
  const rejected=useRef(new Set<string>());
  const refreshVersion=useRef(0);

  const refresh=useCallback(async()=>{
    const version=++refreshVersion.current;
    const city=municipality.trim();
    if(!online||!gpsReady||!city){
      setQueue([]);
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
      const activeRide=requests.find(r=>r.role==="DRIVER" && r.status==="IN_PROGRESS");
    }catch{
      if(version===refreshVersion.current)
        setError("Conexão temporariamente indisponível. Os chamados serão atualizados.");
    }
  },[municipality,online,gpsReady]);
  useQuickRideRealtime(municipality,refresh,online&&gpsReady);
  const loadDropoff=useCallback(async(rideId:string)=>{
    const {data,error}=await (supabase as any).rpc("quick_ride_dropoff_state",{p_id:rideId});
    if(error)return;
    const entry=Array.isArray(data)?data[0]:null;
    setDropoffDeadline(entry?.deadline_at??null);
    setDropoffResponse(entry?.passenger_response??null);
  },[]);


  const action=async(rideId:string,next:"ACCEPT"|"ARRIVED"|"IN_PROGRESS"|"COMPLETED")=>{
    if(requestLock.current)return;
    requestLock.current=true;
    setBusy(true);
    setError("");
    try {
      const accept=next==="ACCEPT";
      const rpc=next==="IN_PROGRESS"?"quick_ride_verify_boarding_pin":
        next==="COMPLETED"?"quick_ride_request_dropoff":
        accept?"quick_ride_accept":"quick_ride_transition";
      const args=next==="IN_PROGRESS"?{p_id:rideId,p_pin:boardingPin}:
        next==="COMPLETED"?{p_id:rideId}:
        accept?{p_id:rideId}:{p_id:rideId,p_status:next};
      const {data,error:rpcError}=await (supabase as any).rpc(rpc,args);
      if(rpcError)throw new Error(next==="IN_PROGRESS"
        ?"Código incorreto, expirado ou bloqueado. Confira com o passageiro."
        :"Não foi possível atualizar a corrida. Verifique GPS e disponibilidade.");
      if(accept && data!==true){
        rejected.current.add(rideId);
        setQueue(items=>items.filter(r=>r.id!==rideId));
        toast.error("Corrida já aceita por outro motorista da região.");
        await refresh();
        return;
      }
      if(data===false)throw new Error(next==="IN_PROGRESS"?"Código de embarque inválido.":"A atualização não foi autorizada para o estado atual.");
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
    className="min-w-0 space-y-3 rounded-2xl border border-[#FFBB00]/30 bg-[#121212] p-4 text-white">
    <div>
      <h2 className="text-lg font-bold text-[#FFBB00]">Chamados em tempo real na sua região</h2>
      <p className="text-xs text-white/70">
        {municipality||"Município ainda não verificado"} · GPS e autorização obrigatórios
      </p>
    </div>
    {!online||!gpsReady?(
      <p role="status" className="text-sm text-white/75">
        {online?"Aguardando posição GPS publicada e válida no radar.":
          "Fique disponível e compartilhe o GPS para receber chamados."}
      </p>
    ):(
      <>
        {active&&<article className="space-y-2 rounded-xl border border-[#FFBB00]/40 p-3">
          <p className="font-semibold text-[#FFBB00]">Sua corrida em andamento</p>
          <p className="text-sm">{active.origin_label} → {active.destination_label}</p>
          <p className="text-xs text-white/70">Status: {active.status}</p>
          {active.status==="ACCEPTED"&&<button type="button" disabled={busy}
            onClick={()=>void action(active.id,"ARRIVED")}
            className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-60">Cheguei</button>}
          {active.status==="ARRIVED"&&<>
            <label htmlFor="quick-ride-driver-pin" className="block text-xs text-white/70">Peça ao passageiro o código secreto de seis dígitos.</label>
            <input id="quick-ride-driver-pin" type="text" inputMode="numeric" autoComplete="off"
              maxLength={6} value={boardingPin} onChange={event=>setBoardingPin(event.target.value.replace(/\\D/g,"").slice(0,6))}
              placeholder="Código de embarque" className="min-h-12 w-full rounded-xl border border-white/30 bg-white/10 px-3 text-white" />
            <button type="button" disabled={busy}
              onClick={()=>void action(active.id,"IN_PROGRESS")} disabled={busy||boardingPin.length!==6}
              className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-60">Iniciar viagem</button>
          </>}
          {active.status==="IN_PROGRESS"&&<>
            {dropoffResponse==="CONTESTED"?<p role="status" className="text-sm text-red-200">Desembarque contestado. Aguarde atendimento da plataforma.</p>:
             dropoffDeadline?<p role="status" className="text-sm text-white/80">Finalização solicitada. Aguardando confirmação do passageiro (janela de 30 segundos).</p>:
             <button type="button" disabled={busy} onClick={()=>void action(active.id,"COMPLETED")}
               className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-60">Solicitar finalização</button>}
          </>}
        </article>}
        {!active&&lastCompleted&&<QuickRidePixCard rideId={lastCompleted}/>}
        {queue.length===0&&<p role="status" className="text-sm text-white/70">
          Nenhuma corrida aguardando motorista neste momento.
        </p>}
        {queue.map(ride=><article key={ride.id}
          className="min-w-0 space-y-2 rounded-xl border border-white/20 bg-white/5 p-3">
          <p className="font-semibold">{ride.vehicle_type==="MOTO"?"Moto":"Carro"} · Corrida Rápida</p>
          <p className="break-words text-sm">{ride.origin_label} → {ride.destination_label}</p>
          <p className="text-xs text-white/65">
            {typeof ride.distance_km==="number"
              ?ride.distance_km.toFixed(1)+" km estimados"
              :"Distância detalhada após o aceite"}
          </p>
          <p className="text-sm font-bold text-[#FFBB00]">
            {typeof ride.driver_receives_cents==="number"
              ?"Você recebe "+formatBrl(ride.driver_receives_cents/100)
              :"Remuneração não informada"}
          </p>
          {typeof ride.fare_cents==="number"&&
            <p className="text-xs">Preço do passageiro: {formatBrl(ride.fare_cents/100)}</p>}
          <button type="button" disabled={busy||!!active||
            typeof ride.driver_receives_cents!=="number"}
            onClick={()=>void action(ride.id,"ACCEPT")}
            className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-60">
            {busy?"Processando…":"Aceitar corrida"}
          </button>
        </article>)}
      </>
    )}
    {error&&<p role="alert" className="rounded-lg border border-red-300/40 p-3 text-xs text-red-200">{error}</p>}
  </section>;
}
