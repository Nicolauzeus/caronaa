import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bike, CarFront, Clock3, Loader2, MapPin, Search, UserRound } from "lucide-react";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { isKaluandaNightActive } from "@/lib/location/kaluanda-night";
import { WomenOnlyToggle } from "@/components/caronaa/WomenOnlyToggle";
import { emptyTravelPreferences, type TravelPreferences } from "@/lib/travel-preferences";
import { loadTravelPreferences } from "@/lib/travel-preferences-service";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { quoteUnifiedFare, type UnifiedFareResult, type UnifiedFareMode } from "@/lib/pricing/unified-fare-engine";
import { formatBrl } from "@/lib/ride-cost";
import { supabase } from "@/integrations/supabase/client";
import { ServiceTypeDock, type ServiceType } from "./ServiceTypeDock";
import type { SheetSnap } from "./InteractiveBottomSheet";
import type { FormLocationDetails } from "@/lib/location/types";
import type { ProfileGender } from "@/lib/use-profile-gender";
import { confirmOnRouteBooking, searchOnRouteMatches, OnRouteServiceError } from "@/services/on-route-service";
import type { OnRouteMatch } from "@/types/ride";
import { toast } from "sonner";
import type { QuickRideFarePreview } from "@/lib/quick-rides/quick-ride.functions";

export type ShellRoute = {routePath:Array<{lat:number;lng:number}>;distanceKm:number;durationMinutes:number};
type Point = {lat:number;lng:number};
type Vehicle = "CAR"|"MOTO";
type Props = {
  snap:SheetSnap;
  onSnapChange?:(snap:SheetSnap)=>void;
  serviceType:ServiceType;
  onServiceTypeChange:(service:ServiceType)=>void;
  originPoint?:{lat?:number;lng?:number}|null;
  originLabel?:string;
  locating?:boolean;
  gpsError?:string;
  onRetryGps?:()=>void;
  originMunicipality:string;
  originRevision?:number;
  gender:ProfileGender;
  onDestinationChange?:(label:string,details?:FormLocationDetails)=>void;
  onRouteChange?:(route:ShellRoute|null,origin:Point|null)=>void;
  onAdjustOrigin?:()=>void;
  onScheduled?:(id:string)=>void;
  onOnRouteMatchSelected?:(match:OnRouteMatch|null)=>void;
  flashOperationalPanel?:ReactNode;
  onFlashVehicleChange?:(vehicle:Vehicle)=>void;
  flashRideActive?:boolean;
  flashFare?:QuickRideFarePreview|null;
  flashFares?:Partial<Record<Vehicle,QuickRideFarePreview>>;
  flashFarePending?:boolean;
  flashDriverCounts?:Record<Vehicle,number>;
  flashDriverErrors?:Partial<Record<Vehicle,string>>;
  flashDriverLoading?:boolean;
  flashDriverError?:string;
  onFlashActionContainer?:(element:HTMLElement|null)=>void;
};
const valid=(p:{lat?:number;lng?:number}|null|undefined):p is Point=>
  !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&
  typeof p.lat==="number"&&typeof p.lng==="number"&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
const selectedButton=(chosen:boolean)=>"min-h-11 rounded-xl border p-3 text-sm font-bold transition-colors "+
  (chosen?"border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]":"border-white/20 bg-white/5 text-white");
const localDateTime=(offsetMs=0)=>new Date(Date.now()+offsetMs-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
export const validScheduleDate=(localValue:string,now=Date.now()):boolean=>{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localValue))return false;
  const value=new Date(localValue);
  return Number.isFinite(value.getTime())&&value.getTime()>=now+30*60*1000&&
    localValue===[value.getFullYear(),String(value.getMonth()+1).padStart(2,"0"),String(value.getDate()).padStart(2,"0")].join("-")+
      "T"+String(value.getHours()).padStart(2,"0")+":"+String(value.getMinutes()).padStart(2,"0");
};
const scheduledLabel=(localValue:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"full",timeStyle:"short"}).format(new Date(localValue));

