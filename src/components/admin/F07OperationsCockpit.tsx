import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Bike, CarFront, CheckCircle2, Clock3,
  MapPin, Navigation, Phone, Radio, RefreshCw, Search, ShieldCheck,
  UserRound, Users, X, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMapSurface, type GoogleMapPoint } from "@/components/caronaa/GoogleMapSurface";
import { Button } from "@/components/ui/button";

type RideStatus = "SEARCHING" | "ACCEPTED" | "ARRIVED" | "IN_PROGRESS" |
  "PENDING_REVIEW" | "COMPLETED" | "CANCELLED" | "EXPIRED";
type Ride = {
  id:string; passenger_id?:string; driver_id?:string|null;
  passenger_name:string; passenger_avatar?:string|null; passenger_whatsapp?:string|null;driver_name?:string|null;
  origin_label:string;destination_label:string;vehicle_type:string;status:RideStatus;
  origin_lat?:number;origin_lng?:number;destination_lat?:number;destination_lng?:number;
  municipality?:string;requested_at:string;expires_at?:string;closed_at?:string;
  accepted_at?:string;payment_status?:string|null;
  customer_pays_cents?:number|null;
};
type Driver = {
  user_id:string;display_name:string;vehicle_type:string|null;whatsapp?:string|null;
  connected_recent:boolean;gps_valid:boolean;dispatch_ready:boolean;
  gps_municipality:string|null;gps_sampled_at:string|null;gps_accuracy_m:number|null;
  last_seen_at:string|null;status_code:string;active_ride_id:string|null;
};
type MapDriver={id:string;lat:number;lng:number;seen_at:string;vehicle_type:string;
  in_trip:boolean;ready:boolean};
type LiveData={
  generated_at:string;
  kpis:{waiting:number;ready_drivers:number;in_progress:number;
    critical:number;completed_today:number};
  passenger_demand?:{preparing:number;waiting:number};
  waiting:Ride[];active:Ride[];recent:Ride[];
  drivers:Driver[];map_drivers:MapDriver[];
};

const stateLabel:Record<string,string>={
  SEARCHING:"Aguardando motorista",ACCEPTED:"Motorista a caminho",
  ARRIVED:"Motorista chegou",IN_PROGRESS:"Em viagem",PENDING_REVIEW:"Em revisão",
  COMPLETED:"Concluída",CANCELLED:"Cancelada",EXPIRED:"Expirada",
};
const statusTone:Record<string,string>={
  SEARCHING:"bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  ACCEPTED:"bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200",
  ARRIVED:"bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200",
  IN_PROGRESS:"bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200",
  PENDING_REVIEW:"bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200",
  COMPLETED:"bg-green-100 text-green-900 dark:bg-green-500/15 dark:text-green-200",
  CANCELLED:"bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  EXPIRED:"bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};
const currency=(cents:number|null|undefined)=>
  cents==null||!Number.isFinite(cents)?"Valor não informado":
    new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
const time=(value:string|null|undefined)=>{
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Fortaleza"});
};
const dateTime=(value:string|null|undefined)=>{
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleString("pt-BR",{timeZone:"America/Fortaleza"});
};
const elapsed=(value:string|undefined,now:number)=>{
  if(!value)return "—";
  const then=Date.parse(value);
  if(!Number.isFinite(then))return "—";
  const diff=Math.max(0,Math.floor((now-then)/60000));
  return diff<60?diff+" min":Math.floor(diff/60)+"h "+String(diff%60).padStart(2,"0")+"m";
};
const validCoordinate=(lat?:number,lng?:number)=>
  typeof lat==="number"&&typeof lng==="number"&&Number.isFinite(lat)&&
  Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
const distanceKm=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{
  const rad=Math.PI/180;
  const dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad;
  const value=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(value)));
};

const cardShell="rounded-2xl border bg-card shadow-sm dark:bg-[#11161D] dark:border-white/10";
type MetricProps={label:string;value:number|undefined;hint:string;icon:LucideIcon;
  tone:"amber"|"green"|"blue"|"red";onClick:()=>void};
