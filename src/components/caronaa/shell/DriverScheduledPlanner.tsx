import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, MapPin, Navigation, UserRound, Users, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { quoteUnifiedFare } from "@/lib/pricing/unified-fare-engine";
import { emptyTravelPreferences, type TravelPreferences } from "@/lib/travel-preferences";
import { loadTravelPreferences } from "@/lib/travel-preferences-service";
import { formatBrl } from "@/lib/ride-cost";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { TravelPreferenceFields } from "@/components/caronaa/TravelPreferences";
import { DriverPlatformFees } from "@/components/caronaa/DriverPlatformFees";
import { WomenOnlyToggle } from "@/components/caronaa/WomenOnlyToggle";
import { ServiceTypeDock, type ServiceType } from "./ServiceTypeDock";
import type { SheetSnap } from "./InteractiveBottomSheet";
import type { FormLocationDetails } from "@/lib/location/types";
import type { ProfileGender } from "@/lib/use-profile-gender";
import type { ShellRoute } from "./ShellJourneyPlanner";
import { validScheduleDate } from "./ShellJourneyPlanner";
import {
  acceptDriverScheduledRequest, DriverScheduledError, getDriverScheduledOpportunities,
  publishScheduledDriverOffer, type DriverBookingMode, type DriverOpportunity,
} from "@/services/driver-scheduled-service";

type Point={lat:number;lng:number};
type Props={
  snap:SheetSnap;onSnapChange:(value:SheetSnap)=>void;
  serviceType:ServiceType;onServiceTypeChange:(value:ServiceType)=>void;
  vehicleType:"CAR"|"MOTO";maxSeats:number;gender:ProfileGender;
  originPoint?:{lat?:number;lng?:number}|null;
  originLabel:string;originRevision:number;
  onAdjustOrigin:()=>void;
  onRouteChange:(route:ShellRoute|null,origin:Point|null)=>void;
  onDestinationChange:(label:string,details?:FormLocationDetails)=>void;
  onPublished?:()=>void;
  onOpenTrips?:()=>void;
};
const valid=(p:{lat?:number;lng?:number}|undefined|null):p is Point=>
  !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat!)<=90&&Math.abs(p.lng!)<=180;
