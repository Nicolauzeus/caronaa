import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/caronaa/AppShell";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import type { FormLocationDetails } from "@/lib/location/types";

type QuickRide = {
 id:string; role:"PASSENGER"|"DRIVER"; municipality:string; vehicle_type:string;
 origin_label:string;destination_label:string;status:string;requested_at:string;expires_at:string;
};
export const Route=createFileRoute("/_authenticated/viagem-rapida")({component:QuickRidePage});
const labels:Record<string,string>={SEARCHING:"Buscando motorista",ACCEPTED:"Motorista confirmado",ARRIVED:"Motorista chegou",IN_PROGRESS:"Em viagem",COMPLETED:"Concluída",CANCELLED:"Cancelada",EXPIRED:"Busca encerrada"};
function QuickRidePage(){
 const [municipality,setMunicipality]=useState("");
 const [vehicle,setVehicle]=useState<"CAR"|"MOTO">("CAR");
 const [origin,setOrigin]=useState("");
 const [destination,setDestination]=useState("");
 const [originPoint,setOriginPoint]=useState<FormLocationDetails>();
 const [destinationPoint,setDestinationPoint]=useState<FormLocationDetails>();
 const [rides,setRides]=useState<QuickRide[]>([]);
 const [queue,setQueue]=useState<QuickRide[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const submitting=useRef(false);
 const refresh=async()=>{
   const {data,error:loadError}=await (supabase as any).rpc("quick_ride_my_requests");
   if(loadError){setError("Histórico de viagens rápidas indisponível. Verifique a homologação.");return;}
   setRides(data??[]);
 };
 useEffect(()=>{
   void refresh();
   const timer=window.setInterval(()=>void refresh(),5000);
   return()=>window.clearInterval(timer);
 },[]);
 useEffect(()=>{
   if(municipality.trim().length<2){setQueue([]);return;}
   let alive=true;
   const check=async()=>{
     const {data,error:loadError}=await (supabase as any).rpc("quick_ride_driver_queue",{p_municipality:municipality.trim()});
     if(alive)setQueue(loadError?[]:data??[]);
   };
   void check();
   const timer=window.setInterval(()=>void check(),5000);
   return()=>{alive=false;window.clearInterval(timer)};
 },[municipality]);
 const useGps=()=>{
   if(!window.isSecureContext||!navigator.geolocation){setError("GPS requer HTTPS e um navegador compatível.");return}
   navigator.geolocation.getCurrentPosition(pos=>{
     setOrigin("Localização atual");
     setOriginPoint({rawText:"Localização atual",formattedAddress:"Localização atual",lat:pos.coords.latitude,lng:pos.coords.longitude});
     setError("");
   },()=>setError("Sem permissão para GPS. Busque a origem manualmente."),{enableHighAccuracy:true,timeout:10000});
 };
 async function create(){
   if(submitting.current)return;
   if(!originPoint||!destinationPoint||originPoint.lat==null||originPoint.lng==null||
      destinationPoint.lat==null||destinationPoint.lng==null||municipality.trim().length<2){
     setError("Informe município, origem e destino selecionados no mapa ou na busca.");return;
   }
   submitting.current=true;setBusy(true);setError("");
   const {error:requestError}=await (supabase as any).rpc("quick_ride_request",{
     p_municipality:municipality.trim(),p_vehicle_type:vehicle,
     p_origin_label:origin,p_destination_label:destination,
     p_origin_lat:originPoint.lat,p_origin_lng:originPoint.lng,
     p_destination_lat:destinationPoint.lat,p_destination_lng:destinationPoint.lng
   });
   setBusy(false);submitting.current=false;
   if(requestError)setError("Solicitação não autorizada: "+requestError.message);
   else await refresh();
 }
 async function action(id:string,status:string,accept=false){
   setBusy(true);setError("");
   const {data,error:actionError}=await (supabase as any).rpc(
     accept?"quick_ride_accept":"quick_ride_transition",
     accept?{p_id:id}:{p_id:id,p_status:status}
   );
   if(actionError||data===false)setError(actionError?.message??"A solicitação já foi atendida por outro motorista.");
   await refresh();setBusy(false);
 }
 return <AppShell><div className="mx-auto max-w-xl space-y-5 p-4">
   <Link to="/home" className="text-sm font-semibold text-primary">← Início</Link>
   <h1 className="text-2xl font-extrabold">Viajar agora</h1>
   <p className="text-sm text-muted-foreground">Fluxo-piloto de corridas rápidas. Só funciona em municípios liberados pela operação; sem cobrança ou tarifa profissional nesta fase.</p>
   <div className="rounded-2xl border p-4 space-y-3">
     <label htmlFor="quick-municipality" className="block text-sm font-semibold">Município</label>
     <input id="quick-municipality" className="w-full rounded-xl border bg-background p-3" value={municipality} maxLength={120} onChange={e=>setMunicipality(e.target.value)} placeholder="Município do piloto"/>
     <div className="flex gap-2">
       <button type="button" onClick={()=>setVehicle("CAR")} aria-pressed={vehicle==="CAR"} className={"flex-1 rounded-xl border p-3 "+(vehicle==="CAR"?"bg-primary text-primary-foreground":"")}>Carro</button>
       <button type="button" onClick={()=>setVehicle("MOTO")} aria-pressed={vehicle==="MOTO"} className={"flex-1 rounded-xl border p-3 "+(vehicle==="MOTO"?"bg-primary text-primary-foreground":"")}>Moto</button>
     </div>
     <LocationAutocomplete id="quick-origin" label="Origem" value={origin} variant="simple" onChange={(v,d)=>{setOrigin(d?.formattedAddress||v);setOriginPoint(d)}} placeholder="De onde você sai?"/>
     <button className="rounded-xl border px-4 py-3 text-sm" type="button" onClick={useGps}>Usar minha localização</button>
     <LocationAutocomplete id="quick-destination" label="Destino" value={destination} variant="simple" onChange={(v,d)=>{setDestination(d?.formattedAddress||v);setDestinationPoint(d)}} placeholder="Para onde você vai?"/>
     <button type="button" disabled={busy} onClick={()=>void create()} className="w-full rounded-xl bg-primary p-4 font-bold text-primary-foreground disabled:opacity-50">Solicitar corrida (piloto)</button>
     <p className="text-xs text-muted-foreground">Sem estimativa tarifária ou pagamento nesta versão. Não utilize para transporte comercial real.</p>
   </div>
   {error&&<p role="alert" className="rounded-xl border border-red-400 p-3 text-sm">{error}</p>}
   <section className="space-y-3">
     <h2 className="font-bold">Minhas solicitações</h2>
     {rides.length===0&&<p className="text-sm text-muted-foreground">Nenhuma corrida rápida registrada.</p>}
     {rides.map(r=><article key={r.id} className="rounded-xl border p-3 space-y-2">
       <p className="font-semibold">{r.origin_label} → {r.destination_label}</p>
       <p className="text-sm">{r.role==="DRIVER"?"Motorista":"Passageiro"} · {labels[r.status]??r.status}</p>
       {["SEARCHING","ACCEPTED","ARRIVED"].includes(r.status)&&
         <button disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void action(r.id,"CANCELLED")}>Cancelar</button>}
       {r.role==="DRIVER"&&r.status==="ACCEPTED"&&<button disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void action(r.id,"ARRIVED")}>Cheguei</button>}
       {r.role==="DRIVER"&&r.status==="ARRIVED"&&<button disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void action(r.id,"IN_PROGRESS")}>Iniciar</button>}
       {r.role==="DRIVER"&&r.status==="IN_PROGRESS"&&<button disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void action(r.id,"COMPLETED")}>Finalizar</button>}
     </article>)}
   </section>
   <section className="space-y-3">
     <h2 className="font-bold">Pedidos próximos (motorista credenciado)</h2>
     {queue.length===0&&<p className="text-sm text-muted-foreground">Nenhum pedido disponível ou motorista sem autorização/online.</p>}
     {queue.map(r=><article key={r.id} className="rounded-xl border p-3 space-y-2">
       <p className="text-sm">{r.origin_label} → {r.destination_label} · {r.vehicle_type==="MOTO"?"Moto":"Carro"}</p>
       <button disabled={busy} className="rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground" onClick={()=>void action(r.id,"",true)}>Aceitar pedido</button>
     </article>)}
   </section>
 </div></AppShell>;
}
