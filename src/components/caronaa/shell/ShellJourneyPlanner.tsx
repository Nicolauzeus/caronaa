import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bike, CarFront, Clock3, MapPin, Search, UserRound } from "lucide-react";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { WomenOnlyToggle } from "@/components/caronaa/WomenOnlyToggle";
import { TravelPreferenceFields } from "@/components/caronaa/TravelPreferences";
import { emptyTravelPreferences, type TravelPreferences } from "@/lib/travel-preferences";
import { loadTravelPreferences } from "@/lib/travel-preferences-service";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { getQuickRideApproach } from "@/lib/quick-ride-map.functions";
import { quoteUnifiedFare, type UnifiedFareResult, type UnifiedFareMode } from "@/lib/pricing/unified-fare-engine";
import { formatBrl } from "@/lib/ride-cost";
import { supabase } from "@/integrations/supabase/client";
import { ServiceTypeDock, type ServiceType } from "./ServiceTypeDock";
import type { SheetSnap } from "./InteractiveBottomSheet";
import type { FormLocationDetails } from "@/lib/location/types";
import type { ProfileGender } from "@/lib/use-profile-gender";

export type ShellRoute = {routePath:Array<{lat:number;lng:number}>;distanceKm:number;durationMinutes:number};
type Point = {lat:number;lng:number};
type Vehicle = "CAR"|"MOTO";
type SearchPhase = "REVIEW"|"SEARCHING"|"TIMEOUT"|"MATCHED"|"WAITLISTED";
type MatchedDriver = {
  name:string;photo:string|null;vehicle:string|null;plate:string|null;
  color?:string|null;rating?:number|null;etaMinutes?:number|null;
  meetingLabel?:string|null;walkDistanceMeters?:number|null;
};
type Props = {
  snap:SheetSnap;
  onSnapChange?:(snap:SheetSnap)=>void;
  serviceType:ServiceType;
  onServiceTypeChange:(service:ServiceType)=>void;
  originPoint?:{lat?:number;lng?:number}|null;
  originLabel?:string;
  originMunicipality:string;
  originRevision?:number;
  gender:ProfileGender;
  onDestinationChange?:(label:string,details?:FormLocationDetails)=>void;
  onRouteChange?:(route:ShellRoute|null,origin:Point|null)=>void;
  onAdjustOrigin?:()=>void;
};
const valid=(p:{lat?:number;lng?:number}|null|undefined):p is Point=>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat!)<=90 && Math.abs(p.lng!)<=180;
const selectedButton=(chosen:boolean)=>"min-h-11 rounded-xl border p-3 text-sm font-bold transition-colors "+
  (chosen?"border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]":"border-white/20 bg-white/5 text-white");
const localDateTime=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);