const localTime=(delay=0)=>new Date(Date.now()+delay-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
const formatTripDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"full",timeStyle:"short",timeZone:"America/Fortaleza"}).format(new Date(value));
const modeChoices:[DriverBookingMode,string][]=[
  ["ALL","Aceito tudo"],["ON_ROUTE","Apenas Na Rota"],["EXCLUSIVE","Apenas Exclusiva"],
];
function playConfirmationSound(){
  try{
    const BrowserAudio=(window as any).AudioContext||(window as any).webkitAudioContext;
    if(!BrowserAudio)return;
    const audio=new BrowserAudio();
    const oscillator=audio.createOscillator();
    const gain=audio.createGain();
    oscillator.frequency.value=740;oscillator.type="sine";
    oscillator.connect(gain);gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.06,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.18);
    oscillator.start();oscillator.stop(audio.currentTime+0.18);
    oscillator.onended=()=>void audio.close();
  }catch{/* Audio is optional and must not block acceptance. */}
}
export function DriverScheduledPlanner({
  snap,onSnapChange,serviceType,onServiceTypeChange,vehicleType,maxSeats,gender,
  originPoint,originLabel,originRevision,onAdjustOrigin,onRouteChange,
  onDestinationChange,onPublished,onOpenTrips,
}:Props){
  const [destination,setDestination]=useState("");
  const [destPoint,setDestPoint]=useState<FormLocationDetails>();
  const [scheduledAt,setScheduledAt]=useState("");
  const [seats,setSeats]=useState(vehicleType==="MOTO"?1:Math.max(1,Math.min(3,maxSeats)));
  const [bookingMode,setBookingMode]=useState<DriverBookingMode>("ALL");
  const [preferences,setPreferences]=useState<TravelPreferences>({...emptyTravelPreferences});
  const [womenOnly,setWomenOnly]=useState(false);
  const [airConditioning,setAirConditioning]=useState(false);
  const [route,setRoute]=useState<ShellRoute|null>(null);
  const [price,setPrice]=useState<number|null>(null);
  const [routeBusy,setRouteBusy]=useState(false);
  const [routeError,setRouteError]=useState("");
  const [busy,setBusy]=useState(false);
  const [publishedId,setPublishedId]=useState<string|null>(null);
  const [publicationError,setPublicationError]=useState("");
  const [debtPending,setDebtPending]=useState(false);
  const [showFees,setShowFees]=useState(false);
  const [opportunities,setOpportunities]=useState<DriverOpportunity[]>([]);
  const [opportunityError,setOpportunityError]=useState("");
  const [acceptBusy,setAcceptBusy]=useState<string|null>(null);
  const [seatsLeft,setSeatsLeft]=useState<number|null>(null);
  const [ignored,setIgnored]=useState<string[]>([]);
  const [revision,setRevision]=useState(0);
  const routeFn=useServerFn(getMapDrivingRoute);
  const routeFnRef=useRef(routeFn);
  routeFnRef.current=routeFn;
  const routeCache=useRef(new Map<string,Promise<ShellRoute>>());
  const fixedOrigin=useRef<Point|null>(null);
  const lastOriginRevision=useRef(originRevision);
  const callbackRef=useRef(onRouteChange);callbackRef.current=onRouteChange;
  const loadOpportunityRef=useRef<()=>Promise<void>>(async()=>{});
  const requestNonce=useRef(0);

  useEffect(()=>{let mounted=true;void loadTravelPreferences().then(x=>{if(mounted)setPreferences(x);}).catch(()=>undefined);
    return()=>{mounted=false;routeCache.current.clear();};
  },[]);
  useEffect(()=>{if(vehicleType==="MOTO"){setSeats(1);setAirConditioning(false);}else setSeats(s=>Math.min(3,Math.max(1,s)));},[vehicleType]);
  useEffect(()=>{if(gender!=="FEMININO")setWomenOnly(false);},[gender]);

  useEffect(()=>{
    if(serviceType!=="AGENDADA"||!valid(destPoint)){
      setRoute(null);setPrice(null);callbackRef.current(null,null);return;
    }
    if(valid(originPoint)&&(!fixedOrigin.current||originRevision!==lastOriginRevision.current))
      fixedOrigin.current={lat:originPoint.lat,lng:originPoint.lng};
    lastOriginRevision.current=originRevision;
    const from=fixedOrigin.current;
    if(!from){setRoute(null);callbackRef.current(null,null);return;}
    const to={lat:destPoint.lat!,lng:destPoint.lng!};
    const key=[from.lat,from.lng,to.lat,to.lng].map(n=>n.toFixed(6)).join(":");
    let active=true;
    setRouteBusy(true);setRouteError("");setRoute(null);setPrice(null);callbackRef.current(null,null);
    let promise=routeCache.current.get(key);
    if(!promise){
      promise=routeFnRef.current({data:{points:[from,to]}}).then(result=>{
        if(!Array.isArray(result.routePath)||result.routePath.length<2||
          !Number.isFinite(result.distanceKm)||result.distanceKm<=0)throw new Error("ROUTE_UNAVAILABLE");
        return {routePath:result.routePath,distanceKm:result.distanceKm,durationMinutes:result.durationMinutes};
      });
      routeCache.current.set(key,promise);
      void promise.catch(()=>routeCache.current.delete(key));
    }
    void promise.then(result=>{if(active){setRoute(result);callbackRef.current(result,from);}})
      .catch(()=>{if(active)setRouteError("Não foi possível traçar a rota. Escolha o destino novamente.");})
      .finally(()=>{if(active)setRouteBusy(false);});
    return()=>{active=false;};
  },[destPoint?.lat,destPoint?.lng,originRevision,serviceType]);

  useEffect(()=>{
    let live=true;
    setPrice(null);
    if(!route)return;
    // Suggested ON_ROUTE rate per seat, not an invented separate tariff.
    void quoteUnifiedFare({distanceKm:route.distanceKm,mode:"ON_ROUTE",vehicleType,seats:1})
      .then(value=>{if(live)setPrice(value.perSeatFare??value.totalFare);})
      .catch(()=>{if(live)setPublicationError("Valor sugerido indisponível.");});
    return()=>{live=false;};
  },[route,vehicleType]);

  const refreshOpportunities=useCallback(async()=>{
    if(!publishedId)return;
    try{
      const rows=await getDriverScheduledOpportunities(publishedId);
      setOpportunities(rows);
      setOpportunityError("");
    }catch{setOpportunityError("Oportunidades indisponíveis. Tente atualizar.");}
  },[publishedId]);
  loadOpportunityRef.current=refreshOpportunities;
  useEffect(()=>{
    if(!publishedId)return;
    let disposed=false;let debounce:ReturnType<typeof setTimeout>|null=null;
    const signal=()=>{
      if(disposed)return;
      if(debounce)clearTimeout(debounce);
      debounce=setTimeout(()=>{if(!disposed)void loadOpportunityRef.current();},450);
    };
    const onFocus=()=>{if(!document.hidden)signal();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    // Read-only Realtime signal; details are always re-fetched by authorized RPC.
    const client=supabase as any;
    const channel=client.channel("scheduled-driver-"+publishedId).on("postgres_changes",{
      event:"*",schema:"public",table:"ride_requests",
    },signal).subscribe();
    signal();
    return()=>{
      disposed=true;if(debounce)clearTimeout(debounce);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onFocus);
      void client.removeChannel(channel);
    };
  },[publishedId]);

  const chooseDestination=(label:string,details?:FormLocationDetails)=>{
    requestNonce.current+=1;
    setDestination(label);setDestPoint(details);
    fixedOrigin.current=valid(originPoint)?{lat:originPoint.lat,lng:originPoint.lng}:null;
    setRoute(null);setPrice(null);setPublishedId(null);setSeatsLeft(null);
    setOpportunities([]);setPublicationError("");setDebtPending(false);
    onDestinationChange(label,details);
    if(valid(details))onSnapChange("half");
  };
  const publish=async()=>{
    if(busy||publishedId||!validScheduleDate(scheduledAt)||!route||price===null||!valid(originPoint))return;
    setBusy(true);setPublicationError("");setDebtPending(false);
    try{
      const id=await publishScheduledDriverOffer({
        origin:originLabel||"Origem confirmada",destination,
        departureAt:new Date(scheduledAt).toISOString(),routePath:route.routePath,
        bookingMode,vehicleType,seats:vehicleType==="MOTO"?1:seats,
        suggestedFarePerSeat:price,preferences,womenOnly:gender==="FEMININO"&&womenOnly,
        airConditioning:vehicleType==="CAR"&&airConditioning,
      });
      setPublishedId(id);setSeatsLeft(seats);
      toast.success("Carona agendada publicada.");
      onPublished?.();
    }catch(error){
      if(error instanceof DriverScheduledError&&error.code==="DEBT_PENDING"){
        setDebtPending(true);
        setPublicationError("Há uma taxa de plataforma pendente. Regularize antes de publicar.");
      }else setPublicationError("Não foi possível publicar. Verifique o serviço e tente novamente.");
    }finally{setBusy(false);}
  };
  const accept=async(item:DriverOpportunity)=>{
    if(!publishedId||acceptBusy||seatsLeft!==null&&item.passengers>seatsLeft)return;
    setAcceptBusy(item.requestId);
    try{
      const confirmation=await acceptDriverScheduledRequest(publishedId,item.requestId);
      setSeatsLeft(confirmation.seatsRemaining);
      setOpportunities(list=>list.filter(x=>x.requestId!==item.requestId));
      playConfirmationSound();toast.success("Passageiro confirmado para sua viagem!");
      onPublished?.();
      setRevision(v=>v+1);
    }catch(error){
      if(error instanceof DriverScheduledError&&error.code==="ALREADY_MATCHED")
        toast.info("Este passageiro acabou de ser atendido por outra carona");
      else toast.error("Não foi possível aceitar o passageiro.");
      await refreshOpportunities();
    }finally{setAcceptBusy(null);}
  };
  const ready=validScheduleDate(scheduledAt)&&!!route&&price!==null&&!routeBusy&&destination.trim().length>0;
  return <div className="space-y-3 pb-4 text-white" style={{fontFamily:"Manrope, sans-serif"}}>
    {serviceType!=="AGENDADA"?
      <div className="space-y-3">
        <ServiceTypeDock compact={snap==="peek"} value={serviceType} onChange={onServiceTypeChange}/>
        <p className="rounded-xl border border-white/15 p-3 text-sm text-white/75">
          O Flash profissional permanece no fluxo operacional existente. Selecione Agendada para publicar sua viagem.
        </p>
      </div>:
    snap==="peek"?<>
      <div className="flex gap-2">
        <button type="button" onClick={()=>onSnapChange("half")}
          className="min-h-9 min-w-0 flex-1 truncate rounded-xl border border-white/20 bg-white/10 px-3 text-left text-sm">
          {destination||"Para onde vamos?"}
        </button>
        <button type="button" onClick={onAdjustOrigin} aria-label="Ajustar origem no mapa"
          className="flex min-h-9 w-10 items-center justify-center rounded-xl border border-[#FFBB00]/50"><MapPin size={17}/></button>
      </div>
      <ServiceTypeDock compact value={serviceType} onChange={onServiceTypeChange}/>
    </>:
    <>
      {snap==="half"&&<>
        <LocationAutocomplete id="driver-scheduled-destination" label="Destino"
          value={destination} selectedLocation={destPoint} placeholder="Para onde vamos?"
          variant="glass" onChange={chooseDestination}/>
        <button type="button" onClick={onAdjustOrigin}
          className="flex min-h-10 items-center gap-2 text-xs text-[#FFBB00]">
          <MapPin size={16}/> Origem: {originLabel||"GPS atual"} · Ajustar no mapa
        </button>
        <ServiceTypeDock value={serviceType} onChange={onServiceTypeChange}/>
        <label className="block space-y-2 text-sm font-semibold">
          Data e hora de saída
          <input type="datetime-local" aria-label="Data e hora de saída" min={localTime(30*60000)}
            value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-white/25 bg-[#121212] px-3 [color-scheme:dark]"/>
          {scheduledAt&&!validScheduleDate(scheduledAt)&&
            <span role="alert" className="block text-xs text-[#FFBB00]">Escolha pelo menos 30 minutos no futuro.</span>}
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">Vagas disponíveis
          <select aria-label="Vagas disponíveis" value={vehicleType==="MOTO"?1:seats}
            disabled={vehicleType==="MOTO"} onChange={e=>setSeats(Number(e.target.value))}
            className="min-h-11 rounded-lg border border-white/25 bg-[#121212] px-3">
            {Array.from({length:vehicleType==="MOTO"?1:Math.min(3,maxSeats)},(_,i)=>i+1)
              .map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <fieldset className="space-y-2"><legend className="text-sm font-bold">Modo de reserva</legend>
          <div className="grid grid-cols-3 gap-1">
            {modeChoices.map(([value,label])=><button key={value} type="button" aria-pressed={bookingMode===value}
              onClick={()=>setBookingMode(value)}
              className={"min-h-12 rounded-xl border px-1 text-xs font-bold "+(bookingMode===value?
                "border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/25 bg-white/5")}>{label}</button>)}
          </div>
        </fieldset>
        <TravelPreferenceFields kind="offer" value={preferences} onChange={setPreferences}/>
        {vehicleType==="CAR"&&<label className="flex min-h-11 items-center justify-between gap-2 text-sm">
          Ar-condicionado disponível
          <input type="checkbox" checked={airConditioning} onChange={e=>setAirConditioning(e.target.checked)}
            className="size-5 accent-[#FFBB00]"/>
        </label>}
        {gender==="FEMININO"&&<WomenOnlyToggle kind="offer" gender={gender}
          checked={womenOnly} onChange={setWomenOnly}/>}
        <p role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
          Valor sugerido por vaga: <strong className="text-[#FFBB00]">{price!==null?formatBrl(price):"Calculando..."}</strong>
        </p>
        <p className="text-xs text-white/70">{routeBusy?"Calculando rota...":routeError|| (route?
          route.distanceKm.toFixed(1)+" km pelas ruas · sem recálculo ao editar horário ou vagas":
          "Selecione um destino para visualizar a rota.")}</p>
        <button type="button" disabled={!ready} onClick={()=>onSnapChange("full")}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-40">
          Revisar publicação
        </button>
      </>}
      {snap==="full"&&<>
        <button type="button" onClick={()=>onSnapChange("half")}
          className="min-h-11 text-sm text-[#FFBB00]">Voltar à edição</button>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Publicar Carona Agendada</h2>
        <section className="space-y-2 rounded-2xl border border-white/20 p-4 text-sm">
          <p><MapPin size={15} className="mr-1 inline text-[#FFBB00]"/> {originLabel||"Origem confirmada"}</p>
          <p><Navigation size={15} className="mr-1 inline text-[#FFBB00]"/> {destination||"Destino não selecionado"}</p>
          {scheduledAt&&<p><CalendarClock size={15} className="mr-1 inline text-[#FFBB00]"/> {formatTripDate(scheduledAt)}</p>}
          <p><Users size={15} className="mr-1 inline text-[#FFBB00]"/> {vehicleType==="MOTO"?1:seats} vaga(s) · {bookingMode}</p>
          <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[#FFBB00]">
            {price!==null?formatBrl(price):"—"} <span className="text-xs font-normal text-white/70">sugeridos por vaga</span>
          </p>
        </section>
        {!publishedId?<button type="button" disabled={!ready||busy} onClick={()=>void publish()}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-40">
          {busy?"Publicando...":"Publicar Carona Agendada"}
        </button>:<p role="status" className="rounded-xl border border-[#FFBB00]/40 p-3 text-sm">
          Carona agendada publicada. Aguardando passageiros.
        </p>}
        {publicationError&&<div role="alert" className="space-y-2 rounded-xl border border-[#FFBB00]/50 p-3 text-sm">
          <p>{publicationError}</p>
          {debtPending&&<button type="button" onClick={()=>setShowFees(value=>!value)}
            className="min-h-11 rounded-xl border border-[#FFBB00]/60 px-3 text-[#FFBB00]">
            {showFees?"Ocultar regularização":"Regularizar pendências"}
          </button>}
        </div>}
        {debtPending&&showFees&&<div className="max-h-[40dvh] overflow-y-auto rounded-xl border border-white/20 p-2">
          <DriverPlatformFees compact/>
        </div>}
        {publishedId&&<section className="space-y-3 rounded-2xl border border-[#FFBB00]/30 p-3">
          <h3 className="font-[family-name:var(--font-display)] font-bold">Oportunidades no seu trajeto</h3>
          <p className="text-sm text-white/70">{seatsLeft??seats} vagas livres</p>
          <button type="button" onClick={()=>void refreshOpportunities()}
            className="min-h-10 text-sm text-[#FFBB00]">Atualizar oportunidades</button>
          {opportunityError&&<p role="alert" className="text-sm">{opportunityError}</p>}
          {opportunities.filter(item=>!ignored.includes(item.requestId)).length===0&&!opportunityError&&
            <p className="text-sm text-white/65">Nenhuma oportunidade disponível no momento.</p>}
          {opportunities.filter(item=>!ignored.includes(item.requestId)).map(item=>
            <article key={item.requestId} className="space-y-2 rounded-xl border border-white/20 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                {item.passengerAvatarUrl?<img src={item.passengerAvatarUrl} alt="Foto do passageiro"
                  className="size-12 rounded-full object-cover"/>:
                  <span className="flex size-12 items-center justify-center rounded-full bg-white/10"><UserRound size={21}/></span>}
                <div><p className="font-bold">{item.passengerName}</p>
                  {item.rating!==undefined&&<p className="text-xs text-white/70">★ {item.rating.toFixed(1)}</p>}
                </div>
              </div>
              <p className="text-sm">{item.passengers} pessoas · Ganho potencial {formatBrl(item.potentialEarnings)}</p>
              <p className="text-xs text-white/70">Ponto de encontro a {Math.round(item.meetingDistanceMeters)} metros da sua rota · {item.meetingName}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>setIgnored(list=>[...list,item.requestId])}
                  className="min-h-11 rounded-xl border border-white/25 px-2 text-sm">Ignorar</button>
                <button type="button" disabled={!!acceptBusy || (seatsLeft!==null&&item.passengers>seatsLeft)}
                  onClick={()=>void accept(item)}
                  className="min-h-11 rounded-xl bg-[#FFBB00] px-2 text-sm font-bold text-[#121212] disabled:opacity-40">
                  {acceptBusy===item.requestId?"Aceitando...":"Aceitar Passageiro"}
                </button>
              </div>
            </article>)}
          <button type="button" onClick={onOpenTrips}
            className="min-h-11 w-full rounded-xl border border-[#FFBB00]/60 text-sm text-[#FFBB00]">
            Ver Agendados
          </button>
        </section>}
      </>}
    </>}
  </div>;
}
