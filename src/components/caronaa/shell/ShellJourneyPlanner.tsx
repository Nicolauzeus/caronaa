import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Clock3, MapPin, Users, Music2, MessageCircle, ShieldCheck, Zap } from "lucide-react";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { ServiceTypeDock, type ServiceType } from "./ServiceTypeDock";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { quoteUnifiedFare, type UnifiedFareResult, type UnifiedFareMode } from "@/lib/pricing/unified-fare-engine";
import { supabase } from "@/integrations/supabase/client";
import type { FormLocationDetails } from "@/lib/location/types";
import type { SheetSnap } from "./InteractiveBottomSheet";

type VehicleType="CAR"|"MOTO";
type Props={
  snap:SheetSnap;
  serviceType:ServiceType;
  onServiceTypeChange:(type:ServiceType)=>void;
  originPoint?:{lat?:number;lng?:number}|null;
  originMunicipality:string;
  gender:string|null;
  onDestinationChange?:(label:string,details?:FormLocationDetails)=>void;
};
const formatPrice=(amount:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(amount);
const validPoint=(p:Props["originPoint"]):p is {lat:number;lng:number} =>
  Boolean(p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat!)<=90 && Math.abs(p.lng!)<=180);
export function ShellJourneyPlanner({snap,serviceType,onServiceTypeChange,
  originPoint,originMunicipality,gender,onDestinationChange}:Props){
  const [destination,setDestination]=useState("");
  const [destinationPoint,setDestinationPoint]=useState<FormLocationDetails>();
  const [mode,setMode]=useState<UnifiedFareMode>("ON_ROUTE");
  const [vehicle,setVehicle]=useState<VehicleType>("CAR");
  const [seats,setSeats]=useState(1);
  const [quote,setQuote]=useState<UnifiedFareResult|null>(null);
  const [quoting,setQuoting]=useState(false);
  const [quoteError,setQuoteError]=useState("");
  const [music,setMusic]=useState("SEM_PREFERENCIA");
  const [conversation,setConversation]=useState("SEM_PREFERENCIA");
  const [scheduledAt,setScheduledAt]=useState("");
  const [womenOnly,setWomenOnly]=useState(false);
  const [flashStartedAt,setFlashStartedAt]=useState<number|null>(null);
  const [remaining,setRemaining]=useState(60);
  const [waitlistBusy,setWaitlistBusy]=useState(false);
  const [radarCount,setRadarCount]=useState(0);
  const [radarState,setRadarState]=useState<"unknown"|"loading"|"ready"|"error">("unknown");
  const [waitlistStatus,setWaitlistStatus]=useState("");
  const routePreview=useServerFn(getMapDrivingRoute);
  useEffect(()=>{
    const municipality=originMunicipality.trim();
    if(serviceType!=="FLASH" || municipality.length<2){
      setRadarState("unknown");
      setRadarCount(0);
      return;
    }
    let mounted=true;
    setRadarState("loading");
    void (supabase as any).rpc("discover_caronaa_quick_drivers",{
      p_municipality:municipality,p_vehicle:vehicle,
    }).then(({data,error}:{data:unknown;error:unknown})=>{
      if(!mounted)return;
      if(error){setRadarState("error");setRadarCount(0);return;}
      const drivers=Array.isArray(data)?data:[];
      setRadarCount(drivers.filter(driver=>!driver.is_self && !driver.simulated).length);
      setRadarState("ready");
    }).catch(()=>{if(mounted){setRadarState("error");setRadarCount(0);}});
    return()=>{mounted=false;};
  },[originMunicipality,vehicle,serviceType]);

  useEffect(()=>{
    if(flashStartedAt===null)return;
    const update=()=>setRemaining(Math.max(0,60-Math.floor((Date.now()-flashStartedAt)/1000)));
    update();
    const interval=window.setInterval(update,1000);
    return ()=>window.clearInterval(interval);
  },[flashStartedAt]);

  useEffect(()=>{
    setQuote(null);
    setQuoteError("");
    if(!validPoint(originPoint) || !validPoint(destinationPoint))return;
    let active=true;
    const timer=window.setTimeout(async()=>{
      setQuoting(true);
      try{
        // Google Routes returns road distance; never replace it with straight-line distance.
        const route=await routePreview({data:{points:[
          {lat:originPoint.lat,lng:originPoint.lng},
          {lat:destinationPoint.lat!,lng:destinationPoint.lng!},
        ]}});
        if(!Number.isFinite(route.distanceKm)||route.distanceKm<=0)
          throw new Error("ROAD_DISTANCE_UNAVAILABLE");
        const result=await quoteUnifiedFare({distanceKm:route.distanceKm,
          mode,vehicleType:vehicle,seats:vehicle==="MOTO"?1:seats});
        if(active)setQuote(result);
      }catch{
        if(active)setQuoteError("Não foi possível calcular a rota agora. Confira origem e destino.");
      }finally{if(active)setQuoting(false);}
    },350);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[originPoint?.lat,originPoint?.lng,destinationPoint?.lat,destinationPoint?.lng,
    mode,vehicle,seats,routePreview]);

  useEffect(()=>{
    if(vehicle==="MOTO")setSeats(1);
  },[vehicle]);

  const startFlash=()=>{
    setWaitlistStatus("");
    if(!validPoint(originPoint)||!validPoint(destinationPoint)){
      setWaitlistStatus("Escolha um destino válido e permita localizar a origem.");
      return;
    }
    if(radarState!=="ready"){
      setWaitlistStatus(radarState==="error"
        ?"Radar temporariamente indisponível. Tente novamente mais tarde."
        :"Ainda estamos verificando a disponibilidade de motoristas e o município pelo GPS.");
      return;
    }
    if(radarCount>0){
      setWaitlistStatus("Há motoristas no radar. A solicitação de corrida ainda depende da confirmação operacional.");
      return;
    }
    setFlashStartedAt(Date.now());
    setRemaining(60);
  };
  const joinWaitlist=async()=>{
    if(waitlistBusy||!destination.trim()||!validPoint(destinationPoint)||
      originMunicipality.trim().length<2)return;
    setWaitlistBusy(true);
    setWaitlistStatus("");
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth.user)throw new Error("AUTH");
      const {error}=await (supabase as any).from("flash_waitlist").upsert({
        user_id:auth.user.id,
        vehicle_type:vehicle,
        service_mode:mode,
        // Store only municipality-level interest, not home addresses or GPS.
        origin_municipality:originMunicipality.trim(),
        destination_municipality:destinationPoint?.city ?? null,
        updated_at:new Date().toISOString(),
      },{onConflict:"user_id,origin_municipality,vehicle_type,service_mode"});
      if(error)throw error;
      setWaitlistStatus("Você entrou na lista de espera. Avisaremos quando houver disponibilidade.");
      setFlashStartedAt(null);
    }catch{
      setWaitlistStatus("Não foi possível registrar na lista de espera. Verifique a tabela e tente novamente.");
    }finally{setWaitlistBusy(false);}
  };
  const scheduleSoon=()=>{
    onServiceTypeChange("AGENDADA");
    setFlashStartedAt(null);
    setWaitlistStatus("Modo agendado selecionado. Informe o horário quando o agendamento estiver disponível.");
  };

  return <div className={snap==="peek"?"space-y-1":"space-y-4 pb-3"} style={{fontFamily:"Manrope, sans-serif"}}>
    <div className={snap==="peek"?"space-y-1":"space-y-2"}>
      <h2 className={snap==="peek"?"sr-only":"font-[family-name:var(--font-display)] text-lg font-bold text-white"}>
        Para onde vamos?
      </h2>
      {snap==="peek"?<button type="button" onClick={()=>{
        document.dispatchEvent(new CustomEvent("caronaa-shell-expand"));
      }} className="flex min-h-9 w-full items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 text-left text-sm">
        <Search size={18} className="text-[#FFBB00]"/>
        <span className="truncate text-white/75">{destination||"Para onde vamos?"}</span>
      </button>:
      <LocationAutocomplete id="shell-destination" label="Destino" value={destination}
        selectedLocation={destinationPoint} variant="glass" placeholder="Para onde vamos?"
        onChange={(label,location)=>{
          setDestination(label);setDestinationPoint(location);onDestinationChange?.(label,location);
        }}/> }
      <ServiceTypeDock compact={snap==="peek"} value={serviceType} onChange={type=>{
        onServiceTypeChange(type);
        setFlashStartedAt(null);
        setWaitlistStatus("");
      }}/>
    </div>

    {snap!=="peek"&&<>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Modalidade</legend>
        <div className="grid grid-cols-2 gap-2">
          {([{id:"ON_ROUTE",title:"Na Rota"},{id:"EXCLUSIVE",title:"Exclusiva"}] as const).map(opt=>
            <button key={opt.id} type="button" aria-pressed={mode===opt.id}
              onClick={()=>setMode(opt.id)}
              className={`min-h-12 rounded-xl border px-3 text-sm font-bold ${mode===opt.id?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/20 bg-white/10 text-white"}`}>
              {opt.title}
            </button>)}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Veículo</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["CAR","MOTO"] as const).map(item=>
            <button key={item} type="button" aria-pressed={vehicle===item}
              onClick={()=>setVehicle(item)}
              className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${vehicle===item?"border-[#FFBB00] text-[#FFBB00]":"border-white/20 text-white"}`}>
              {item==="CAR"?"Carro":"Moto"}
            </button>)}
        </div>
      </fieldset>
      {mode==="ON_ROUTE"&&<label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/15 px-3 text-sm font-semibold">
        <span className="inline-flex items-center gap-2"><Users size={17}/> Vagas</span>
        <select aria-label="Quantidade de vagas" value={vehicle==="MOTO"?1:seats}
          disabled={vehicle==="MOTO"} onChange={e=>setSeats(Number(e.target.value))}
          className="rounded-lg border border-white/20 bg-[#121212] px-3 py-2 text-white">
          {Array.from({length:vehicle==="MOTO"?1:3},(_,i)=>i+1)
            .map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </label>}
      <div role="status" aria-live="polite"
        className="rounded-2xl border border-[#FFBB00]/30 bg-white/5 p-3 text-sm">
        <p className="font-semibold text-white">Prévia de tarifa</p>
        {quoting?<p className="mt-1 text-white/70">Calculando distância rodoviária...</p>:
          quote?<><p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[#FFBB00]">
            {formatPrice(quote.totalFare)}
          </p><p className="text-xs text-white/60">
            {quote.distanceKm.toFixed(1)} km pela via · {quote.configSource==="FALLBACK"?"estimativa com tarifa padrão":"configuração do banco"}.
            Valor final depende da confirmação no servidor.
          </p></>:
          <p className="mt-1 text-white/65">{quoteError||"Defina origem e destino no mapa para estimar o valor."}</p>}
      </div>

      {serviceType==="FLASH"&&<div className="space-y-2">
        {flashStartedAt===null?<button type="button" onClick={startFlash}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">
          <Zap size={18}/> Ver disponibilidade Flash
        </button>:
          <div className="space-y-3 rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-sm">
            <p className="font-semibold">O app está em fase inicial e estamos avisando nossos motoristas.</p>
            {remaining>0?<p role="timer" className="font-[family-name:var(--font-display)] text-xl font-bold text-[#FFBB00]">
              {remaining}s
            </p>:<div className="space-y-2">
              <p>Não encontramos um motorista disponível neste período.</p>
              <button type="button" disabled={waitlistBusy} onClick={()=>void joinWaitlist()}
                className="min-h-11 w-full rounded-xl bg-[#FFBB00] px-3 font-bold text-[#121212]">
                {waitlistBusy?"Registrando...":"Entrar na lista de espera"}
              </button>
              <button type="button" onClick={scheduleSoon}
                className="min-h-11 w-full rounded-xl border border-white/30 px-3 font-semibold text-white">
                Agendar para daqui a pouco
              </button>
            </div>}
          </div>}
      </div>}
      {serviceType==="AGENDADA"&&<div className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/80">
        <label className="block font-semibold">
          <span className="flex items-center gap-2"><Clock3 size={18} className="text-[#FFBB00]"/> Quando deseja sair?</span>
          <input type="datetime-local" aria-label="Horário da viagem agendada"
            value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}
            min={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/25 bg-[#121212] px-3 text-white [color-scheme:dark]"/>
        </label>
        <p className="text-xs text-white/65">
          Horário selecionado: {scheduledAt?new Date(scheduledAt).toLocaleString("pt-BR"):"a definir"}.
          A confirmação do agendamento estará disponível quando o fluxo operacional for conectado.
        </p>
      </div>}
      {waitlistStatus&&<p role="status" className="text-xs text-[#FFBB00]">{waitlistStatus}</p>}
    </>}

    {snap==="full"&&<div className="space-y-3 border-t border-white/15 pt-4">
      <h3 className="font-[family-name:var(--font-display)] text-base font-bold">Preferências e embarque</h3>
      <label className="flex items-center gap-2 text-sm"><Music2 size={17} className="text-[#FFBB00]"/>
        Música <select value={music} onChange={e=>setMusic(e.target.value)}
          className="ml-auto max-w-[55%] rounded-lg border border-white/20 bg-[#121212] p-2 text-white">
          <option value="SEM_PREFERENCIA">Sem preferência</option>
          <option value="COM_MUSICA">Com música</option>
          <option value="SEM_MUSICA">Sem música</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><MessageCircle size={17} className="text-[#FFBB00]"/>
        Conversa <select value={conversation} onChange={e=>setConversation(e.target.value)}
          className="ml-auto max-w-[55%] rounded-lg border border-white/20 bg-[#121212] p-2 text-white">
          <option value="SEM_PREFERENCIA">Sem preferência</option>
          <option value="CONVERSAR">Gosto de conversar</option>
          <option value="SILENCIO">Prefiro silêncio</option>
        </select>
      </label>
      {gender==="FEMININO"&&<label className="flex min-h-12 items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-[#FFBB00]"/> Carona Mulher</span>
        <input type="checkbox" checked={womenOnly} onChange={e=>setWomenOnly(e.target.checked)}
          className="size-5 accent-[#FFBB00]"/>
      </label>}
      <div className="rounded-xl border border-white/15 p-3 text-sm text-white/70">
        <p className="flex items-center gap-2 font-semibold text-white"><MapPin size={17} className="text-[#FFBB00]"/> Embarque</p>
        <p className="mt-1">Origem: {validPoint(originPoint)?"Localização atual selecionada":"Aguardando localização válida"}</p>
        <p>Destino: {destination||"Selecione um destino"}</p>
        <p className="mt-2 text-xs">Preferências visuais ainda não são enviadas para a solicitação de corrida.</p>
      </div>
    </div>}
  </div>;
}
