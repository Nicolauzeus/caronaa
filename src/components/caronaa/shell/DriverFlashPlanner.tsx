import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, MapPin, Navigation, Radio, Signal, UserRound } from "lucide-react";
import { toast } from "sonner";
import { stopLoop, unlockNotificationAudio } from "@/lib/notification-sound";
import { supabase } from "@/integrations/supabase/client";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { useQuickRideRealtime } from "@/lib/quick-rides/use-quick-ride-realtime";
import { useFlashDriverPresence } from "@/hooks/use-flash-driver-presence";
import {
  FlashDriverError, getFlashDriverRadarOrders, getMyActiveFlashRide, getMyFlashRideSnapshot,
  getFlashPassengerDetails, markFlashDriverArrived, respondFlashOrder,
  startFlashRideWithPin, type FlashDriverMode, type FlashDriverOrder,
  type FlashDriverRide, type FlashPassengerDetails,
} from "@/services/flash-driver-service";
import { FlashIncomingOrderCard } from "./FlashIncomingOrderCard";
import { FlashDriverActiveSheet } from "./FlashDriverActiveSheet";
import { QuickRidePostTripFlow } from "../QuickRidePostTripFlow";
import type { CompletedQuickRideRef } from "@/lib/quick-rides/post-trip-prompt";
import { ServiceTypeDock, type ServiceType } from "./ServiceTypeDock";
import type { SheetSnap } from "./InteractiveBottomSheet";
import type { ShellRoute } from "./ShellJourneyPlanner";
import type { FormLocationDetails } from "@/lib/location/types";

type Point={lat:number;lng:number};
type Props={
  snap:SheetSnap;onSnapChange:(next:SheetSnap)=>void;
  serviceType:ServiceType;onServiceTypeChange:(next:ServiceType)=>void;
  vehicleType:"CAR"|"MOTO";municipality:string;
  originPoint?:Point|null;originLabel?:string;originRevision?:number;
  onAdjustOrigin:()=>void;
  onRouteChange:(route:ShellRoute|null,origin:Point|null)=>void;
  onDestinationChange?:(label:string,details?:FormLocationDetails)=>void;
  onActiveRideChange?:(ride:FlashDriverRide|null)=>void;
};
const valid=(p:{lat?:number;lng?:number}|null|undefined):p is Point=>
  !!p&&Number.isFinite(p.lat)&&Math.abs(p.lat!)<=90&&
  Number.isFinite(p.lng)&&Math.abs(p.lng!)<=180;
const modeButtons:[FlashDriverMode,string][]=[
  ["ALL","Aceito tudo"],["ON_ROUTE","Apenas Na Rota"],["EXCLUSIVE","Apenas Exclusiva"],
];
function normalizeWhatsapp(value:string|null|undefined){
  const raw=(value??"").replace(/\D/g,"");
  const number=raw.startsWith("55")?raw.slice(2):raw;
  return /^[1-9][0-9]9[0-9]{8}$/.test(number)?"https://wa.me/55"+number:null;
}

