import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { markQuickRideRequestViewed, type RideRequestPassenger } from "@/lib/quick-rides/request-audience";

/**
 * Driver card identity. A view receipt is sent only while the card itself
 * intersects the viewport, not merely because an RPC returned a candidate.
 */
export function QuickRidePassengerIdentity({
  rideId, initialName, initialPhoto, compact = false,
}: {
  rideId:string;initialName?:string|null;initialPhoto?:string|null;compact?:boolean;
}) {
  const element = useRef<HTMLDivElement|null>(null);
  const [passenger,setPassenger]=useState<RideRequestPassenger|null>(null);
  useEffect(()=>{
    let active=true;
    let visible=false;
    let busy=false;
    let lastPing=0;
    const ping=async()=>{
      if(!active||!visible||document.hidden||busy||Date.now()-lastPing<4500)return;
      busy=true;lastPing=Date.now();
      try {
        const result=await markQuickRideRequestViewed(rideId);
        if(active&&result)setPassenger(result);
      } catch {
        // Migration 0214 absent or request no longer eligible: retain safe placeholder.
      } finally { busy=false; }
    };
    const onVisible=()=>{if(!document.hidden)void ping();};
    const observer=typeof IntersectionObserver!=="undefined"
      ?new IntersectionObserver(entries=>{
        visible=Boolean(entries[0]?.isIntersecting);
        if(visible)void ping();
      },{threshold:0.15})
      :null;
    if(observer&&element.current)observer.observe(element.current);
    else {visible=true;void ping();}
    const timer=window.setInterval(()=>void ping(),6000);
    window.addEventListener("focus",onVisible);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      active=false;window.clearInterval(timer);
      observer?.disconnect();
      window.removeEventListener("focus",onVisible);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[rideId]);
  const name=passenger?.name||initialName||"Passageiro CARONAA";
  const photo=passenger?.photo||(initialPhoto?.startsWith("https://")?initialPhoto:null);
  return <div ref={element} className={`flex min-w-0 items-center rounded-2xl border border-white/15 bg-white/[0.06] ${compact ? "gap-2 p-2" : "gap-3 p-3"}`}>
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 ${compact ? "size-9" : "size-12"}`}>
      {photo?<img src={photo} alt="Foto do passageiro" className="size-full object-cover"/>:
        <UserRound size={22} aria-hidden="true" className="text-white/70"/>}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-white/65">Quem está solicitando</p>
      <p className="truncate text-sm font-bold text-white">{name}</p>
      {!compact && <p className="text-[11px] text-white/55">Identidade exibida para avaliação do chamado</p>}
    </div>
  </div>;
}
