import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bike, CarFront, Clock3, MapPin, ShieldCheck, Users } from "lucide-react";
import type { FormLocationDetails } from "@/lib/location/types";
import { supabase } from "@/integrations/supabase/client";
import {
  getQuickRideCoverage,
  getQuickRideFarePreview,
  registerQuickRideRegionInterest,
  submitQuotedQuickRide,
  type QuickRideCoverage,
  type QuickRideFarePreview,
} from "@/lib/quick-rides/quick-ride.functions";
import { formatBrl } from "@/lib/ride-cost";
import { QuickRidePixCard } from "./QuickRidePixCard";

type QuickVehicle = "CAR" | "MOTO";
type RideStatus = "SEARCHING"|"ACCEPTED"|"ARRIVED"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED"|"EXPIRED";
type ExistingQuickRide = {id:string;role:string;status:RideStatus;vehicle_type:string;municipality:string};

export function QuickRideHomePanel({
  origin, destination, originPoint, destinationPoint, vehicle, onVehicleChange,
  driverCount, driverLoading=false, driverError="", gpsOriginIsImprecise=false,
  onCoverage,
}: {
  origin:string;destination:string;
  originPoint?:FormLocationDetails;destinationPoint?:FormLocationDetails;
  vehicle:QuickVehicle;onVehicleChange:(value:QuickVehicle)=>void;
  driverCount:number;driverLoading?:boolean;driverError?:string;
  gpsOriginIsImprecise?:boolean;
  onCoverage?:(coverage:QuickRideCoverage|null)=>void;
}) {
  const availabilityFn=useServerFn(getQuickRideCoverage);
  const previewFn=useServerFn(getQuickRideFarePreview);
  const submitFn=useServerFn(submitQuotedQuickRide);
  const interestFn=useServerFn(registerQuickRideRegionInterest);
  const [coverage,setCoverage]=useState<QuickRideCoverage|null>(null);
  const [coverageLoading,setCoverageLoading]=useState(false);
  const [quote,setQuote]=useState<QuickRideFarePreview|null>(null);
  const [busy,setBusy]=useState(false);
  const [quoteLoading,setQuoteLoading]=useState(false);
  const [quoteRefresh,setQuoteRefresh]=useState(0);
  const [coverageResolvedKey,setCoverageResolvedKey]=useState("");
  const [error,setError]=useState("");
  const [interestSent,setInterestSent]=useState(false);
  const [rides,setRides]=useState<ExistingQuickRide[]>([]);
  const mounted=useRef(true);
  const originLat=originPoint?.lat, originLng=originPoint?.lng;
  const destinationLat=destinationPoint?.lat, destinationLng=destinationPoint?.lng;
  const hasOrigin=Number.isFinite(originLat)&&Number.isFinite(originLng)&&!gpsOriginIsImprecise;
  const hasDestination=Number.isFinite(destinationLat)&&Number.isFinite(destinationLng);
  // The quote follows the selected itinerary, not every radar refresh.
  const fieldsKey=JSON.stringify([origin,originLat,originLng,destination,destinationLat,destinationLng,vehicle]);
  const coveragePointKey=JSON.stringify([originLat,originLng,vehicle,gpsOriginIsImprecise]);
  const [currentQuoteKey,setCurrentQuoteKey]=useState("");
  const currentQuote=currentQuoteKey===fieldsKey?quote:null;
  const liveRide=rides.find(r=>r.role==="PASSENGER"&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(r.status));
  const completedRide=rides.find(r=>r.role==="PASSENGER"&&r.status==="COMPLETED");
  // A coverage result only applies to the coordinates and vehicle that produced it.
  const covered=coverage?.status==="ENABLED"&&coverageResolvedKey===coveragePointKey;

  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  useEffect(()=>{
    setQuote(null);setCurrentQuoteKey("");setInterestSent(false);setError("");
  },[fieldsKey]);
  useEffect(()=>{
    setCoverage(null);setCoverageResolvedKey("");onCoverage?.(null);setCoverageLoading(false);
    if(!hasOrigin||originLat==null||originLng==null)return;
    let active=true;
    setCoverageLoading(true);
    const timer=window.setTimeout(()=>{
      void availabilityFn({data:{lat:originLat,lng:originLng,vehicleType:vehicle}})
        .then(value=>{if(active){setCoverage(value);setCoverageResolvedKey(coveragePointKey);onCoverage?.(value);}})
        .catch(()=>{if(active){setError("Não foi possível verificar a cobertura agora.");}})
        .finally(()=>{if(active)setCoverageLoading(false);});
    },450);
    return ()=>{active=false;window.clearTimeout(timer);};
  // Only rerun when the selected origin/vehicle changes, not on live GPS pulses.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[originLat,originLng,vehicle,gpsOriginIsImprecise]);
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      const {data,error}=await (supabase as any).rpc("quick_ride_my_requests");
      if(alive&&!error)setRides(Array.isArray(data)?data:[]);
    };
    void refresh();
    const interval=window.setInterval(refresh,12000);
    return ()=>{alive=false;window.clearInterval(interval);};
  },[]);
  // No separate "Calcular preço" step: selecting a valid destination
  // automatically requests the immutable server quote. Debounce limits
  // repeated Google Routes calls while the user edits the address.
  useEffect(()=>{
    if(!covered||!hasOrigin||!hasDestination||!originPoint||!destinationPoint||
       origin.trim().length<3||destination.trim().length<3||liveRide||
       originLat==null||originLng==null||destinationLat==null||destinationLng==null){
      setQuoteLoading(false);
      return;
    }
    let active=true;
    const timer=window.setTimeout(()=>{
      if(!active)return;
      setQuoteLoading(true);setError("");
      void previewFn({data:{
        origin:{lat:originLat,lng:originLng},
        destination:{lat:destinationLat,lng:destinationLng},
        originLabel:origin,destinationLabel:destination,vehicleType:vehicle,
      }})
        .then(result=>{if(active){setQuote(result);setCurrentQuoteKey(fieldsKey);}})
        .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Cotação indisponível.");})
        .finally(()=>{if(active)setQuoteLoading(false);});
    },800);
    return ()=>{active=false;window.clearTimeout(timer);};
    // fieldsKey captures the labels, coordinates and vehicle; covered is
    // associated with the same origin/vehicle. Ignore stale responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[fieldsKey,covered,liveRide?.id,quoteRefresh]);
  async function request() {
    if(busy||quoteLoading||driverLoading||driverCount<1||Boolean(driverError)||
       !currentQuote||Date.parse(currentQuote.expiresAt)<=Date.now())return;
    setBusy(true);setError("");
    try{
      await submitFn({data:{quoteId:currentQuote.quoteId}});
      const {data}=await (supabase as any).rpc("quick_ride_my_requests");
      if(mounted.current){
        setRides(Array.isArray(data)?data:[]);
        setQuote(null);setCurrentQuoteKey("");
      }
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Pedido indisponível.");}
    finally{if(mounted.current)setBusy(false);}
  }
  async function registerInterest(){
    if(!coverage?.municipality||busy)return;
    setBusy(true);setError("");
    try{
      await interestFn({data:{municipality:coverage.municipality,vehicleType:vehicle}});
      if(mounted.current)setInterestSent(true);
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Não foi possível registrar o interesse.");}
    finally{if(mounted.current)setBusy(false);}
  }
  async function rideAction(action:"CANCELLED"|"CONFIRM_PICKUP"){
    if(!liveRide||busy)return;
    setBusy(true);setError("");
    try{
      const {error:rpcError}=action==="CANCELLED"
        ?await (supabase as any).rpc("quick_ride_transition",{p_id:liveRide.id,p_status:"CANCELLED"})
        :await (supabase as any).rpc("quick_ride_confirm_pickup",{p_id:liveRide.id});
      if(rpcError)throw new Error("Não foi possível atualizar a corrida.");
      const {data}=await (supabase as any).rpc("quick_ride_my_requests");
      if(mounted.current)setRides(Array.isArray(data)?data:[]);
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Não foi possível atualizar.");}
    finally{if(mounted.current)setBusy(false);}
  }
  const inactiveText=coverage?.status==="OUTSIDE"
    ?"Ainda não atendemos embarques nesse município."
    :coverage?.status==="WAITLIST"
      ?(coverage?.radar===true
         ?"Radar de motoristas em homologação nesta zona. Corridas pagas aguardam tarifa e autorização operacional."
         :"Este município está no nosso plano de expansão, mas a Corrida Rápida ainda não foi habilitada.")
      :coverage?.status==="UNKNOWN"
        ?"Não foi possível identificar o município do embarque."
        :"Informe um ponto de saída verificado para consultar a cobertura.";
  return (
    <section aria-label="Corrida Rápida no mapa" className="min-w-0 w-full max-w-full space-y-3 overflow-x-hidden rounded-2xl border border-[#FFBB00]/25 bg-white/[0.04] p-3 text-white">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#FFBB00]">Viajar agora</p>
          <p className="text-xs text-gray-300">Mesmo mapa, embarque no local escolhido, sem troca de página.</p>
        </div>
        <ShieldCheck size={20} className="shrink-0 text-[#FFBB00]" aria-label="Motoristas autorizados pela plataforma"/>
      </div>
      <div className="grid grid-cols-2 gap-2" aria-label="Escolher tipo de corrida rápida">
        {(["CAR","MOTO"] as const).map(mode=>(
          <button key={mode} type="button" aria-pressed={vehicle===mode} onClick={()=>onVehicleChange(mode)}
            className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors "+
              (vehicle===mode?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-white/20 bg-white/5 text-white")}>
            {mode==="CAR"?<CarFront size={18}/>:<Bike size={18}/>}
            {mode==="CAR"?"Carro":"Moto"}
          </button>
        ))}
      </div>
      <div className="min-w-0 rounded-xl border border-white/10 bg-[#121212]/70 p-3 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-2 font-semibold">
          <Users size={16} className="text-[#FFBB00]"/>
          <span>Profissionais disponíveis na região</span>
        </div>
        <p role="status" className="mt-1 text-gray-300">
          {driverLoading?"Consultando o radar…":
            driverError?driverError:
            coverage?.radar===false?"Radar ainda indisponível nesse município.":
            driverCount===0?"Nenhum profissional autorizado e online no momento.":
            driverCount===1?"1 profissional autorizado e online.":" "+driverCount+" profissionais autorizados e online."}
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          Radar com posições aproximadas de profissionais aprovados. A presença no mapa não significa disponibilidade para corrida comercial; o despacho exige habilitação separada.
        </p>
      </div>
      {!hasOrigin&&<p role="status" className="rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3 text-xs">
        {gpsOriginIsImprecise?"GPS impreciso. Escolha sua saída manualmente para consultar a corrida.":"Escolha uma saída com coordenadas verificadas."}
      </p>}
      {hasOrigin&&coverageLoading&&<p role="status" className="text-xs text-gray-300">Verificando cobertura a partir do embarque…</p>}
      {hasOrigin&&!coverageLoading&&!covered&&(
        <div className="min-w-0 break-words rounded-xl border border-white/20 bg-white/5 p-3 text-xs">
          <p className="font-semibold">{coverage?.municipality??"Região não identificada"}</p>
          <p className="mt-1 text-gray-300">{inactiveText}</p>
          {coverage?.municipality&&(
            <button type="button" disabled={busy||interestSent} onClick={()=>void registerInterest()}
              className="mt-2 min-h-11 rounded-xl border border-[#FFBB00]/40 px-3 font-bold text-[#FFBB00] disabled:opacity-60">
              {interestSent?"Interesse registrado":"Avise-me quando chegar aqui"}
            </button>
          )}
          <p className="mt-2 text-gray-400">Você pode escolher outra saída numa região habilitada. A região do seu cadastro não limita os pedidos.</p>
        </div>
      )}
      {liveRide?(
        <div className="rounded-xl border border-[#FFBB00]/30 p-3 text-sm">
          <p className="font-semibold">Sua Corrida Rápida</p>
          <p role="status" className="mt-1 text-gray-300">
            {liveRide.status==="SEARCHING"?"Procurando um profissional autorizado…":
              liveRide.status==="ACCEPTED"?"Motorista confirmou sua corrida.":
              liveRide.status==="ARRIVED"?"Motorista informou chegada ao ponto.":
              "Viagem em andamento."}
          </p>
          <div className="flex min-w-0 flex-wrap gap-2">
          {liveRide.status==="ARRIVED"&&(
            <button type="button" disabled={busy} onClick={()=>void rideAction("CONFIRM_PICKUP")}
              className="mt-2 min-h-11 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]">
              Confirmar embarque
            </button>
          )}
          {["SEARCHING","ACCEPTED","ARRIVED"].includes(liveRide.status)&&(
            <button type="button" disabled={busy} onClick={()=>void rideAction("CANCELLED")}
              className="min-h-11 min-w-0 rounded-xl border border-white/30 px-3 text-xs font-semibold">
              Cancelar pedido
            </button>
          )}
          </div>
        </div>
      ):(
        <>
          {covered&&hasDestination&&!currentQuote&&!error&&(
            <p role="status" className="rounded-xl border border-white/20 bg-white/5 p-3 text-xs text-gray-200">
              {quoteLoading?"Calculando o preço da viagem…":"Preparando preço automaticamente para o destino selecionado…"}
            </p>
          )}
          {covered&&!hasDestination&&(
            <p className="text-xs text-gray-300"><MapPin className="mr-1 inline" size={13}/>Escolha o destino para visualizar o preço automaticamente.</p>
          )}
          {currentQuote&&(
            <div role="status" className="min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3">
              <p className="text-xs text-gray-200">Preço até {destination} · {vehicle==="MOTO"?"Moto":"Carro"}</p>
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                {vehicle==="MOTO"?<Bike size={16} className="text-[#FFBB00]"/>:<CarFront size={16} className="text-[#FFBB00]"/>}
                <span>{driverLoading?"Buscando motoristas online…":
                  driverError?"Não foi possível verificar motoristas online.":
                  driverCount===0?"Sem motorista online para esta modalidade.":
                  driverCount===1?"1 motorista online para receber seu pedido.":
                  driverCount+" motoristas online para receber seu pedido."}</span>
              </div>
              <p className="break-words text-2xl font-extrabold text-[#FFBB00]">{formatBrl(currentQuote.customerPaysCents/100)}</p>
              <p className="flex items-center gap-1 text-xs text-gray-200">
                <Clock3 size={13}/>{currentQuote.distanceKm.toFixed(1)} km • aprox. {Math.round(currentQuote.durationMinutes)} min
              </p>
              <p className="text-xs text-gray-300">
                Comissão de {currentQuote.commissionBps/100}% ({currentQuote.commissionSource==="OFFICIAL_ACTIVITY"?"atividade oficial":"política regional"}).
                O motorista recebe {formatBrl(currentQuote.driverReceivesCents/100)}.
              </p>
              <p className="text-[11px] text-gray-300">Fase piloto: sem débito automático. O pagamento e o repasse precisam ser homologados antes da operação comercial.</p>
              <button type="button"
                disabled={busy||quoteLoading||driverLoading||Boolean(driverError)||driverCount<1||
                  Date.parse(currentQuote.expiresAt)<=Date.now()}
                onClick={()=>void request()}
                className="min-h-12 w-full rounded-xl bg-[#FFBB00] text-sm font-bold text-[#121212] disabled:opacity-40">
                {busy?"Enviando pedido…":driverCount<1?"Aguardando motorista disponível":
                  "Confirmar corrida por "+formatBrl(currentQuote.customerPaysCents/100)}
              </button>
              <p className="text-[11px] text-gray-300">Ao confirmar, enviaremos o pedido aos motoristas online. O condutor só será definido quando aceitar; estar no radar não reserva um veículo.</p>
              {Date.parse(currentQuote.expiresAt)<=Date.now()&&(
                <button type="button" onClick={()=>{setQuote(null);setCurrentQuoteKey("");setQuoteRefresh(value=>value+1);}}
                  className="min-h-10 rounded-lg border border-white/30 px-3 text-xs font-semibold">
                  Atualizar preço expirado
                </button>
              )}
            </div>
          )}
        </>
      )}
      {!liveRide&&completedRide&&<QuickRidePixCard rideId={completedRide.id}/>}
      {error&&<p role="alert" className="rounded-xl border border-red-400/40 p-3 text-xs text-red-200">{error}</p>}
      {error&&covered&&hasDestination&&!currentQuote&&!liveRide&&(
        <button type="button" disabled={quoteLoading||busy}
          onClick={()=>{setError("");setQuoteRefresh(value=>value+1);}}
          className="min-h-10 rounded-xl border border-white/30 px-3 text-xs font-semibold disabled:opacity-50">
          Tentar obter preço novamente
        </button>
      )}
    </section>
  );
}
