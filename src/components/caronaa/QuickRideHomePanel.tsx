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
  const [error,setError]=useState("");
  const [interestSent,setInterestSent]=useState(false);
  const [rides,setRides]=useState<ExistingQuickRide[]>([]);
  const mounted=useRef(true);
  const originLat=originPoint?.lat, originLng=originPoint?.lng;
  const destinationLat=destinationPoint?.lat, destinationLng=destinationPoint?.lng;
  const hasOrigin=Number.isFinite(originLat)&&Number.isFinite(originLng)&&!gpsOriginIsImprecise;
  const hasDestination=Number.isFinite(destinationLat)&&Number.isFinite(destinationLng);
  const fieldsKey=JSON.stringify([origin,originLat,originLng,destination,destinationLat,destinationLng,vehicle]);
  const [currentQuoteKey,setCurrentQuoteKey]=useState("");
  const currentQuote=currentQuoteKey===fieldsKey?quote:null;
  const liveRide=rides.find(r=>r.role==="PASSENGER"&&["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(r.status));

  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  useEffect(()=>{
    setQuote(null);setCurrentQuoteKey("");setInterestSent(false);setError("");
  },[fieldsKey]);
  useEffect(()=>{
    setCoverage(null);onCoverage?.(null);setCoverageLoading(false);
    if(!hasOrigin||originLat==null||originLng==null)return;
    let active=true;
    setCoverageLoading(true);
    const timer=window.setTimeout(()=>{
      void availabilityFn({data:{lat:originLat,lng:originLng,vehicleType:vehicle}})
        .then(value=>{if(active){setCoverage(value);onCoverage?.(value);}})
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
  async function preview() {
    if(busy||!hasOrigin||!hasDestination||!originPoint||!destinationPoint||
       originLat==null||originLng==null||destinationLat==null||destinationLng==null)return;
    setBusy(true);setError("");setQuote(null);setCurrentQuoteKey("");
    const startKey=fieldsKey;
    try{
      const result=await previewFn({data:{
        origin:{lat:originLat,lng:originLng},
        destination:{lat:destinationLat,lng:destinationLng},
        originLabel:origin,destinationLabel:destination,vehicleType:vehicle,
      }});
      if(mounted.current){
        setQuote(result);setCurrentQuoteKey(startKey);
      }
    }catch(cause){
      if(mounted.current)setError(cause instanceof Error?cause.message:"Cotação indisponível.");
    }finally{if(mounted.current)setBusy(false);}
  }
  async function request() {
    if(busy||!currentQuote||Date.parse(currentQuote.expiresAt)<=Date.now())return;
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
  const covered=coverage?.status==="ENABLED";
  const inactiveText=coverage?.status==="OUTSIDE"
    ?"Ainda não atendemos embarques nesse município."
    :coverage?.status==="WAITLIST"
      ?"Este município está no nosso plano de expansão, mas a Corrida Rápida ainda não foi habilitada."
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
          Os veículos no radar têm posições aproximadas. O motorista é atribuído somente após aceitar.
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
          {covered&&hasDestination&&(
            <button type="button" disabled={busy} onClick={()=>void preview()}
              className="min-h-12 w-full rounded-xl border border-[#FFBB00] font-bold text-[#FFBB00] disabled:opacity-60">
              {busy?"Calculando…":"Calcular preço da Corrida Rápida"}
            </button>
          )}
          {covered&&!hasDestination&&(
            <p className="text-xs text-gray-300"><MapPin className="mr-1 inline" size={13}/>Selecione o destino para calcular o valor.</p>
          )}
          {currentQuote&&(
            <div role="status" className="min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 p-3">
              <p className="text-xs text-gray-200">Preço da corrida · {vehicle==="MOTO"?"Moto":"Carro"}</p>
              <p className="break-words text-2xl font-extrabold text-[#FFBB00]">{formatBrl(currentQuote.customerPaysCents/100)}</p>
              <p className="flex items-center gap-1 text-xs text-gray-200">
                <Clock3 size={13}/>{currentQuote.distanceKm.toFixed(1)} km • aprox. {Math.round(currentQuote.durationMinutes)} min
              </p>
              <p className="text-xs text-gray-300">
                Comissão de {currentQuote.commissionBps/100}% ({currentQuote.commissionSource==="OFFICIAL_ACTIVITY"?"atividade oficial":"política regional"}).
                O motorista recebe {formatBrl(currentQuote.driverReceivesCents/100)}.
              </p>
              <p className="text-[11px] text-gray-300">Fase piloto: sem débito automático. O pagamento e o repasse precisam ser homologados antes da operação comercial.</p>
              <button type="button" disabled={busy||Date.parse(currentQuote.expiresAt)<=Date.now()}
                onClick={()=>void request()}
                className="min-h-12 w-full rounded-xl bg-[#FFBB00] text-sm font-bold text-[#121212] disabled:opacity-40">
                {busy?"Solicitando…":"Solicitar corrida ao valor indicado"}
              </button>
              {Date.parse(currentQuote.expiresAt)<=Date.now()&&<p className="text-xs">Cotação expirada. Calcule novamente.</p>}
            </div>
          )}
        </>
      )}
      {error&&<p role="alert" className="rounded-xl border border-red-400/40 p-3 text-xs text-red-200">{error}</p>}
    </section>
  );
}
