import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuickRideApproach, getQuickRideMapContext } from "@/lib/quick-ride-map.functions";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { GoogleMapSurface } from "./GoogleMapSurface";
import {
  driverNavigationPhase, validNavigationPoint, needsDriverReroute,
  estimateDriverRouteRemaining,
  type NavigationPhase,
} from "@/lib/quick-rides/driver-navigation";

type Route = {routePath:Array<{lat:number;lng:number}>;distanceKm:number;durationMinutes:number};
type Point={lat:number;lng:number};
type Context={origin:Point;destination:Point;driver:(Point&{seenAt:string;sampledAt?:string;accuracyM?:number})|null;status:string};
type DriverDetails={name:string;photo:string|null;vehicle:string|null;plate:string|null;vehicleType:string};
type LocalDriverFix=Point&{sampledAtMs:number;accuracyM:number;heading?:number|null};
type DriverRouteState={rideId:string;phase:NavigationPhase;start:Point;at:number;result:Route};
let passengerPositionSubscriptionSequence=0;

// One protected route calculation per ride/target while a trip is active.
// Prevent duplicate Google Routes calls if React/Safari remounts a map panel.
const tripRouteRequests=new Map<string,{expiresAt:number;request:Promise<Route>}>();
function cachedTripRoute(key:string,load:()=>Promise<Route>):Promise<Route>{
  const now=Date.now();
  const cached=tripRouteRequests.get(key);
  if(cached&&cached.expiresAt>now)return cached.request;
  if(tripRouteRequests.size>64){
    for(const [entry,value] of tripRouteRequests){
      if(value.expiresAt<=now)tripRouteRequests.delete(entry);
    }
    if(tripRouteRequests.size>64)tripRouteRequests.delete(tripRouteRequests.keys().next().value!);
  }
  const request=load().catch(error=>{
    if(tripRouteRequests.get(key)?.request===request)tripRouteRequests.delete(key);
    throw error;
  });
  tripRouteRequests.set(key,{expiresAt:now+10*60_000,request});
  return request;
}

