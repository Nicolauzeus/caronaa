import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuickRideApproach, getQuickRideMapContext } from "@/lib/quick-ride-map.functions";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { GoogleMapSurface } from "./GoogleMapSurface";

type Route = {routePath:Array<{lat:number;lng:number}>;distanceKm:number;durationMinutes:number};
type Point={lat:number;lng:number};
type Context={origin:Point;destination:Point;driver:(Point&{seenAt:string})|null;status:string};
type DriverDetails={name:string;photo:string|null;vehicle:string|null;plate:string|null;vehicleType:string};

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
  rideId, status, role, immersive=false, vehicleType,
}: {
  rideId:string;
  municipality?:string;
  immersive?:boolean;
  vehicleType?:"CAR"|"MOTO";
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
  const [details,setDetails]=useState<DriverDetails|null>(null);
  const [error,setError]=useState("");
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const reload=useCallback(async()=>{
    try{
      const result=await readMapRef.current({data:{rideId}});
      if(mounted.current){
        setContext(previous=>{
          if(previous&&previous.status===result.status&&
            previous.origin.lat===result.origin.lat&&previous.origin.lng===result.origin.lng&&
            previous.destination.lat===result.destination.lat&&
            previous.destination.lng===result.destination.lng&&
            previous.driver?.lat===result.driver?.lat&&
            previous.driver?.lng===result.driver?.lng&&
            previous.driver?.seenAt===result.driver?.seenAt)return previous;
          return result;
        });
        setError("");
      }
    }catch{if(mounted.current)setError("Não foi possível acompanhar a localização. Verifique sua conexão.");}
  },[rideId]);
  useEffect(()=>{
    void reload();
    // Reading GPS from the own authorized backend is not a Google Routes request.
    const timer=window.setInterval(()=>{if(!document.hidden)void reload();},15000);
    return()=>window.clearInterval(timer);
  },[reload]);

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
  const statusNow=context?.status??status;
  const isMoto = (vehicleType ?? details?.vehicleType)?.toUpperCase() === "MOTO";
  useEffect(()=>{
    if(!origin||!destination||!["ACCEPTED","ARRIVED"].includes(statusNow)){
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
  },[rideId,statusNow,origin?.lat,origin?.lng,destination?.lat,destination?.lng]);

  useEffect(()=>{
    if(!origin||!destination||statusNow!=="IN_PROGRESS"){setRoute(null);return;}
    if(!context?.driver)return;
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
  },[rideId,statusNow,origin?.lat,origin?.lng,destination?.lat,destination?.lng,Boolean(context?.driver)]);

  const rideMap = origin&&destination&&<GoogleMapSurface
      points={[
        ...(statusNow==="IN_PROGRESS"?[]:[{lat:origin.lat,lng:origin.lng,title:"Ponto de Embarque",kind:"meeting" as const}]),
        ...((statusNow==="IN_PROGRESS")?[{lat:destination.lat,lng:destination.lng,title:"Destino",kind:"destination" as const}]:[]),
        ...(context?.driver?[{lat:context.driver.lat,lng:context.driver.lng,
          title:isMoto?"Mototaxista":"Motorista",
          kind:isMoto?("availableMoto" as const):("driver" as const)}]:[]),
      ]}
      lines={statusNow==="IN_PROGRESS"&&route?[{points:route.routePath,color:"#FFBB00"}]:
        ["ACCEPTED","ARRIVED"].includes(statusNow)&&approach?[{points:approach.routePath,color:"#2563eb"}]:[]}
      fitMode="once" fitKey={`${rideId}:${statusNow}:${Boolean(approach?.routePath?.length)}:${Boolean(route?.routePath?.length)}`}
      smoothTracking showControls={immersive} gestureHandling={immersive?"greedy":"cooperative"} ariaLabel="Mapa Google com deslocamento da corrida"
      className={immersive?"h-full w-full":"h-64 w-full rounded-2xl"} />;
  if(immersive) return <section aria-label="Mapa operacional da Corrida Rápida"
    className="relative h-full w-full overflow-hidden bg-[#121212]">
    <div className="absolute inset-0">{rideMap}</div>
    <div className="pointer-events-none absolute left-3 right-3 top-20 z-10 max-w-sm space-y-1 rounded-2xl border border-[#FFBB00]/50 bg-[#121212]/90 p-3 text-sm text-white shadow-xl">
      <p className="font-bold text-[#FFBB00]">{statusNow==="IN_PROGRESS"?"Em viagem — destino":statusNow==="ARRIVED"?"Motorista chegou":"Motorista a caminho"}</p>
      {details&&<p>{details.name} · {details.vehicle||details.vehicleType}{details.plate?" · "+details.plate:""}</p>}
      {approach&&statusNow!=="IN_PROGRESS"&&<p>{approach.distanceKm.toFixed(1)} km · {Math.max(1,Math.round(approach.durationMinutes))} min para embarque</p>}
      {error&&<p role="alert" className="text-red-300">{error}</p>}
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
        {approach? ` Distância pela via até o embarque: ${approach.distanceKm.toFixed(1)} km (estimativa, não comprova proximidade GPS).` : ""}
      </p>}
    {["ACCEPTED","ARRIVED"].includes(statusNow)&&approach&&<p className="text-sm">
      Distância até o embarque: {approach.distanceKm.toFixed(1)} km · aproximadamente {Math.max(1,Math.round(approach.durationMinutes))} min
    </p>}
    {statusNow==="IN_PROGRESS"&&route&&<p className="text-sm">
      Rota ao destino: {route.distanceKm.toFixed(1)} km · aproximadamente {Math.round(route.durationMinutes)} min
    </p>}
    {!context?.driver&&statusNow==="ACCEPTED"&&<p className="text-xs text-white/65">
      Aguardando posição autorizada e recente do motorista.
    </p>}
    {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
  </section>;
}