function Metric({label,value,hint,icon:Icon,tone,onClick}:MetricProps){
  const tones={
    amber:"border-amber-300 bg-amber-50/80 dark:border-amber-500/60 dark:bg-amber-500/10",
    green:"border-green-300 bg-green-50/80 dark:border-green-600/70 dark:bg-green-500/10",
    blue:"border-blue-300 bg-blue-50/80 dark:border-blue-600/70 dark:bg-blue-500/10",
    red:"border-red-300 bg-red-50/80 dark:border-red-600/70 dark:bg-red-500/10",
  };
  const icons={amber:"text-amber-700 dark:text-amber-300",green:"text-green-700 dark:text-green-300",
    blue:"text-blue-700 dark:text-blue-300",red:"text-red-700 dark:text-red-300"};
  return <button type="button" onClick={onClick}
    className={"flex min-h-[110px] items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] dark:hover:brightness-125 sm:p-4 "+tones[tone]}>
    <Icon size={28} className={"shrink-0 "+icons[tone]} aria-hidden="true"/>
    <span className="min-w-0">
      <span className="block text-xs font-semibold leading-tight text-foreground sm:text-sm">{label}</span>
      <span className="mt-1 block font-[Sora] text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">{value==null?"—":value.toLocaleString("pt-BR")}</span>
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </span>
  </button>;
}
function Status({status}:{status:string}){
  return <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold "+(statusTone[status]??"bg-muted text-muted-foreground")}>
    {stateLabel[status]??status}
  </span>;
}
function DetailPanel({ride,onFollow,onManage,onClose,now}:{
  ride:Ride|null;onFollow:()=>void;onManage:()=>void;onClose?:()=>void;now:number;
}){
  return <section className={"flex h-full min-w-0 flex-col gap-3 p-3 sm:p-4 "+cardShell}
    aria-label="Detalhes da solicitação">
    <header className="flex items-center justify-between gap-2 border-b border-border pb-3 dark:border-white/10">
      <h3 className="text-base font-bold">Detalhes da solicitação</h3>
      {onClose&&<button aria-label="Fechar detalhes" onClick={onClose} type="button"
        className="rounded-lg p-2 hover:bg-muted"><X size={18}/></button>}
    </header>
    {!ride?<div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
      <UserRound size={26} className="text-muted-foreground"/>
      <p className="text-sm font-medium">Selecione um pedido</p>
      <p className="text-xs text-muted-foreground">Os detalhes aparecerão aqui, sem sair do mapa.</p>
    </div>:<>
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 font-bold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
          {ride.passenger_avatar?<img src={ride.passenger_avatar} alt="" loading="lazy" className="size-full object-cover"/>:
            (ride.passenger_name?.trim()?.[0]??"P").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">{ride.passenger_name}</p>
          <p className="text-xs text-muted-foreground">Passageiro · #{ride.id.slice(0,8)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 p-2.5 dark:bg-white/5">
        <Status status={ride.status}/>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={14}/>{elapsed(ride.requested_at,now)}</span>
      </div>
      <dl className="space-y-3 py-2 text-sm">
        <div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          <MapPin size={17} className="text-green-600 dark:text-green-400"/><dt className="text-muted-foreground">Origem</dt>
          <dd className="break-words font-medium">{ride.origin_label}</dd>
        </div>
        <div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          <MapPin size={17} className="text-red-600 dark:text-red-400"/><dt className="text-muted-foreground">Destino</dt>
          <dd className="break-words font-medium">{ride.destination_label}</dd>
        </div>
        <div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          {ride.vehicle_type==="MOTO"?<Bike size={17}/>:<CarFront size={17}/>}
          <dt className="text-muted-foreground">Veículo</dt><dd>{ride.vehicle_type==="MOTO"?"Moto":"Carro"}</dd>
        </div>
        <div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          <ShieldCheck size={17}/><dt className="text-muted-foreground">Preço</dt>
          <dd className="font-semibold">{currency(ride.customer_pays_cents)}</dd>
        </div>
        <div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          <Clock3 size={17}/><dt className="text-muted-foreground">Criado</dt>
          <dd>{dateTime(ride.requested_at)}</dd>
        </div>
        {ride.driver_name&&<div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          <CarFront size={17}/><dt className="text-muted-foreground">Motorista</dt>
          <dd className="font-medium">{ride.driver_name}</dd>
        </div>}
        {ride.payment_status&&<div className="grid grid-cols-[22px_68px_minmax(0,1fr)] items-start gap-2">
          <ShieldCheck size={17}/><dt className="text-muted-foreground">Pagamento</dt>
          <dd>{ride.payment_status}</dd>
        </div>}
      </dl>
      <div className="mt-auto space-y-2 pt-3">
        <Button type="button" onClick={onFollow} className="min-h-11 w-full bg-[#FFBB00] font-bold text-[#121212] hover:bg-[#E6A800]">
          <Navigation size={16} className="mr-2"/> Acompanhar no mapa
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {ride.passenger_whatsapp?<Button asChild variant="outline" className="min-h-11 px-2 text-xs">
            <a href={"https://wa.me/"+ride.passenger_whatsapp.replace(/[^0-9]/g,"")}
              target="_blank" rel="noopener noreferrer"><Phone size={14} className="mr-1"/> Contatar</a>
          </Button>:<span className="flex min-h-11 items-center justify-center rounded-lg border px-2 text-center text-xs text-muted-foreground">
            Sem contato autorizado
          </span>}
          <Button variant="outline" onClick={onManage} className="min-h-11 px-2 text-xs">Gerenciar <ArrowRight size={14} className="ml-1"/></Button>
        </div>
      </div>
    </>}
  </section>;
}

export function F07OperationsCockpit({onOpenTools}:{onOpenTools:()=>void}){
  const [data,setData]=useState<LiveData|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [offline,setOffline]=useState(false);
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [mobileDetails,setMobileDetails]=useState(false);
  const [queueTab,setQueueTab]=useState<"waiting"|"active">("waiting");
  const [mapTab,setMapTab]=useState<"live"|"tracking">("live");
  const [now,setNow]=useState(Date.now());
  const [focusKey,setFocusKey]=useState<string|undefined>();
  const mapArea=useRef<HTMLDivElement>(null);
  const queueArea=useRef<HTMLDivElement>(null);
  const activeVersion=useRef(0);
  const inFlight=useRef(false);
  const alive=useRef(true);

  const reload=useCallback(async()=>{
    if(typeof navigator!=="undefined"&&!navigator.onLine){setOffline(true);return;}
    if(inFlight.current)return;
    inFlight.current=true;
    const version=++activeVersion.current;
    let timeout:ReturnType<typeof setTimeout>|undefined;
    setRefreshing(true);
    try{
      const outcome=await Promise.race([
        (supabase as any).rpc("admin_f07_cockpit_live"),
        new Promise<{error:Error;data:null}>(resolve=>{
          timeout=setTimeout(()=>resolve({error:new Error("A consulta excedeu 10 segundos"),data:null}),10000);
        }),
      ]);
      if(!alive.current||version!==activeVersion.current)return;
      if(outcome.error||!outcome.data||!Array.isArray(outcome.data.waiting)||
         !Array.isArray(outcome.data.active)||!Array.isArray(outcome.data.recent)||
         !Array.isArray(outcome.data.map_drivers)||!outcome.data.kpis)
        throw outcome.error??new Error("Resposta operacional inválida");
      setData(outcome.data as LiveData);
      setError("");setOffline(false);
    }catch(cause){
      if(alive.current&&version===activeVersion.current)
        setError(cause instanceof Error?cause.message:"Não foi possível sincronizar a central");
    }finally{
      if(timeout)clearTimeout(timeout);
      inFlight.current=false;
      if(alive.current&&version===activeVersion.current){setLoading(false);setRefreshing(false);}
    }
  },[]);

  useEffect(()=>{
    alive.current=true;
    setOffline(!navigator.onLine);
    void reload();
    const interval=window.setInterval(()=>{
      setNow(Date.now());
      if(document.visibilityState==="visible")void reload();
    },10000);
    const wake=()=>{setNow(Date.now());if(!document.hidden)void reload();};
    const disconnected=()=>setOffline(true);
    window.addEventListener("online",wake);
    window.addEventListener("offline",disconnected);
    window.addEventListener("focus",wake);
    document.addEventListener("visibilitychange",wake);
    return()=>{
      alive.current=false;activeVersion.current++;
      window.clearInterval(interval);
      window.removeEventListener("online",wake);
      window.removeEventListener("offline",disconnected);
      window.removeEventListener("focus",wake);
      document.removeEventListener("visibilitychange",wake);
    };
  },[reload]);

  const current=[...(data?.waiting??[]),...(data?.active??[])];
  const selected=current.find(ride=>ride.id===selectedId)??current[0]??null;
  const search=query.toLocaleLowerCase("pt-BR").trim();
  const matches=(ride:Ride)=>!search||[ride.id,ride.passenger_name,ride.driver_name,
    ride.origin_label,ride.destination_label,ride.municipality].some(x=>
      String(x??"").toLocaleLowerCase("pt-BR").includes(search));
  const visibleWaiting=(data?.waiting??[]).filter(matches);
  const visibleActive=(data?.active??[]).filter(matches);
  const list=queueTab==="waiting"?visibleWaiting:visibleActive;
  const points=useMemo(()=>{
    const focus=selected?.id===focusKey?selected:null;
    const drivers=(data?.map_drivers??[])
      .filter(driver=>validCoordinate(driver.lat,driver.lng))
      .filter(driver=>mapTab==="live"||driver.in_trip)
      .filter(driver=>!focus||!validCoordinate(focus.origin_lat,focus.origin_lng)||
        driver.id===focus.driver_id||
        distanceKm({lat:driver.lat,lng:driver.lng},{lat:focus.origin_lat!,lng:focus.origin_lng!})<=15)
      .map((driver):GoogleMapPoint=>({
        id:"driver:"+driver.id,lat:driver.lat,lng:driver.lng,
        kind:driver.in_trip?(driver.vehicle_type==="MOTO"?"adminInTripMoto":"adminInTripCar"):
          driver.vehicle_type==="MOTO"?"adminAvailableMoto":"adminAvailableCar",
        title:driver.in_trip?"Motorista em viagem":"Motorista conectado",
      }));
    const requests=mapTab==="tracking"?[]:(data?.waiting??[])
      .filter(ride=>validCoordinate(ride.origin_lat,ride.origin_lng))
      .filter(ride=>!focus||ride.id===focus.id)
      .map((ride):GoogleMapPoint=>({
        id:"request:"+ride.id,lat:ride.origin_lat!,lng:ride.origin_lng!,
        kind:"adminWaitingPassenger",title:"Pedido aguardando · "+ride.passenger_name,
      }));
    if(selected&&validCoordinate(selected.origin_lat,selected.origin_lng)
        &&!requests.some(point=>point.id==="request:"+selected.id)){
      requests.push({id:"selected:"+selected.id,lat:selected.origin_lat!,lng:selected.origin_lng!,
        kind:"origin",title:"Embarque · "+selected.passenger_name});
    }
    return [...drivers,...requests];
  },[data?.map_drivers,data?.waiting,mapTab,focusKey,selected?.id,selected?.driver_id,selected?.origin_lat,selected?.origin_lng]);
  const choose=(ride:Ride)=>{
    setSelectedId(ride.id);setMobileDetails(true);
  };
  const follow=()=>{
    setMapTab("live");
    if(selected)setFocusKey(selected.id);
    setMobileDetails(false);
    mapArea.current?.scrollIntoView({behavior:"smooth",block:"center"});
  };
  const kpis=data?.kpis;

  return <section className="min-w-0 space-y-4 rounded-2xl bg-background text-foreground dark:bg-[#0B0F14] md:space-y-5"
    data-testid="operations-cockpit">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-[Sora] text-2xl font-extrabold tracking-tight sm:text-3xl">Centro de Operações</h1>
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFBB00] px-2 py-1 text-[11px] font-extrabold text-[#121212]">
            <Radio size={12}/> LIVE
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Demanda, motoristas e corridas em um só lugar.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <span className={"size-2 rounded-full "+(offline||error?"bg-amber-500":"bg-green-500")}/>
          {offline?"Sem conexão":error?"Dados anteriores":refreshing?"Sincronizando…":"Atualizado "+time(data?.generated_at)}
        </p>
        <Button variant="outline" size="sm" onClick={()=>void reload()} disabled={refreshing||offline}
          className="min-h-10 rounded-xl">
          <RefreshCw size={15} className={"mr-2 "+(refreshing?"animate-spin":"")}/>Atualizar
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenTools} className="min-h-10 rounded-xl">
          Ferramentas <ArrowRight size={14} className="ml-1"/>
        </Button>
      </div>
    </header>
    <label className="relative block max-w-xl">
      <span className="sr-only">Buscar passageiro, motorista ou corrida</span>
      <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
      <input className="min-h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00] dark:border-white/15 dark:bg-[#11161D]"
        placeholder="Buscar passageiro, motorista, corrida..." value={query}
        onChange={event=>setQuery(event.target.value)}/>
    </label>
    {error&&<div role="alert" className="rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      {error}. {data?"Os últimos dados confirmados permanecem visíveis.":"Confira a migration 0230 e a conexão com o servidor."}
    </div>}
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3" aria-label="Indicadores operacionais">
      <Metric label="Passageiros aguardando" value={kpis?.waiting} hint="Pedidos ainda sem aceite" icon={Users}
        tone="amber" onClick={()=>{setQueueTab("waiting");queueArea.current?.scrollIntoView({behavior:"smooth",block:"start"});}}/>
      <Metric label="Motoristas aptos" value={kpis?.ready_drivers} hint="Online e com GPS válido" icon={ShieldCheck}
        tone="green" onClick={()=>{setFocusKey(undefined);setMapTab("live");mapArea.current?.scrollIntoView({behavior:"smooth",block:"center"});}}/>
      <Metric label="Corridas em andamento" value={kpis?.in_progress} hint="Viagens já iniciadas" icon={Navigation}
        tone="blue" onClick={()=>{setFocusKey(undefined);setQueueTab("active");setMapTab("tracking");queueArea.current?.scrollIntoView({behavior:"smooth",block:"start"});}}/>
      <Metric label="Situações críticas" value={kpis?.critical} hint={kpis?.critical?"Precisam de análise":"Nenhuma intervenção aberta"}
        icon={AlertTriangle} tone="red" onClick={onOpenTools}/>
    </div>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(270px,0.85fr)]">
      <section ref={queueArea} className={cardShell+" min-w-0 overflow-hidden p-3 sm:p-4"}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-[Sora] text-base font-bold">Pedidos em espera ({data?.kpis.waiting??"—"})</h2>
            <p className="text-xs text-muted-foreground">Solicitações ainda sem motorista.</p>
          </div>
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs dark:border-white/10" role="group" aria-label="Filtrar solicitações">
            <button type="button" aria-pressed={queueTab==="waiting"}
              onClick={()=>setQueueTab("waiting")} className={"min-h-9 rounded-md px-2.5 font-semibold "+(queueTab==="waiting"?"bg-[#FFBB00] text-[#121212]":"text-muted-foreground")}>Espera</button>
            <button type="button" aria-pressed={queueTab==="active"}
              onClick={()=>setQueueTab("active")} className={"min-h-9 rounded-md px-2.5 font-semibold "+(queueTab==="active"?"bg-[#FFBB00] text-[#121212]":"text-muted-foreground")}>Em curso</button>
          </div>
        </div>
        <div className="space-y-2 xl:max-h-[365px] xl:overflow-y-auto xl:pr-1">
          {list.map(ride=><button key={ride.id} type="button"
            onClick={()=>choose(ride)} aria-current={selected?.id===ride.id?"true":undefined}
            className={"grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2.5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[#FFBB00] "+
              (selected?.id===ride.id?"border-[#FFBB00] bg-amber-50 dark:bg-[#FFBB00]/10":"border-border bg-background hover:bg-muted/50 dark:border-white/10 dark:bg-[#161C24] dark:hover:bg-white/10")}>
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted font-extrabold text-foreground">
              {ride.passenger_avatar?<img src={ride.passenger_avatar} alt="" loading="lazy" className="size-full object-cover"/>:
                ride.passenger_name.trim().slice(0,1).toUpperCase()||"P"}
            </span>
            <span className="min-w-0 space-y-1">
              <span className="block truncate text-sm font-bold">{ride.passenger_name}</span>
              <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin size={11} className="shrink-0 text-green-600"/> {ride.origin_label}
              </span>
              <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin size={11} className="shrink-0 text-red-600"/> {ride.destination_label}
              </span>
            </span>
            <span className="self-start whitespace-nowrap rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              {elapsed(ride.requested_at,now)}
            </span>
          </button>)}
          {list.length===0&&<div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl bg-muted/20 px-3 text-center">
            <CheckCircle2 size={25} className="text-muted-foreground"/>
            <p className="text-sm font-semibold">{query?"Nenhum resultado encontrado":queueTab==="waiting"?"Nenhum pedido aguardando":"Nenhuma corrida em aberto"}</p>
            <p className="text-xs text-muted-foreground">{queueTab==="waiting"?"Novos pedidos aparecerão automaticamente.":"Acompanhe as corridas no mapa."}</p>
          </div>}
        </div>
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground dark:border-white/10">
          {(data?.passenger_demand?.preparing??0).toLocaleString("pt-BR")} preparando pedido · Atualização a cada 10 segundos
        </p>
      </section>

      <section ref={mapArea} className={cardShell+" min-w-0 overflow-hidden"} aria-label="Mapa operacional">
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-3">
          <div className="inline-flex rounded-full border border-border p-0.5 text-xs dark:border-white/10" role="group" aria-label="Modo do mapa">
            <button type="button" aria-pressed={mapTab==="live"} onClick={()=>{setFocusKey(undefined);setMapTab("live");}}
              className={"min-h-9 rounded-full px-3 font-bold "+(mapTab==="live"?"bg-[#FFBB00] text-[#121212]":"text-muted-foreground")}>Mapa em tempo real</button>
            <button type="button" aria-pressed={mapTab==="tracking"} onClick={()=>{setFocusKey(undefined);setMapTab("tracking");}}
              className={"min-h-9 rounded-full px-3 font-bold "+(mapTab==="tracking"?"bg-[#FFBB00] text-[#121212]":"text-muted-foreground")}>Rastreamento</button>
          </div>
          <span className="text-xs text-muted-foreground">{time(data?.generated_at)}</span>
        </div>
        {points.length>0?
          <GoogleMapSurface className="h-[300px] w-full sm:h-[360px] xl:h-[390px]"
            ariaLabel="Mapa de motoristas e solicitações CARONAA"
            points={points} showControls smoothTracking onRefresh={reload}
            appearance="adaptive" fitMode="once"
            fitKey={(focusKey??"f07-initial")+":"+mapTab} gestureHandling="cooperative"/>:
          <div className="flex h-[300px] flex-col items-center justify-center gap-3 bg-muted/20 px-5 text-center sm:h-[360px] xl:h-[390px]">
            <MapPin size={30} className="text-muted-foreground"/>
            <p className="text-sm font-semibold">{loading?"Preparando mapa…":"Nenhuma localização operacional recente"}</p>
            <p className="max-w-xs text-xs text-muted-foreground">O mapa mostrará somente posições válidas, sem criar marcadores fictícios.</p>
          </div>}
        <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-border p-3 text-xs dark:border-white/10">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-green-500"/>Motoristas aptos ({kpis?.ready_drivers??"—"})</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500"/>Em atendimento no mapa ({data?.map_drivers.filter(driver=>driver.in_trip).length??"—"})</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500"/>Em espera ({kpis?.waiting??"—"})</span>
        </div>
      </section>

      <div className="hidden min-w-0 xl:block" aria-label="Painel lateral de detalhes">
        <DetailPanel ride={selected} now={now} onFollow={follow} onManage={onOpenTools}/>
      </div>
    </div>

    <section className={cardShell+" min-w-0 overflow-hidden"} aria-label="Histórico recente">
      <header className="flex items-center justify-between gap-3 border-b border-border p-3 dark:border-white/10 sm:p-4">
        <div>
          <h2 className="font-[Sora] text-base font-bold">Últimas corridas</h2>
          <p className="text-xs text-muted-foreground">{kpis?.completed_today??"—"} concluída(s) hoje · Horário de Fortaleza</p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenTools}>Ver histórico completo <ArrowRight size={14} className="ml-1"/></Button>
      </header>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground dark:bg-white/5">
            <tr>{["Hora","Passageiro","Motorista","Trajeto","Valor","Status"].map(label=>
              <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-white/10">
            {(data?.recent??[]).map(ride=><tr key={ride.id} className="hover:bg-muted/30">
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{time(ride.closed_at)}</td>
              <td className="max-w-[140px] truncate px-3 py-3" title={ride.passenger_name}>{ride.passenger_name}</td>
              <td className="max-w-[140px] truncate px-3 py-3" title={ride.driver_name??""}>{ride.driver_name??"—"}</td>
              <td className="max-w-[240px] truncate px-3 py-3" title={ride.origin_label+" → "+ride.destination_label}>
                {ride.origin_label} → {ride.destination_label}
              </td>
              <td className="whitespace-nowrap px-3 py-3">{currency(ride.customer_pays_cents)}</td>
              <td className="px-3 py-3"><Status status={ride.status}/></td>
            </tr>)}
            {data&&!data.recent.length&&<tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Nenhuma corrida concluída ou cancelada no histórico recente.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    {mobileDetails&&selected&&<div className="fixed inset-0 z-[120] flex items-end bg-black/55 p-2 xl:hidden sm:items-center sm:justify-center"
      onClick={event=>{if(event.target===event.currentTarget)setMobileDetails(false);}}>
      <div role="dialog" aria-modal="true" aria-label="Detalhes da solicitação"
        className="max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-background sm:max-w-lg">
        <DetailPanel ride={selected} now={now} onFollow={follow} onManage={onOpenTools}
          onClose={()=>setMobileDetails(false)}/>
      </div>
    </div>}
  </section>;
}
