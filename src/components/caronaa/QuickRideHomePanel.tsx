import { useCallback, useEffect, useRef, useState } from "react";
import { FlashPassengerLiveSheet } from "./shell/FlashPassengerLiveSheet";
import { QuickRideSearchActivity } from "./QuickRideSearchActivity";
import { playNotificationSound, unlockNotificationAudio } from "@/lib/notification-sound";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { Bike, CarFront, Clock3, Loader2, MapPin, Navigation2, ShieldCheck, Users } from "lucide-react";
import type { FormLocationDetails } from "@/lib/location/types";
import { validPoint } from "@/lib/location/use-user-location";
import { useAuth } from "@/lib/auth-context";
import { quickQuoteCoordinator, quickQuoteItineraryKey, isQuickQuoteRateLimit } from "@/lib/quick-rides/quick-quote-coordinator";
import { supabase } from "@/integrations/supabase/client";
import {
  getQuickRideCoverage, getQuickRideFarePreview, registerQuickRideRegionInterest,
  submitQuotedQuickRide, type QuickRideCoverage, type QuickRideFarePreview,
} from "@/lib/quick-rides/quick-ride.functions";
import { formatBrl } from "@/lib/ride-cost";
import { useQuickRideRealtime } from "@/lib/quick-rides/use-quick-ride-realtime";
import { QuickRidePostTripFlow } from "./QuickRidePostTripFlow";
import { toast } from "sonner";

type QuickVehicle = "CAR" | "MOTO";
function friendlyQuickQuoteError(cause:unknown):string{
  const message=cause instanceof Error?cause.message:"";
  if(isQuickQuoteRateLimit(cause))
    return "O limite temporário de consultas foi atingido. Seus preços já calculados foram preservados.";
  if(/não habilitada|fora da cobertura|ainda não|tarifa|intermunicipal/i.test(message))
    return "Esta modalidade ainda não está disponível neste trajeto.";
  return "Não foi possível calcular o preço agora.";
}
type RideStatus = "SEARCHING"|"ACCEPTED"|"ARRIVED"|"IN_PROGRESS"|"PENDING_REVIEW"|"COMPLETED"|"CANCELLED"|"EXPIRED";
type ExistingQuickRide = {id:string;role:string;status:RideStatus;vehicle_type:string;municipality:string;requested_at?:string|null;expires_at?:string;distance_km?:number|null;duration_minutes?:number|null;fare_cents?:number|null};