export function ShellJourneyPlanner({
  snap,onSnapChange,serviceType,onServiceTypeChange,originPoint,originLabel,
  originMunicipality,originRevision=0,gender,onDestinationChange,onRouteChange,onAdjustOrigin,
}:Props){
  const [destination,setDestination]=useState("");
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
  const [preferences,setPreferences]=useState<TravelPreferences>({...emptyTravelPreferences});
  const [womenOnly,setWomenOnly]=useState(false);
  const [scheduledAt,setScheduledAt]=useState("");
  const [phase,setPhase]=useState<SearchPhase>("REVIEW");
  const [startedAt,setStartedAt]=useState<number|null>(null);
  const [secondsLeft,setSecondsLeft]=useState(60);
  const [waitlistBusy,setWaitlistBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [matched,setMatched]=useState<MatchedDriver|null>(null);
  const routeReader=useServerFn(getMapDrivingRoute);
  const approachReader=useServerFn(getQuickRideApproach);
  const approachRef=useRef(approachReader);
  approachRef.current=approachReader;
  const routeReaderRef=useRef(routeReader);
  routeReaderRef.current=routeReader;
  const routeCache=useRef(new Map<string,Promise<ShellRoute>>());
  const frozenOrigin=useRef<Point|null>(null);
  const selectedKey=useRef("");
  const lastOriginRevision=useRef(originRevision);
  const searchSession=useRef(0);
  const onRouteRef=useRef(onRouteChange);
  onRouteRef.current=onRouteChange;

  useEffect(()=>{
    let active=true;
    void loadTravelPreferences().then(value=>{if(active)setPreferences(value);}).catch(()=>undefined);
    return()=>{active=false;routeCache.current.clear();};
  },[]);
  useEffect(()=>{if(gender!=="FEMININO")setWomenOnly(false);},[gender]);

  // One Google Routes call per selected origin/destination pair. Changing cards,
  // seats, preferences, sheet height or the live GPS pulse never reroutes.
  useEffect(()=>{
    if(!valid(destinationPoint)){setRoute(null);setPrices(null);onRouteRef.current?.(null,null);return;}
    if(valid(originPoint) && (originRevision!==lastOriginRevision.current || !frozenOrigin.current))
      frozenOrigin.current={lat:originPoint.lat,lng:originPoint.lng};
    lastOriginRevision.current=originRevision;
    const from=frozenOrigin.current;
    if(!from){setRoute(null);onRouteRef.current?.(null,null);return;}
    const to:Point={lat:destinationPoint.lat!,lng:destinationPoint.lng!};
    const key=[from.lat,from.lng,to.lat,to.lng].map(n=>n.toFixed(6)).join(":");
    selectedKey.current=key;
    let alive=true;
    setRouteBusy(true);setRouteError("");setRoute(null);setPrices(null);
    onRouteRef.current?.(null,null);
    let pending=routeCache.current.get(key);
    if(!pending){
      pending=routeReaderRef.current({data:{points:[from,to]}}).then(result=>{
        if(!Number.isFinite(result.distanceKm)||result.distanceKm<=0||
          !Array.isArray(result.routePath)||result.routePath.length<2)
          throw new Error("ROAD_ROUTE_UNAVAILABLE");
        return {routePath:result.routePath,distanceKm:result.distanceKm,durationMinutes:result.durationMinutes};
      });
      routeCache.current.set(key,pending);
      void pending.catch(()=>{routeCache.current.delete(key);});
    }
    void pending.then(result=>{
      if(!alive||selectedKey.current!==key)return;
      setRoute(result);
      onRouteRef.current?.(result,from);
    }).catch(()=>{
      if(alive){setRouteError("Não foi possível traçar a rota. Tente escolher o destino novamente.");}
    }).finally(()=>{if(alive)setRouteBusy(false);});
    return()=>{alive=false;};
  },[destinationPoint?.lat,destinationPoint?.lng,originRevision]);

  useEffect(()=>{
    if(!route){setPrices(null);return;}
    let active=true;
    const onRouteSeats=onRouteVehicle==="MOTO"?1:entireCar?3:seats;
    void Promise.all([
      quoteUnifiedFare({distanceKm:route.distanceKm,mode:"ON_ROUTE",vehicleType:onRouteVehicle,seats:onRouteSeats}),
      quoteUnifiedFare({distanceKm:route.distanceKm,mode:"EXCLUSIVE",vehicleType:exclusiveVehicle}),
    ]).then(([ON_ROUTE,EXCLUSIVE])=>{
      if(active)setPrices({ON_ROUTE,EXCLUSIVE});
    }).catch(()=>{if(active){setPrices(null);setRouteError("Não foi possível calcular a estimativa.");}});
    return()=>{active=false;};
  },[route,onRouteVehicle,exclusiveVehicle,seats,entireCar]);

  // The countdown is UI-only until the booking/dispatch RPC is integrated.
  // Never report a fabricated acceptance, payment or notification.
  useEffect(()=>{
    if(phase!=="SEARCHING"||startedAt===null)return;
    const tick=()=>{
      const remaining=Math.max(0,60-Math.floor((Date.now()-startedAt)/1000));
      setSecondsLeft(remaining);
      if(remaining===0)setPhase("TIMEOUT");
    };
    tick();
    const timer=window.setInterval(tick,1000);
    return()=>window.clearInterval(timer);
  },[phase,startedAt]);

  useEffect(()=>{
    if(phase!=="SEARCHING")return;
    let alive=true;
    const session=++searchSession.current;
    const check=async()=>{
      // Only a genuinely authorized, already-created ride may become MATCHED.
      // This shell does not manufacture a ride or bypass dispatch constraints.
      try{
        const {data,error}=await (supabase as any).rpc("quick_ride_my_requests");
        if(error||!Array.isArray(data)||!alive||session!==searchSession.current)return;
        const relevant=data.find((ride:any)=>ride.role==="PASSENGER"&&
          ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(ride.status)&&
          ride.destination_label===destination && ride.requested_at &&
          Date.parse(ride.requested_at)>=((startedAt??0)-5000));
        if(!relevant?.id)return;
        const {data:details,error:detailsError}=await (supabase as any).rpc(
          "quick_ride_driver_details",{p_id:relevant.id});
        if(!alive||detailsError||!details?.name)return;
        const approach=await approachRef.current({data:{rideId:relevant.id}}).catch(()=>null);
        if(!alive || session!==searchSession.current)return;
        const driver:MatchedDriver={
          name:details.name,photo:details.photo??null,vehicle:details.vehicle??null,
          plate:details.plate??null,color:details.color??null,
          rating:Number.isFinite(details.rating)?details.rating:null,
          etaMinutes:approach && Number.isFinite(approach.durationMinutes)
            ?Math.max(1,Math.ceil(approach.durationMinutes)):null,
          meetingLabel:typeof details.meetingLabel==="string"?details.meetingLabel:null,
          walkDistanceMeters:Number.isFinite(details.walkDistanceMeters)
            ?Math.round(details.walkDistanceMeters):null,
        };
        setMatched(driver);setPhase("MATCHED");
      }catch{/* No driver is claimed without authorized server data. */}
    };
    void check();
    const timer=window.setInterval(()=>{if(!document.hidden)void check();},15000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[phase,destination,startedAt]);

  const pickDestination=useCallback((label:string,details?:FormLocationDetails)=>{
    setDestination(label);
    setDestinationPoint(details);
    onDestinationChange?.(label,details);
    setPhase("REVIEW");setMatched(null);setFeedback("");setStartedAt(null);
    setRoute(null);setPrices(null);
    frozenOrigin.current=valid(originPoint)?{lat:originPoint.lat,lng:originPoint.lng}:null;
    if(details && valid(details))onSnapChange?.("half");
  },[originPoint?.lat,originPoint?.lng,onDestinationChange,onSnapChange]);

  const changeVehicle=(value:Vehicle,kind:UnifiedFareMode)=>{
    if(kind==="EXCLUSIVE"){setExclusiveVehicle(value);return;}
    setOnRouteVehicle(value);
    if(value==="MOTO"){setSeats(1);setEntireCar(false);}
  };
  const start=()=>{
    if(!valid(originPoint)||!valid(destinationPoint)||!route||!prices){
      setFeedback("Confirme a origem e o destino para continuar.");return;
    }
    setFeedback("");
    setSecondsLeft(60);setStartedAt(Date.now());setPhase("SEARCHING");
  };
  const cancel=()=>{
    searchSession.current+=1;
    setPhase("REVIEW");setStartedAt(null);setMatched(null);setFeedback("");
  };
  const schedule=()=>{
    cancel();
    onServiceTypeChange("AGENDADA");
    onSnapChange?.("full");
    setFeedback("Escolha o horário para agendar.");
  };
  const waitlist=async()=>{
    if(waitlistBusy || !valid(destinationPoint) || !originMunicipality.trim())return;
    setWaitlistBusy(true);setFeedback("");
    try{
      const onRouteSeats=onRouteVehicle==="MOTO"?1:entireCar?3:seats;
      const {error}=await (supabase as any).rpc("register_flash_waitlist",{
        p_origin_municipality:originMunicipality.trim(),
        p_destination_municipality:destinationPoint.city??null,
        p_vehicle_type:vehicle,p_service_mode:mode,
        p_seats:mode==="EXCLUSIVE"?(vehicle==="CAR"?3:1):onRouteSeats,
        p_reserved_entire_vehicle:mode==="EXCLUSIVE"||entireCar,
      });
      if(error)throw error;
      setPhase("WAITLISTED");
      setFeedback("Você está na lista de espera! Assim que os avisos por WhatsApp estiverem disponíveis, poderemos informar sobre motoristas na sua rota.");
    }catch{
      setFeedback("Não conseguimos confirmar sua inscrição. Tente novamente.");
    }finally{setWaitlistBusy(false);}
  };

  const selectedPrice=prices?.[mode]??null;
  const optionCard=(kind:UnifiedFareMode)=>(
    <div key={kind} className={"rounded-2xl border p-3 "+(mode===kind?
      "border-[#FFBB00] bg-[#FFBB00]/10":"border-white/20 bg-white/5")}>
      <button type="button" aria-pressed={mode===kind}
        onClick={()=>setMode(kind)} className="flex min-h-10 w-full items-center justify-between gap-2 text-left">
        <span className="font-[family-name:var(--font-display)] font-bold">
          {kind==="EXCLUSIVE"?"Exclusiva":"Na Rota"}
        </span>
        <span className="font-[family-name:var(--font-display)] font-extrabold text-[#FFBB00]">
          {prices?formatBrl(prices[kind].totalFare):"—"}
        </span>
      </button>
      <p className="my-2 text-xs leading-relaxed text-white/75">
        {kind==="EXCLUSIVE"?"Porta a porta, só você e quem estiver com você.":
          "Mais barato. Você embarca num ponto de encontro dentro do trajeto do motorista."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["CAR","MOTO"] as const).map(value=><button key={value} type="button"
          onClick={()=>{setMode(kind);changeVehicle(value,kind);}}
          aria-pressed={(kind==="EXCLUSIVE"?exclusiveVehicle:onRouteVehicle)===value}
          className={selectedButton((kind==="EXCLUSIVE"?exclusiveVehicle:onRouteVehicle)===value)}>
          {value==="CAR"?<CarFront size={17} className="mx-auto mb-1"/>:<Bike size={17} className="mx-auto mb-1"/>}
          {value==="CAR"?"Carro":"Moto"}
        </button>)}
      </div>
      {kind==="ON_ROUTE"&&mode==="ON_ROUTE"&&<div className="mt-3 space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Vagas</span>
          <select aria-label="Quantidade de vagas" value={onRouteVehicle==="MOTO"?1:entireCar?3:seats}
            disabled={onRouteVehicle==="MOTO"||entireCar}
            onChange={event=>setSeats(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-white/25 bg-[#121212] px-4 text-white">
            {Array.from({length:onRouteVehicle==="MOTO"?1:3},(_,i)=>i+1)
              .map(value=><option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        {onRouteVehicle==="CAR"&&<label className="flex min-h-11 items-center justify-between gap-2 text-xs">
          Reservar veículo inteiro (3 vagas)
          <input type="checkbox" checked={entireCar} onChange={e=>setEntireCar(e.target.checked)}
            className="size-5 accent-[#FFBB00]"/>
        </label>}
        {onRouteVehicle==="CAR"&&entireCar&&<p className="text-xs text-white/70">O bloqueio das outras vagas só vale após o servidor confirmar a reserva.</p>}
      </div>}
    </div>
  );

  return <div className={snap==="peek"?"space-y-1":"space-y-4 pb-4"}
    style={{fontFamily:"Manrope, sans-serif"}}>
    {snap==="peek"&&<>
      <button type="button" onClick={()=>onSnapChange?.("half")}
        className="flex min-h-9 w-full items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-sm">
        <Search size={18} className="text-[#FFBB00]"/>
        <span className="truncate">{destination||"Para onde vamos?"}</span>
      </button>
      <button type="button" className="block w-full truncate text-left text-[11px] text-white/80"
        onClick={onAdjustOrigin}>Origem: {originLabel||"GPS atual"} · Ajustar no mapa</button>
      <ServiceTypeDock compact value={serviceType} onChange={onServiceTypeChange}/>
    </>}
    {snap==="half"&&<>
      <LocationAutocomplete id="shell-destination" label="Para onde vamos?"
        value={destination} selectedLocation={destinationPoint}
        variant="glass" placeholder="Busque seu destino"
        onChange={pickDestination}/>
      <button type="button" onClick={onAdjustOrigin}
        className="flex min-h-10 items-center gap-2 text-xs text-[#FFBB00]">
        <MapPin size={16}/> Origem: {originLabel||"GPS atual"} · Ajustar no mapa
      </button>
      <ServiceTypeDock value={serviceType} onChange={onServiceTypeChange}/>
      {optionCard("EXCLUSIVE")}
      {optionCard("ON_ROUTE")}
      <div aria-live="polite" className="text-xs text-white/75">
        {routeBusy?"Calculando rota pelas ruas...":
          routeError||(!route?"Selecione um destino válido para calcular a rota.":
          route.distanceKm.toFixed(1)+" km pelas ruas · estimativa, sem cobrança")}
      </div>
      <button type="button" disabled={!route||!selectedPrice||routeBusy}
        onClick={()=>onSnapChange?.("full")}
        className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-50">
        Revisar e Continuar
      </button>
    </>}
    {snap==="full"&&<>
      <button type="button" onClick={()=>{cancel();onSnapChange?.("half");}}
        className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <ArrowLeft size={18} className="text-[#FFBB00]"/> Voltar às modalidades
      </button>
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Confirme seu Caronaa Flash</h2>
      <section aria-label="Resumo da corrida" className="space-y-2 rounded-2xl border border-[#FFBB00]/35 bg-white/5 p-4 text-sm">
        <p><strong>Embarque:</strong> {originLabel||"Sua localização atual"}</p>
        <p><strong>Destino:</strong> {destination||"Não selecionado"}</p>
        <p><strong>Modalidade:</strong> {mode==="EXCLUSIVE"?
          "Exclusiva ("+(vehicle==="CAR"?"Carro":"Moto")+")":
          "Na Rota ("+(onRouteVehicle==="MOTO"?1:entireCar?3:seats)+" vagas)"} </p>
        <p className="font-[family-name:var(--font-display)] text-2xl font-black text-[#FFBB00]">
          {selectedPrice?formatBrl(selectedPrice.totalFare):"Calculando..."}
        </p>
        <p className="text-xs text-white/70">Tarifa estimada, sujeita à confirmação operacional.</p>
        <p><strong>Pagamento:</strong> Pix ou dinheiro direto ao motorista</p>
        <p className="text-xs text-white/70">O app não retém valores nesta etapa.</p>
      </section>
      <div className="rounded-2xl border border-white/15 bg-white/5 p-3
        [&_select]:bg-[#121212] [&_select]:text-white [&_label]:text-white">
        <TravelPreferenceFields kind="request" value={preferences} onChange={setPreferences}/>
      </div>
      {gender==="FEMININO"&&<WomenOnlyToggle kind="request" gender={gender}
        checked={womenOnly} onChange={setWomenOnly}/>}
      {serviceType==="AGENDADA"&&<label className="block text-sm">
        <span className="flex items-center gap-2"><Clock3 size={16} className="text-[#FFBB00]"/> Horário desejado</span>
        <input type="datetime-local" aria-label="Horário da viagem agendada" value={scheduledAt}
          onChange={e=>setScheduledAt(e.target.value)} min={localDateTime()}
          className="mt-2 min-h-12 w-full rounded-xl border border-white/25 bg-[#121212] p-3 [color-scheme:dark]"/>
        <small className="block py-2 text-white/65">O agendamento ainda precisa ser confirmado pelo serviço operacional.</small>
      </label>}
      {serviceType==="FLASH"&&phase==="REVIEW"&&<>
        <button type="button" disabled={!selectedPrice||!route}
          onClick={start} className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-40">
          Pedir Caronaa Flash
        </button>
        <p className="text-xs text-white/65">
          A busca nesta casca é uma prévia. Nenhum pedido é enviado ou cobrado até conectar o despacho autorizado.
        </p>
      </>}
      {phase==="SEARCHING"&&<section className="space-y-3 rounded-2xl border border-[#FFBB00]/40 p-4">
        <p className="text-sm font-semibold">O app está em fase inicial e estamos avisando nossos motoristas da sua região.</p>
        <p className="text-xs text-white/70">Prévia de busca: notificações não foram disparadas.</p>
        <p role="timer" className="font-[family-name:var(--font-display)] text-3xl font-bold text-[#FFBB00]">
          {secondsLeft}s
        </p>
        <button type="button" onClick={cancel}
          className="min-h-12 w-full rounded-xl border border-white/30 font-semibold">Cancelar busca</button>
      </section>}
      {phase==="TIMEOUT"&&<section className="space-y-3 rounded-2xl border border-[#FFBB00]/35 p-4">
        <p className="text-sm font-bold">Nenhum motorista confirmou neste período.</p>
        <button type="button" onClick={schedule}
          className="min-h-12 w-full rounded-xl border border-white/30 font-bold">Agendar para daqui a pouco</button>
        <button type="button" disabled={waitlistBusy} onClick={()=>void waitlist()}
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-50">
          {waitlistBusy?"Registrando...":"Entrar na lista de espera"}
        </button>
        <button type="button" onClick={cancel} className="min-h-11 w-full text-sm text-white/70">Voltar ao resumo</button>
      </section>}
      {phase==="WAITLISTED"&&<p role="status" className="rounded-xl border border-[#FFBB00]/30 p-4 text-sm text-[#FFBB00]">{feedback}</p>}
      {phase==="MATCHED"&&matched&&<section className="space-y-3 rounded-xl border border-[#FFBB00]/50 p-3">
        <h3 className="font-bold text-[#FFBB00]">Motorista confirmou</h3>
        <div className="flex items-center gap-3">
          {matched.photo?<img src={matched.photo} alt="Foto do motorista" className="size-14 rounded-full object-cover"/>:
            <span aria-label="Motorista sem foto" className="flex size-14 items-center justify-center rounded-full bg-white/10">
              <UserRound size={25}/>
            </span>}
          <div className="text-sm">
            <p className="font-bold">{matched.name}</p>
            {matched.rating!=null&&<p>★ {matched.rating.toFixed(1)}</p>}
            <p>{[matched.vehicle,matched.color,matched.plate].filter(Boolean).join(" · ")}</p>
            {!matched.color&&<p className="text-xs text-white/65">Cor não informada</p>}
            {matched.rating==null&&<p className="text-xs text-white/65">Avaliação indisponível</p>}
            {matched.etaMinutes!=null&&<p>Chegada estimada: {matched.etaMinutes} min</p>}
          </div>
        </div>
        {mode==="ON_ROUTE"&&<p className="text-xs text-white/80">
          Ponto de embarque: {matched.meetingLabel||"Aguardando confirmação do motorista"}.
          {matched.walkDistanceMeters!=null?" Caminhada: "+matched.walkDistanceMeters+" m.":" Distância a pé indisponível."}
        </p>}
      </section>}
      {feedback&&phase!=="WAITLISTED"&&<p role="status" className="text-xs text-[#FFBB00]">{feedback}</p>}
    </>}
  </div>;
}
