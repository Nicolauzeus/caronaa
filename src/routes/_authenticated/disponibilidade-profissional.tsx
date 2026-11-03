import {createFileRoute, Link} from "@tanstack/react-router";
import {useCallback, useEffect, useRef, useState} from "react";
import {supabase} from "@/integrations/supabase/client";

export const Route=createFileRoute("/_authenticated/disponibilidade-profissional")({component:ProfessionalAvailability});

type DriverLocation = {coords: {latitude:number; longitude:number; accuracy:number}};
function ProfessionalAvailability(){
 const [enabled,setEnabled]=useState(false);
 const [municipality,setMunicipality]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [ready,setReady]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [lastPosition,setLastPosition]=useState<Date|null>(null);
 const watchId=useRef<number|null>(null);
 const sharingRef=useRef(false);
 const locationRequestBusy=useRef(false);
 const stopSharing=useCallback(async()=>{
   sharingRef.current=false;
   if(watchId.current!==null && typeof navigator!=="undefined" && navigator.geolocation){
     navigator.geolocation.clearWatch(watchId.current); watchId.current=null;
   }
   setSharing(false);setLastPosition(null);
   await (supabase as any).rpc("professional_location_stop");
 },[]);
 const publishPosition=useCallback(async(position:DriverLocation)=>{
   if(!sharingRef.current||locationRequestBusy.current)return;
   locationRequestBusy.current=true;
   const {latitude,longitude,accuracy}=position.coords;
   const {error:rpcError}=await (supabase as any).rpc("professional_location_opt_in",{
     p_lat:latitude,p_lng:longitude,p_accuracy_m:accuracy,p_municipality:municipality.trim()
   });
   locationRequestBusy.current=false;
   if(rpcError){
     setError("Compartilhamento interrompido: "+rpcError.message);
     void stopSharing();
   }else setLastPosition(new Date());
 },[municipality,stopSharing]);
 const startSharing=useCallback(()=>{
   setError("");
   if(!enabled){setError("Fique disponível antes de compartilhar a localização.");return}
   if(!municipality.trim()){setError("Informe primeiro o município.");return}
   if(typeof window==="undefined"||!window.isSecureContext||!navigator.geolocation){
     setError("Localização exige HTTPS e GPS disponível no navegador.");return;
   }
   if(watchId.current!==null)return;
   sharingRef.current=true;setSharing(true);
   watchId.current=navigator.geolocation.watchPosition(
     position=>void publishPosition(position),
     position=>{setError("GPS indisponível: "+position.message);void stopSharing()},
     {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
   );
 },[enabled,municipality,publishPosition,stopSharing]);
 useEffect(()=>{
   let active=true;
   void supabase.auth.getUser().then(async({data})=>{
     if(!data.user)return;
     const {data:row}=await (supabase as any).from("professional_presence").select("is_available,municipality,last_seen_at").eq("user_id",data.user.id).maybeSingle();
     if(active){setEnabled(Boolean(row?.is_available)&&Date.now()-Date.parse(row.last_seen_at)<90000);setMunicipality(row?.municipality??"");setReady(true)}
   });
   return()=>{active=false};
 },[]);
 async function save(availability:boolean){
   setBusy(true);setError("");
   if(!availability)await stopSharing();
   const {error:presenceError}=await (supabase as any).rpc("set_professional_presence",{p_available:availability,p_municipality:municipality});
   if(presenceError)setError(presenceError.message);else setEnabled(availability);
   setBusy(false);
 }
 useEffect(()=>{
   if(!enabled)return;
   const timer=window.setInterval(()=>{
     if(document.visibilityState==="visible")
       void (supabase as any).rpc("set_professional_presence",{p_available:true,p_municipality:municipality})
       .then(({error}:{error:any})=>{if(error){setError("Falha ao atualizar disponibilidade.");setEnabled(false);void stopSharing()}});
   },30000);
   return()=>window.clearInterval(timer);
 },[enabled,municipality,stopSharing]);
 useEffect(()=>{
   const visibility=()=>{if(document.hidden&&sharingRef.current)void stopSharing()};
   document.addEventListener("visibilitychange",visibility);
   return()=>{document.removeEventListener("visibilitychange",visibility);void stopSharing()};
 },[stopSharing]);
 return <main className="mx-auto max-w-2xl space-y-5 p-5">
   <Link to="/home" className="text-sm text-primary">← Voltar ao aplicativo</Link>
   <h1 className="text-3xl font-bold">Disponibilidade profissional</h1>
   <p className="text-sm text-muted-foreground">Presença voluntária para o piloto. Recebimento de corridas profissionais ainda não liberado.</p>
   <label className="block text-sm">Município<input value={municipality} maxLength={120} disabled={sharing} onChange={e=>setMunicipality(e.target.value)} placeholder="Informe seu município" className="mt-2 w-full rounded-lg border bg-background p-3"/></label>
   <p className="rounded-xl border p-4 text-sm">Situação: <strong>{!ready?"Carregando":enabled?"Disponível":"Indisponível"}</strong></p>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <button disabled={!ready||busy} onClick={()=>void save(!enabled)} className="w-full rounded-xl bg-primary p-4 font-bold text-primary-foreground disabled:opacity-50">{busy?"Salvando...":enabled?"Ficar offline":"Ficar disponível"}</button>
   <section className="rounded-xl border p-4 space-y-3">
     <h2 className="font-semibold">Localização no mapa (somente profissionais habilitados)</h2>
     <p className="text-sm text-muted-foreground">Compartilhamento opcional. Outros usuários veem apenas uma posição aproximada enquanto você estiver online em uma região liberada. O GPS é interrompido ao sair da tela, desligar a disponibilidade ou colocar o app em segundo plano.</p>
     <button type="button" disabled={!enabled||busy} onClick={()=>sharing?void stopSharing():startSharing()} className="min-h-12 w-full rounded-xl border p-3 font-semibold disabled:opacity-50">{sharing?"Parar compartilhamento":"Compartilhar minha localização"}</button>
     {sharing&&<p role="status" className="text-sm">GPS ativo{lastPosition?" · último sinal: "+lastPosition.toLocaleTimeString("pt-BR"):" · aguardando sinal"}</p>}
   </section>
 </main>;
}
