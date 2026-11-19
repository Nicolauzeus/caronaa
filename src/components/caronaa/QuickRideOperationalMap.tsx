import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getQuickRideApproach, getQuickRideMapContext, getQuickRideNavigation } from "@/lib/quick-ride-map.functions";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { GoogleMapSurface } from "./GoogleMapSurface";
import { useJourneyWakeLock } from "@/lib/quick-rides/use-journey-wake-lock";
import {
  driverNavigationPhase, validNavigationPoint, needsDriverReroute,
  estimateDriverRouteRemaining, normalizedHeading, navigationBearing, navigationDistanceMeters,
  distanceToNavigationPathMeters, upcomingNavigationManeuver,
  type NavigationPhase,
} from "@/lib/quick-rides/driver-navigation";
import { navigationVoiceKey, navigationVoiceMessage, navigationVoiceStage } from "@/lib/quick-rides/voice-navigation";

type Route = {routePath:Array<{lat:number;lng:number}>;distanceKm:number;durationMinutes:number;maneuvers?:Array<{start:Point;end:Point;instruction:string;maneuver:string}>};
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
  const readNavigation=useServerFn(getQuickRideNavigation);
  // Server-function wrapper identities must not restart network timers.
  const readMapRef=useRef(readMap);readMapRef.current=readMap;
  const readApproachRef=useRef(readApproach);readApproachRef.current=readApproach;
  const readRouteRef=useRef(readRoute);readRouteRef.current=readRoute;
  const readNavigationRef=useRef(readNavigation);readNavigationRef.current=readNavigation;
  const [context,setContext]=useState<Context|null>(null);
  const [approach,setApproach]=useState<Route|null>(null);
  const [route,setRoute]=useState<Route|null>(null);
  const [driverRoute,setDriverRoute]=useState<DriverRouteState|null>(null);
  const [navigationRoute,setNavigationRoute]=useState<(Route&{phase:NavigationPhase;sampledAt:number})|null>(null);
  const navigationAttempt=useRef<{rideId:string;at:number}|null>(null);
  const offRouteSamples=useRef<{key:string;count:number;lastPoint:string}|null>(null);
  const previousDriverPosition=useRef<{rideId:string;point:Point}|null>(null);
  const [directionHeading,setDirectionHeading]=useState<number|null>(null);
  const lastDriverRouteAttempt=useRef<{rideId:string;phase:NavigationPhase;at:number}|null>(null);
  const [routeTick,setRouteTick]=useState(0);
  const [details,setDetails]=useState<DriverDetails|null>(null);
  const [error,setError]=useState("");
  const [voiceEnabled,setVoiceEnabled]=useState(false);
  const announcedVoiceCues=useRef<Set<string>>(new Set());
  const activeUtterance=useRef<SpeechSynthesisUtterance|null>(null);
  const lastSpokenPhase=useRef<NavigationPhase|null>(null);
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
    window.addEventListener("pageshow",foreground);
    window.addEventListener("online",foreground);
    document.addEventListener("visibilitychange",foreground);
    return()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",foreground);
      window.removeEventListener("pageshow",foreground);
      window.removeEventListener("online",foreground);
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
    window.addEventListener("pageshow",onVisible);
    window.addEventListener("online",onVisible);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      disposed=true;
      if(debounce)clearTimeout(debounce);
      window.clearInterval(fallback);
      window.removeEventListener("focus",onVisible);
      window.removeEventListener("pageshow",onVisible);
      window.removeEventListener("online",onVisible);
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
  const visibleDriver=driverPoint??context?.driver??null;
  const passengerTracking=role==="PASSENGER"&&passengerFollow&&
    ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(statusNow);
  const driverPositionDelayed=role==="PASSENGER"&&
    Boolean(context?.driver)&&!driverPoint;
  const driverPhase=role==="DRIVER"?driverNavigationPhase(statusNow):null;
  useJourneyWakeLock(["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(statusNow) && (role==="DRIVER" || passengerFollow));
  const navigationTarget=driverPhase==="PICKUP"?origin:
    driverPhase==="DROPOFF"?destination:null;
  const driverPhaseRef=useRef<NavigationPhase|null>(null);
  const currentRideRef=useRef(rideId);
  currentRideRef.current=rideId;
  driverPhaseRef.current=driverPhase;
  const currentDriverRoute=driverRoute?.rideId===rideId&&driverRoute.phase===driverPhase?driverRoute.result:null;
  const remaining=driverPoint&&currentDriverRoute
    ?estimateDriverRouteRemaining(driverPoint,currentDriverRoute):null;
  const operationalRoute=navigationRoute?.phase===(statusNow==="IN_PROGRESS"?"DROPOFF":"PICKUP")?navigationRoute:null;
  const passengerRoute=operationalRoute??(statusNow==="IN_PROGRESS"?route:approach);
  const passengerRemaining=role==="PASSENGER"&&driverPoint&&passengerRoute
    ?estimateDriverRouteRemaining(driverPoint,passengerRoute):null;
  const wazeNavigationUrl=navigationTarget&&validNavigationPoint(navigationTarget)
    ?"https://waze.com/ul?ll="+encodeURIComponent(navigationTarget.lat+","+navigationTarget.lng)+"&navigate=yes":null;
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
    if(!driverPoint||!["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(statusNow))return;
    const previous=previousDriverPosition.current;
    if(previous?.rideId===rideId){
      // Ignore sub-8m GPS jitter; stationary vehicles should not spin.
      if(navigationDistanceMeters(previous.point,driverPoint)>=8){
        const bearing=navigationBearing(previous.point,driverPoint);
        if(bearing!==null)setDirectionHeading(bearing);
      }
    }
    previousDriverPosition.current={rideId,point:driverPoint};
  },[rideId,statusNow,driverPoint?.lat,driverPoint?.lng]);

  useEffect(()=>{
    if(!rideId||!["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(statusNow)){
      setNavigationRoute(null);return;
    }
    let disposed=false;
    const check=()=>{
      if(disposed||document.hidden)return;
      const now=Date.now(),phase=statusNow==="IN_PROGRESS"?"DROPOFF":"PICKUP";
      const previous=navigationRoute?.phase===phase?navigationRoute:null;
      const point=role==="DRIVER"?driverPoint:context?.driver;
      if(!point||!validNavigationPoint(point))return;
      const sample=point.lat.toFixed(6)+":"+point.lng.toFixed(6),key=rideId+":"+phase;
      const last=offRouteSamples.current;
      const accuracy=role==="DRIVER"&&localFixFresh&&liveDriverFix?liveDriverFix.accuracyM:context?.driver?.accuracyM;
      const offRoute=Boolean(previous&&typeof accuracy==="number"&&accuracy<=80&&
        distanceToNavigationPathMeters(point,previous.routePath)>Math.max(40,accuracy*1.5));
      const count=offRoute?(last?.key===key?last.count+(last.lastPoint!==sample?1:0):1):0;
      offRouteSamples.current={key,count,lastPoint:sample};
      const elapsed=now-(navigationAttempt.current?.rideId===rideId?navigationAttempt.current.at:0);
      const due=!previous||(needsDriverReroute({
        current:point,start:previous.routePath[0],path:previous.routePath,
        elapsedMs:elapsed,offRouteConfirmations:count,accuracyM:accuracy,
      }))||(previous&&elapsed>=30000&&now-previous.sampledAt>90000);
      if(!due||elapsed<10000)return;
      navigationAttempt.current={rideId,at:now};
      void readNavigationRef.current({data:{rideId}}).then(result=>{
        if(disposed||!mounted.current||activeMapRideId.current!==rideId||!result||result.phase!==phase)return;
        const next=result as Route&{phase:NavigationPhase;sampledAt:number};
        setNavigationRoute(next);
        setDriverRoute({rideId,phase,start:point,at:Date.now(),result:next});
        offRouteSamples.current={key,count:0,lastPoint:sample};
        setError("");
      }).catch(()=>{
        if(!disposed&&mounted.current&&activeMapRideId.current===rideId&&!previous)
          setError("Rota momentaneamente indisponível. Utilize Rota por voz.");
      });
    };
    check();
    const timer=window.setInterval(check,5000);
    return()=>{disposed=true;window.clearInterval(timer);};
  },[rideId,role,statusNow,driverPoint?.lat,driverPoint?.lng,
    context?.driver?.lat,context?.driver?.lng,navigationRoute?.sampledAt,navigationRoute?.phase]);

  const activeRoute=role==="DRIVER"?currentDriverRoute:passengerRoute;
  const maneuver=role==="DRIVER"&&driverPoint&&activeRoute?.maneuvers
    ?upcomingNavigationManeuver(driverPoint,activeRoute.routePath,activeRoute.maneuvers):null;
  const speakNavigation=useCallback((message:string)=>{
    if(typeof window==="undefined"||!("speechSynthesis" in window)||
      !("SpeechSynthesisUtterance" in window))return false;
    try{
      const synth=window.speechSynthesis;
      const utterance=new SpeechSynthesisUtterance(message);
      utterance.lang="pt-BR";
      utterance.rate=1;
      const voices=synth.getVoices();
      const portuguese=voices.find(voice=>voice.lang.toLowerCase()==="pt-br")??
        voices.find(voice=>voice.lang.toLowerCase().startsWith("pt"));
      if(portuguese)utterance.voice=portuguese;
      synth.cancel();
      activeUtterance.current=utterance;
      synth.speak(utterance);
      return true;
    }catch{
      return false;
    }
  },[]);
  // On iOS, the first utterance must occur synchronously after the driver's
  // tap. Subsequent cues are driven by the current road maneuver and GPS.
  const toggleNavigationVoice=useCallback(()=>{
    if(voiceEnabled){
      setVoiceEnabled(false);
      if(typeof window!=="undefined"&&activeUtterance.current){
        window.speechSynthesis.cancel();
        activeUtterance.current=null;
      }
      return;
    }
    if(!speakNavigation("Orientação por voz ativada.")){
      toast.error("A voz não está disponível neste navegador.");
      return;
    }
    announcedVoiceCues.current.clear();
    setVoiceEnabled(true);
  },[voiceEnabled,speakNavigation]);
  useEffect(()=>{
    if(lastSpokenPhase.current===driverPhase)return;
    const previous=lastSpokenPhase.current;
    lastSpokenPhase.current=driverPhase;
    // Once boarding is verified, cancel instructions for the old pickup leg.
    if(previous&&voiceEnabled&&typeof window!=="undefined"&&activeUtterance.current){
      window.speechSynthesis.cancel();
      activeUtterance.current=null;
    }
    announcedVoiceCues.current.clear();
  },[driverPhase,voiceEnabled]);
  useEffect(()=>{
    // Do not carry guidance, cached announcements or speech into the next trip.
    announcedVoiceCues.current.clear();
    setVoiceEnabled(false);
    return()=>{
      if(typeof window!=="undefined"&&activeUtterance.current){
        window.speechSynthesis.cancel();
        activeUtterance.current=null;
      }
    };
  },[rideId]);
  useEffect(()=>{
    if(!voiceEnabled||role!=="DRIVER"||!driverPhase||!driverPoint||
      !maneuver||document.hidden)return;
    // Do not call an old/unreliable fix "navigation" or read stale directions.
    const gpsAccuracy=localFixFresh&&liveDriverFix?liveDriverFix.accuracyM:
      serverFixFresh?context?.driver?.accuracyM:null;
    if(typeof gpsAccuracy!=="number"||gpsAccuracy>100)return;
    const stage=navigationVoiceStage(maneuver.distanceMeters);
    if(!stage)return;
    const key=navigationVoiceKey(rideId,driverPhase,maneuver)+":"+stage;
    if(announcedVoiceCues.current.has(key))return;
    const message=navigationVoiceMessage(maneuver,stage);
    if(speakNavigation(message))announcedVoiceCues.current.add(key);
  },[voiceEnabled,role,driverPhase,driverPoint?.lat,driverPoint?.lng,
    maneuver?.start.lat,maneuver?.start.lng,maneuver?.instruction,maneuver?.distanceMeters,
    localFixFresh,liveDriverFix?.accuracyM,serverFixFresh,context?.driver?.accuracyM,
    speakNavigation,rideId]);
  useEffect(()=>{
    if(voiceEnabled&&role==="DRIVER"&&!driverPhase){
      setVoiceEnabled(false);
      if(typeof window!=="undefined"&&activeUtterance.current){
        window.speechSynthesis.cancel();
        activeUtterance.current=null;
      }
    }
  },[voiceEnabled,driverPhase,role]);

  const liveHeading=role==="DRIVER"&&localFixFresh&&liveDriverFix
    ?normalizedHeading(liveDriverFix.heading??directionHeading):directionHeading;
  const etaMinutes=role==="DRIVER"?(remaining?.durationMinutes??currentDriverRoute?.durationMinutes):
    (passengerRemaining?.durationMinutes??passengerRoute?.durationMinutes);
  const etaClock=typeof etaMinutes==="number"&&Number.isFinite(etaMinutes)
    ?new Date(Date.now()+etaMinutes*60000).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):null;
  const maneuverDistance=maneuver?(maneuver.distanceMeters<1000
    ?Math.round(maneuver.distanceMeters/10)*10+" m":(maneuver.distanceMeters/1000).toFixed(1)+" km"):null;
  const maneuverSymbol=maneuver?.maneuver.includes("LEFT")?"↰":
    maneuver?.maneuver.includes("RIGHT")?"↱":maneuver?.maneuver.includes("ROUNDABOUT")?"⟳":"↑";

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
        statusNow==="IN_PROGRESS"&&passengerRoute?[{points:passengerRoute.routePath,color:"#FFBB00"}]:
        ["ACCEPTED","ARRIVED"].includes(statusNow)&&passengerRoute?[{points:passengerRoute.routePath,color:"#2563eb"}]:[]}
      fitMode="once" fitKey={`${rideId}:${statusNow}:${Boolean(approach?.routePath?.length)}:${Boolean(route?.routePath?.length)}:${Boolean(currentDriverRoute)}`}
      smoothTracking showControls={Boolean(driverPhase)||!immersive} gestureHandling={immersive?"greedy":"cooperative"}
      followPoint={driverPhase||passengerTracking?driverPoint:null}
      followKey={driverPhase?`${rideId}:${driverPhase}:${navigationFocusRequest}`:
        passengerTracking?`${rideId}:PASSENGER:${statusNow}:${navigationFocusRequest}`:undefined}
      followZoom={17} navigationMode={Boolean(driverPhase)}
      navigationPath={activeRoute?.routePath??[]}
      navigationVehicle={isMoto?"MOTO":"CAR"}
      followHeading={driverPhase?liveHeading:directionHeading}
      followAccuracyM={role==="DRIVER"&&localFixFresh&&liveDriverFix?liveDriverFix.accuracyM:context?.driver?.accuracyM}
      ariaLabel={role==="PASSENGER"
        ?"Mapa com acompanhamento da localização do motorista durante a corrida"
        :"Mapa Google com deslocamento da corrida"}
      className={immersive?"h-full w-full":"h-64 w-full rounded-2xl"} />;
  if(immersive) return <section aria-label="Mapa operacional da Corrida Rápida"
    className="relative h-full w-full overflow-hidden bg-[#121212]">
    <div className="absolute inset-0">{rideMap}</div>
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-center">
      <div className="pointer-events-none flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-white/15 bg-[#121212]/90 px-3 py-2 text-white shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
          {maneuver&&<p className="flex items-center gap-2 text-sm font-bold text-white" aria-live="polite">
            <span aria-hidden="true" className="text-2xl text-[#FFBB00]">{maneuverSymbol}</span>
            <span className="min-w-0 truncate">{maneuverDistance} · {maneuver.instruction}</span>
          </p>}
          <p className="truncate text-xs font-extrabold text-[#FFBB00]" aria-live="polite">
            {driverPhase==="PICKUP"
              ?statusNow==="ARRIVED"?"No embarque":"Até o passageiro":
              driverPhase==="DROPOFF"?"Rota até o destino":
              statusNow==="IN_PROGRESS"?"Viagem em andamento":
              statusNow==="ARRIVED"?"Motorista chegou":"Motorista a caminho"}
          </p>
          {driverPhase&&currentDriverRoute
            ?<p className="truncate text-xs tabular-nums text-white/85">
              {(remaining?.distanceKm??currentDriverRoute.distanceKm).toFixed(1)} km ·
              {Math.max(1,Math.round(remaining?.durationMinutes??currentDriverRoute.durationMinutes))} min estimados
            </p>
            :!driverPhase&&passengerRemaining
              ?<p className="truncate text-xs text-white/80">
                {passengerRemaining.distanceKm.toFixed(1)} km ·
                {Math.max(1,Math.round(passengerRemaining.durationMinutes))} min estimados
              </p>
              :!driverPhase&&approach
                ?<p className="truncate text-xs text-white/80">
                  {approach.distanceKm.toFixed(1)} km até o embarque
                </p>
                :<p className="truncate text-xs text-white/65">
                  {driverPoint?"Acompanhamento GPS ativo":"Aguardando localização"}
                </p>}
        </div>
          {etaClock&&<span className="hidden shrink-0 text-[11px] font-bold tabular-nums text-white/80 sm:inline">Chegada {etaClock}</span>}
          {(error||driverPositionDelayed||showingLastFix||(Boolean(driverPhase)&&!driverPoint))&&
            <span role="status" title={error||"Sinal GPS atrasado: mostrando última posição conhecida"}
              aria-label={error||"Sinal GPS atrasado: mostrando última posição conhecida"}
              className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-1 text-[10px] font-bold text-amber-300">
              {error?"Rota instável":"GPS atrasado"}
            </span>}
        </div>
        {driverPhase&&<div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={toggleNavigationVoice} aria-pressed={voiceEnabled}
            aria-label={voiceEnabled?"Desativar orientação por voz no CARONAA":"Ativar orientação por voz no CARONAA"}
            className="flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-xl border border-[#FFBB00]/45 bg-[#FFBB00]/10 px-2 text-xs font-bold text-[#FFBB00]">
            {voiceEnabled?"Silenciar voz":"Rota por voz"}
          </button>
          {mapsNavigationUrl&&<a href={mapsNavigationUrl} target="_blank" rel="noopener noreferrer"
            aria-label="Abrir rota no Google Maps" title="Abrir rota no Google Maps"
            className="flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2 text-xs font-bold text-white">
            Google Maps
          </a>}
        </div>}
      </div>
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
    {driverPhase&&<div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={toggleNavigationVoice} aria-pressed={voiceEnabled}
        className="min-h-11 flex-1 rounded-xl border border-[#FFBB00]/50 bg-[#FFBB00]/10 px-3 text-sm font-semibold text-[#FFBB00]">
        {voiceEnabled?"Silenciar voz":"Rota por voz"}
      </button>
      {mapsNavigationUrl&&<a href={mapsNavigationUrl} target="_blank" rel="noopener noreferrer"
        className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/25 px-3 text-sm font-semibold text-white">
        Abrir no Google Maps
      </a>}
    </div>}

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
