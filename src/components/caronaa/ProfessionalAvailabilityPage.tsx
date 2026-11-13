import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publishVerifiedProfessionalPosition } from "@/lib/professional-radar.functions";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";
import { getF07PilotState, activateF07PilotDriver } from "@/lib/quick-rides/f07-pilot.functions";
import { simulateF07TestLocation, clearF07TestLocation } from "@/lib/quick-rides/f07-radar-diagnostic.functions";
import { ProfessionalAccessRequest } from "@/components/caronaa/ProfessionalAccessRequest";
import { MunicipalitySelect } from "@/components/caronaa/MunicipalitySelect";
import { buildQuickRideSearch } from "@/lib/quick-ride-search";
import { Button } from "@/components/ui/button";

type Fix = { lat:number; lng:number; at:Date; simulated:boolean };
type Vehicle = "CAR" | "MOTO";

/** One explicit activation is consent for online presence AND real GPS.
 * Fake municipality centres are diagnostic-only and NEVER masquerade as GPS.
 */
export function ProfessionalAvailabilityPage() {
  const publishVerified = useServerFn(publishVerifiedProfessionalPosition);
  const getPilot = useServerFn(getF07PilotState);
  const activatePilot = useServerFn(activateF07PilotDriver);
  const simulateTest = useServerFn(simulateF07TestLocation);
  const clearTest = useServerFn(clearF07TestLocation);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [enabled,setEnabled]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [blocked,setBlocked]=useState(false);
  const [pilotEnabled,setPilotEnabled]=useState(false);
  const [pilotVehicle,setPilotVehicle]=useState<Vehicle>("MOTO");
  const [pilotExpiry,setPilotExpiry]=useState("");
  const [userId,setUserId]=useState("");
  const [municipality,setMunicipality]=useState("");
  const [sharing,setSharing]=useState(false);
  const [fix,setFix]=useState<Fix|null>(null);
  const [error,setError]=useState("");
  const [tick,setTick]=useState(Date.now());
  const onAuthorized=useCallback((value:boolean)=>setAuthorized(value),[]);
  const mounted=useRef(true);
  const watch=useRef<number|null>(null);
  const tracking=useRef(false);
  const sending=useRef(false);
  const simulating=useRef(false);
  const lastAttempt=useRef(0);
  const positionHandler=useRef<(position:GeolocationPosition)=>void>(()=>{});

  const discardWatch=useCallback(()=>{
    tracking.current=false;
    if(watch.current!==null && typeof navigator!=="undefined" && navigator.geolocation){
      navigator.geolocation.clearWatch(watch.current);
    }
    watch.current=null;
    if(mounted.current)setSharing(false);
  },[]);

  const stop=useCallback(async()=>{
    discardWatch();
    if(mounted.current)setFix(null);
    await Promise.allSettled([
      (supabase as any).rpc("professional_location_stop"),
      clearTest(),
    ]);
  },[discardWatch,clearTest]);

  const onFix=useCallback(async(position:GeolocationPosition)=>{
    if(!tracking.current || sending.current || Date.now()-lastAttempt.current<25000)return;
    if(userId && window.localStorage.getItem(professionalRadarConsentKey(userId))!=="yes"){
      discardWatch();
      void (supabase as any).rpc("professional_location_stop");
      return;
    }
    const {latitude,longitude,accuracy}=position.coords;
    if(!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
       !Number.isFinite(accuracy) || accuracy<0 || accuracy>5000){
      if(mounted.current)setError("Sinal GPS com precisão insuficiente.");
      return;
    }
    sending.current=true;
    lastAttempt.current=Date.now();
    try{
      const result=await publishVerified({data:{lat:latitude,lng:longitude,accuracyM:accuracy}});
      if(!tracking.current){
        // Route switch is not withdrawal of consent. Do not let a late
        // server response erase an active watch started on the next page.
        if(!userId || window.localStorage.getItem(professionalRadarConsentKey(userId))!=="yes")
          void (supabase as any).rpc("professional_location_stop");
        return;
      }
      if(result.published){
        if(mounted.current){
          setMunicipality(result.municipality);
          setFix({lat:latitude,lng:longitude,at:new Date(),simulated:false});
          setError("");
        }
        void clearTest().catch(()=>undefined);
      }else{
        if(mounted.current){
          setFix(null);
          setError(result.reason==="OUTSIDE_APPROVED_ZONE"
            ?"Localização fora dos municípios habilitados; publicação suspensa."
            :"Google não confirmou o município atual. Nenhum GPS foi publicado.");
        }
      }
    }catch(e){
      if(mounted.current)setError(e instanceof Error?e.message:"Falha ao enviar GPS verificado.");
    }finally{sending.current=false;}
  },[publishVerified,clearTest,userId,discardWatch]);
  positionHandler.current=position=>{void onFix(position);};

  const simulationFallback=useCallback(async(city:string,vehicle:Vehicle,reason:string)=>{
    if(mounted.current)setError("GPS indisponível: "+reason);
    if(!pilotEnabled || !city.trim())return;
    if(simulating.current)return;
    simulating.current=true;
    try{
      const test=await simulateTest({data:{municipality:city,vehicleType:vehicle}});
      if(!mounted.current)return;
      setFix({lat:test.lat,lng:test.lng,at:new Date(test.updatedAt),simulated:true});
      setMunicipality(test.municipality);
      setError("SIMULAÇÃO de homologação — centro do município; visível só para a própria conta, nunca usado para despachar viagens.");
    }catch(e){
      if(mounted.current)setError(
        e instanceof Error?e.message:"Não foi possível criar a prévia simulada.");
    }finally{simulating.current=false;}
  },[pilotEnabled,simulateTest]);

  const startGps=useCallback((city:string,vehicle:Vehicle,uid:string)=>{
    if(tracking.current)return;
    if(typeof window==="undefined" || !window.isSecureContext || !navigator.geolocation){
      void simulationFallback(city,vehicle,"precisa de HTTPS e geolocalização permitida.");
      return;
    }
    tracking.current=true;
    if(mounted.current){
      setSharing(true);
      setError("Buscando GPS e enviando o primeiro sinal...");
    }
    const fail=(reason:GeolocationPositionError)=>{
      if(!tracking.current)return;
      discardWatch();
      window.localStorage.removeItem(professionalRadarConsentKey(uid));
      void (supabase as any).rpc("professional_location_stop");
      void simulationFallback(city,vehicle,reason.message);
    };
    try{
      // First fix immediately after the same click; the watch provides updates.
      navigator.geolocation.getCurrentPosition(
        position=>positionHandler.current(position), fail,
        {enableHighAccuracy:true,timeout:15000,maximumAge:5000});
      watch.current=navigator.geolocation.watchPosition(
        position=>positionHandler.current(position),fail,
        {enableHighAccuracy:true,timeout:15000,maximumAge:10000});
    }catch(e){
      discardWatch();
      void simulationFallback(city,vehicle,
        e instanceof Error?e.message:"O navegador não iniciou o GPS.");
    }
  },[discardWatch,simulationFallback]);

  useEffect(()=>{
    mounted.current=true;
    let active=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("Entre na sua conta para usar o radar.");
      const [presence,fees,access,profile,pilot]=await Promise.all([
        (supabase as any).from("professional_presence")
          .select("is_available,municipality").eq("user_id",user.id).maybeSingle(),
        (supabase as any).rpc("get_my_driver_platform_fees"),
        (supabase as any).rpc("get_my_professional_access"),
        supabase.from("profiles").select("city").eq("id",user.id).maybeSingle(),
        getPilot().catch(()=>({enabled:false})),
      ]);
      if(!active)return;
      if(presence.error || fees.error || access.error)throw new Error("Falha ao conferir autorização, presença ou repasses.");
      const registeredCity=String(access.data?.request?.municipality??"");
      const candidate=registeredCity==="MACICO_BATURITE"||registeredCity==="FORTALEZA"
        ? "":registeredCity;
      setUserId(user.id);
      setAuthorized(access.data?.authorized===true);
      const registeredVehicle=access.data?.request?.vehicle_type;
      if(registeredVehicle==="CAR"||registeredVehicle==="MOTO")
        setPilotVehicle(registeredVehicle);
      setBlocked(fees.data?.driverAllowed!==true);
      setPilotEnabled(pilot.enabled===true);
      setMunicipality(String(presence.data?.municipality||profile.data?.city||candidate).trim());
      setEnabled(presence.data?.is_available===true &&
        access.data?.authorized===true && fees.data?.driverAllowed===true);
      setReady(true);
    })().catch(e=>{if(active){setReady(true);setError(e instanceof Error?e.message:"Falha no radar.");}});
    return()=>{active=false;mounted.current=false;discardWatch();
      // On navigation, the common AppShell radar resumes an earlier opt-in.
      // Do not erase a valid fix when merely changing routes.
    };
  },[]);

  useEffect(()=>{
    if(!userId)return;
    const consentChanged=(event:StorageEvent)=>{
      if(event.key!==professionalRadarConsentKey(userId))return;
      if(event.newValue!=="yes"){
        // Explicit withdrawal from another tab: remove precise position now.
        void stop();
      }
    };
    window.addEventListener("storage",consentChanged);
    return()=>window.removeEventListener("storage",consentChanged);
  },[userId,stop]);

  useEffect(()=>{
    const t=window.setInterval(()=>setTick(Date.now()),10000);
    return()=>window.clearInterval(t);
  },[]);
  // A previously consented GPS session can resume when returning to this
  // screen, including after a tab switch. No first-visit silent permission.
  useEffect(()=>{
    if(!ready||!enabled||!authorized||blocked||!userId||tracking.current||fix?.simulated)return;
    if(window.localStorage.getItem(professionalRadarConsentKey(userId))==="yes"){
      startGps(municipality,pilotVehicle,userId);
    }
  },[ready,enabled,authorized,blocked,userId,municipality,pilotVehicle,startGps,fix?.simulated]);

  useEffect(()=>{
    if(!enabled)return;
    const timer=window.setInterval(()=>{
      // Do not silently re-enable an explicit offline choice from another device.
      void (async()=>{
        const {data,stateError}=await (supabase as any)
          .from("professional_presence").select("is_available").eq("user_id",userId).maybeSingle()
          .then(({data,error}:any)=>({data,stateError:error}));
        if(stateError || data?.is_available!==true){
          if(mounted.current){setEnabled(false);setError("Disponibilidade encerrada ou sessão indisponível.");}
          void stop();return;
        }
        const {error}=await (supabase as any).rpc("set_professional_presence",{
          p_available:true,p_municipality:null,
        });
        if(error && mounted.current)setError("Não foi possível atualizar o sinal de disponibilidade.");
      })();
    },30000);
    return()=>window.clearInterval(timer);
  },[enabled,userId,stop]);

  useEffect(()=>{
    if(!sharing)return;
    const timer=window.setInterval(()=>{
      if(!tracking.current || !navigator.geolocation)return;
      // Browsers may throttle background execution; DB TTL will prevent stale
      // GPS from appearing as a live driver if that happens.
      navigator.geolocation.getCurrentPosition(
        position=>positionHandler.current(position),
        ()=>{if(mounted.current)setError("GPS temporariamente indisponível; tentando novamente.");},
        {enableHighAccuracy:true,timeout:15000,maximumAge:10000});
    },30000);
    return()=>window.clearInterval(timer);
  },[sharing]);

  async function toggleOnline(next:boolean) {
    if(busy)return;
    if(next && blocked){setError("Motorista bloqueado por repasses.");return;}
    if(next && !authorized && !pilotEnabled){
      setError("É necessária aprovação administrativa para entrar no radar.");return;
    }
    setBusy(true);setError("");
    try{
      if(!next){
        if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));
        await stop();
        const {error}=await (supabase as any).rpc("set_professional_presence",{
          p_available:false,p_municipality:null,
        });
        if(error)throw error;
        setEnabled(false);
        return;
      }
      if(!authorized){
        const result=await activatePilot({data:{vehicleType:pilotVehicle}});
        if(!result.approved)throw new Error("Piloto não autorizado.");
        setAuthorized(true);
        setPilotExpiry(result.expiresAt);
      }
      const {error}=await (supabase as any).rpc("set_professional_presence",{
        p_available:true,p_municipality:municipality||null,
      });
      if(error)throw error;
      setEnabled(true);
      // The user explicitly chose availability + GPS in ONE labeled button.
      if(userId)window.localStorage.setItem(professionalRadarConsentKey(userId),"yes");
      startGps(municipality,pilotVehicle,userId);
    }catch(e){
      setError(e instanceof Error?e.message:"Não foi possível mudar a disponibilidade.");
    }finally{setBusy(false);}
  }

  const fresh=!!fix && !fix.simulated && tick-fix.at.getTime()<90000 && enabled && sharing;
  return <main className="mx-auto max-w-2xl space-y-5 p-5">
    <Link to="/cadastro-motorista" className="text-sm text-primary">← Meu cadastro profissional</Link>
    <h1 className="text-3xl font-bold">Disponibilidade profissional</h1>
    <p className="text-sm text-muted-foreground">
      Ficar disponível ativa a presença e pede permissão de GPS no mesmo toque.
      Com consentimento ativo, o navegador pode continuar transmitindo ao alternar
      abas; se suspender o GPS, o sinal do radar expira em 90 segundos.
    </p>
    <ProfessionalAccessRequest onAuthorized={onAuthorized}/>
    {pilotEnabled&&!authorized&&<section className="space-y-2 rounded-xl border border-primary/30 p-3 text-sm">
      <strong>Piloto F07 — apenas homologação</strong>
      <p>Autorização temporária somente no ambiente de testes.</p>
      <label className="block">Veículo
        <select className="mt-1 w-full rounded-lg border bg-background p-3"
          value={pilotVehicle} onChange={e=>setPilotVehicle(e.target.value as Vehicle)}>
          <option value="MOTO">Moto</option><option value="CAR">Carro</option>
        </select>
      </label>
    </section>}
    {pilotExpiry&&<p className="text-xs">Piloto autorizado até {new Date(pilotExpiry).toLocaleString("pt-BR")}</p>}
    <p className="text-xs text-muted-foreground">Município inicial (não substitui a localização real):</p>
    <MunicipalitySelect value={municipality} onChange={setMunicipality} disabled={enabled||busy}/>
    {blocked&&<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
      Radar bloqueado por repasses. <Link to="/perfil" className="underline">Consultar comissões</Link>
    </p>}
    <section aria-label="Status da localização" className="space-y-2 rounded-xl border p-4 text-sm">
      <p className="font-bold">{!ready?"Carregando...":fresh?"Online e no radar":fix?.simulated?"SIMULAÇÃO — somente na sua conta":enabled?"Disponível · aguardando sinal GPS":"Offline"}</p>
      <p>Município: <strong>{municipality||"Aguardando verificação"}</strong></p>
      <p>Coordenadas: <strong>{fix?`${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`:"Não enviadas"}</strong>
        {fix?.simulated?" (centro simulado do município)":""}</p>
      <p>Último sinal: <strong>{fix?fix.at.toLocaleTimeString("pt-BR"):"Aguardando"}</strong></p>
      {enabled&&!fresh&&!fix?.simulated&&<p className="text-muted-foreground">
        Sem GPS confirmado recente, o veículo não aparece no radar público.
      </p>}
      {error&&<p role="alert" className="text-destructive">{error}</p>}
    </section>
    <Button className="min-h-12 w-full"
      disabled={!ready||busy||(!enabled&&(blocked||(!authorized&&!pilotEnabled)))}
      onClick={()=>void toggleOnline(!enabled)}>
      {busy?"Atualizando...":enabled?"Ficar offline":"Ficar disponível e compartilhar GPS"}
    </Button>
    {enabled&&<div className="space-y-2">
      <button type="button" onClick={()=>{
        if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));
        void stop();
      }} className="min-h-12 w-full rounded-xl border p-3 font-semibold">
        Parar compartilhamento de localização
      </button>
      {!sharing&&<button type="button" onClick={()=>{
        if(userId)window.localStorage.setItem(professionalRadarConsentKey(userId),"yes");
        startGps(municipality,pilotVehicle,userId);
      }} className="min-h-12 w-full rounded-xl border p-3 font-semibold">
        Tentar GPS novamente
      </button>}
    </div>}
    {authorized&&<Link to="/viagem-rapida"
      search={buildQuickRideSearch({origin:"",destination:"",municipality})}
      className="flex min-h-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 p-3 text-center text-sm font-semibold">
      Ver pedidos e acompanhar Corrida Rápida
    </Link>}
  </main>;
}