const fortalezaLocal=(value:string)=>new Date(Date.parse(value)-3*60*60*1000).toISOString();
export function ShellJourneyPlanner({
  snap,onSnapChange,serviceType,onServiceTypeChange,originPoint,originLabel,locating=false,
  gpsError="",onRetryGps,originMunicipality,originRevision=0,gender,onDestinationChange,onRouteChange,onAdjustOrigin,onScheduled,onOnRouteMatchSelected,
  flashOperationalPanel,onFlashVehicleChange,flashRideActive=false,flashFare=null,flashFares={},flashFarePending=false,
  flashDriverCounts={CAR:0,MOTO:0},flashDriverErrors={},flashDriverLoading=false,flashDriverError="",onFlashActionContainer,
}:Props){
  const [destination,setDestination]=useState("");
  const [flashStep,setFlashStep]=useState<"choices"|"confirm"|"shared">("choices");
  useEffect(()=>{
    // A new service or pickup invalidates the old selection; the server will
    // produce a fresh route-specific quotation before confirmation.
    setFlashStep("choices");
  },[serviceType,originRevision]);

  const [focusDestination,setFocusDestination]=useState(false);
  const [destinationPoint,setDestinationPoint]=useState<FormLocationDetails>();
  const [exclusiveVehicle,setExclusiveVehicle]=useState<Vehicle>("CAR");
  const [onRouteVehicle,setOnRouteVehicle]=useState<Vehicle>("CAR");
  const [mode,setMode]=useState<UnifiedFareMode>("EXCLUSIVE");
  const [seats,setSeats]=useState(1);
  const vehicle=mode==="EXCLUSIVE"?exclusiveVehicle:onRouteVehicle;
  const [entireCar,setEntireCar]=useState(false);
  const [route,setRoute]=useState<ShellRoute|null>(null);
  const [prices,setPrices]=useState<{ON_ROUTE:UnifiedFareResult;EXCLUSIVE:UnifiedFareResult}|null>(null);
  const [routeBusy,setRouteBusy]=useState(false);
  const [routeError,setRouteError]=useState("");
  const [routeAttempt,setRouteAttempt]=useState(0);
  const [preferences,setPreferences]=useState<TravelPreferences>({...emptyTravelPreferences});
  const [womenOnly,setWomenOnly]=useState(false);
  const [scheduledAt,setScheduledAt]=useState("");
  const [onRouteMatches,setOnRouteMatches]=useState<OnRouteMatch[]>([]);
  const [onRouteDiagnostic,setOnRouteDiagnostic]=useState("");
  const [onRouteBusy,setOnRouteBusy]=useState(false);
  const [bookingBusy,setBookingBusy]=useState(false);
  const [selectedMatch,setSelectedMatch]=useState<OnRouteMatch|null>(null);
  const [onRouteConfirmedId,setOnRouteConfirmedId]=useState<string|null>(null);
  const [scheduling,setScheduling]=useState(false);
  const [scheduledId,setScheduledId]=useState<string|null>(null);
  const [scheduleError,setScheduleError]=useState("");
  const onRouteSearchRef=useRef(0);
  const routeReader=useServerFn(getMapDrivingRoute);
  const routeReaderRef=useRef(routeReader);routeReaderRef.current=routeReader;
  const routeCache=useRef(new Map<string,Promise<ShellRoute>>());
  const frozenOrigin=useRef<Point|null>(null);
  const selectedKey=useRef("");
  const lastOriginRevision=useRef(originRevision);
  const onRouteRef=useRef(onRouteChange);onRouteRef.current=onRouteChange;
  const waitingForOrigin=locating&&!valid(originPoint);
  const originText=waitingForOrigin?"Localizando você…":valid(originPoint)
    ?"Origem: "+(originLabel||"Minha localização atual"):"Definir ponto de embarque";

  useEffect(()=>{
    let active=true;
    void loadTravelPreferences().then(value=>{if(active)setPreferences(value);}).catch(()=>undefined);
    return()=>{active=false;routeCache.current.clear();};
  },[]);
  useEffect(()=>{if(gender!=="FEMININO")setWomenOnly(false);},[gender]);

  // One Google route per selected pair. GPS display updates do not change the
  // contracted origin; the explicit retry only evicts this pair's cache entry.
  useEffect(()=>{
    if(originRevision!==lastOriginRevision.current){
      // An explicit new-location request invalidates the old point even while
      // the replacement GPS fix is still absent. Do not silently reuse it.
      frozenOrigin.current=valid(originPoint)?{lat:originPoint.lat,lng:originPoint.lng}:null;
      lastOriginRevision.current=originRevision;
    }else if(!frozenOrigin.current&&valid(originPoint)){
      frozenOrigin.current={lat:originPoint.lat,lng:originPoint.lng};
    }
    if(!valid(destinationPoint)){
      selectedKey.current="";setRoute(null);setPrices(null);setRouteBusy(false);
      onRouteRef.current?.(null,null);return;
    }
    const from=frozenOrigin.current;
    if(!from){setRoute(null);setPrices(null);setRouteBusy(false);onRouteRef.current?.(null,null);return;}
    const to:Point={lat:destinationPoint.lat,lng:destinationPoint.lng};
    const key=[from.lat,from.lng,to.lat,to.lng].map(n=>n.toFixed(6)).join(":");
    selectedKey.current=key;
    let alive=true;
    setRouteBusy(true);setRouteError("");setRoute(null);setPrices(null);
    // Publish the SAME origin immediately, even if route rendering is delayed.
    onRouteRef.current?.(null,from);
    let pending=routeCache.current.get(key);
    if(!pending){
      pending=routeReaderRef.current({data:{points:[from,to]}}).then(result=>{
        if(!Number.isFinite(result.distanceKm)||result.distanceKm<=0||!Array.isArray(result.routePath)||result.routePath.length<2)
          throw new Error("ROAD_ROUTE_UNAVAILABLE");
        return {routePath:result.routePath,distanceKm:result.distanceKm,durationMinutes:result.durationMinutes};
      });
      routeCache.current.set(key,pending);
      void pending.catch(()=>{routeCache.current.delete(key);});
    }
    void pending.then(result=>{
      if(!alive||selectedKey.current!==key)return;
      setRoute(result);onRouteRef.current?.(result,from);
    }).catch(()=>{if(alive)setRouteError("Não foi possível traçar a rota agora.");})
      .finally(()=>{if(alive)setRouteBusy(false);});
    return()=>{alive=false;};
  },[destinationPoint?.lat,destinationPoint?.lng,originRevision,originPoint?.lat,originPoint?.lng,routeAttempt]);

  useEffect(()=>{
    if(!route){setPrices(null);return;}
    let active=true;
    const onRouteSeats=onRouteVehicle==="MOTO"?1:entireCar?3:seats;
    void Promise.all([
      quoteUnifiedFare({distanceKm:route.distanceKm,mode:"ON_ROUTE",vehicleType:onRouteVehicle,seats:onRouteSeats}),
      quoteUnifiedFare({distanceKm:route.distanceKm,mode:"EXCLUSIVE",vehicleType:exclusiveVehicle}),
    ]).then(([ON_ROUTE,EXCLUSIVE])=>{if(active)setPrices({ON_ROUTE,EXCLUSIVE});})
      .catch(()=>{if(active){setPrices(null);setRouteError("Não foi possível calcular a estimativa.");}});
    return()=>{active=false;};
  },[route,onRouteVehicle,exclusiveVehicle,seats,entireCar]);

  const pickDestination=useCallback((label:string,details?:FormLocationDetails)=>{
    onRouteSearchRef.current+=1;setOnRouteMatches([]);setSelectedMatch(null);
    setOnRouteConfirmedId(null);setOnRouteDiagnostic("");onOnRouteMatchSelected?.(null);
    setDestination(label);setDestinationPoint(details);setFlashStep("choices");onDestinationChange?.(label,details);
    if(details)setFocusDestination(false);
    setRoute(null);setPrices(null);
    frozenOrigin.current=valid(originPoint)?{lat:originPoint.lat,lng:originPoint.lng}:null;
    if(details&&valid(details))onSnapChange?.("half");
  },[originPoint?.lat,originPoint?.lng,onDestinationChange,onSnapChange,onOnRouteMatchSelected,serviceType]);
  useEffect(()=>{
    onRouteSearchRef.current+=1;setOnRouteMatches([]);setSelectedMatch(null);setOnRouteBusy(false);
    setOnRouteDiagnostic("");setOnRouteConfirmedId(null);onOnRouteMatchSelected?.(null);
  },[onRouteVehicle,seats,entireCar,scheduledAt,originRevision,onOnRouteMatchSelected]);
  const changeVehicle=(value:Vehicle,kind:UnifiedFareMode)=>{
    if(flashRideActive){toast.info("Finalize ou cancele a corrida atual antes de mudar o veículo.");return;}
    if(kind==="EXCLUSIVE"){setExclusiveVehicle(value);onFlashVehicleChange?.(value);return;}
    setOnRouteVehicle(value);if(value==="MOTO"){setSeats(1);setEntireCar(false);}
  };
  const scheduleValid=validScheduleDate(scheduledAt);
  const submitSchedule=async()=>{
    if(scheduling||scheduledId||!scheduleValid||!route||!prices||!valid(originPoint)||!valid(destinationPoint)){
      setScheduleError("Revise o trajeto e escolha um horário com pelo menos 30 minutos de antecedência.");return;
    }
    setScheduling(true);setScheduleError("");
    try{
      const reservedSeats=vehicle==="MOTO"?1:mode==="EXCLUSIVE"?3:entireCar?3:seats;
      const {data,error}=await (supabase as any).rpc("schedule_caronaa_ride",{
        // Matches the live signature; America/Fortaleza is fixed UTC-3.
        p_origin:originLabel?.trim()||"Origem confirmada",p_destination:destination.trim(),
        p_origin_lat:originPoint.lat,p_origin_lng:originPoint.lng,
        p_destination_lat:destinationPoint.lat,p_destination_lng:destinationPoint.lng,
        p_ride_date:fortalezaLocal(scheduledAt).slice(0,10),p_departure_time:fortalezaLocal(scheduledAt).slice(11,19),
        p_service_mode:mode,p_vehicle_type:vehicle,p_passenger_count:reservedSeats,
        p_women_only:gender==="FEMININO"&&womenOnly,
        p_price_cents:Math.round(prices[mode].totalFare*100),p_distance_km:route.distanceKm,
        p_preferences:preferences,
        p_origin_label:originLabel?.trim()||"Origem confirmada",p_destination_label:destination.trim(),
      });
      if(error||!data)throw new Error("SCHEDULE_NOT_CONFIRMED");
      const id=typeof data==="string"?data:typeof data==="object"&&data!==null?(data.request_id??data.id):null;
      if(typeof id!=="string"||!id)throw new Error("SCHEDULE_ID_MISSING");
      setScheduledId(id);onScheduled?.(id);
    }catch{setScheduleError("Não foi possível agendar agora. Verifique a disponibilidade do serviço e tente novamente.");}
    finally{setScheduling(false);}
  };
  const searchAvailableOnRoute=async()=>{
    if(onRouteBusy||!valid(destinationPoint)||!frozenOrigin.current)return;
    const generation=++onRouteSearchRef.current;
    setOnRouteBusy(true);setOnRouteDiagnostic("");setOnRouteMatches([]);setSelectedMatch(null);onOnRouteMatchSelected?.(null);
    const from=frozenOrigin.current;
    try {
      const result=await searchOnRouteMatches({
        originLat:from.lat,originLng:from.lng,destLat:destinationPoint.lat,destLng:destinationPoint.lng,
        seats:onRouteVehicle==="MOTO"?1:entireCar?3:seats,
        targetTime:serviceType==="FLASH"?new Date():validScheduleDate(scheduledAt)?new Date(scheduledAt):undefined,
      });
      if(generation===onRouteSearchRef.current){
        setOnRouteMatches(result.matches);
        setOnRouteDiagnostic(result.diagnostic);
      }
    } catch {
      if(generation===onRouteSearchRef.current){
        setOnRouteMatches([]);
        setOnRouteDiagnostic("ON_ROUTE_SERVICE_UNAVAILABLE");
      }
    } finally {
      if(generation===onRouteSearchRef.current)setOnRouteBusy(false);
    }
  };
  const selectOnRoute=(match:OnRouteMatch)=>{
    if(selectedMatch?.offerId===match.offerId)return;
    setSelectedMatch(match);setOnRouteConfirmedId(null);onOnRouteMatchSelected?.(match);
  };
  const confirmSelectedOnRoute=async()=>{
    if(!selectedMatch||bookingBusy||onRouteConfirmedId)return;
    const needed=onRouteVehicle==="MOTO"?1:entireCar?3:seats;
    if(selectedMatch.seatsRemaining<needed){toast.info("Essa carona não tem vagas suficientes. Atualize as opções.");return;}
    const count=onRouteVehicle==="MOTO"?1:entireCar?3:seats;setBookingBusy(true);
    try{
      const result=await confirmOnRouteBooking(selectedMatch.offerId,count,{
        pickupMeeting:selectedMatch.pickupMeeting,dropoffMeeting:selectedMatch.dropoffMeeting,
      });
      setOnRouteConfirmedId(result.bookingId);onSnapChange?.("full");toast.success("Carona confirmada. Confira o resumo.");
    }catch(error){
      if(error instanceof OnRouteServiceError&&error.code==="OVERBOOKING_PREVENTED"){
        toast.info("Essa carona acabou de ser preenchida. Buscando outras opções...");
        setSelectedMatch(null);onOnRouteMatchSelected?.(null);await searchAvailableOnRoute();
      }else toast.error("Não conseguimos confirmar essa carona. Tente novamente.");
    }finally{setBookingBusy(false);}
  };
  useEffect(()=>{
    // Look up genuine shared rides as soon as a destination and route are ready.
    // Do not require selecting the shared category to discover an offer.
    if(serviceType!=="FLASH"||!route||!valid(destinationPoint)||!frozenOrigin.current||flashRideActive)return;
    const timer=window.setTimeout(()=>{void searchAvailableOnRoute();},280);
    return()=>window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[serviceType,route?.distanceKm,destinationPoint?.lat,destinationPoint?.lng,
     onRouteVehicle,seats,entireCar,originRevision,flashRideActive]);

  const flashChoices=<section aria-label="Escolha sua carona" className="space-y-3">
    <div className="space-y-1">
      <h2 className="font-[Sora] text-lg font-extrabold text-white">Escolha sua Corrida Rápida</h2>
      <p className="text-xs leading-relaxed text-white/65">Confira o preço e solicite sua corrida. Acompanhe a busca na mesma tela.</p>
    </div>
    <div role="radiogroup" aria-label="Opções de viagem" className="space-y-2">
      {(["MOTO","CAR"] as const).map(type=>{
        const fare=flashFares[type]??null;
        const price=fare&&Date.parse(fare.expiresAt)>Date.now()?formatBrl(fare.customerPaysCents/100):null;
        const onlineCount=flashDriverCounts[type];
        const radarFailed=Boolean(flashDriverErrors[type]||flashDriverError);
        const available=onlineCount>0&&!radarFailed;
        const ready=Boolean(price)&&!flashRideActive; // Driver presence is informational; the server holds a valid request for 30 minutes.
        const checked=flashStep==="confirm"&&mode==="EXCLUSIVE"&&exclusiveVehicle===type;
        return <button type="button" key={type} role="radio" aria-checked={checked}
          disabled={!ready}
          onClick={()=>{
            if(!ready)return;
            setMode("EXCLUSIVE");changeVehicle(type,"EXCLUSIVE");
            setFlashStep("confirm");onSnapChange?.("full");
          }}
          className={`flex min-h-[94px] w-full items-center gap-2 rounded-2xl border px-2.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#FFBB00] motion-reduce:transition-none ${checked?"border-[#FFBB00] bg-[#FFBB00]/10":"border-white/20 bg-white/[0.05]"} disabled:opacity-60`}>
          <span className="flex h-[68px] w-[88px] shrink-0 items-center justify-center">
            <img src={type==="MOTO"?"/flash-moto.png":"/flash-carro.png"} alt="" aria-hidden="true"
              loading="lazy" className="max-h-[68px] w-[88px] object-contain"
              onError={e=>{e.currentTarget.style.display="none";}}/>
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-[Sora] text-sm font-extrabold text-white">{type==="MOTO"?"Flash Moto":"Flash Carro"}</strong>
            <small className="block text-[11px] text-white/65">{type==="MOTO"?"Mototáxi profissional":"Motorista profissional"}</small>
            <small className="mt-1 block text-[11px] text-white/55">{fare?.durationMinutes?Math.round(fare.durationMinutes)+" min · ":""}{fare?.distanceKm.toFixed(1)??"—"} km</small>
            <small className={`mt-1 block text-[11px] ${available?"text-emerald-300":"text-white/60"}`} aria-live="polite">
              {flashDriverLoading?"Verificando motoristas…":radarFailed?"Radar temporariamente indisponível · pode solicitar":available
                ?`${onlineCount} ${type==="MOTO"?"mototaxista(s)":"motorista(s)"} online`:"Buscando motoristas na sua área…"}
            </small>
          </span>
          <span className="shrink-0 text-right">
            <strong className="block max-w-[9rem] break-words font-[Sora] text-sm font-extrabold text-[#FFBB00]" aria-live="polite">
              {price??(waitingForOrigin?"Aguardando localização":flashFarePending?"Calculando…":"Indisponível")}
            </strong>
            {ready&&<small className="block text-[10px] text-white/65">{available?"Selecionar":"Solicitar e aguardar"}</small>}
          </span>
        </button>;
      })}
      {onRouteMatches.length>0&&<button type="button" role="radio" aria-checked={flashStep==="shared"}
        disabled={flashRideActive} onClick={()=>{
          setMode("ON_ROUTE");setFlashStep("shared");onSnapChange?.("full");
        }}
        className={`flex min-h-[88px] w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${flashStep==="shared"?"border-[#FFBB00] bg-[#FFBB00]/10":"border-white/20 bg-white/[0.05]"}`}>
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#FFBB00]/10 text-[#FFBB00]"><UserRound size={25}/></span>
        <span className="min-w-0 flex-1">
          <strong className="block font-[Sora] text-sm font-extrabold">CARONAA <small className="rounded-md bg-emerald-600/20 px-1.5 py-0.5 text-[10px] text-emerald-300">Compartilhada</small></strong>
          <small className="mt-1 block text-xs text-white/65">Carona Na Rota · trajeto compatível</small>
          <small className="mt-1 block text-[11px] text-emerald-300">{onRouteMatches.length} oferta(s) disponível(is)</small>
        </span>
        <strong className="shrink-0 text-right font-[Sora] text-sm font-extrabold text-[#FFBB00]">
          {formatBrl(Math.min(...onRouteMatches.map(match=>match.estimatedPrice)))}
          <small className="block text-[10px] font-normal text-white/55">a partir de</small>
        </strong>
      </button>}
    </div>
    {onRouteBusy&&<p role="status" className="text-xs text-white/55">Buscando caronas compartilhadas compatíveis…</p>}
  </section>;
  const flashOnRoute=mode==="ON_ROUTE"&&<section aria-label="Caronas Na Rota" className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.035] p-3">
    <details className="text-xs text-white/80"><summary className="min-h-10 cursor-pointer font-bold text-[#FFBB00]">Ajustar vagas e tipo de veículo</summary>
      <div className="mt-2 space-y-3"><div className="flex gap-2">{(["CAR","MOTO"] as const).map(type=><button type="button" key={type} onClick={()=>changeVehicle(type,"ON_ROUTE")} className={selectedButton(onRouteVehicle===type)+" flex-1"} aria-pressed={onRouteVehicle===type}>{type==="MOTO"?"Moto":"Carro"}</button>)}</div>
        <label className="flex items-center justify-between">Vagas<select aria-label="Quantidade de vagas" value={onRouteVehicle==="MOTO"?1:entireCar?3:seats} disabled={onRouteVehicle==="MOTO"||entireCar} onChange={event=>setSeats(Number(event.target.value))} className="min-h-12 rounded-lg border border-white/20 bg-[#121212] px-3">{Array.from({length:onRouteVehicle==="MOTO"?1:3},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        {onRouteVehicle==="CAR"&&<label className="flex min-h-10 items-center gap-3"><input type="checkbox" checked={entireCar} onChange={event=>setEntireCar(event.target.checked)} className="size-5 accent-[#FFBB00]"/> Reservar veículo inteiro</label>}
      </div>
    </details>
    <button type="button" onClick={()=>void searchAvailableOnRoute()} disabled={onRouteBusy||!route||!valid(destinationPoint)} className="min-h-12 w-full rounded-xl border border-[#FFBB00]/45 px-3 font-semibold text-[#FFBB00] disabled:opacity-50">{onRouteBusy?"Buscando ofertas reais...":"Atualizar ofertas"}</button>
    {onRouteDiagnostic==="NO_ON_ROUTE_MATCHES"&&<p role="status" className="text-sm text-white/70">Nenhuma carona compatível agora.</p>}
    {onRouteDiagnostic==="ON_ROUTE_SERVICE_UNAVAILABLE"&&<p role="alert" className="text-sm text-white/70">Não foi possível consultar as caronas. Tente novamente.</p>}
    {onRouteMatches.map(match=><article key={match.offerId} className={`space-y-2 rounded-xl border p-3 ${selectedMatch?.offerId===match.offerId?"border-[#FFBB00] bg-[#FFBB00]/10":"border-white/20"}`}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold">{match.driverName}</p><p className="text-xs text-white/75">{match.pickupMeeting.poiName}</p><p className="mt-1 text-xs text-[#FFBB00]">{Math.round(match.pickupMeeting.walkMeters)} m de caminhada até o embarque</p></div><strong className="shrink-0 font-[Sora] text-[#FFBB00]">{formatBrl(match.estimatedPrice)} <small className="block text-right text-[10px] text-white/60">Estimativa</small></strong></div>
      <button type="button" onClick={()=>selectOnRoute(match)} aria-pressed={selectedMatch?.offerId===match.offerId} className="min-h-12 w-full rounded-xl border border-white/25 px-3 text-sm font-bold text-white">{selectedMatch?.offerId===match.offerId?"Ponto selecionado no mapa":"Escolher ponto de encontro"}</button>
    </article>)}
    {selectedMatch&&<button type="button" onClick={()=>void confirmSelectedOnRoute()} disabled={bookingBusy||onRouteConfirmedId!==null} className="min-h-14 w-full rounded-2xl bg-[#FFBB00] px-4 font-[Sora] text-sm font-black text-[#121212] disabled:opacity-50">{bookingBusy?"Confirmando...":"Confirmar carona "+formatBrl(selectedMatch.estimatedPrice)}</button>}
  </section>;

  const selectedPrice=prices?.[mode]??null;
  const optionCard=(kind:UnifiedFareMode)=><div key={kind} className={"rounded-2xl border p-3 "+(mode===kind?"border-[#FFBB00] bg-[#FFBB00]/10":"border-white/20 bg-white/5")}>
    <button type="button" aria-pressed={mode===kind} disabled={flashRideActive} onClick={()=>setMode(kind)} className="flex min-h-12 w-full items-center justify-between gap-2 text-left disabled:opacity-60"><span className="font-[family-name:var(--font-display)] font-bold">{kind==="EXCLUSIVE"?"Exclusiva":"Na Rota"}</span><span className="font-[family-name:var(--font-display)] font-extrabold text-[#FFBB00]">{serviceType==="FLASH"&&kind==="EXCLUSIVE"?"Cotação oficial no próximo passo":prices?formatBrl(prices[kind].totalFare):"—"}</span></button>
    <p className="my-2 text-xs leading-relaxed text-white/75">{kind==="EXCLUSIVE"?"Porta a porta, só você e quem estiver com você.":"Mais barato. Você embarca num ponto de encontro dentro do trajeto do motorista."}</p>
    <div className="grid grid-cols-2 gap-2">{(["CAR","MOTO"] as const).map(value=><button key={value} type="button" disabled={flashRideActive} onClick={()=>{if(flashRideActive)return;setMode(kind);changeVehicle(value,kind);}} aria-pressed={(kind==="EXCLUSIVE"?exclusiveVehicle:onRouteVehicle)===value} className={selectedButton((kind==="EXCLUSIVE"?exclusiveVehicle:onRouteVehicle)===value)+" disabled:opacity-60"}>{value==="CAR"?<CarFront size={17} className="mx-auto mb-1"/>:<Bike size={17} className="mx-auto mb-1"/>}{value==="CAR"?"Carro":"Moto"}</button>)}</div>
    {kind==="ON_ROUTE"&&mode==="ON_ROUTE"&&<div className="mt-3 space-y-2">
      <label className="flex items-center justify-between gap-3 text-sm"><span>Vagas</span><select aria-label="Quantidade de vagas" value={onRouteVehicle==="MOTO"?1:entireCar?3:seats} disabled={onRouteVehicle==="MOTO"||entireCar} onChange={event=>setSeats(Number(event.target.value))} className="min-h-11 rounded-lg border border-white/25 bg-[#121212] px-4 text-white">{Array.from({length:onRouteVehicle==="MOTO"?1:3},(_,i)=>i+1).map(value=><option value={value} key={value}>{value}</option>)}</select></label>
      {onRouteVehicle==="CAR"&&<label className="flex min-h-11 items-center justify-between gap-2 text-xs">Reservar veículo inteiro (3 vagas)<input type="checkbox" checked={entireCar} onChange={e=>setEntireCar(e.target.checked)} className="size-5 accent-[#FFBB00]"/></label>}
      {onRouteVehicle==="CAR"&&entireCar&&<p className="text-xs text-white/70">O bloqueio das outras vagas só vale após o servidor confirmar a reserva.</p>}
    </div>}
  </div>;
  const originControl=<Button variant="ghost" type="button" onClick={onAdjustOrigin}
    className="h-auto min-h-12 w-full justify-start whitespace-normal px-1 text-left text-xs text-primary hover:bg-caronaa-white/10 hover:text-primary">
    {waitingForOrigin?<Loader2 size={16} aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none"/>:<MapPin size={16} aria-hidden="true" className="shrink-0"/>}
    <span role="status" aria-live="polite" className="min-w-0 break-words">{originText}</span>
  </Button>;
  const gpsFeedback=!waitingForOrigin&&!valid(originPoint)&&gpsError
    ?<div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 p-3">
      <p className="text-xs leading-relaxed text-white/90">{gpsError}</p>
      <div className="flex flex-wrap gap-2">
        {onRetryGps&&<Button type="button" variant="outline" onClick={onRetryGps}
          className="min-h-11 border-[#FFBB00]/45 text-[#FFBB00]">Tentar GPS novamente</Button>}
        {onAdjustOrigin&&<Button type="button" variant="outline" onClick={onAdjustOrigin}
          className="min-h-11 border-white/25 text-white">Escolher embarque no mapa</Button>}
      </div>
    </div>:null;
  const routeFeedback=routeError&&!flashRideActive&&<div role="alert" className="space-y-2 rounded-xl border border-[#FFBB00]/30 p-3">
    <p className="text-xs text-white/80">{routeError}</p>
    <Button type="button" variant="outline" disabled={routeBusy||!valid(destinationPoint)||!valid(originPoint)}
      onClick={()=>{if(routeBusy)return;routeCache.current.delete(selectedKey.current);setRouteAttempt(value=>value+1);}}
      className="min-h-12 w-full border-[#FFBB00]/40 text-[#FFBB00]">Recalcular rota</Button>
  </div>;
  const fixedFlash=serviceType==="FLASH"&&(snap!=="peek"||flashRideActive);
  const itinerary=<div className="shrink-0 space-y-2 border-b border-caronaa-white/15 bg-secondary px-1 pb-3">
    <LocationAutocomplete id="shell-destination" featuredEvent="kaluanda-night" label="Para onde vamos?" value={destination} selectedLocation={destinationPoint} variant="glass" placeholder="Rua, bairro ou local de destino" autoFocus={focusDestination} onChange={pickDestination}/>
    {originControl}
    {gpsFeedback}
    {(serviceType!=="FLASH"||!valid(destinationPoint))&&<ServiceTypeDock compact value={serviceType} onChange={onServiceTypeChange}/>}
  </div>;
  return <div className={fixedFlash?"flex h-full min-h-0 flex-col font-sans":snap==="peek"?"space-y-1":"space-y-4 pb-4"}>
    {snap==="peek"&&!flashRideActive&&<>
      <h2 className="px-1 font-[Sora] text-lg font-black text-white">Para onde vamos?</h2>
      <div className="flex min-w-0 gap-1">
        <button type="button" aria-label="Para onde vamos?" onClick={()=>{setFocusDestination(true);onSnapChange?.("half");}}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/30 bg-white px-4 py-2 text-[#121212] shadow-sm transition-transform active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00] motion-reduce:transform-none">
          <Search size={21} className="shrink-0 text-[#121212]" aria-hidden="true"/>
          <span className="min-w-0 text-left">
            <strong className="block truncate font-[Sora] text-sm font-extrabold">{destination||"Digite seu destino"}</strong>
            <small className="block truncate text-[11px] font-medium text-[#505050]" aria-live="polite">{waitingForOrigin?"Localizando você…":destination?"Toque para mudar o destino":isKaluandaNightActive()?"Sugestão de hoje: Kaluanda Night":"Digite seu destino"}</small>
          </span>
        </button>
        <button type="button" aria-label="Ajustar no mapa a origem" onClick={onAdjustOrigin} title={originText} className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#FFBB00]/45 bg-[#FFBB00]/10 text-[#FFBB00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00]">
          {waitingForOrigin?<Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>:<MapPin size={18} aria-hidden="true"/>}
        </button>
      </div><ServiceTypeDock compact value={serviceType} onChange={onServiceTypeChange}/>
    </>}
    {snap==="half"&&serviceType!=="FLASH"&&<>
      <LocationAutocomplete id="shell-destination" featuredEvent="kaluanda-night" label="Para onde vamos?" value={destination} selectedLocation={destinationPoint} variant="glass" placeholder="Rua, bairro ou destino" autoFocus={focusDestination} onChange={pickDestination}/>
      {originControl}{gpsFeedback}<ServiceTypeDock value={serviceType} onChange={onServiceTypeChange}/>
      {serviceType==="AGENDADA"&&<label className="block space-y-2 rounded-2xl border border-white/20 bg-white/5 p-3 text-sm">
        <span className="flex items-center gap-2 font-bold"><Clock3 size={18} className="text-[#FFBB00]"/> Data e hora da viagem</span>
        <input type="datetime-local" aria-label="Data e hora do agendamento" required min={localDateTime(30*60*1000)} value={scheduledAt} onChange={event=>{setScheduledAt(event.target.value);setScheduledId(null);setScheduleError("");}} className="min-h-12 w-full rounded-xl border border-white/25 bg-[#121212] px-3 text-white [color-scheme:dark]"/>
        <p className="text-xs text-white/70">Agende com pelo menos 30 minutos de antecedência.</p>
        {scheduledAt&&!scheduleValid&&<p role="alert" className="text-xs text-[#FFBB00]">Escolha uma data e hora válidas, pelo menos 30 minutos no futuro.</p>}
      </label>}
      {optionCard("EXCLUSIVE")}{optionCard("ON_ROUTE")}{routeFeedback}
      <button type="button" disabled={!route||!selectedPrice||routeBusy||!scheduleValid} onClick={()=>onSnapChange?.("full")} className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-50">Revisar Agendamento</button>
    </>}
    {snap==="full"&&serviceType==="AGENDADA"&&<>
      {onRouteConfirmedId&&<section role="status" className="space-y-1 rounded-xl border border-[#FFBB00]/50 bg-[#FFBB00]/10 p-3"><p className="font-bold text-[#FFBB00]">Carona Na Rota confirmada.</p><p className="text-sm">Embarque em: {selectedMatch?.pickupMeeting.poiName||"ponto confirmado"}</p><p className="text-xs text-white/75">A confirmação foi retornada pelo servidor. Não há pagamento antecipado no aplicativo.</p></section>}
      <button type="button" onClick={()=>{if(flashRideActive){toast.info("Cancele a solicitação antes de retornar às modalidades.");return;}onSnapChange?.("half");}} className="flex min-h-12 items-center gap-2 text-sm font-bold"><ArrowLeft size={18} className="text-[#FFBB00]"/> Voltar às modalidades</button>
      {routeFeedback}
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Confirme seu agendamento</h2>
      <section aria-label="Resumo da corrida" className="space-y-2 rounded-2xl border border-[#FFBB00]/35 bg-white/5 p-4 text-sm">
        {scheduledAt&&<p><strong>Data e horário:</strong> {scheduledLabel(scheduledAt)}</p>}
        <p><strong>Embarque:</strong> {originLabel||"Sua localização atual"}</p><p><strong>Destino:</strong> {destination||"Não selecionado"}</p>
        <p><strong>Modalidade:</strong> {mode==="EXCLUSIVE"?"Exclusiva ("+(vehicle==="CAR"?"Carro":"Moto")+")":"Na Rota ("+(onRouteVehicle==="MOTO"?1:entireCar?3:seats)+" vagas)"}</p>
        <p className="font-[family-name:var(--font-display)] text-2xl font-black text-[#FFBB00]">{selectedPrice?formatBrl(selectedPrice.totalFare):"Calculando..."}</p>
        <p className="text-xs text-white/70">Tarifa estimada, sujeita à confirmação operacional.</p><p><strong>Pagamento:</strong> Pix ou dinheiro direto ao motorista</p><p className="text-xs text-white/70">O app não retém valores nesta etapa.</p>
      </section>
      {gender==="FEMININO"&&<WomenOnlyToggle kind="request" gender={gender} checked={womenOnly} onChange={setWomenOnly}/>}
      {!onRouteConfirmedId&&<>
        {scheduledId?<section role="status" className="space-y-2 rounded-2xl border border-[#FFBB00]/40 p-4"><p className="font-bold text-[#FFBB00]">Carona agendada! Seus dados foram salvos.</p><p className="text-sm">Aguardando motorista</p><p className="text-xs text-white/70">Sua solicitação foi registrada. A confirmação do motorista será exibida quando houver aceite real.</p></section>:
          <button type="button" disabled={scheduling||!scheduleValid||!selectedPrice||!route} onClick={()=>void submitSchedule()} className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-40">{scheduling?"Salvando agendamento...":"Agendar Caronaa"}</button>}
        {scheduleError&&<p role="alert" className="text-sm text-[#FFBB00]">{scheduleError}</p>}
      </>}
    </>}
    {fixedFlash&&<>
      {!flashRideActive&&itinerary}
      <div className={flashRideActive?"hidden":"min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-3"}>
        {onRouteConfirmedId&&<p role="status" className="text-primary">Carona Na Rota confirmada · {selectedMatch?.pickupMeeting.poiName}</p>}
        {routeFeedback}
        {!flashRideActive&&valid(destinationPoint)&&flashStep==="choices"&&flashChoices}
        {!flashRideActive&&valid(destinationPoint)&&flashStep!=="choices"&&
          <button type="button" onClick={()=>{setFlashStep("choices");onSnapChange?.("half");}}
            className="flex min-h-11 items-center gap-2 text-sm font-bold text-[#FFBB00]">
            <ArrowLeft size={18}/> Voltar às opções
          </button>}
        {!flashRideActive&&flashStep==="confirm"&&mode==="EXCLUSIVE"&&
          <section aria-label="Confirmar viagem" className="space-y-3">
            <h2 className="font-[Sora] text-lg font-extrabold text-white">Confirmar viagem</h2>
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/5 p-3">
              <img src={exclusiveVehicle==="MOTO"?"/flash-moto.png":"/flash-carro.png"} alt="" aria-hidden="true"
                className="h-16 w-24 object-contain"/>
              <div className="min-w-0 flex-1">
                <strong className="font-[Sora] text-sm text-white">{exclusiveVehicle==="MOTO"?"Flash Moto":"Flash Carro"}</strong>
                <p className="text-xs text-white/65">{exclusiveVehicle==="MOTO"?"Mototáxi profissional":"Motorista profissional"}</p>
              </div>
              <strong className="shrink-0 font-[Sora] text-lg text-[#FFBB00]">
                {flashFares[exclusiveVehicle]&&Date.parse(flashFares[exclusiveVehicle]!.expiresAt)>Date.now()
                  ?formatBrl(flashFares[exclusiveVehicle]!.customerPaysCents/100):"Cotação pendente"}
              </strong>
            </div>
            <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-white/60">Embarque</p>
              <p className="break-words font-semibold">{originLabel||"Localização de embarque"}</p>
              <div className="border-t border-white/10 pt-2">
                <p className="text-xs uppercase tracking-wide text-white/60">Destino</p>
                <p className="break-words font-semibold">{destination}</p>
              </div>
              {flashFares[exclusiveVehicle]&&
                <p className="text-xs text-white/65">
                  {flashFares[exclusiveVehicle]!.distanceKm.toFixed(1)} km · aproximadamente {Math.round(flashFares[exclusiveVehicle]!.durationMinutes)} min
                </p>}
              <p className="border-t border-white/10 pt-2 text-xs text-white/65">Pagamento direto ao motorista, conforme a operação da viagem. Revise o preço antes de confirmar.</p>
              {(flashDriverCounts[exclusiveVehicle]??0)===0&&<p role="status" className="text-xs text-[#FFBB00]">Buscando motoristas na sua área… Você pode confirmar seu pedido e acompanhar a busca.</p>}
            </div>
          </section>}
        {!flashRideActive&&flashStep==="shared"&&flashOnRoute}

      </div>
      {mode==="EXCLUSIVE"&&!flashRideActive&&flashStep==="confirm"&&<div ref={onFlashActionContainer} className="shrink-0 border-t border-caronaa-white/15 bg-secondary py-3"/>}
    </>}
    {/* One stable, stateful F07 panel across peek/half/full.
        The previous conditional placements unmounted QuickRideHomePanel on
        each sheet transition, causing state resets, flicker and RPC bursts. */}
    {serviceType==="FLASH"&&<div className={
      flashRideActive?"min-h-0 flex-1 overflow-y-auto overscroll-contain":
      fixedFlash&&mode==="EXCLUSIVE"&&flashStep==="confirm"
        ?"min-h-0 max-h-[55dvh] shrink-0 overflow-y-auto overscroll-contain"
        :"hidden"
    }>{flashOperationalPanel}</div>}
  </div>;
}
