import {createFileRoute, Link} from "@tanstack/react-router";
import {useCallback, useEffect, useRef, useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {ProfessionalAccessRequest} from "@/components/caronaa/ProfessionalAccessRequest";
import {professionalRadarConsentKey} from "@/lib/professional-radar-consent";
import {buildQuickRideSearch} from "@/lib/quick-ride-search";
import {MunicipalitySelect} from "@/components/caronaa/MunicipalitySelect";
import {Button} from "@/components/ui/button";

export const Route=createFileRoute("/_authenticated/disponibilidade-profissional")({component:ProfessionalAvailability,
 head:()=>({meta:[{title:"Disponibilidade profissional | CARONAA"},{name:"description",content:"Controle sua disponibilidade e município de atuação no radar profissional CARONAA."},{property:"og:title",content:"Disponibilidade profissional | CARONAA"},{property:"og:description",content:"Disponibilidade autorizada e compartilhamento consentido de localização no CARONAA."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]})
});

type DriverLocation = {coords: {latitude:number; longitude:number; accuracy:number}};
function ProfessionalAvailability(){
 const [enabled,setEnabled]=useState(false);
 const [driverBlocked,setDriverBlocked]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const [userId,setUserId]=useState("");
 const [visible,setVisible]=useState(true);
 const [municipality,setMunicipality]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [ready,setReady]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [lastPosition,setLastPosition]=useState<Date|null>(null);
 const watchId=useRef<number|null>(null);
 const sharingRef=useRef(false);
 const locationRequestBusy=useRef(false);
 const publishPositionRef=useRef<(position:DriverLocation)=>void>(()=>{});
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
     if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));
     setError("Compartilhamento interrompido: "+rpcError.message);
     void stopSharing();
   }else setLastPosition(new Date());
 },[municipality,userId,stopSharing]);
 publishPositionRef.current=(position)=>{void publishPosition(position)};
 const startSharing=useCallback(()=>{
   setError("");
   if(!enabled){setError("Fique disponível antes de compartilhar a localização.");return}
   if(!authorized||driverBlocked){setError("Apenas motoristas autorizados e sem bloqueio podem aparecer no radar.");return}
   if(!municipality.trim()){setError("Informe primeiro o município.");return}
   if(typeof window==="undefined"||!window.isSecureContext||!navigator.geolocation){
     setError("Localização exige HTTPS e GPS disponível no navegador.");return;
   }
   if(watchId.current!==null)return;
   sharingRef.current=true;setSharing(true);
   watchId.current=navigator.geolocation.watchPosition(
     position=>publishPositionRef.current(position),
     position=>{if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));setError("GPS indisponível: "+position.message);void stopSharing()},
     {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
   );
 },[enabled,authorized,driverBlocked,municipality,publishPosition,stopSharing,userId]);
 useEffect(()=>{
   let active=true;
   void (async()=>{
     const {data:{user}}=await supabase.auth.getUser();
     if(!user){if(active){setError("Entre na sua conta para ativar o radar.");setReady(true)}return}
     const [presence, fees, access, profile]=await Promise.all([
       (supabase as any).from("professional_presence").select("is_available,municipality,last_seen_at").eq("user_id",user.id).maybeSingle(),
       (supabase as any).rpc("get_my_driver_platform_fees"),
       (supabase as any).rpc("get_my_professional_access"),
       supabase.from("profiles").select("city").eq("id",user.id).maybeSingle(),
     ]);
     if(!active)return;
     setUserId(user.id);
     const allowed=!fees.error && fees.data?.driverAllowed===true;
     const approved=!access.error && access.data?.authorized===true;
     const requestedArea=String(access.data?.request?.municipality ?? "");
     // Registration regions are not municipalities. Never send a region code to
     // the municipality-restricted radar presence RPC.
     const fallbackCity=requestedArea==="MACICO_BATURITE"||requestedArea==="FORTALEZA"
       ? "" : requestedArea;
     const city=String(presence.data?.municipality || profile.data?.city || fallbackCity).trim();
     setAuthorized(approved);
     setDriverBlocked(!allowed);
     setMunicipality(city);
     // New approved drivers start online; a driver's explicit offline choice wins.
     // A previously online driver resumes after returning to the app.
     const shouldActivate=approved && allowed && city.length>=2 && !presence.error && presence.data?.is_available!==false;
     if(shouldActivate){
       const {error:onlineError}=await (supabase as any).rpc("set_professional_presence",{p_available:true,p_municipality:city});
       if(!active)return;
       setEnabled(!onlineError);
       if(onlineError)setError("Não foi possível iniciar a disponibilidade: "+onlineError.message);
     }else{
       setEnabled(false);
       if(presence.error)setError("Não foi possível verificar a disponibilidade atual.");
     }
     setReady(true);
   })().catch(()=>{if(active){setError("Não foi possível carregar o radar.");setReady(true)}});
   return()=>{active=false};
 },[]);
 async function save(availability:boolean){
    if(availability && (driverBlocked||!authorized)){
      setError("A disponibilidade exige autorização profissional e ausência de repasses bloqueantes. Consulte seu Perfil.");
      return;
    }
    if(availability && municipality.trim().length<2){setError("Informe o município do radar.");return}
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
   if(!sharing)return;
   const timer=window.setInterval(()=>{
     if(document.visibilityState!=="visible"||!sharingRef.current||!navigator.geolocation)return;
     navigator.geolocation.getCurrentPosition(
       position=>publishPositionRef.current(position),
       ()=>{if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));setError("Sinal GPS expirado. Compartilhamento interrompido.");void stopSharing()},
       {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
     );
   },30000);
   return()=>window.clearInterval(timer);
 },[sharing,stopSharing,userId]);
 useEffect(()=>{
   const visibility=()=>{setVisible(!document.hidden);if(document.hidden&&sharingRef.current)void stopSharing()};
   document.addEventListener("visibilitychange",visibility);
   return()=>{document.removeEventListener("visibilitychange",visibility);void stopSharing()};
 },[stopSharing]);
 // A prior explicit GPS choice resumes automatically when returning to this
 // foreground page; never request location for a first-time visitor silently.
 useEffect(()=>{
   if(!ready||!enabled||!authorized||driverBlocked||!visible||sharing||!userId||!municipality.trim())return;
   if(window.localStorage.getItem(professionalRadarConsentKey(userId))==="yes")startSharing();
 },[ready,enabled,authorized,driverBlocked,visible,sharing,userId,municipality,startSharing]);
 const toggleSharing=()=>{
   if(sharing){if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));void stopSharing();return}
   if(userId)window.localStorage.setItem(professionalRadarConsentKey(userId),"yes");
   startSharing();
 };
 return <main className="mx-auto max-w-2xl space-y-5 p-5">
   <Link to="/cadastro-motorista" className="text-sm text-primary">← Meu cadastro profissional</Link>
   <h1 className="text-3xl font-bold">Disponibilidade profissional</h1>
   <p className="text-sm text-muted-foreground">O radar inicia disponível para motoristas aprovados ao entrar aqui pela primeira vez. Se você escolher ficar offline, essa preferência será respeitada. O compartilhamento GPS exige sua autorização e só funciona com o app em primeiro plano. Recebimento comercial de corridas depende de homologação regional.</p>
   {authorized&&(
     <Link to="/viagem-rapida"
       search={buildQuickRideSearch({origin:"",destination:"",municipality})}
       className="flex min-h-12 w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/10 px-3 text-sm font-bold text-primary">
       Ver pedidos de Corrida Rápida e acompanhar minhas viagens
     </Link>
   )}
   <ProfessionalAccessRequest/>
   <p className="rounded-xl border p-3 text-xs text-muted-foreground">Após a aprovação, informe seu município real de atuação para verificar a cobertura operacional. A região informada no cadastro não é um município. O GPS exige consentimento.</p>
   <MunicipalitySelect value={municipality} disabled={enabled||sharing||busy} onChange={setMunicipality}/>
   {enabled&&<p className="text-xs text-muted-foreground">Fique offline para alterar o município.</p>}
   {driverBlocked && <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
      Radar suspenso até a quitação dos repasses.{" "}
      <Link to="/perfil" className="font-semibold underline">Ver comissões</Link>
    </p>}
    <p className="rounded-xl border p-4 text-sm">Situação: <strong>{!ready?"Carregando":!authorized?"Aguardando autorização":enabled?(sharing&&lastPosition?"Online · GPS ativo":"Disponível · GPS não publicado"):"Offline"}</strong></p>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <Button disabled={!ready||busy||(!enabled&&(driverBlocked||!authorized||!municipality))} onClick={()=>void save(!enabled)} className="min-h-12 w-full">{busy?"Salvando...":enabled?"Ficar offline":"Ficar disponível"}</Button>
   <section className="rounded-xl border p-4 space-y-3">
     <h2 className="font-semibold">Localização no mapa (somente profissionais habilitados)</h2>
     <p className="text-sm text-muted-foreground">Compartilhamento opcional. Depois que você autorizar o GPS, ele será retomado automaticamente enquanto usar o CARONAA em uma aba visível. Outros usuários veem apenas uma posição aproximada, em região liberada. Ficar offline ou parar o compartilhamento interrompe a publicação.</p>
     <button type="button" disabled={!enabled||busy||driverBlocked||!authorized} onClick={toggleSharing} className="min-h-12 w-full rounded-xl border p-3 font-semibold disabled:opacity-50">{sharing?"Parar compartilhamento":"Compartilhar minha localização"}</button>
     {sharing&&<p role="status" className="text-sm">GPS ativo{lastPosition?" · último sinal: "+lastPosition.toLocaleTimeString("pt-BR"):" · aguardando sinal"}</p>}
   </section>
 </main>;
}
