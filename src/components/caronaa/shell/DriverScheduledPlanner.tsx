import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, MapPin, Navigation, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { quoteOfferRoute } from "@/lib/offer-pricing.functions";
import { formatBrl } from "@/lib/ride-cost";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
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
  publishScheduledDriverOffer, type DriverBookingMode, type DriverOpportunity, type ScheduledDriverOfferDraft,
} from "@/services/driver-scheduled-service";

type Point={lat:number;lng:number};
type ScheduledQuote=ShellRoute&{
  quoteId:string;pricePerPassenger:number;expiresAt:string;
  originPoint:Point;destinationPoint:Point;origin:string;destination:string;
};
type CachedQuote={promise:Promise<ScheduledQuote>;expiresAt?:number};
type Props={
  snap:SheetSnap;onSnapChange:(value:SheetSnap)=>void;
  serviceType:ServiceType;onServiceTypeChange:(value:ServiceType)=>void;
  vehicleType:"CAR"|"MOTO";maxSeats:number;gender:ProfileGender;
  originPoint?:{lat?:number;lng?:number}|null;
  originLabel:string;originRevision:number;
  locating?:boolean;originNeedsConfirmation?:boolean;
  onConfirmOrigin?:()=>void;
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
  locating=false,originNeedsConfirmation=false,onConfirmOrigin,
  onDestinationChange,onPublished,onOpenTrips,
}:Props){
  const [destination,setDestination]=useState("");
  const [destPoint,setDestPoint]=useState<FormLocationDetails>();
  const [scheduledAt,setScheduledAt]=useState("");
  const [seats,setSeats]=useState(vehicleType==="MOTO"?1:Math.max(1,Math.min(3,maxSeats)));
  const [bookingMode,setBookingMode]=useState<DriverBookingMode>("ALL");
  const [womenOnly,setWomenOnly]=useState(false);
  const [quote,setQuote]=useState<ScheduledQuote|null>(null);
  const route=quote;
  const price=quote?.pricePerPassenger??null;
  const [routeBusy,setRouteBusy]=useState(false);
  const [routeError,setRouteError]=useState("");
  const [routeAttempt,setRouteAttempt]=useState(0);
  const [quoteExpired,setQuoteExpired]=useState(false);
  const [busy,setBusy]=useState(false);
  const [uncertainDraft,setUncertainDraft]=useState<ScheduledDriverOfferDraft|null>(null);
  const [alreadyPublished,setAlreadyPublished]=useState(false);
  const [publishedId,setPublishedId]=useState<string|null>(null);
  const [publicationError,setPublicationError]=useState("");
  const [debtPending,setDebtPending]=useState(false);
  const [showFees,setShowFees]=useState(false);
  const [opportunities,setOpportunities]=useState<DriverOpportunity[]>([]);
  const [opportunityError,setOpportunityError]=useState("");
  const [acceptBusy,setAcceptBusy]=useState<string|null>(null);
  const [seatsLeft,setSeatsLeft]=useState<number|null>(null);
  const [ignored,setIgnored]=useState<string[]>([]);
  const quoteFn=useServerFn(quoteOfferRoute);
  const quoteFnRef=useRef(quoteFn);
  quoteFnRef.current=quoteFn;
  const routeCache=useRef(new Map<string,CachedQuote>());
  const fixedOrigin=useRef<Point|null>(null);
  const fixedOriginLabel=useRef("");
  const lastOriginRevision=useRef(originRevision);
  const routeGeneration=useRef(0);
  const requestedPair=useRef<{key:string;attempt:number}|null>(null);
  const publishInFlight=useRef(false);
  const submittedDraft=useRef<ScheduledDriverOfferDraft|null>(null);
  const callbackRef=useRef(onRouteChange);callbackRef.current=onRouteChange;
  const loadOpportunityRef=useRef<()=>Promise<void>>(async()=>{});

  useEffect(()=>{
    return()=>{routeGeneration.current+=1;routeCache.current.clear();requestedPair.current=null;};
  },[]);
  useEffect(()=>{if(vehicleType==="MOTO"){setSeats(1);}else setSeats(s=>Math.min(3,Math.max(1,s)));},[vehicleType]);
  useEffect(()=>{if(gender!=="FEMININO")setWomenOnly(false);},[gender]);

  useEffect(()=>{
    if(busy||uncertainDraft||publishedId||alreadyPublished)return;
    if(originRevision!==lastOriginRevision.current){
      // An explicit origin change also invalidates the previous point while
      // a replacement GPS sample is still pending.
      fixedOrigin.current=valid(originPoint)?{lat:originPoint.lat,lng:originPoint.lng}:null;
      fixedOriginLabel.current=valid(originPoint)?originLabel||"Origem confirmada":"";
      lastOriginRevision.current=originRevision;
      requestedPair.current=null;
    }
    if(serviceType!=="AGENDADA"||!valid(destPoint)){
      routeGeneration.current+=1;requestedPair.current=null;
      setQuote(null);setRouteBusy(false);setRouteError("");callbackRef.current(null,null);return;
    }
    if(!fixedOrigin.current&&valid(originPoint)){
      fixedOrigin.current={lat:originPoint.lat,lng:originPoint.lng};
      fixedOriginLabel.current=originLabel||"Origem confirmada";
    }
    const from=fixedOrigin.current;
    if(!from){
      routeGeneration.current+=1;requestedPair.current=null;
      setQuote(null);setRouteBusy(false);setRouteError("");callbackRef.current(null,null);return;
    }
    const to={lat:destPoint.lat!,lng:destPoint.lng!};
    const selectedOrigin=fixedOriginLabel.current||"Origem confirmada";
    const selectedDestination=destination.trim();
    const key=JSON.stringify([from.lat,from.lng,to.lat,to.lng,selectedOrigin,selectedDestination]);
    // A later live GPS update must not reset an in-flight request or replace
    // the selected origin. Only a new itinerary or explicit retry can do that.
    if(requestedPair.current?.key===key&&requestedPair.current.attempt===routeAttempt)return;
    requestedPair.current={key,attempt:routeAttempt};
    const generation=++routeGeneration.current;
    setRouteBusy(true);setRouteError("");setQuote(null);callbackRef.current(null,from);
    let cached=routeCache.current.get(key);
    if(cached?.expiresAt!==undefined&&cached.expiresAt<=Date.now()){
      routeCache.current.delete(key);cached=undefined;
    }
    if(!cached){
      const promise=Promise.resolve().then(()=>quoteFnRef.current({data:{
        origin:selectedOrigin,destination:selectedDestination,originPoint:from,destinationPoint:to,
      }})).then(result=>{
        if(!Array.isArray(result.routePath)||result.routePath.length<2||
          !Number.isFinite(result.distanceKm)||result.distanceKm<=0||
          !result.quoteId||!Number.isFinite(result.pricePerPassenger)||result.pricePerPassenger<0||
          !valid(result.originPoint)||!valid(result.destinationPoint)||
          !Number.isFinite(Date.parse(result.expiresAt))||Date.parse(result.expiresAt)<=Date.now())
          throw new Error("QUOTE_UNAVAILABLE");
        return {...result,origin:selectedOrigin,destination:selectedDestination};
      });
      const entry:CachedQuote={promise};cached=entry;routeCache.current.set(key,entry);
      void promise.then(result=>{entry.expiresAt=Date.parse(result.expiresAt);})
        .catch(()=>{if(routeCache.current.get(key)===entry)routeCache.current.delete(key);});
    }
    void cached.promise.then(result=>{if(generation===routeGeneration.current){setQuote(result);callbackRef.current(result,result.originPoint);}})
      .catch(()=>{if(generation===routeGeneration.current)setRouteError("Não foi possível calcular a rota e o valor agora. Tente novamente.");})
      .finally(()=>{if(generation===routeGeneration.current)setRouteBusy(false);});
  },[destination,destPoint?.lat,destPoint?.lng,originRevision,originPoint?.lat,originPoint?.lng,originLabel,serviceType,routeAttempt,busy,uncertainDraft,publishedId,alreadyPublished]);

  useEffect(()=>{
    setQuoteExpired(false);
    if(!quote)return;
    const timer=setTimeout(()=>setQuoteExpired(true),Math.max(0,Date.parse(quote.expiresAt)-Date.now()));
    return()=>clearTimeout(timer);
  },[quote]);

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
    let lastRun=0;
    const signal=(force=false)=>{
      if(disposed)return;
      // The existing shared table produces unrelated changes. Limit reads
      // without processing any event payload or exposing passenger PII.
      if(!force&&Date.now()-lastRun<10000)return;
      if(debounce)clearTimeout(debounce);
      debounce=setTimeout(()=>{
        if(disposed)return;
        lastRun=Date.now();
        void loadOpportunityRef.current();
      },450);
    };
    const onFocus=()=>{if(!document.hidden)signal(true);};
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
    if(publishInFlight.current||uncertainDraft||alreadyPublished)return;
    submittedDraft.current=null;
    routeGeneration.current+=1;requestedPair.current=null;
    setDestination(label);setDestPoint(details);
    if(!fixedOrigin.current&&valid(originPoint)){
      fixedOrigin.current={lat:originPoint.lat,lng:originPoint.lng};
      fixedOriginLabel.current=originLabel||"Origem confirmada";
    }
    setQuote(null);setRouteBusy(false);setRouteError("");setRouteAttempt(value=>value+1);
    setPublishedId(null);setSeatsLeft(null);
    setOpportunities([]);setPublicationError("");setDebtPending(false);
    onDestinationChange(label,details);
    if(valid(details))onSnapChange("half");
  };
  const retryQuote=()=>{
    if(publishInFlight.current||uncertainDraft||alreadyPublished)return;
    if(requestedPair.current)routeCache.current.delete(requestedPair.current.key);
    routeGeneration.current+=1;requestedPair.current=null;
    setQuote(null);setRouteError("");setRouteBusy(true);setRouteAttempt(value=>value+1);
  };
  const renewQuoteForReview=()=>{
    if(requestedPair.current)routeCache.current.delete(requestedPair.current.key);
    routeGeneration.current+=1;requestedPair.current=null;
    setQuote(null);setRouteError("");setRouteBusy(true);setRouteAttempt(value=>value+1);
    setPublicationError("O valor anterior expirou. Estamos atualizando a rota e o valor. Revise novamente antes de publicar.");
    onSnapChange("full");
  };
  const ready=validScheduleDate(scheduledAt)&&!!quote&&!routeBusy&&!routeError&&
    valid(destPoint)&&!!fixedOrigin.current&&destination.trim().length>0&&!originNeedsConfirmation&&!alreadyPublished;
  const publish=async()=>{
    if(publishInFlight.current||busy||publishedId||alreadyPublished)return;
    if(!uncertainDraft&&(!ready||!quote))return;
    if(!uncertainDraft&&quote&&Date.parse(quote.expiresAt)<=Date.now()){renewQuoteForReview();return;}
    const draft:ScheduledDriverOfferDraft=uncertainDraft??{
      origin:quote!.origin,destination:quote!.destination,quoteId:quote!.quoteId,
      originPoint:quote!.originPoint,destinationPoint:quote!.destinationPoint,
      departureAt:new Date(scheduledAt).toISOString(),routePath:quote!.routePath,
      bookingMode,vehicleType,seats:vehicleType==="MOTO"?1:seats,
      suggestedFarePerSeat:quote!.pricePerPassenger,womenOnly:gender==="FEMININO"&&womenOnly,
    };
    submittedDraft.current=draft;
    publishInFlight.current=true;
    setBusy(true);setPublicationError("");setDebtPending(false);
    try{
      const id=await (uncertainDraft?publishScheduledDriverOffer(draft,{retry:true}):publishScheduledDriverOffer(draft));
      // A confirmed publication consumes this quote. A network failure keeps
      // it cached so an explicit retry can recover the same offer safely.
      routeCache.current.clear();
      setUncertainDraft(null);setPublishedId(id);setSeatsLeft(draft.seats);
      toast.success("Carona agendada publicada.");
      onPublished?.();
    }catch(error){
      const outcomeUnknown=!(error instanceof DriverScheduledError)||error.code==="UNAVAILABLE";
      if(outcomeUnknown){
        setUncertainDraft(draft);
        setPublicationError("Não foi possível confirmar se a carona foi publicada. Seus dados foram mantidos. Verifique a publicação antes de fazer alterações.");
        onSnapChange("full");return;
      }
      setUncertainDraft(null);
      if(error instanceof DriverScheduledError){
        if(error.code==="QUOTE_EXPIRED")renewQuoteForReview();
        else if(error.code==="ALREADY_PUBLISHED"){
          setAlreadyPublished(true);
          setPublicationError("Esta carona já foi publicada. Confira os detalhes em Agendados antes de criar outra.");
        }
        else if(error.code==="INVALID_SCHEDULE"){
          setPublicationError("Escolha uma saída com pelo menos 30 minutos de antecedência e tente novamente.");
          onSnapChange("half");
        }else if(error.code==="VEHICLE_REQUIRED")setPublicationError("Confira os dados do veículo no seu perfil e tente publicar novamente.");
        else if(error.code==="FORBIDDEN")setPublicationError("Não foi possível autorizar a publicação. Entre novamente na sua conta e tente outra vez.");
        else if(error.code==="INVALID_INPUT"){
          setPublicationError("Revise a saída, o destino e as vagas antes de publicar.");onSnapChange("half");
        }else if(error.code==="DEBT_PENDING"){
          setDebtPending(true);setPublicationError("Há uma taxa de plataforma pendente. Regularize antes de publicar.");
        }else setPublicationError("Não foi possível publicar agora. Seus dados foram mantidos. Tente novamente.");
      }else setPublicationError("Não foi possível publicar agora. Seus dados foram mantidos. Tente novamente.");
    }finally{publishInFlight.current=false;setBusy(false);}
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
    }catch(error){
      if(error instanceof DriverScheduledError&&error.code==="ALREADY_MATCHED")
        toast.info("Este passageiro acabou de ser atendido por outra carona");
      else toast.error("Não foi possível aceitar o passageiro.");
      await refreshOpportunities();
    }finally{setAcceptBusy(null);}
  };
  const hasDestination=valid(destPoint);
  const hasOrigin=!!fixedOrigin.current||valid(originPoint);
  const planningLocked=busy||!!uncertainDraft||alreadyPublished;
  const plannerSnap=planningLocked?"full":snap;
  const reviewDraft=planningLocked||publishedId?submittedDraft.current:null;
  const selectedOriginLabel=quote?.origin||fixedOriginLabel.current||originLabel||
    (locating?"Localizando sua saída...":"Defina a saída");
  const fareStatus=routeBusy?"Calculando...":routeError?"Indisponível":quoteExpired?"Atualize o valor":
    price!==null?formatBrl(price):!hasDestination?"Escolha o destino":!hasOrigin?
      (locating?"Localizando sua saída...":"Defina a saída"):"Calculando...";
  const routeStatus=routeBusy?"Calculando rota e valor...":routeError||
    (quoteExpired?"O valor expirou. Atualize a rota e o valor antes de publicar.":route?
      route.distanceKm.toFixed(1)+" km pelas ruas":!hasDestination?
        (destination.trim()?"Selecione o endereço na lista para confirmar o destino.":"Selecione um destino para visualizar a rota."):
        locating?"Destino selecionado. Aguardando sua localização para calcular a rota.":
          "Destino selecionado. Defina a saída no mapa para calcular a rota.");
  const modeLabel=modeChoices.find(([value])=>value===(reviewDraft?.bookingMode??bookingMode))?.[1]??"Aceito tudo";
  const originConfirmation=originNeedsConfirmation?<section className="space-y-2 rounded-xl border border-[#FFBB00]/50 p-3 text-sm">
    <p>Sua localização é aproximada. Confirme o ponto de saída antes de publicar.</p>
    <button type="button" onClick={onConfirmOrigin??onAdjustOrigin}
      className="min-h-11 w-full rounded-xl border border-[#FFBB00]/60 px-3 font-semibold text-[#FFBB00]">
      Confirmar ponto de saída
    </button>
  </section>:null;
  const routeRetry=(routeError||quoteExpired)&&!routeBusy&&!planningLocked?<button type="button" onClick={retryQuote}
    className="min-h-11 w-full rounded-xl border border-[#FFBB00]/60 px-3 text-sm font-semibold text-[#FFBB00]">
    {quoteExpired?"Atualizar rota e valor":"Tentar calcular novamente"}
  </button>:null;
  return <div className="space-y-3 pb-4 text-white" style={{fontFamily:"Manrope, sans-serif"}}>
    {serviceType!=="AGENDADA"?
      <div className="space-y-3">
        <ServiceTypeDock compact={snap==="peek"} value={serviceType} onChange={onServiceTypeChange}/>
        <p className="rounded-xl border border-white/15 p-3 text-sm text-white/75">
          O Flash profissional permanece no fluxo operacional existente. Selecione Agendada para publicar sua viagem.
        </p>
      </div>:
    plannerSnap==="peek"?<>
      <div className="flex gap-2">
        <button type="button" onClick={()=>onSnapChange("half")}
          className="min-h-9 min-w-0 flex-1 truncate rounded-xl border border-white/20 bg-white/10 px-3 text-left text-sm">
          {destination||"Para onde vamos?"}
        </button>
        <button type="button" onClick={onAdjustOrigin} aria-label="Ajustar origem no mapa"
          className="flex min-h-9 w-10 items-center justify-center rounded-xl border border-[#FFBB00]/50"><MapPin size={17}/></button>
      </div>
      <p className="truncate px-1 text-[11px] text-white/70">
        Origem: {selectedOriginLabel} · toque no marcador para ajustar
      </p>
      <ServiceTypeDock compact value={serviceType} onChange={onServiceTypeChange}/>
    </>:
    <>
      {plannerSnap==="half"&&<>
        <LocationAutocomplete id="driver-scheduled-destination" label="Destino"
          value={destination} selectedLocation={destPoint} placeholder="Para onde vamos?"
          variant="glass" onChange={chooseDestination}/>
        <button type="button" onClick={onAdjustOrigin}
          className="flex min-h-10 items-center gap-2 text-xs text-[#FFBB00]">
          <MapPin size={16}/> Origem: {selectedOriginLabel} · Ajustar no mapa
        </button>
        {originConfirmation}
        <ServiceTypeDock value={serviceType} onChange={onServiceTypeChange}/>
        <label className="block space-y-2 text-sm font-semibold">
          Data e hora de saída
          <input type="datetime-local" lang="pt-BR" aria-label="Data e hora de saída" min={localTime(30*60000)}
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
        {gender==="FEMININO"&&<WomenOnlyToggle kind="offer" gender={gender}
          checked={womenOnly} onChange={setWomenOnly}/>}
        <p role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
          Valor sugerido por vaga: <strong className="text-[#FFBB00]">{fareStatus}</strong>
        </p>
        <p role={routeError?"alert":undefined} className="text-xs text-white/70">{routeStatus}</p>
        {routeRetry}
        {publicationError&&<p role="alert" className="rounded-xl border border-[#FFBB00]/50 p-3 text-sm">{publicationError}</p>}
        <button type="button" disabled={!ready} onClick={()=>onSnapChange("full")}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-40">
          Revisar publicação
        </button>
      </>}
      {plannerSnap==="full"&&<>
        <button type="button" disabled={planningLocked} onClick={()=>onSnapChange("half")}
          className="min-h-11 text-sm text-[#FFBB00] disabled:opacity-40">Voltar à edição</button>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Publicar Carona Agendada</h2>
        {originConfirmation}
        <section className="space-y-2 rounded-2xl border border-white/20 p-4 text-sm">
          <p><MapPin size={15} className="mr-1 inline text-[#FFBB00]"/> {reviewDraft?.origin||selectedOriginLabel}</p>
          <p><Navigation size={15} className="mr-1 inline text-[#FFBB00]"/> {reviewDraft?.destination||destination||"Destino não selecionado"}</p>
          {(reviewDraft?.departureAt||scheduledAt)&&<p><CalendarClock size={15} className="mr-1 inline text-[#FFBB00]"/> {formatTripDate(reviewDraft?.departureAt||scheduledAt)}</p>}
          <p><Users size={15} className="mr-1 inline text-[#FFBB00]"/> {reviewDraft?.seats??(vehicleType==="MOTO"?1:seats)} vaga(s) · {modeLabel}</p>
          <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[#FFBB00]">
            {reviewDraft?formatBrl(reviewDraft.suggestedFarePerSeat):price!==null?formatBrl(price):"—"} <span className="text-xs font-normal text-white/70">sugeridos por vaga</span>
          </p>
        </section>
        {!planningLocked&&(!route||routeError||quoteExpired)&&<p role={routeError?"alert":"status"} className="text-sm text-white/75">{routeStatus}</p>}
        {routeRetry}
        {!publishedId?<button type="button" disabled={(!uncertainDraft&&!ready)||busy} onClick={()=>void publish()}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-40">
          {busy?(uncertainDraft?"Verificando...":"Publicando..."):uncertainDraft?"Verificar publicação":quoteExpired?"Atualizar valor para revisar":"Publicar Carona Agendada"}
        </button>:<p role="status" className="rounded-xl border border-[#FFBB00]/40 p-3 text-sm">
          Carona agendada publicada. Aguardando passageiros.
        </p>}
        {publicationError&&<div role="alert" className="space-y-2 rounded-xl border border-[#FFBB00]/50 p-3 text-sm">
          <p>{publicationError}</p>
          {(uncertainDraft||alreadyPublished)&&onOpenTrips&&<button type="button" onClick={onOpenTrips}
            className="min-h-11 rounded-xl border border-[#FFBB00]/60 px-3 text-[#FFBB00]">Conferir Agendados</button>}
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