export function QuickRideOperationalMap({
  rideId, status, role, immersive=false, vehicleType, liveDriverFix=null,
  navigationFocusRequest=0, passengerFollow=false,
}: {
  rideId:string;
  municipality?:string;
  immersive?:boolean;
  vehicleType?:"CAR"|"MOTO";
  /** Local browser GPS for smooth visual tracking. Never used for dispatch approval. */
  liveDriverFix?:LocalDriverFix|null;
  /** Explicit navigation button re-enables GPS camera tracking. */
  navigationFocusRequest?:number;
  /** Passenger opts in to keeping the assigned driver's verified marker centered. */
  passengerFollow?:boolean;
  status:string;
  role:"DRIVER"|"PASSENGER";
}) {
  const readMap=useServerFn(getQuickRideMapContext);
  const readApproach=useServerFn(getQuickRideApproach);
  const readRoute=useServerFn(getMapDrivingRoute);
  // Server-function wrapper identities must not restart network timers.
  const readMapRef=useRef(readMap);readMapRef.current=readMap;
  const readApproachRef=useRef(readApproach);readApproachRef.current=readApproach;
  const readRouteRef=useRef(readRoute);readRouteRef.current=readRoute;
  const [context,setContext]=useState<Context|null>(null);
  const [approach,setApproach]=useState<Route|null>(null);
  const [route,setRoute]=useState<Route|null>(null);
  const [driverRoute,setDriverRoute]=useState<DriverRouteState|null>(null);
  const lastDriverRouteAttempt=useRef<{rideId:string;phase:NavigationPhase;at:number}|null>(null);
  const [routeTick,setRouteTick]=useState(0);
  const [details,setDetails]=useState<DriverDetails|null>(null);
  const [error,setError]=useState("");
  const mounted=useRef(true);
  const latestContextRequest=useRef(0);
  const latestContextApplied=useRef(0);
  const activeMapRideId=useRef(rideId);
  activeMapRideId.current=rideId;
  const lastDriverFix=useRef<{rideId:string;at:number;point:NonNullable<Context["driver"]>}|null>(null);
  const [showingLastFix,setShowingLastFix]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const reload=useCallback(async()=>{
    const requestNumber=++latestContextRequest.current;
    try{
      const result=await readMapRef.current({data:{rideId}});
      if(mounted.current&&activeMapRideId.current===rideId&&
         requestNumber>=latestContextApplied.current){
        // Out-of-order responses must never move the car backwards.
        latestContextApplied.current=requestNumber;
        let next=result;
        if(result.driver){
          lastDriverFix.current={rideId,at:Date.now(),point:result.driver};
          setShowingLastFix(false);
        }else{
          const last=lastDriverFix.current;
          const canKeep=last?.rideId===rideId &&
            Date.now()-last.at<=30000 &&
            ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(result.status);
          if(canKeep&&last){
            // Grace period for a single transient GPS dropout. Clearly label
            // it as last known, never as a fresh validated dispatch location.
            next={...result,driver:last.point};
          }
          setShowingLastFix(Boolean(canKeep));
        }
        setContext(previous=>{
          if(previous&&previous.status===next.status&&
            previous.origin.lat===next.origin.lat&&previous.origin.lng===next.origin.lng&&
            previous.destination.lat===next.destination.lat&&
            previous.destination.lng===next.destination.lng&&
            previous.driver?.lat===next.driver?.lat&&
            previous.driver?.lng===next.driver?.lng&&
            previous.driver?.seenAt===next.driver?.seenAt)return previous;
          return next;
        });
        setError("");
      }
    }catch{if(mounted.current&&activeMapRideId.current===rideId&&
      requestNumber>=latestContextApplied.current)
      setError("Não foi possível acompanhar a localização. Verifique sua conexão.");}
  },[rideId]);
  useEffect(()=>{
    void reload();
    // The driver already watches its own browser GPS. The passenger listens
    // for participant-scoped server signals below, with HTTP as a fallback.
    if(role==="PASSENGER")return;
    const timer=window.setInterval(()=>{if(!document.hidden)void reload();},10000);
    const foreground=()=>{if(!document.hidden)void reload();};
    window.addEventListener("focus",foreground);
    document.addEventListener("visibilitychange",foreground);
    return()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",foreground);
      document.removeEventListener("visibilitychange",foreground);
    };
  },[reload,role]);

  useEffect(()=>{
    if(role!=="PASSENGER"||!rideId)return;
    let disposed=false,subscribed=false,lastSignal=0;
    let debounce:ReturnType<typeof setTimeout>|null=null;
    const wake=()=>{
      if(disposed||document.hidden)return;
      if(debounce)clearTimeout(debounce);
      debounce=setTimeout(()=>{debounce=null;if(!disposed)void reload();},180);
    };
    const client=supabase as any;
    // Only the assigned passenger/driver may read this row via SQL RLS.
    // The Realtime event never contains coordinates or another driver's ID.
    const channel=client.channel("f07-passenger-track-"+
      (++passengerPositionSubscriptionSequence)+"-"+rideId)
      .on("postgres_changes",{
        event:"*",schema:"public",table:"caronaa_quick_position_updates",
        filter:"ride_id=eq."+rideId,
      },()=>{lastSignal=Date.now();wake();})
      .subscribe((state:string)=>{
        subscribed=state==="SUBSCRIBED";
        if(subscribed)wake();
      });
    // 5-second fallback if Realtime is unavailable. While healthy, poll
    // only if no location signal was received recently (missed events, tabs).
    const fallback=window.setInterval(()=>{
      if(document.hidden)return;
      if(!subscribed||Date.now()-lastSignal>12000)wake();
    },5000);
    const onVisible=()=>{if(!document.hidden)wake();};
    window.addEventListener("focus",onVisible);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      disposed=true;
      if(debounce)clearTimeout(debounce);
      window.clearInterval(fallback);
      window.removeEventListener("focus",onVisible);
      document.removeEventListener("visibilitychange",onVisible);
      void client.removeChannel(channel);
    };
  },[rideId,role,reload]);

  useEffect(()=>{
    if(!rideId || role!=="PASSENGER")return;
    let active=true;
    void (supabase as any).rpc("quick_ride_driver_details",{p_id:rideId})
      .then(({data,error:rpcError}:{data:any;error:any})=>{
        if(active&&!rpcError)setDetails(data??null);
      }).catch(()=>undefined);
    return()=>{active=false;};
  },[rideId,role]);

  const origin=context?.origin;
  const destination=context?.destination;
  // The driver queue receives its stage from the authenticated RPC. Show
  // the new leg promptly after the OTP succeeds, even during map poll latency.
  const statusNow=role==="DRIVER"&&["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(status)
    ?status:context?.status??status;
  const isMoto = (vehicleType ?? details?.vehicleType)?.toUpperCase() === "MOTO";
  const localFixFresh=role==="DRIVER"&&liveDriverFix&&
    validNavigationPoint(liveDriverFix)&&Number.isFinite(liveDriverFix.accuracyM)&&
    liveDriverFix.accuracyM<=150&&Number.isFinite(liveDriverFix.sampledAtMs)&&
    Date.now()-liveDriverFix.sampledAtMs>=0&&Date.now()-liveDriverFix.sampledAtMs<20000;
  // A recent DB write is not proof of recent GPS sampling; prefer the
  // sensor timestamp and never call a stale fix "live".
  const driverSampleTime=Date.parse(context?.driver?.sampledAt??
    context?.driver?.seenAt??"");
  const serverFixFresh=context?.driver&&!showingLastFix&&
    Number.isFinite(driverSampleTime)&&
    Date.now()-driverSampleTime>=-5000&&Date.now()-driverSampleTime<30000;
  const driverPoint:Point|null=localFixFresh&&liveDriverFix
    ?{lat:liveDriverFix.lat,lng:liveDriverFix.lng}:
    serverFixFresh&&context?.driver
      ?{lat:context.driver.lat,lng:context.driver.lng}:null;
  const visibleDriver=role==="DRIVER"?(driverPoint??context?.driver??null):context?.driver??null;
  const passengerTracking=role==="PASSENGER"&&passengerFollow&&
    ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(statusNow);
  const driverPositionDelayed=role==="PASSENGER"&&
    Boolean(context?.driver)&&!driverPoint;
  const driverPhase=role==="DRIVER"?driverNavigationPhase(statusNow):null;
  const navigationTarget=driverPhase==="PICKUP"?origin:
    driverPhase==="DROPOFF"?destination:null;
  const driverPhaseRef=useRef<NavigationPhase|null>(null);
  const currentRideRef=useRef(rideId);
  currentRideRef.current=rideId;
  driverPhaseRef.current=driverPhase;
  const currentDriverRoute=driverRoute?.rideId===rideId&&driverRoute.phase===driverPhase?driverRoute.result:null;
  const remaining=driverPoint&&currentDriverRoute
    ?estimateDriverRouteRemaining(driverPoint,currentDriverRoute):null;
  const passengerRoute=statusNow==="IN_PROGRESS"?route:approach;
  const passengerRemaining=role==="PASSENGER"&&driverPoint&&passengerRoute
    ?estimateDriverRouteRemaining(driverPoint,passengerRoute):null;
  const mapsNavigationUrl=navigationTarget&&validNavigationPoint(navigationTarget)
    ?"https://www.google.com/maps/dir/?api=1&destination="+
      encodeURIComponent(navigationTarget.lat+","+navigationTarget.lng)+
      "&travelmode=driving&dir_action=navigate":null;
  useEffect(()=>{
    if(role==="DRIVER"||!origin||!destination||!["ACCEPTED","ARRIVED"].includes(statusNow)){
      setApproach(null);return;
    }
    let active=true;
    const read=()=>void readApproachRef.current({data:{rideId}})
      .then(result=>{if(active)setApproach(result);})
      .catch(()=>{ /* Keep last validated route while the network recovers. */ });
    read();
    // ETA is recomputed no more than once per minute; GPS animation remains independent.
    const timer=window.setInterval(read,60000);
    return()=>{active=false;window.clearInterval(timer);};
  },[rideId,statusNow,role,origin?.lat,origin?.lng,destination?.lat,destination?.lng]);

  useEffect(()=>{
    if(role==="DRIVER"||!origin||!destination||statusNow!=="IN_PROGRESS"){setRoute(null);return;}
    if(!context?.driver || showingLastFix)return;
    let active=true;
    // Snapshot the authorized driver's position when the in-progress route starts.
    // Avoid recalculating this Google route on every GPS pulse.
    const routeStart={lat:context.driver.lat,lng:context.driver.lng};
    const cacheKey=[rideId,statusNow,destination.lat.toFixed(5),
      destination.lng.toFixed(5)].join(":");
    void cachedTripRoute(cacheKey,()=>readRouteRef.current({
      data:{points:[routeStart,destination]},
    })).then(result=>{if(active)setRoute(result);})
      .catch(()=>{if(active)setError("Não foi possível calcular a rota ao destino.");});
    return()=>{active=false;};
  },[rideId,role,statusNow,origin?.lat,origin?.lng,destination?.lat,destination?.lng,Boolean(context?.driver),showingLastFix]);

  useEffect(()=>{
    if(role!=="DRIVER"||!driverPhase)return;
    // GPS may update every second, but deciding whether to request another
    // Google route is bounded by distance from the last calculated road path.
    const timer=window.setInterval(()=>setRouteTick(v=>v+1),20000);
    return()=>window.clearInterval(timer);
  },[role,driverPhase,rideId]);

  useEffect(()=>{
    if(role!=="DRIVER"||!driverPhase||!driverPoint||!navigationTarget||
      !validNavigationPoint(driverPoint)||!validNavigationPoint(navigationTarget))return;
    const previous=driverRoute?.rideId===rideId&&driverRoute.phase===driverPhase?driverRoute:null;
    const now=Date.now();
    if(previous){
      if(statusNow==="ARRIVED"&&driverPhase==="PICKUP")return;
      if(!needsDriverReroute({
        current:driverPoint,start:previous.start,
        path:previous.result.routePath,elapsedMs:now-previous.at,
      }))return;
    }
    // A failed route or a fast series of GPS samples cannot exhaust Google.
    if(lastDriverRouteAttempt.current?.rideId===rideId&&
       lastDriverRouteAttempt.current.phase===driverPhase&&
       now-lastDriverRouteAttempt.current.at<60000)return;
    lastDriverRouteAttempt.current={rideId,phase:driverPhase,at:now};
    const from={lat:driverPoint.lat,lng:driverPoint.lng};
    const target={lat:navigationTarget.lat,lng:navigationTarget.lng};
    const requestKey=[rideId,driverPhase,from.lat.toFixed(4),from.lng.toFixed(4),
      target.lat.toFixed(5),target.lng.toFixed(5),Math.floor(now/180000)].join(":");
    void cachedTripRoute(requestKey,()=>readRouteRef.current({
      data:{points:[from,target]},
    })).then(result=>{
      if(!mounted.current||currentRideRef.current!==rideId||driverPhaseRef.current!==driverPhase)return;
      setDriverRoute({rideId,phase:driverPhase,start:from,at:Date.now(),result});
      setError("");
    }).catch(()=>{
      if(mounted.current&&currentRideRef.current===rideId&&driverPhaseRef.current===driverPhase)
        setError("A rota do Google está indisponível. Você pode abrir a navegação no Google Maps.");
    });
  },[rideId,role,driverPhase,statusNow,driverPoint?.lat,driverPoint?.lng,
     navigationTarget?.lat,navigationTarget?.lng,routeTick,driverRoute?.at]);

  const rideMap = origin&&destination&&<GoogleMapSurface
      points={[
        ...(statusNow==="IN_PROGRESS"?[]:[{id:"ride-pickup",lat:origin.lat,lng:origin.lng,title:"Ponto de Embarque",kind:"meeting" as const}]),
        ...((statusNow==="IN_PROGRESS")?[{id:"ride-destination",lat:destination.lat,lng:destination.lng,title:"Destino",kind:"destination" as const}]:[]),
        ...(visibleDriver?[{id:"assigned-professional",lat:visibleDriver.lat,lng:visibleDriver.lng,
          title:driverPoint&&role==="DRIVER"?"GPS do motorista em movimento":
            showingLastFix||driverPositionDelayed?"Última posição conhecida (não ao vivo)":
            isMoto?"Mototaxista":"Motorista",
          kind:isMoto?("availableMoto" as const):("driver" as const)}]:[]),
      ]}
      lines={driverPhase?(currentDriverRoute?[{points:currentDriverRoute.routePath,
        color:driverPhase==="PICKUP"?"#2563eb":"#FFBB00"}]:[]):
        statusNow==="IN_PROGRESS"&&route?[{points:route.routePath,color:"#FFBB00"}]:
        ["ACCEPTED","ARRIVED"].includes(statusNow)&&approach?[{points:approach.routePath,color:"#2563eb"}]:[]}
      fitMode="once" fitKey={`${rideId}:${statusNow}:${Boolean(approach?.routePath?.length)}:${Boolean(route?.routePath?.length)}:${Boolean(currentDriverRoute)}`}
      smoothTracking showControls={immersive} gestureHandling={immersive?"greedy":"cooperative"}
      followPoint={driverPhase||passengerTracking?driverPoint:null}
      followKey={driverPhase?`${rideId}:${driverPhase}:${navigationFocusRequest}`:
        passengerTracking?`${rideId}:PASSENGER:${statusNow}:${navigationFocusRequest}`:undefined}
      followZoom={16} ariaLabel={role==="PASSENGER"
        ?"Mapa com acompanhamento da localização do motorista durante a corrida"
        :"Mapa Google com deslocamento da corrida"}
      className={immersive?"h-full w-full":"h-64 w-full rounded-2xl"} />;
  if(immersive) return <section aria-label="Mapa operacional da Corrida Rápida"
    className="relative h-full w-full overflow-hidden bg-[#121212]">
    <div className="absolute inset-0">{rideMap}</div>
    <div className="pointer-events-none absolute left-3 right-3 top-20 z-10 max-w-sm space-y-1 rounded-2xl border border-[#FFBB00]/50 bg-[#121212]/90 p-3 text-sm text-white shadow-xl">
      <p className="font-bold text-[#FFBB00]" aria-live="polite">{driverPhase==="PICKUP"
        ?statusNow==="ARRIVED"?"No embarque · aguarde o código":"Navegando até o passageiro"
        :driverPhase==="DROPOFF"?"Navegando até o destino":
          statusNow==="IN_PROGRESS"?"Em viagem — destino":statusNow==="ARRIVED"?"Motorista chegou":"Motorista a caminho"}</p>
      {details&&<p>{details.name} · {details.vehicle||details.vehicleType}{details.plate?" · "+details.plate:""}</p>}
      {role==="PASSENGER"&&<p role="status" aria-live="polite"
        className={"text-xs "+(driverPoint?"text-emerald-200":"text-amber-200")}>
        {driverPoint?"Motorista no mapa · localização recebida pelo GPS":
          driverPositionDelayed||showingLastFix
            ?"Sinal GPS atrasado · última posição conhecida":
            "Aguardando a posição GPS do motorista. O mapa atualizará automaticamente."}
      </p>}
      {role==="PASSENGER"&&passengerRemaining&&<p className="text-xs text-white/85">
        {passengerRemaining.distanceKm.toFixed(1)} km restantes · cerca de {Math.max(1,Math.round(passengerRemaining.durationMinutes))} min (estimativa)
      </p>}
      {driverPhase&&currentDriverRoute&&<p className="font-semibold">
        {(remaining?.distanceKm??currentDriverRoute.distanceKm).toFixed(1)} km {remaining?"restantes (estimativa)":""} · cerca de {Math.max(1,Math.round(remaining?.durationMinutes??currentDriverRoute.durationMinutes))} min
      </p>}
      {driverPhase&&!currentDriverRoute&&!error&&<p className="text-xs text-white/75">Calculando rota rodoviária…</p>}
      {driverPhase&&!driverPoint&&<p role="status" className="text-xs text-amber-200">Sem GPS recente. Confira a permissão de localização.</p>}
      {!driverPhase&&showingLastFix&&<p role="status" className="text-xs text-amber-200">
        GPS do motorista em atualização · última posição conhecida (não ao vivo).
      </p>}
      {!driverPhase&&approach&&statusNow!=="IN_PROGRESS"&&<p>{approach.distanceKm.toFixed(1)} km · {Math.max(1,Math.round(approach.durationMinutes))} min para embarque</p>}
      {driverPhase&&mapsNavigationUrl&&<a href={mapsNavigationUrl} target="_blank" rel="noopener noreferrer"
        className="pointer-events-auto inline-flex min-h-10 items-center rounded-xl border border-[#FFBB00]/60 bg-[#FFBB00]/15 px-3 text-xs font-bold text-[#FFBB00]">
        Abrir orientação por voz no Google Maps
      </a>}
      {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  </section>;
  return <section className="space-y-3 rounded-2xl border border-[#FFBB00]/30 bg-[#121212] p-3 text-white"
    aria-label="Navegação da Corrida Rápida">
    {statusNow==="ACCEPTED"&&<p className="font-bold text-[#FFBB00]">
      {role==="DRIVER"?"Navegando até o passageiro":"Motorista a caminho"}
    </p>}
    {statusNow==="ARRIVED"&&<p role="status" className="font-bold text-[#FFBB00]">
      {role==="DRIVER"?"Você chegou ao ponto de embarque":"Seu motorista chegou!"}
    </p>}
    {statusNow==="IN_PROGRESS"&&<p className="font-bold text-[#FFBB00]">Em viagem — acompanhando destino</p>}
    {details&&role==="PASSENGER"&&<div className="flex items-center gap-3 rounded-xl border border-white/15 p-2">
      {details.photo&&<img src={details.photo} alt="Foto do motorista" className="h-12 w-12 rounded-full object-cover"/>}
      <div className="min-w-0">
        <p className="truncate font-semibold">{details.name}</p>
        <p className="text-xs text-white/70">{details.vehicle||details.vehicleType} {details.plate?" · "+details.plate:""}</p>
      </div>
    </div>}
    {rideMap}

    {role==="DRIVER"&&statusNow==="ACCEPTED"&&
      <p className="text-xs text-white/70">
        A chegada só será confirmada a até 75 m do embarque, com GPS de precisão de até 50 m e sinal recente.
        {(role==="DRIVER"?currentDriverRoute:approach)
           ? ` Distância pela via até o embarque: ${(role==="DRIVER"?currentDriverRoute:approach)!.distanceKm.toFixed(1)} km (estimativa, não comprova proximidade GPS).` : ""}
      </p>}
    {["ACCEPTED","ARRIVED"].includes(statusNow)&&(role==="DRIVER"?currentDriverRoute:approach)&&<p className="text-sm">
      Distância até o embarque: {(role==="DRIVER"?currentDriverRoute:approach)!.distanceKm.toFixed(1)} km · aproximadamente {Math.max(1,Math.round((role==="DRIVER"?currentDriverRoute:approach)!.durationMinutes))} min
    </p>}
    {statusNow==="IN_PROGRESS"&&(role==="DRIVER"?currentDriverRoute:route)&&<p className="text-sm">
      Rota ao destino: {(role==="DRIVER"?currentDriverRoute:route)!.distanceKm.toFixed(1)} km · aproximadamente {Math.round((role==="DRIVER"?currentDriverRoute:route)!.durationMinutes)} min
    </p>}
    {!context?.driver&&statusNow==="ACCEPTED"&&<p className="text-xs text-white/65">
      Aguardando posição autorizada e recente do motorista.
    </p>}
    {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
  </section>;
}
