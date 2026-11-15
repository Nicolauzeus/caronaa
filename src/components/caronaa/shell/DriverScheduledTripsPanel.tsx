import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, MapPin, MessageCircle, Navigation, UserRound, X } from "lucide-react";
import { getDriverScheduledTrips, driverWhatsappLink, type DriverScheduledTrip } from "@/services/driver-scheduled-service";
import { formatBrl } from "@/lib/ride-cost";

type Props={onClose:()=>void;refreshKey?:number};
const dateLabel=(date:string)=>new Intl.DateTimeFormat("pt-BR",{
  dateStyle:"medium",timeStyle:"short",timeZone:"America/Fortaleza",
}).format(new Date(date));

export function DriverScheduledTripsPanel({onClose,refreshKey=0}:Props){
  const [trips,setTrips]=useState<DriverScheduledTrip[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setTrips(await getDriverScheduledTrips());}
    catch{setError("Não foi possível carregar suas viagens agendadas.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh,refreshKey]);
  useEffect(()=>{
    const visible=()=>{if(!document.hidden)void refresh();};
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    return()=>{window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
  },[refresh]);
  return <section aria-label="Agendados do motorista" className="space-y-4 pb-4 text-white"
    style={{fontFamily:"Manrope, sans-serif"}}>
    <header className="flex items-center justify-between gap-2">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Agendados</h2>
      <button type="button" onClick={onClose} aria-label="Fechar Agendados"
        className="flex size-11 items-center justify-center rounded-xl border border-white/25">
        <X size={20}/>
      </button>
    </header>
    {loading?<p role="status" className="text-sm text-white/65">Carregando viagens...</p>
    :error?<div role="alert" className="space-y-2 text-sm">
      <p>{error}</p>
      <button type="button" onClick={()=>void refresh()}
        className="min-h-11 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">Tentar novamente</button>
    </div>
    :trips.length===0?<p className="rounded-xl border border-white/20 p-4 text-sm text-white/70">
      Você ainda não tem caronas agendadas.
    </p>:<div className="space-y-3">{trips.map(trip=><article key={trip.offerId}
      className="space-y-3 rounded-2xl border border-white/20 bg-white/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><CalendarClock size={17} className="text-[#FFBB00]"/>
        {dateLabel(trip.departureAt)}
      </p>
      <p className="flex items-start gap-2"><MapPin size={16} className="shrink-0 text-[#FFBB00]"/>{trip.origin}</p>
      <p className="flex items-start gap-2"><Navigation size={16} className="shrink-0 text-[#FFBB00]"/>{trip.destination}</p>
      <span className="inline-flex rounded-full bg-[#FFBB00] px-3 py-1 text-xs font-bold text-[#121212]">
        {trip.seatsRemaining} {trip.seatsRemaining===1?"vaga livre":"vagas livres"}
      </span>
      <p className="text-xs text-white/65">Veículo: {trip.vehicleType==="MOTO"?"Moto":"Carro"}</p>
      <h3 className="font-semibold">Passageiros confirmados</h3>
      {trip.passengers.length===0?<p className="text-xs text-white/65">Aguardando confirmação de passageiros.</p>:
        trip.passengers.map(passenger=>{
          const whatsapp=driverWhatsappLink(trip,passenger);
          return <div key={passenger.id} className="space-y-2 rounded-xl border border-white/15 p-3">
            <div className="flex items-center gap-2">
              {passenger.avatarUrl?<img src={passenger.avatarUrl} alt="Foto do passageiro"
                className="size-11 rounded-full object-cover"/>:
                <span className="flex size-11 items-center justify-center rounded-full bg-white/10"><UserRound size={18}/></span>}
              <p className="font-semibold">{passenger.name}</p>
            </div>
            <p className="text-xs text-white/75">Encontro: {passenger.meetingName}</p>
            <p className="text-xs text-[#FFBB00]">Valor acordado: {formatBrl(passenger.agreedFare)}</p>
            {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer"
              aria-label={"Falar no WhatsApp com "+passenger.name}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#167D42] px-3 font-bold text-white">
              <MessageCircle size={18}/> Falar no WhatsApp
            </a>}
          </div>;
        })}
    </article>)}</div>}
    <button type="button" onClick={onClose}
      className="flex min-h-11 items-center gap-2 text-sm text-white/70"><ArrowLeft size={16}/> Voltar ao planejamento</button>
  </section>;
}
