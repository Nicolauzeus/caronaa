import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, UserRound } from "lucide-react";
import { getQuickRideRequestAudience, type QuickRideAudience, type RideParticipantSummary } from "@/lib/quick-rides/request-audience";

const empty:QuickRideAudience={watchingCount:0,viewers:[],acceptedDriver:null};

function DriverProfile({driver,confirmed}:{driver:RideParticipantSummary;confirmed:boolean}){
  return <div className="flex min-w-0 items-center gap-3">
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#FFBB00]/70 bg-white/10">
      {driver.photo?<img src={driver.photo} alt={`Foto de ${driver.name}`} className="size-full object-cover"/>:
        <UserRound size={24} className="text-white/70" aria-hidden="true"/>}
    </div>
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="truncate text-base font-extrabold text-white">{driver.name}</p>
      <p className="truncate text-xs text-white/70">
        Motorista cadastrado no CARONAA
      </p>
      {confirmed&&(driver.vehicle||driver.plate)&&
        <p className="truncate text-xs text-white/70">
          {[driver.vehicle,driver.plate].filter(Boolean).join(" · ")}
        </p>}
      <p className="text-[11px] font-semibold text-[#FFBB00]">
        {confirmed?"Aceitou sua solicitação":"Visualizando sua solicitação"}
      </p>
    </div>
  </div>;
}

/** Show real live viewers, not a count of all online drivers or fictitious rotation. */
export function QuickRideSearchActivity({rideId,status,compact=false}:{rideId:string;status:string;compact?:boolean}){
  const [audience,setAudience]=useState<QuickRideAudience>(empty);
  const [failed,setFailed]=useState(false);
  const [index,setIndex]=useState(0);
  const previousRide=useRef(rideId);
  useEffect(()=>{
    let active=true;
    let running=false;
    if(previousRide.current!==rideId){
      previousRide.current=rideId;
      setAudience(empty);setIndex(0);
    }
    setFailed(false);
    const refresh=async()=>{
      if(!active||running||document.hidden)return;
      running=true;
      try{
        const result=await getQuickRideRequestAudience(rideId,status);
        if(active){setAudience(result);setFailed(false);}
      }catch{if(active)setFailed(true);}
      finally{running=false;}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),status==="SEARCHING"?4000:7000);
    const onFocus=()=>void refresh();
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    return()=>{active=false;window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onFocus);};
  },[rideId,status]);
  useEffect(()=>{
    if(status!=="SEARCHING"||audience.viewers.length<2)return;
    const timer=window.setInterval(()=>setIndex(current=>current+1),3100);
    return()=>window.clearInterval(timer);
  },[status,audience.viewers.length]);
  if(failed&&audience.viewers.length===0&&!audience.acceptedDriver)
    return <p role="status" className="text-xs text-white/70">Acompanhamento de visualizações temporariamente indisponível. Seu pedido continua ativo.</p>;

  const searching=status==="SEARCHING";
  const driver=searching ? audience.viewers[index%Math.max(1,audience.viewers.length)] : audience.acceptedDriver;

  if(compact){
    return <div aria-label="Resumo do acompanhamento da corrida"
      className="flex min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.045] p-2">
      {searching?
        <>
          <Eye size={20} className="shrink-0 text-[#FFBB00]" aria-hidden="true"/>
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-white/85">Motoristas visualizando</p>
          <span role="status" className="rounded-full bg-[#FFBB00]/15 px-2.5 py-1 text-sm font-black text-[#FFBB00]">
            {failed?"—":audience.watchingCount}
          </span>
        </>:
        driver?<DriverProfile driver={driver} confirmed/>:
        <p role="status" className="truncate text-xs text-white/70">Confirmando os dados do motorista…</p>}
    </div>;
  }
  return <section aria-label="Acompanhamento da procura por motorista"
    className="mt-3 space-y-3 rounded-2xl border border-white/15 bg-[#121212] p-3 text-white">
    {searching?<div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-xs font-bold text-white/90">
        <Eye size={16} className="text-[#FFBB00]" aria-hidden="true"/>
        Motoristas vendo seu pedido
      </span>
      <span role="status" aria-live="polite" className="rounded-full bg-[#FFBB00]/15 px-2.5 py-1 text-sm font-extrabold text-[#FFBB00]">
        {audience.watchingCount}
      </span>
    </div>:
    <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
      <CheckCircle2 size={18} aria-hidden="true"/> Motorista confirmou sua corrida
    </div>}
    {driver?<div key={driver.id} className="animate-in fade-in duration-500">
      <DriverProfile driver={driver} confirmed={!searching}/>
    </div>:<div className="flex items-center gap-3">
      <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
        {searching?<span className="size-3 animate-pulse rounded-full bg-[#FFBB00]"/>:<UserRound size={20}/>}
      </div>
      <p className="text-xs leading-relaxed text-white/70">
        {searching?"Pedido enviado. Aguardando motoristas abrirem a chamada.":"Motorista confirmado. Atualizando sua identificação…"}
      </p>
    </div>}
    {searching&&audience.viewers.length>1&&
      <div className="flex justify-center gap-1.5" aria-label="Motoristas que estão visualizando">
        {audience.viewers.map((viewer,i)=><span key={viewer.id}
          className={`size-1.5 rounded-full ${i===index%audience.viewers.length?"bg-[#FFBB00]":"bg-white/25"}`}/>)}
      </div>}
    {searching&&<p className="text-[11px] leading-relaxed text-white/50">
      Contador de visualizações ativas, atualizado enquanto os motoristas mantêm o pedido aberto. Fotos exibidas uma por vez.
    </p>}
  </section>;
}