export function QuickRideHomePanel({
  origin, destination, originPoint, destinationPoint, vehicle, onVehicleChange,
  driverCount, driverCounts, driverLoading=false, driverError="", gpsOriginIsImprecise=false,
  locating=false, pickupNeedsConfirmation=false, onConfirmPickup, actionContainer,
  onFaresChange, onFarePendingChange, onCoverage, onCoveragesChange, onOperationalRideChange,
  onRidePhaseChange, onDropoffPendingChange, onFareChange, onFollowMap,
  shellMode=false, shellSnap="full", onOpenOperational,
}: {
  origin:string;destination:string;
  originPoint?:FormLocationDetails;destinationPoint?:FormLocationDetails;
  vehicle:QuickVehicle;onVehicleChange:(value:QuickVehicle)=>void;
  driverCount:number;driverCounts?:Record<QuickVehicle,number>;driverLoading?:boolean;driverError?:string;
  gpsOriginIsImprecise?:boolean;
  locating?:boolean;
  pickupNeedsConfirmation?:boolean;
  /** Open the parent's explicit pickup dialog; this never creates a ride. */
  onConfirmPickup?:()=>void;
  actionContainer?:HTMLElement|null;
  onFaresChange?:(value:Partial<Record<QuickVehicle,QuickRideFarePreview>>)=>void;
  onFarePendingChange?:(pending:boolean)=>void;
  onCoverage?:(coverage:QuickRideCoverage|null)=>void;
  onCoveragesChange?:(coverages:Partial<Record<QuickVehicle,QuickRideCoverage>>)=>void;
  onOperationalRideChange?:(ride:{id:string;status:string;municipality:string}|null)=>void;
  onRidePhaseChange?:(status:RideStatus|null)=>void;
  onDropoffPendingChange?:(pending:boolean)=>void;
  onFareChange?:(value:QuickRideFarePreview|null)=>void;
  onFollowMap?:(rideId:string)=>void;
  shellMode?:boolean;shellSnap?:"peek"|"half"|"full";onOpenOperational?:()=>void;
}) {
  const {user}=useAuth();
  const quoteAccount=user?.id??null;
  const availabilityFn=useServerFn(getQuickRideCoverage);
  const previewFn=useServerFn(getQuickRideFarePreview);
  const submitFn=useServerFn(submitQuotedQuickRide);
  const interestFn=useServerFn(registerQuickRideRegionInterest);
  const [coverage,setCoverage]=useState<QuickRideCoverage|null>(null);
  const [coverageLoading,setCoverageLoading]=useState(false);
  const [coverageRefresh,setCoverageRefresh]=useState(0);
  const [quote,setQuote]=useState<QuickRideFarePreview|null>(null);
  const [quoteErrors,setQuoteErrors]=useState<Partial<Record<QuickVehicle,string>>>({});
  const [fares,setFares]=useState<Partial<Record<QuickVehicle,QuickRideFarePreview>>>({});
  const [coverages,setCoverages]=useState<Partial<Record<QuickVehicle,QuickRideCoverage>>>({});
  const [busy,setBusy]=useState(false);
  const [quoteLoading,setQuoteLoading]=useState(false);
  const [quoteRefresh,setQuoteRefresh]=useState(0);
  const [cooldownSeconds,setCooldownSeconds]=useState(0);
  const [coverageResolvedKey,setCoverageResolvedKey]=useState("");
  const [error,setError]=useState("");
  const [interestSent,setInterestSent]=useState(false);
  const [rides,setRides]=useState<ExistingQuickRide[]>([]);
  const [boardingCode,setBoardingCode]=useState("");
  const [dropoff,setDropoff]=useState<{deadline_at:string;passenger_response:string|null;resolved_at:string|null}|null>(null);
  const [nowMs,setNowMs]=useState(Date.now());
  const [expiredHidden,setExpiredHidden]=useState<string|null>(null);
  const [rideRefreshError,setRideRefreshError]=useState(false);
  const mounted=useRef(true);
  const submissionInFlight=useRef(false);
  const retryInFlight=useRef(false);
  const originLat=originPoint?.lat, originLng=originPoint?.lng;
  const destinationLat=destinationPoint?.lat, destinationLng=destinationPoint?.lng;
  const hasOriginCoordinates=validPoint(originPoint);
  const hasOrigin=hasOriginCoordinates&&!gpsOriginIsImprecise;
  const waitingForOrigin=locating&&!hasOriginCoordinates;
  const hasDestination=validPoint(destinationPoint);
  const hasQuoteLabels=origin.trim().length>=3&&destination.trim().length>=3;
  // A delayed reverse-geocode label must not spend two more quote allowances.
  // Exact coordinates, the account and modality define the request lifecycle.
  const fieldsKey=JSON.stringify([quoteAccount,quickQuoteItineraryKey(originPoint,destinationPoint,shellMode?null:vehicle)]);
  const coveragePointKey=JSON.stringify([quoteAccount,originLat,originLng,shellMode?null:vehicle,gpsOriginIsImprecise]);
  const [currentQuoteKey,setCurrentQuoteKey]=useState("");
  const currentQuote=currentQuoteKey===fieldsKey?(shellMode?fares[vehicle]??null:quote):null;
  useEffect(()=>{
    quickQuoteCoordinator.setAccount(quoteAccount);
    setCooldownSeconds(Math.ceil(quickQuoteCoordinator.remainingMs()/1000));
  },[quoteAccount]);
  useEffect(()=>{
    if(cooldownSeconds<=0)return;
    const timer=window.setInterval(()=>setCooldownSeconds(Math.ceil(quickQuoteCoordinator.remainingMs()/1000)),1000);
    return()=>window.clearInterval(timer);
  },[cooldownSeconds>0]);
  useEffect(()=>{onFaresChange?.(currentQuoteKey===fieldsKey?fares:{});},[fares,currentQuoteKey,fieldsKey,onFaresChange]);
  useEffect(()=>onFareChange?.(currentQuote),[currentQuote,onFareChange]);
  useEffect(()=>{
    onFarePendingChange?.(waitingForOrigin||coverageLoading||quoteLoading||
      Boolean(hasOrigin&&hasDestination&&!error&&coverageResolvedKey!==coveragePointKey));
  },[waitingForOrigin,coverageLoading,quoteLoading,hasOrigin,hasDestination,error,coverageResolvedKey,coveragePointKey,onFarePendingChange]);
  // A search that exceeded its server-issued deadline is no longer active in
  // the UI, even if a delayed RPC returns the old SEARCHING status.
  // The database remains authoritative for acceptance and new requests.
  const searchExpired=(r:ExistingQuickRide)=>r.status==="SEARCHING"&&
    typeof r.expires_at==="string"&&Number.isFinite(Date.parse(r.expires_at))&&
    Date.parse(r.expires_at)<=nowMs;
  const liveRide=rides.find(r=>r.role==="PASSENGER"&&(
    ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(r.status)||
    (r.status==="SEARCHING"&&!searchExpired(r))));
  const completedRide=rides.find(r=>r.role==="PASSENGER"&&r.status==="COMPLETED");
  const pendingReviewRide=rides.find(r=>r.role==="PASSENGER"&&r.status==="PENDING_REVIEW");
  const expiredRide=rides.find(r=>r.role==="PASSENGER"&&(r.status==="EXPIRED"||searchExpired(r)));
  const shownExpiredRide=expiredRide?.id!==expiredHidden?expiredRide:null;
  const searchSecondsLeft=liveRide?.status==="SEARCHING"&&liveRide.expires_at
    ?Math.max(0,Math.ceil((Date.parse(liveRide.expires_at)-nowMs)/1000)):null;
  const searchDeadlinePassed=searchSecondsLeft===0;
  const previouslyActiveRide=useRef<string|null>(null);
  useEffect(()=>{
    if(liveRide){previouslyActiveRide.current=liveRide.id;return;}
    // One non-blocking notice for the actual transition to COMPLETED.
    // Old completed trips must not hijack the Home on every reload.
    if(completedRide&&previouslyActiveRide.current===completedRide.id){
      previouslyActiveRide.current=null;
      // The checkout is shown automatically by QuickRidePostTripFlow below.
      setQuote(null);setCurrentQuoteKey("");setQuoteRefresh(v=>v+1);
    }
  },[liveRide?.id,completedRide?.id]);

  useEffect(()=>{
    onOperationalRideChange?.(liveRide&&["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(liveRide.status)
      ?{id:liveRide.id,status:liveRide.status,municipality:liveRide.municipality}:null);
  },[liveRide?.id,liveRide?.status,liveRide?.municipality,onOperationalRideChange]);
  useEffect(()=>()=>onOperationalRideChange?.(null),[onOperationalRideChange]);

  useEffect(()=>{onRidePhaseChange?.(liveRide?.status??null);},[liveRide?.id,liveRide?.status,onRidePhaseChange]);
  useEffect(()=>{
    if(!expiredRide)return;
    try{
      if(window.localStorage.getItem("caronaa-expired-dismissed:"+expiredRide.id)==="1")
        setExpiredHidden(expiredRide.id);
    }catch{/* In-memory dismissal remains available. */}
  },[expiredRide?.id]);
  function releaseExpiredRide(){
    if(!expiredRide)return;
    try{window.localStorage.setItem("caronaa-expired-dismissed:"+expiredRide.id,"1");}catch{}
    setExpiredHidden(expiredRide.id);
    setError("");
    setQuote(null);setCurrentQuoteKey("");setQuoteRefresh(value=>value+1);
  }
  useEffect(()=>{if(!liveRide||!["ACCEPTED","ARRIVED"].includes(liveRide.status))setBoardingCode("");},[liveRide?.id,liveRide?.status]);
  useEffect(()=>{
    if(!liveRide||liveRide.status!=="IN_PROGRESS"){setDropoff(null);return;}
    let cancelled=false;
    const load=async()=>{
      const {data,error}=await (supabase as any).rpc("quick_ride_dropoff_state",{p_id:liveRide.id});
      if(!cancelled&&!error)setDropoff(Array.isArray(data)?data[0]??null:null);
    };
    void load();const timer=window.setInterval(load,5000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[liveRide?.id,liveRide?.status]);
  useEffect(()=>{
    if(!dropoff?.deadline_at)return;
    const timer=window.setInterval(()=>setNowMs(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[dropoff?.deadline_at]);
  useEffect(()=>{
    if(!liveRide||liveRide.status!=="IN_PROGRESS"||!dropoff?.deadline_at||
      dropoff.passenger_response||dropoff.resolved_at||Date.parse(dropoff.deadline_at)>nowMs)return;
    let alive=true;
    void (supabase as any).rpc("quick_ride_finalize_after_timeout",{p_id:liveRide.id})
      .then(async({data,error:rpcError}:{data:any;error:any})=>{
        if(!alive||rpcError||data!==true)return;
        const {data:ridesData}=await (supabase as any).rpc("quick_ride_my_requests");
        if(alive&&mounted.current){setRides(Array.isArray(ridesData)?ridesData:[]);}
      });
    return()=>{alive=false;};
  },[liveRide?.id,liveRide?.status,dropoff?.deadline_at,dropoff?.passenger_response,dropoff?.resolved_at,nowMs]);
  const remainingDropoffSeconds=dropoff?.deadline_at?Math.max(0,Math.ceil((Date.parse(dropoff.deadline_at)-nowMs)/1000)):0;
  const dropoffIsPending=liveRide?.status==="IN_PROGRESS"&&Boolean(dropoff?.deadline_at)&&!dropoff?.resolved_at&&!dropoff?.passenger_response;
  useEffect(()=>{onDropoffPendingChange?.(Boolean(dropoffIsPending));},[dropoffIsPending,onDropoffPendingChange]);
  async function issueBoardingCode(){
    if(!liveRide||busy)return;
    setBusy(true);setError("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_issue_boarding_pin",{p_id:liveRide.id});
      if(rpcError||typeof data!=="string")throw new Error("Não foi possível emitir o código de embarque.");
      setBoardingCode(data);
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao gerar código.");}
    finally{setBusy(false);}
  }
  const notifiedArrival=useRef<string|null>(null);
  useEffect(()=>{
    if(!liveRide||liveRide.status!=="ARRIVED"||notifiedArrival.current===liveRide.id)return;
    notifiedArrival.current=liveRide.id;
    toast.success("Seu motorista chegou! Informe o código de embarque.");
    if(!boardingCode)void issueBoardingCode();
    void playNotificationSound("driver_arrived");
  },[liveRide?.id,liveRide?.status]);
  async function respondDropoff(response:"CONFIRMED"|"CONTESTED"){
    if(!liveRide||busy||remainingDropoffSeconds===0)return;
    setBusy(true);setError("");
    try{
      const {error:rpcError}=await (supabase as any).rpc("quick_ride_respond_dropoff",{p_id:liveRide.id,p_response:response});
      if(rpcError)throw new Error("Não foi possível registrar a resposta.");
      const {data}=await (supabase as any).rpc("quick_ride_my_requests");
      if(mounted.current)setRides(Array.isArray(data)?data:[]);
      setDropoff(previous=>previous?{...previous,passenger_response:response,resolved_at:new Date().toISOString()}:previous);
      if(response==="CONTESTED")toast.info("Desembarque contestado. A conclusão ficará suspensa para análise.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível responder.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{if(shellMode){const selected=coverages[vehicle]??null;setCoverage(selected);onCoverage?.(selected);}},[shellMode,coverages,vehicle,onCoverage]);
  const covered=coverage?.status==="ENABLED"&&coverageResolvedKey===coveragePointKey;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    setQuote(null);setFares({});setQuoteErrors({});setCurrentQuoteKey("");setInterestSent(false);setError("");
    retryInFlight.current=false;
  },[fieldsKey]);
  useEffect(()=>{
    setCoverage(null);setCoverages({});setCoverageResolvedKey("");onCoverage?.(null);onCoveragesChange?.({});setCoverageLoading(false);
    if(!hasOrigin||originLat==null||originLng==null)return;
    let active=true;setCoverageLoading(true);
    const timer=window.setTimeout(()=>{
      void Promise.allSettled((shellMode?(["CAR","MOTO"] as const):[vehicle]).map(async type=>{
        const value=await availabilityFn({data:{lat:originLat,lng:originLng,vehicleType:type}});
        return [type,value] as const;
      })).then(results=>{if(active){
        const values:Partial<Record<QuickVehicle,QuickRideCoverage>>={};
        results.forEach(result=>{if(result.status==="fulfilled")values[result.value[0]]=result.value[1];});
        setCoverages(values);
        setCoverage(values[vehicle]??null);setCoverageResolvedKey(coveragePointKey);
        onCoverage?.(values[vehicle]??null);onCoveragesChange?.(values);
        if(results.every(result=>result.status==="rejected"))
          setError("Não foi possível verificar a cobertura agora.");
      }})
        .finally(()=>{if(active){setCoverageLoading(false);retryInFlight.current=false;}});
    },450);
    return()=>{active=false;window.clearTimeout(timer);};
    // Stable coordinates, not watchPosition pulses, own the request lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[coveragePointKey,coverageRefresh]);
  const refreshQuickRides=useCallback(async()=>{
    try{
      const {data,error}=await (supabase as any).rpc("quick_ride_my_requests");
      if(!mounted.current)return;
      if(error){setRideRefreshError(true);return;}
      setRides(Array.isArray(data)?data:[]);
      setRideRefreshError(false);
    }catch{
      if(mounted.current)setRideRefreshError(true);
    }
  },[]);
  useEffect(()=>{void refreshQuickRides();},[refreshQuickRides]);
  useEffect(()=>{const onRefresh=()=>void refreshQuickRides();window.addEventListener("caronaa:app-refresh",onRefresh);return()=>window.removeEventListener("caronaa:app-refresh",onRefresh);},[refreshQuickRides]);
  useEffect(()=>{
    const updated=()=>{void refreshQuickRides();};
    window.addEventListener("caronaa:quick-ride-dropoff-updated",updated);
    return()=>window.removeEventListener("caronaa:quick-ride-dropoff-updated",updated);
  },[refreshQuickRides]);
  useQuickRideRealtime(liveRide?.municipality??coverage?.municipality??"",refreshQuickRides,true);
  // A passenger is not authorized to read the driver-only municipal event
  // channel. Read their own ride state at a bounded cadence while active;
  // this is independent of driver socket delivery and survives missed events.
  useEffect(()=>{
    if(!liveRide)return;
    const intervalMs=liveRide.status==="SEARCHING"?3000:
      ["ACCEPTED","ARRIVED"].includes(liveRide.status)?5000:12000;
    const timer=window.setInterval(()=>{
      if(!document.hidden)void refreshQuickRides();
    },intervalMs);
    const visible=()=>{if(!document.hidden)void refreshQuickRides();};
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    return()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",visible);
      document.removeEventListener("visibilitychange",visible);
    };
  },[liveRide?.id,liveRide?.status,refreshQuickRides]);
  useEffect(()=>{
    if(liveRide?.status!=="SEARCHING")return;
    const timer=window.setInterval(()=>setNowMs(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[liveRide?.id,liveRide?.status]);

  useEffect(()=>{
    if(!(shellMode?Object.values(coverages).some(value=>value.status==="ENABLED")&&coverageResolvedKey===coveragePointKey:covered)||
      !hasOrigin||!hasDestination||!hasQuoteLabels||liveRide||
      originLat==null||originLng==null||destinationLat==null||destinationLng==null){
      setQuoteLoading(false);retryInFlight.current=false;return;
    }
    const eligible:QuickVehicle[]=shellMode?(["CAR","MOTO"] as const).filter(type=>coverages[type]?.status==="ENABLED"):[vehicle];
    // Retry only missing/expired quotations. Keep a valid quote for the other vehicle.
    const types=eligible.filter(type=>{
      const existing=currentQuoteKey===fieldsKey?(shellMode?fares[type]:quote):null;
      return !existing||Date.parse(existing.expiresAt)<=Date.now();
    });
    if(types.length===0){setQuoteLoading(false);retryInFlight.current=false;return;}
    let active=true;
    setQuoteLoading(true);setError("");
    setQuoteErrors(previous=>{const next={...previous};for(const type of types)delete next[type];return next;});
    const timer=window.setTimeout(()=>{
      if(!active)return;
      void Promise.allSettled(types.map(async type=>{
        const key=quickQuoteItineraryKey(originPoint,destinationPoint,type);
        const result=await quickQuoteCoordinator.run(quoteAccount,key,()=>previewFn({data:{
          origin:{lat:originLat,lng:originLng},destination:{lat:destinationLat,lng:destinationLng},
          originLabel:origin,destinationLabel:destination,vehicleType:type,
        }}));
        if(active){setFares(previous=>({...previous,[type]:result}));setQuote(result);setCurrentQuoteKey(fieldsKey);}
        return result;
      })).then(results=>{
        if(!active)return;
        const failures:Partial<Record<QuickVehicle,string>>={};
        results.forEach((result,index)=>{if(result.status==="rejected")failures[types[index]]=friendlyQuickQuoteError(result.reason);});
        setQuoteErrors(previous=>({...previous,...failures}));
        setCooldownSeconds(Math.ceil(quickQuoteCoordinator.remainingMs()/1000));
      }).catch(()=>{if(active)setError("Não foi possível calcular o preço agora.");})
        .finally(()=>{if(active){setQuoteLoading(false);retryInFlight.current=false;}});
    },350);
    return()=>{active=false;window.clearTimeout(timer);};
    // Address labels update display only; exact coordinates govern re-quoting.
    // Completed quote state never restarts this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[fieldsKey,hasQuoteLabels,coverageResolvedKey,coverages,liveRide?.id,quoteRefresh]);

  function retryPrice(){
    const remaining=Math.ceil(quickQuoteCoordinator.remainingMs()/1000);
    if(remaining>0){setCooldownSeconds(remaining);return;}
    if(quoteLoading||coverageLoading||busy||retryInFlight.current||!hasOrigin||!hasDestination||liveRide)return;
    retryInFlight.current=true;setError("");
    if(coverageResolvedKey!==coveragePointKey){setCoverageLoading(true);setCoverageRefresh(v=>v+1);}
    else{setQuoteLoading(true);setQuoteRefresh(v=>v+1);}
  }
  async function request(){
    if(waitingForOrigin||busy||submissionInFlight.current)return;
    if(!hasOrigin){onConfirmPickup?.();return;}
    if(!covered||quoteLoading||driverLoading||driverCount<1||Boolean(driverError)||
      !currentQuote||Date.parse(currentQuote.expiresAt)<=Date.now())return;
    // Approximate coordinates may calculate a preview, but never dispatch
    // until a separate explicit action confirms the selected pickup.
    if(pickupNeedsConfirmation){onConfirmPickup?.();return;}
    void unlockNotificationAudio();
    submissionInFlight.current=true;setBusy(true);setError("");
    try{
      const submitted=await submitFn({data:{quoteId:currentQuote.quoteId}});
      quickQuoteCoordinator.forget();
      const acknowledged:ExistingQuickRide={id:submitted.rideId,role:"PASSENGER",status:"SEARCHING",
        municipality:coverage?.municipality??"",vehicle_type:vehicle,
        expires_at:new Date(Date.now()+120000).toISOString()};
      const {data,error:reloadError}=await (supabase as any).rpc("quick_ride_my_requests");
      if(mounted.current){
        const fromServer:ExistingQuickRide[]=!reloadError&&Array.isArray(data)?data:[];
        setRides(fromServer.some(r=>r.id===submitted.rideId)?fromServer:[acknowledged,...fromServer]);
        setQuote(null);setCurrentQuoteKey("");
      }
    }catch(cause){
      quickQuoteCoordinator.forget(currentQuote.quoteId);
      if(mounted.current)setError(cause instanceof Error?cause.message:"Pedido indisponível.");
    }
    finally{submissionInFlight.current=false;if(mounted.current)setBusy(false);}
  }
  async function registerInterest(){
    if(!coverage?.municipality||busy)return;
    setBusy(true);setError("");
    try{await interestFn({data:{municipality:coverage.municipality,vehicleType:vehicle}});if(mounted.current)setInterestSent(true);}
    catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Não foi possível registrar o interesse.");}
    finally{if(mounted.current)setBusy(false);}
  }
  async function rideAction(action:"CANCELLED"){
    if(!liveRide||busy)return;
    setBusy(true);setError("");
    try{
      const {error:rpcError}=await (supabase as any).rpc("quick_ride_transition",{p_id:liveRide.id,p_status:action});
      if(rpcError)throw new Error("Não foi possível atualizar a corrida.");
      const {data}=await (supabase as any).rpc("quick_ride_my_requests");
      if(mounted.current)setRides(Array.isArray(data)?data:[]);
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Não foi possível atualizar.");}
    finally{if(mounted.current)setBusy(false);}
  }
  const inactiveText=coverage?.status==="OUTSIDE"?"Ainda não atendemos embarques nesse município.":
    coverage?.status==="WAITLIST"?(coverage?.radar===true
      ?"Radar de motoristas em homologação nesta zona. Corridas pagas aguardam tarifa e autorização operacional."
      :"Este município está no nosso plano de expansão, mas a Corrida Rápida ainda não foi habilitada."):
    coverage?.status==="UNKNOWN"?"Não foi possível identificar o município do embarque.":"Informe um ponto de saída verificado para consultar a cobertura.";
  const canOpenOrigin=!waitingForOrigin&&!hasOrigin&&Boolean(onConfirmPickup);
  const requestDisabled=busy||waitingForOrigin||(!canOpenOrigin&&(!hasOrigin||!covered||quoteLoading||driverLoading||
    Boolean(driverError)||driverCount<1||!currentQuote||Date.parse(currentQuote.expiresAt)<=Date.now()));
  const priceFailure=!currentQuote?quoteErrors[vehicle]:undefined;
  const retryDisabled=busy||quoteLoading||coverageLoading||cooldownSeconds>0;
  const retryLabel=cooldownSeconds>0?`Tentar novamente em ${cooldownSeconds}s`:"Tentar novamente";
  const requestControls=<div className="space-y-2" aria-live="polite">
    <Button type="button" disabled={requestDisabled} onClick={()=>void request()}
      className="min-h-12 h-auto w-full whitespace-normal px-3 py-3 font-bold">
      {waitingForOrigin&&<Loader2 size={18} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none"/>}
      {busy?"Enviando pedido…":waitingForOrigin?"Obtendo sua localização…":!hasOrigin?"Definir ponto de embarque":
        !hasDestination?"Escolha seu destino":!currentQuote?(quoteLoading||coverageLoading?"Consultando preços…":"Preço indisponível"):
        driverCount<1?"Aguardando motorista disponível":
        (shellMode?`Confirmar Flash ${vehicle==="MOTO"?"Moto":"Carro"} — `:"Confirmar corrida por ")+formatBrl(currentQuote.customerPaysCents/100)}
    </Button>
    {priceFailure&&!quoteLoading&&<div role="alert" className="space-y-2">
      <p className="text-sm text-white/80">{priceFailure}</p>
      <Button type="button" variant="outline" disabled={retryDisabled} onClick={retryPrice} className="min-h-12 w-full border-[#FFBB00]/40 text-[#FFBB00]">{retryLabel}</Button>
    </div>}
    {currentQuote&&Date.parse(currentQuote.expiresAt)<=Date.now()&&<Button type="button" variant="ghost" disabled={retryDisabled}
      onClick={retryPrice} className="min-h-12">{cooldownSeconds>0?retryLabel:"Atualizar preço expirado"}</Button>}
  </div>;
  return (
    <section aria-label="Corrida Rápida no mapa" className={shellMode&&liveRide?"flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden text-white":shellMode?"min-w-0 w-full space-y-3 text-white":
      "min-w-0 w-full max-w-full space-y-3 overflow-x-hidden rounded-2xl border border-[#FFBB00]/25 bg-white/[0.04] p-3 text-white"}>
      {liveRide?.status==="IN_PROGRESS"&&dropoff?.deadline_at&&!dropoff.resolved_at&&!dropoff.passenger_response&&<section role="alert" aria-label="Confirmação de desembarque pendente"
        className="space-y-3 rounded-2xl border-2 border-[#FFBB00] bg-[#FFBB00]/15 p-4">
        <h2 className="font-[Sora] text-lg font-black text-[#FFBB00]">Motorista solicitou o desembarque</h2>
        <p className="text-sm leading-relaxed text-white">Você já desembarcou no destino combinado?</p>
        <p role="timer" className="font-[Sora] text-2xl font-extrabold tabular-nums text-[#FFBB00]">Aguardando resposta · {String(Math.floor(remainingDropoffSeconds/60)).padStart(2,"0")}:{String(remainingDropoffSeconds%60).padStart(2,"0")}</p>
        {remainingDropoffSeconds>0?<div className="grid gap-2">
          <button type="button" disabled={busy} onClick={()=>void respondDropoff("CONFIRMED")} className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-3 font-extrabold text-[#121212] disabled:opacity-50">Confirmar desembarque no destino</button>
          <button type="button" disabled={busy} onClick={()=>void respondDropoff("CONTESTED")} className="min-h-12 w-full rounded-xl border border-white/40 bg-[#121212] px-3 font-semibold text-white disabled:opacity-50">Ainda não desembarquei / Contestar</button>
        </div>:<p role="status" className="text-sm text-white/90">Prazo encerrado. Aguardando confirmação do servidor.</p>}
      </section>}
      {!shellMode&&<div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#FFBB00]">Viajar agora</p><p className="text-xs text-gray-300">Mesmo mapa, embarque no local escolhido, sem troca de página.</p></div>
        <ShieldCheck size={20} className="shrink-0 text-[#FFBB00]" aria-label="Motoristas autorizados pela plataforma"/>
      </div>}
      {!shellMode&&<div className="grid grid-cols-2 gap-2" aria-label="Escolher tipo de corrida rápida">
        {(["CAR","MOTO"] as const).map(mode=><button key={mode} type="button" aria-pressed={vehicle===mode} onClick={()=>onVehicleChange(mode)}
          className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors "+(vehicle===mode?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/20 bg-white/5 text-white")}>
          {mode==="CAR"?<CarFront size={18}/>:<Bike size={18}/>}{mode==="CAR"?"Carro":"Moto"}
        </button>)}
      </div>}
      {!shellMode&&<div className="min-w-0 rounded-xl border border-white/10 bg-[#121212]/70 p-3 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-semibold"><Users size={16} className="text-[#FFBB00]"/><span>Profissionais disponíveis na região</span></div>
        <p role="status" className="mt-1 text-gray-300">{driverLoading?"Consultando o radar…":driverError?driverError:
          coverage?.radar===false?"Radar ainda indisponível nesse município.":driverCount===0?"Nenhum profissional autorizado e online no momento.":
          driverCount===1?"1 profissional autorizado e online.":driverCount+" profissionais autorizados e online."}</p>
        {driverCounts&&<p className="mt-1 text-xs text-gray-300">🚗 {driverCounts.CAR} carro(s) · 🏍️ {driverCounts.MOTO} moto(s) no radar</p>}
        <p className="mt-1 text-[11px] text-gray-400">Radar com posições aproximadas de profissionais aprovados. A presença no mapa não significa disponibilidade para corrida comercial; o despacho exige habilitação separada.</p>
      </div>}
      {!liveRide&&(shellMode
        ?(actionContainer?createPortal(requestControls,actionContainer):requestControls)
        :!currentQuote?requestControls:null)}
      {!liveRide&&!hasOrigin&&!waitingForOrigin&&<p role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-xs">
        {gpsOriginIsImprecise?"GPS impreciso. Defina o ponto de embarque no mapa ou pelo endereço.":"Defina seu ponto de embarque para consultar os preços."}
      </p>}
      {!liveRide&&hasOrigin&&coverageLoading&&<p role="status" className="text-xs text-gray-300">Verificando cobertura a partir do embarque…</p>}
      {!liveRide&&hasOrigin&&!coverageLoading&&coverageResolvedKey===coveragePointKey&&!covered&&<div className="min-w-0 break-words rounded-xl border border-white/20 bg-white/5 p-3 text-xs">
        <p className="font-semibold">{coverage?.municipality??"Região não identificada"}</p>
        <p className="mt-1 text-gray-300">{shellMode?"Corrida não disponível neste local. Escolha uma origem ou modalidade atendida.":inactiveText}</p>
        {coverage?.municipality&&<button type="button" disabled={busy||interestSent} onClick={()=>void registerInterest()}
          className="mt-2 min-h-12 rounded-xl border border-[#FFBB00]/40 px-3 font-bold text-[#FFBB00] disabled:opacity-60">{interestSent?"Interesse registrado":"Avise-me quando chegar aqui"}</button>}
        {!shellMode&&<p className="mt-2 text-gray-400">Você pode escolher outra saída numa região habilitada. A região do seu cadastro não limita os pedidos.</p>}
      </div>}
      {liveRide?(dropoffIsPending?null:<FlashPassengerLiveSheet
        ride={{id:liveRide.id,status:liveRide.status as "SEARCHING"|"ACCEPTED"|"ARRIVED"|"IN_PROGRESS",
          vehicle_type:liveRide.vehicle_type,fare_cents:liveRide.fare_cents??null}}
        snap={shellSnap} origin={origin} destination={destination}
        searchSecondsLeft={searchSecondsLeft} searchDeadlinePassed={searchDeadlinePassed}
        boardingCode={boardingCode} busy={busy} rideRefreshError={rideRefreshError}
        onBoardingCode={()=>void issueBoardingCode()}
        onCancel={()=>void rideAction("CANCELLED")}
        onRefresh={()=>void refreshQuickRides()}
        onFollowMap={onFollowMap?()=>onFollowMap(liveRide.id):undefined}
        onExpand={()=>onOpenOperational?.()}/>
      ):<>
        {pendingReviewRide&&<section role="status" className="space-y-2 rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
          <p className="font-bold text-[#FFBB00]">Confirmação de desembarque pendente</p>
          <p className="text-white/85">Há uma confirmação de desembarque pendente ou em revisão. Se ainda não respondeu, ela será apresentada ao abrir o aplicativo. O Pix só fica disponível após a conclusão confirmada.</p>
        </section>}
        {shownExpiredRide&&<section role="status"
          className="space-y-2 rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
          <p className="font-semibold text-[#FFBB00]">Busca encerrada</p>
          <p className="text-white/85">O prazo terminou sem um motorista confirmado. Você pode solicitar outra corrida sem atualizar a página.</p>
          <button type="button" onClick={releaseExpiredRide}
            className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-3 font-bold text-[#121212]">
            Tentar outra corrida
          </button>
        </section>}
        {covered&&hasDestination&&!currentQuote&&!error&&!priceFailure&&<p role="status" className="rounded-xl border border-white/20 bg-white/5 p-3 text-xs text-gray-200">
          {quoteLoading?"Calculando o preço da viagem…":"Preparando preço automaticamente para o destino selecionado…"}
        </p>}
        {covered&&!hasDestination&&!shellMode&&<p className="text-xs text-gray-300"><MapPin className="mr-1 inline" size={13}/>Escolha o destino para visualizar o preço automaticamente.</p>}
        {currentQuote&&<div role="status" className={shellMode?"space-y-2 py-2":"min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3"}>
          {!shellMode&&<>
            <p className="text-xs text-gray-200">Preço até {destination} · {vehicle==="MOTO"?"Moto":"Carro"}</p>
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              {vehicle==="MOTO"?<Bike size={16} className="text-[#FFBB00]"/>:<CarFront size={16} className="text-[#FFBB00]"/>}
              <span>{driverLoading?"Buscando motoristas online…":driverError?"Não foi possível verificar motoristas online.":driverCount===0?"Sem motorista online para esta modalidade.":driverCount===1?"1 motorista online para receber seu pedido.":driverCount+" motoristas online para receber seu pedido."}</span>
            </div>
            <p className="break-words text-2xl font-extrabold text-[#FFBB00]">{formatBrl(currentQuote.customerPaysCents/100)}</p>
            <p className="flex items-center gap-1 text-xs text-gray-200"><Clock3 size={13}/>{currentQuote.distanceKm.toFixed(1)} km • aprox. {Math.round(currentQuote.durationMinutes)} min</p>
            <p className="text-xs text-gray-300">Comissão de {currentQuote.commissionBps/100}% ({currentQuote.commissionSource==="OFFICIAL_ACTIVITY"?"atividade oficial":"política regional"}). O motorista recebe {formatBrl(currentQuote.driverReceivesCents/100)}.</p>
            <p className="text-[11px] text-gray-300">Fase piloto: sem débito automático. O pagamento e o repasse precisam ser homologados antes da operação comercial.</p>
          </>}
          {shellMode&&<p className="text-xs text-white/70">Pix ou dinheiro direto ao motorista · {currentQuote.distanceKm.toFixed(1)} km · aprox. {Math.round(currentQuote.durationMinutes)} min de viagem</p>}
          {!shellMode&&requestControls}
        </div>}
      </>}
      <QuickRidePostTripFlow role="PASSENGER" activeRideId={liveRide?.id??pendingReviewRide?.id??null} completedRide={completedRide??null}/>
      {!liveRide&&error&&!priceFailure&&!waitingForOrigin&&<p role="alert" className="rounded-xl border border-[#FFBB00]/35 p-3 text-sm text-white/90">{shellMode?"Não foi possível obter os dados da viagem. Confira o trajeto e tente novamente.":error}</p>}
      {error&&!priceFailure&&hasOrigin&&hasDestination&&!currentQuote&&!liveRide&&<Button type="button" variant="outline" disabled={retryDisabled} onClick={retryPrice} className="min-h-12 w-full border-[#FFBB00]/40">{retryLabel}</Button>}
    </section>
  );
}