export function DriverFlashPlanner({
  snap,onSnapChange,serviceType,onServiceTypeChange,vehicleType,municipality,
  originPoint,originLabel,originRevision=0,onAdjustOrigin,onRouteChange,
  onDestinationChange,onActiveRideChange,
}:Props){
  const presence=useFlashDriverPresence();
  const [destination,setDestination]=useState("");
  const [destPoint,setDestPoint]=useState<FormLocationDetails>();
  const [mode,setMode]=useState<FlashDriverMode>("ALL");
  const [seats,setSeats]=useState(1);
  const [onlineRoute,setOnlineRoute]=useState<ShellRoute|null>(null);
  const [active,setActive]=useState<FlashDriverRide|null>(null);
  const [completedRide,setCompletedRide]=useState<CompletedQuickRideRef|null>(null);
  const priorRidePhase=useRef<string|null>(null);
  const [passenger,setPassenger]=useState<FlashPassengerDetails|null>(null);
  const [orders,setOrders]=useState<FlashDriverOrder[]>([]);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [queueError,setQueueError]=useState("");
  const [acting,setActing]=useState(false);
  const [pin,setPin]=useState("");
  const [busyRide,setBusyRide]=useState(false);
  const routeReader=useServerFn(getMapDrivingRoute);
  const routeRef=useRef(routeReader);routeRef.current=routeReader;
  const routeCache=useRef(new Map<string,Promise<ShellRoute>>());
  const lastOnRoute=useRef<{route:ShellRoute;from:Point}|null>(null);
  const readVersion=useRef(0);
  const answerLock=useRef(false);
  const ignored=useRef(new Set<string>());
  const refreshCallback=useRef<()=>Promise<void>>(async()=>{});

  // Keep the map callback stable even when Home rerenders.
  const onRouteRef=useRef(onRouteChange);onRouteRef.current=onRouteChange;
  const onRideRef=useRef(onActiveRideChange);onRideRef.current=onActiveRideChange;
  const onDestinationRef=useRef(onDestinationChange);onDestinationRef.current=onDestinationChange;
  useEffect(()=>{if(vehicleType==="MOTO")setSeats(1);},[vehicleType]);

  const refresh=useCallback(async()=>{
    const version=++readVersion.current;
    try{
      const [current,offers]=await Promise.allSettled([
        getMyFlashRideSnapshot(),
        presence.online&&presence.gpsConnected
          ?getFlashDriverRadarOrders():Promise.resolve([] as FlashDriverOrder[]),
      ]);
      if(version!==readVersion.current)return;
      if(current.status==="fulfilled"){
        const ride=current.value.active;
        setActive(ride);
        setCompletedRide(current.value.completed);
        const phase=ride?ride.id+":"+ride.status:null;
        // Avoid recreating the active Google map on every queue heartbeat.
        if(phase!==priorRidePhase.current)onRideRef.current?.(ride);
        // Do not snap shut again on every Realtime/heartbeat refresh.
        if(ride && phase!==priorRidePhase.current){
          onSnapChange(ride.status==="ARRIVED"?"half":"peek");
          void getFlashPassengerDetails(ride.id).then(setPassenger);
        }else if(!ride)setPassenger(null);
        priorRidePhase.current=phase;
      }
      if(offers.status==="fulfilled"){
        setOrders(offers.value.filter(order=>!ignored.current.has(order.id)&&
          Date.parse(order.expiresAt)>Date.now()));
        setQueueError("");
      }else{
        setQueueError("Chamados indisponíveis. Confira o GPS e o serviço Flash.");
        setOrders([]);
      }
    }catch{
      if(version===readVersion.current)setQueueError("Não foi possível atualizar os chamados.");
    }
  },[presence.online,presence.gpsConnected,onSnapChange]);
  refreshCallback.current=refresh;
  useEffect(()=>{void refresh();},[refresh]);
  useQuickRideRealtime(municipality,()=>{
    void refreshCallback.current();
  },Boolean((presence.online&&presence.gpsConnected)||active));
  useEffect(()=>()=>{readVersion.current+=1;onRideRef.current?.(null);},[]);

  const changeService=(next:ServiceType)=>{
    if(next!==serviceType&&(active||presence.online)){
      toast.info("Fique indisponível e finalize corridas ativas antes de mudar de serviço.");
      return;
    }
    onServiceTypeChange(next);
  };
  const pickDestination=(label:string,details?:FormLocationDetails)=>{
    if(presence.online)return;
    setDestination(label);setDestPoint(details);
    setOnlineRoute(null);lastOnRoute.current=null;
    onRouteRef.current(null,null);
    onDestinationRef.current?.(label,details);
    if(mode==="ON_ROUTE"&&!valid(details))setMode("ALL");
    if(valid(details))onSnapChange("half");
  };
  const activate=async()=>{
    void unlockNotificationAudio();
    if(presence.busy||presence.online)return;
    if(mode==="ON_ROUTE"&&!valid(destPoint)){
      toast.info("Escolha um destino para receber chamadas Na Rota.");
      onSnapChange("half");return;
    }
    try{
      let route:ShellRoute|null=null;
      let from:Point|null=null;
      if(valid(destPoint)){
        const origin=valid(originPoint)?originPoint:presence.gps&&valid(presence.gps)?presence.gps:null;
        if(!origin){
          toast.error("Confirme a origem GPS antes de traçar seu caminho.");
          onSnapChange("half");return;
        }
        from={lat:origin.lat,lng:origin.lng};
        const key=[from.lat,from.lng,destPoint.lat!,destPoint.lng!].map(n=>n.toFixed(6)).join(":");
        let pending=routeCache.current.get(key);
        if(!pending){
          pending=routeRef.current({data:{points:[from,{lat:destPoint.lat!,lng:destPoint.lng!}]}}).then(result=>{
            if(!Array.isArray(result.routePath)||result.routePath.length<2||
              !Number.isFinite(result.distanceKm)||result.distanceKm<=0)
              throw new Error("ROUTE_UNAVAILABLE");
            return {routePath:result.routePath,distanceKm:result.distanceKm,
              durationMinutes:result.durationMinutes};
          });
          routeCache.current.set(key,pending);
          void pending.catch(()=>routeCache.current.delete(key));
        }
        route=await pending;
      }
      // Without a destination, only EXCLUSIVE bookings can be routed safely.
      const effectiveMode=valid(destPoint)?mode:"EXCLUSIVE";
      if(effectiveMode!==mode)setMode(effectiveMode);
      const config={
        online:true as const,mode:effectiveMode,seats:vehicleType==="MOTO"?1:seats,vehicleType,
        destination:valid(destPoint)?{lat:destPoint.lat!,lng:destPoint.lng!,label:destination}:null,
        routePath:route?.routePath??null,
      };
      const enabled=await presence.goOnline(config);
      if(!enabled)return;
      // A server-acknowledged online state is the only source of truth for map overlay.
      // Hook state commits asynchronously; refresh on next render after confirmation.
      if(route&&from){lastOnRoute.current={route,from};setOnlineRoute(route);}
    }catch{
      toast.error("Não foi possível obter a rota. Confira origem e destino.");
    }
  };
  useEffect(()=>{
    if(presence.online&&onlineRoute&&lastOnRoute.current)
      onRouteRef.current(onlineRoute,lastOnRoute.current.from);
    if(!presence.online){
      setOnlineRoute(null);
      lastOnRoute.current=null;
      onRouteRef.current(null,null);
    }
  },[presence.online,onlineRoute]);
  const deactivate=async()=>{
    if(active){
      toast.info("Finalize a corrida em andamento antes de ficar indisponível.");
      return;
    }
    await presence.markOffline();
    setOrders([]);ignored.current.clear();setDismissed([]);
  };
  const answer=async(accept:boolean)=>{
    if(!orders.length||answerLock.current)return;
    const candidate=orders.find(order=>!ignored.current.has(order.id));
    if(!candidate)return;
    stopLoop(candidate.id);
    answerLock.current=true;setActing(true);
    try{
      const result=await respondFlashOrder(candidate.id,accept);
      ignored.current.add(candidate.id);
      setDismissed(items=>[...items,candidate.id]);
      setOrders(items=>items.filter(x=>x.id!==candidate.id));
      if(result==="ACCEPTED"){
        toast.success("Chamado aceito. A caminho do embarque.");
        const next=await getMyActiveFlashRide();
        if(next){setActive(next);onRideRef.current?.(next);onSnapChange("peek");}
        await refresh();
      }
    }catch(error){
      if(error instanceof FlashDriverError&&error.code==="ALREADY_TAKEN")
        toast.info("Corrida já aceita por outro motorista da região");
      else if(error instanceof FlashDriverError&&error.code==="EXPIRED")
        toast.info("O prazo desse chamado expirou.");
      else toast.error("Não foi possível responder ao chamado.");
      ignored.current.add(candidate.id);
      setOrders(items=>items.filter(x=>x.id!==candidate.id));
      void refresh();
    }finally{answerLock.current=false;setActing(false);}
  };
  const transition=async(next:"ARRIVED"|"IN_PROGRESS")=>{
    if(!active||busyRide)return;
    setBusyRide(true);
    try{
      if(next==="ARRIVED")await markFlashDriverArrived(active.id);
      else await startFlashRideWithPin(active.id,pin);
      setPin("");
      toast.success(next==="ARRIVED"?"Chegada ao embarque registrada.":"PIN confirmado. Viagem iniciada.");
      await refresh();
    }catch{
      toast.error(next==="ARRIVED"?
        "Chegada não confirmada. Confira a precisão GPS e a distância ao embarque.":
        "PIN inválido ou não autorizado. Confira com o passageiro.");
    }finally{setBusyRide(false);}
  };
  const [dropoffSent,setDropoffSent]=useState(false);
  const [manualCloseOpen,setManualCloseOpen]=useState(false);
  const [manualCloseReason,setManualCloseReason]=useState("");
  useEffect(()=>{if(active?.status!=="IN_PROGRESS")setDropoffSent(false);},[active?.id,active?.status]);
  const requestDropoff=async()=>{
    if(!active||busyRide)return;
    setBusyRide(true);
    try{
      const {data,error}=await (supabase as any).rpc("quick_ride_complete_ride",{p_id:active.id});
      if(error||data!==true){
        if(/DROPOFF_GPS_UNVERIFIED|DROPOFF_TOO_FAR_FROM_DESTINATION/i.test(String(error?.message??"")))
          setManualCloseOpen(true);
        throw new Error("DROPOFF");
      }
      setDropoffSent(true);
      toast.success("Desembarque enviado ao passageiro.");
      await refresh();
    }catch{toast.error("Não foi possível confirmar o GPS no destino. Verifique o local ou peça análise manual.");}
    finally{setBusyRide(false);}
  };
  const requestManualClose=async()=>{
    if(!active||busyRide||manualCloseReason.trim().length<20)return;
    setBusyRide(true);
    try{
      const {data,error}=await (supabase as any).rpc(
        "quick_ride_request_manual_review",
        {p_id:active.id,p_reason:manualCloseReason.trim()});
      if(error||data!==true)throw new Error("REVIEW_UNAVAILABLE");
      setManualCloseOpen(false);setManualCloseReason("");setDropoffSent(true);
      toast.info("Confirmação manual enviada ao passageiro. Sem resposta em 120 segundos, irá para análise sem cobrança.");
      await refresh();
    }catch{toast.error("Não foi possível enviar o encerramento para análise. Tente novamente.");}
    finally{setBusyRide(false);}
  };
  useEffect(()=>{
    if(presence.error?.includes("COMMISSION_BLOCKED"))
      toast.error("A regra financeira do servidor está desatualizada. É necessária a migration 0212.");
  },[presence.error]);
  const canListen=presence.online&&presence.gpsConnected&&
    (!active||((active.mode??passenger?.rideMode)==="ON_ROUTE"&&
      (passenger?.seatsRemaining??0)>0));
  const visibleOrders=orders.filter(order=>!ignored.current.has(order.id));
  const current=visibleOrders[0]??null;
  return <>
    <section aria-label="CARONAA Flash motorista"
      className={active?"flex h-full min-h-0 flex-col overflow-hidden text-white":"space-y-2 pb-3 text-white"}
      style={{fontFamily:"Manrope, sans-serif"}}>
      {!active&&snap==="peek"&&<>
        <LocationAutocomplete id="flash-driver-destination" label="Para onde você vai? (opcional)"
          value={destination} selectedLocation={destPoint} variant="glass"
          placeholder="Para onde você vai?" onChange={pickDestination}/>
        <p className="text-[11px] leading-snug text-white/70">
          Opcional: atenda passageiros Na Rota do seu caminho ou deixe vazio para corridas Exclusivas.
        </p>
        {presence.online?<div className="space-y-1">
          <span className="inline-flex items-center gap-2 text-xs text-emerald-300">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400"/> Online
          </span>
          <button type="button" disabled={presence.busy} onClick={()=>void deactivate()}
            className="min-h-12 w-full rounded-xl border border-red-400/70 bg-[#251316] font-bold text-white">
            Ficar Indisponível
          </button>
        </div>:
          <button type="button" disabled={presence.busy} onClick={()=>void activate()}
            className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-50">
            {presence.busy?"Ativando GPS...":"Ficar Disponível"}
          </button>}
        <ServiceTypeDock value={serviceType} onChange={changeService} compact/>
      </>}
      {!active&&snap==="half"&&<>
        <LocationAutocomplete id="flash-driver-dest-edit" label="Para onde você vai? (opcional)"
          value={destination} selectedLocation={destPoint} variant="glass"
          placeholder="Destino opcional" onChange={pickDestination}/>
        <fieldset className="space-y-2"><legend className="font-bold">Modo de atendimento</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {modeButtons.map(([value,label])=><button key={value} type="button"
              disabled={presence.online||(value==="ON_ROUTE"&&!valid(destPoint))}
              aria-pressed={mode===value} onClick={()=>setMode(value)}
              className={"min-h-12 rounded-xl border px-1 text-xs font-bold "+(mode===value?
                "border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/25 bg-white/5")}>
              {label}
            </button>)}
          </div>
        </fieldset>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">Vagas livres
          <select aria-label="Vagas livres" value={vehicleType==="MOTO"?1:seats}
            disabled={vehicleType==="MOTO"||presence.online}
            onChange={e=>setSeats(Number(e.target.value))}
            className="min-h-12 rounded-xl border border-white/25 bg-[#121212] px-4">
            {Array.from({length:vehicleType==="MOTO"?1:4},(_,i)=>i+1)
              .map(n=><option value={n} key={n}>{n}</option>)}
          </select>
        </label>
        <p className="flex min-h-10 items-center gap-2 text-sm">
          <Signal size={18} className={presence.gpsConnected?"text-emerald-300":"text-[#FFBB00]"}/>
          GPS: {presence.gps?Math.round(presence.gps.accuracyM)+" m de precisão":"aguardando sinal"} ·
          {presence.gpsConnected?" conectado":" sem publicação"}
        </p>
        <button type="button" onClick={onAdjustOrigin}
          className="flex min-h-11 items-center gap-2 text-sm text-[#FFBB00]">
          <MapPin size={16}/> Ajustar origem no mapa
        </button>
        <ServiceTypeDock value={serviceType} onChange={changeService}/>
        <button type="button" disabled={presence.busy} onClick={()=>void (presence.online?deactivate():activate())}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-50">
          {presence.online?"Ficar Indisponível":"Ficar Disponível"}
        </button>
      </>}
      {!active&&snap==="full"&&<>
        <button type="button" onClick={()=>onSnapChange("half")}
          className="min-h-11 text-[#FFBB00]">Voltar às opções Flash</button>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Disponibilidade Flash</h2>
        <p className="text-sm">Modo: {mode==="ALL"?"Aceito tudo":mode==="ON_ROUTE"?"Apenas Na Rota":"Apenas Exclusiva"}</p>
        <p className="text-sm">{vehicleType==="MOTO"?1:seats} vaga(s) · {destination||"Sem destino definido"}</p>
        <button type="button" disabled={presence.busy} onClick={()=>void(presence.online?deactivate():activate())}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]">
          {presence.online?"Ficar Indisponível":"Ficar Disponível"}
        </button>
      </>}
      {presence.error&&<p role="alert" className="flex items-start gap-2 rounded-xl border border-[#FFBB00]/50 p-3 text-xs">
        <CircleAlert size={16} className="shrink-0 text-[#FFBB00]"/>{presence.error}
      </p>}
      {queueError&&presence.online&&!active&&<p role="status" className="text-xs text-white/70">{queueError}</p>}
      {active&&<FlashDriverActiveSheet ride={active} passenger={passenger} snap={snap}
        whatsappUrl={normalizeWhatsapp(passenger?.whatsapp)}
        pin={pin} onPinChange={setPin} busy={busyRide} dropoffSent={dropoffSent}
        manualCloseOpen={manualCloseOpen} onToggleManualClose={()=>setManualCloseOpen(v=>!v)}
        manualCloseReason={manualCloseReason} onManualCloseReason={setManualCloseReason}
        onArrived={()=>void transition("ARRIVED")}
        onStart={()=>void transition("IN_PROGRESS")}
        onDropoff={()=>void requestDropoff()}
        onManualClose={()=>void requestManualClose()}
        onSnapChange={onSnapChange}/>}
      {!presence.online&&snap!=="peek"&&
        <p className="text-xs text-white/65">Para receber chamados, ative o GPS e sua disponibilidade.</p>}
    </section>
    <QuickRidePostTripFlow role="DRIVER" activeRideId={active?.id??null} completedRide={completedRide}/>
    {canListen&&current&&typeof document!=="undefined"&&createPortal(
      <FlashIncomingOrderCard key={current.id} order={current} busy={acting}
        onAnswer={answer}/>,document.body
    )}
  </>;
}
