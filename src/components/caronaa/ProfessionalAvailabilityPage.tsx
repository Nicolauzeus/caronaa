import { Link } from "@tanstack/react-router";
import "./professional-cockpit.css";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publishVerifiedProfessionalPosition } from "@/lib/professional-radar.functions";
import { f07RadarAccuracyBand, f07RadarEvent, f07RadarFailureCode, f07RadarTraceId, type SafeF07RadarEvent } from "@/lib/professional-radar-diagnostics";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";
import { getF07PilotState, activateF07PilotDriver } from "@/lib/quick-rides/f07-pilot.functions";
import { simulateF07TestLocation, clearF07TestLocation } from "@/lib/quick-rides/f07-radar-diagnostic.functions";
import { ProfessionalAccessRequest } from "@/components/caronaa/ProfessionalAccessRequest";
import { MISSING_LABELS, type MissingCode } from "@/lib/professional-access";
import { MunicipalitySelect } from "@/components/caronaa/MunicipalitySelect";
import { QuickRideDriverQueue, type ActiveDriverRide } from "@/components/caronaa/QuickRideDriverQueue";
import { QuickRideOperationalMap } from "@/components/caronaa/QuickRideOperationalMap";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MapPin } from "lucide-react";
import { GoogleMapSurface } from "@/components/caronaa/GoogleMapSurface";

type Fix = { lat:number; lng:number; at:Date; simulated:boolean; accuracyM?:number; heading?:number|null };
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
  const [activeQuickRide,setActiveQuickRide]=useState(false);
  const [hasPendingCalls,setHasPendingCalls]=useState(false);
  const [sheetExpanded,setSheetExpanded]=useState(false);
  const [navigationFocusRequest,setNavigationFocusRequest]=useState(0);
  const sheetTouchStart=useRef<number|null>(null);
  const sheetSwiped=useRef(false);
  const lastRidePhase=useRef<string|null>(null);
  const [activeRide,setActiveRide]=useState<ActiveDriverRide|null>(null);
  const [authorized,setAuthorized]=useState(false);
  const [simpleMototaxi,setSimpleMototaxi]=useState(false);
  const [professionalReview,setProfessionalReview]=useState("");
  const [professionalMissing,setProfessionalMissing]=useState<MissingCode[]>([]);
  const [pilotEnabled,setPilotEnabled]=useState(false);
  const [pilotVehicle,setPilotVehicle]=useState<Vehicle>("MOTO");
  const [pilotExpiry,setPilotExpiry]=useState("");
  const [userId,setUserId]=useState("");
  const [municipality,setMunicipality]=useState("");
  const [sharing,setSharing]=useState(false);
  const [fix,setFix]=useState<Fix|null>(null);
  const [observedFix,setObservedFix]=useState<Fix|null>(null);
  const [accuracyWarning,setAccuracyWarning]=useState(false); // real GPS in the browser, even when publication fails
  const [error,setError]=useState("");
  const [diagnostics,setDiagnostics]=useState<SafeF07RadarEvent[]>([]);
  const [copied,setCopied]=useState(false);
  const [tick,setTick]=useState(Date.now());
  const onAuthorized=useCallback((value:boolean)=>setAuthorized(value),[]);
  const mounted=useRef(true);
  const watch=useRef<number|null>(null);
  const tracking=useRef(false);
  const sending=useRef(false);
  const simulating=useRef(false);
  const lastAttempt=useRef(0);
  const positionHandler=useRef<(position:GeolocationPosition)=>void>(()=>{});
  const record=useCallback((stage:string, details:Omit<Partial<SafeF07RadarEvent>,"at"|"stage">={}, level:"info"|"warn"="info")=>{
    const entry=f07RadarEvent(stage,details);
    // Safe allowlisted fields only: never leak precise GPS coordinates,
    // account identifiers, phone, authentication tokens or raw SQL errors.
    console[level]("[CARONAA][F07][GPS][client]",entry);
    if(mounted.current)setDiagnostics(previous=>[entry,...previous].slice(0,30));
  },[]);

  const discardWatch=useCallback(()=>{
    tracking.current=false;
    if(watch.current!==null && typeof navigator!=="undefined" && navigator.geolocation){
      navigator.geolocation.clearWatch(watch.current);
    }
    watch.current=null;
    if(mounted.current)setSharing(false);
  },[]);

  const stop=useCallback(async()=>{
    record("LOCATION_STOP_REQUEST");
    discardWatch();
    if(mounted.current){setFix(null);setObservedFix(null);setAccuracyWarning(false);}
    await Promise.allSettled([
      (supabase as any).rpc("professional_location_stop"),
      clearTest(),
    ]);
  },[discardWatch,clearTest,record]);

  const onFix=useCallback(async(position:GeolocationPosition)=>{
    if(!tracking.current)return;
    record("GPS_FIX_RECEIVED",{accuracy:f07RadarAccuracyBand(position.coords.accuracy)});
    if(userId && window.localStorage.getItem(professionalRadarConsentKey(userId))!=="yes"){
      record("CONSENT_REVOKED",{},"warn");
      discardWatch();
      void (supabase as any).rpc("professional_location_stop");
      return;
    }
    const {latitude,longitude,accuracy}=position.coords;
    if(!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
       !Number.isFinite(accuracy) || accuracy<0 || accuracy>5000){
      record("GPS_FIX_REJECTED",{code:"GPS_INVALID_FIX"},"warn");
      if(mounted.current)setError("Sinal GPS com precisão insuficiente.");
      return;
    }
    const sampledAtMs=position.timestamp;
    if(!Number.isFinite(sampledAtMs)||sampledAtMs>Date.now()+5000||
        Date.now()-sampledAtMs>25000){
      record("GPS_FIX_REJECTED",{code:"GPS_STALE_SAMPLE"},"warn");
      if(mounted.current)setError("A localização recebida está antiga. Buscando um sinal GPS atualizado.");
      return;
    }
    if(mounted.current){
      setObservedFix({lat:latitude,lng:longitude,at:new Date(sampledAtMs),simulated:false,
        accuracyM:accuracy,heading:position.coords.heading});
      setAccuracyWarning(accuracy>100);
    }
    // The dispatch SQL enforces <=150 m. Never send 5 km coarse fixes and
    // label them as online; keep listening for a better real sensor reading.
    if(accuracy>150){
      record("GPS_FIX_REJECTED",{code:"GPS_LOW_ACCURACY",accuracy:f07RadarAccuracyBand(accuracy)},"warn");
      if(mounted.current)setError(
        "GPS localizado, mas ainda impreciso (aprox. "+Math.round(accuracy)+
        " m). Ative a localização precisa e aproxime-se de uma janela ou área aberta.");
      return;
    }
    if(sending.current||Date.now()-lastAttempt.current<25000)return;
    sending.current=true;
    lastAttempt.current=Date.now();
    const ref=f07RadarTraceId();
    record("SERVER_PUBLISH_REQUEST",{ref,accuracy:f07RadarAccuracyBand(accuracy)});
    try{
      const result=await publishVerified({data:{lat:latitude,lng:longitude,accuracyM:accuracy,sampledAtMs,traceId:ref}});
      if(!tracking.current){
        // Route switch is not withdrawal of consent. Do not let a late
        // server response erase an active watch started on the next page.
        if(!userId || window.localStorage.getItem(professionalRadarConsentKey(userId))!=="yes")
          void (supabase as any).rpc("professional_location_stop");
        return;
      }
      if(result.published){
        record("SERVER_PUBLISH_SUCCESS",{ref:result.traceId??ref,city:result.municipality});
        if(mounted.current){
          setMunicipality(result.municipality);
          setFix({lat:latitude,lng:longitude,at:new Date(sampledAtMs),simulated:false,
            accuracyM:accuracy,heading:position.coords.heading});
          setError("");
        }
        void clearTest().catch(()=>undefined);
      }else{
        record("SERVER_PUBLISH_NOT_PUBLISHED",{ref:result.traceId??ref,code:result.reason,city:result.municipality??undefined},"warn");
        if(mounted.current){
          // Temporary lookup failures do not revoke the last consented fix.
          // A previously published position still expires after 90 seconds.
          if(result.reason==="OUTSIDE_APPROVED_ZONE")setFix(null);
          if(result.reason==="LOCATION_UNKNOWN" || result.reason==="GOOGLE_QUOTA_LIMITED")
            lastAttempt.current=Date.now()+35000; // 60s total before retrying upstream geocoding
          setError(result.reason==="OUTSIDE_APPROVED_ZONE"
            ?"Localização fora dos municípios habilitados; publicação suspensa."
            :result.reason==="GOOGLE_QUOTA_LIMITED"
              ?"O Google Maps atingiu o limite temporário. Nova verificação automática em cerca de 60 segundos."
              :"O Google não conseguiu identificar o município pelo GPS. Tentaremos novamente; confira a API Geocoding e o sinal GPS.");
        }
      }
    }catch(e){
      const code=f07RadarFailureCode(e);
      record("SERVER_PUBLISH_ERROR",{ref,code},"warn");
      if(code==="RATE_LIMITED")
        lastAttempt.current=Date.now()+20000; // 45s total to reduce cross-tab contention
      if(mounted.current)setError(code==="RATE_LIMITED"
        ?"Publicação temporariamente limitada. O GPS continuará ativo e tentará novamente em até 45 segundos."
        :code==="GOOGLE_REVERSE_FAILED"
          ?"Não foi possível confirmar seu município agora. O GPS continuará tentando."
          :code==="GPS_STALE_SAMPLE"
            ?"O sinal GPS chegou atrasado. Uma nova leitura será solicitada automaticamente."
          :code==="GPS_IMPLAUSIBLE_JUMP"
            ?"O GPS detectou um salto improvável. Aguarde a estabilização da localização."
          :code==="GPS_INVALID_FIX"
            ?"O sinal GPS foi rejeitado por precisão inválida. Ative a localização precisa."
          :"Não foi possível publicar o GPS. Consulte o diagnóstico técnico F07.");
    }finally{sending.current=false;}
  },[publishVerified,clearTest,userId,discardWatch,record]);
  positionHandler.current=position=>{void onFix(position);};

  const simulationFallback=useCallback(async(city:string,vehicle:Vehicle,reason:string)=>{
    record("GPS_FALLBACK_REQUEST",{code:"GPS_UNAVAILABLE",city},"warn");
    if(mounted.current)setError("GPS indisponível: "+reason);
    if(!pilotEnabled || !city.trim())return;
    if(simulating.current)return;
    simulating.current=true;
    try{
      const test=await simulateTest({data:{municipality:city,vehicleType:vehicle}});
      if(!mounted.current)return;
      setFix({lat:test.lat,lng:test.lng,at:new Date(test.updatedAt),simulated:true});
      setObservedFix(null);
      setMunicipality(test.municipality);
      setError("SIMULAÇÃO de homologação — centro do município; visível só para a própria conta, nunca usado para despachar viagens.");
      record("SIMULATED_PREVIEW_AVAILABLE",{city:test.municipality});
    }catch(e){
      record("SIMULATED_PREVIEW_FAILED",{code:f07RadarFailureCode(e)},"warn");
      if(mounted.current)setError(
        "Não foi possível criar a prévia simulada.");
    }finally{simulating.current=false;}
  },[pilotEnabled,simulateTest,record]);

  const startGps=useCallback((city:string,vehicle:Vehicle,uid:string)=>{
    if(tracking.current)return;
    record("GPS_START_REQUEST",{city});
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
      record("GPS_BROWSER_ERROR",{code:reason.code===1?"GPS_PERMISSION_DENIED":reason.code===3?"GPS_TIMEOUT":"GPS_UNAVAILABLE"},"warn");
      // A transient timeout is NOT revocation. Keep the browser watcher alive
      // and let the 90-second server cutoff hide stale positions.
      if(reason.code===1){
        discardWatch();
        window.localStorage.removeItem(professionalRadarConsentKey(uid));
        void (supabase as any).rpc("professional_location_stop");
      }
      if(mounted.current)setError(reason.code===1
        ? "Permissão GPS negada. Ative a localização nas configurações do navegador."
        : "Sinal GPS temporariamente indisponível. Continuaremos tentando automaticamente.");
      if(reason.code===1)void simulationFallback(city,vehicle,"Ative a permissão nas configurações de localização do navegador.");
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
  },[discardWatch,simulationFallback,record]);

  useEffect(()=>{
    mounted.current=true;
    let active=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("Entre na sua conta para usar o radar.");
      const [presence,access,profile,pilot]=await Promise.all([
        (supabase as any).from("professional_presence")
          .select("is_available,municipality").eq("user_id",user.id).maybeSingle(),
        (supabase as any).rpc("get_my_professional_access"),
        supabase.from("profiles").select("city").eq("id",user.id).maybeSingle(),
        getPilot().catch(()=>({enabled:false})),
      ]);
      if(!active)return;
      if(presence.error || access.error)throw new Error("Falha ao conferir autorização ou presença.");
      const registeredCity=String(access.data?.request?.municipality??"");
      const candidate=registeredCity==="MACICO_BATURITE"||registeredCity==="FORTALEZA"
        ? "":registeredCity;
      setUserId(user.id);
      setAuthorized(access.data?.authorized===true);
      const simple = access.data?.request?.access_type === "MOTOTAXI_SIMPLE";
      setSimpleMototaxi(simple);
      setProfessionalReview(String(access.data?.request?.status ?? ""));
      setProfessionalMissing(simple && Array.isArray(access.data?.profileMissing)
        ? access.data.profileMissing.filter((code: unknown): code is MissingCode =>
            typeof code === "string" && Object.prototype.hasOwnProperty.call(MISSING_LABELS, code))
        : []);
      const registeredVehicle=access.data?.request?.vehicle_type;
      if(registeredVehicle==="CAR"||registeredVehicle==="MOTO")
        setPilotVehicle(registeredVehicle);
      setPilotEnabled(pilot.enabled===true);
      setMunicipality(String(presence.data?.municipality||profile.data?.city||candidate).trim());
      setEnabled(presence.data?.is_available===true && access.data?.authorized===true);
      record("INITIAL_STATE",{
        city:String(presence.data?.municipality||profile.data?.city||candidate).trim()||undefined,
        authorized:access.data?.authorized===true,
        presenceOnline:presence.data?.is_available===true,
      });
      setReady(true);
    })().catch(e=>{if(active){
      record("INITIAL_STATE_FAILED",{code:"NETWORK_OR_SERVER_ERROR"},"warn");
      setReady(true);setError(e instanceof Error?e.message:"Falha no radar.");
    }});
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
    if(!ready||!enabled||!authorized||!userId||tracking.current||fix?.simulated)return;
    if(window.localStorage.getItem(professionalRadarConsentKey(userId))==="yes"){
      startGps(municipality,pilotVehicle,userId);
    }
  },[ready,enabled,authorized,userId,municipality,pilotVehicle,startGps,fix?.simulated]);

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
    record(next?"ONLINE_REQUEST":"OFFLINE_REQUEST",{city:municipality,authorized});
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
      if(error){
        record("PRESENCE_ENABLE_FAILED",{code:String(error.code??"PRESENCE_RPC_ERROR")},"warn");
        throw error;
      }
      record("PRESENCE_ENABLED",{city:municipality,presenceOnline:true});
      setEnabled(true);
      // The user explicitly chose availability + GPS in ONE labeled button.
      if(userId)window.localStorage.setItem(professionalRadarConsentKey(userId),"yes");
      startGps(municipality,pilotVehicle,userId);
    }catch(e){
      record("PRESENCE_TRANSITION_FAILED",{code:f07RadarFailureCode(e)},"warn");
      setError(e instanceof Error?e.message:"Não foi possível mudar a disponibilidade.");
    }finally{setBusy(false);}
  }

  // Mobile keeps GPS feedback legible without exposing raw database errors.
  const visibleGpsError=/^(GPS |Permissão GPS|Sinal GPS|Localização |O Google|Não foi possível publicar o GPS|Publicação temporariamente|SIMULAÇÃO de homologação)/.test(error)
    ? error
    : enabled
      ? "Não foi possível confirmar sua posição no radar. Verifique a permissão de GPS e tente novamente."
      : "Não foi possível atualizar sua disponibilidade. Tente novamente.";
  const fresh=!!fix && !fix.simulated && tick-fix.at.getTime()<90000 && enabled && sharing;
  const observedFresh=!!observedFix && tick-observedFix.at.getTime()<90000 && enabled && sharing;
  const mapFix=fresh ? fix : observedFresh ? observedFix : fix?.simulated ? fix : null;
  // Local watchPosition updates the driver's camera immediately. The backend
  // remains authoritative for ride states, arrival validation and payments.
  const liveNavigationFix=[observedFix,fix].find(point=>point&&!point.simulated&&
    (point.accuracyM??Infinity)<=150&&tick-point.at.getTime()<20000)??null;
  useEffect(()=>{
    const next=activeRide?.id+":"+activeRide?.status;
    if(!activeRide){lastRidePhase.current=null;return;}
    if(next===lastRidePhase.current)return;
    lastRidePhase.current=next;
    // On acceptance show the route; on arrival open the code field; after
    // validating the OTP return to the full navigation map automatically.
    if(activeRide.status==="ARRIVED")setSheetExpanded(true);
    else if(activeRide.status==="ACCEPTED"||activeRide.status==="IN_PROGRESS")
      setSheetExpanded(false);
  },[activeRide?.id,activeRide?.status]);
  const sheetOpen=activeQuickRide?sheetExpanded:(hasPendingCalls||sheetExpanded);
  const followRideOnMap=useCallback((rideId:string)=>{
    // The driver explicitly asks to see the map: do not wait for another
    // automatic phase transition or force the user to leave this screen.
    if(activeRide?.id!==rideId)return;
    setSheetExpanded(false);
    setNavigationFocusRequest(previous=>previous+1);
  },[activeRide?.id]);
  return <div className="professional-cockpit">
    {activeRide && <div className="professional-cockpit__map">
      <QuickRideOperationalMap rideId={activeRide.id} status={activeRide.status}
        role="DRIVER" immersive vehicleType={activeRide.vehicle_type==="MOTO"?"MOTO":"CAR"}
        navigationFocusRequest={navigationFocusRequest}
        liveDriverFix={liveNavigationFix?{
          lat:liveNavigationFix.lat,lng:liveNavigationFix.lng,
          sampledAtMs:liveNavigationFix.at.getTime(),
          accuracyM:liveNavigationFix.accuracyM??Infinity,
          heading:liveNavigationFix.heading,
        }:null} />
    </div>}
    {!activeRide&&<section aria-label="Mapa do motorista" className="professional-cockpit__map">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Seu mapa em tempo real</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${fresh ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>
          {fresh ? "GPS publicado no radar" : observedFresh ? "GPS local · publicação pendente" :
            mapFix?.simulated ? "SIMULAÇÃO · só você" : "Aguardando GPS"}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-xl border">
        <GoogleMapSurface
          points={mapFix ? [{id:"self-professional",lat:mapFix.lat,lng:mapFix.lng,
            title: mapFix.simulated ? "Prévia simulada, não publicada" :
              fresh ? "Sua posição publicada" : "Posição apenas neste navegador",
            kind:"driver",label:"EU"}] : []}
          fitMode="once" smoothTracking
          showControls gestureHandling="greedy"
          fitKey="professional-home-position"
          className="h-full w-full"
          ariaLabel="Mapa da posição atual do motorista"
        />
        {!mapFix && <div role="status" className="professional-cockpit__map-status pointer-events-none absolute inset-x-3 bottom-3 rounded-lg border bg-background/95 p-3 text-center text-xs font-semibold shadow">
          Aguardando localização real. Ative ou autorize o GPS para centralizar o mapa.
        </div>}
      </div>
      <p className="text-xs text-muted-foreground">
        {fresh ? `Última publicação confirmada às ${fix?.at.toLocaleTimeString("pt-BR")}. Município verificado: ${municipality}.` :
          observedFresh ? "Localização capturada no aparelho, mas ainda NÃO publicada. Você não está visível no radar." :
          mapFix?.simulated ? "A posição simulada é apenas para homologação e não recebe pedidos reais." :
          "Nenhuma posição válida publicada. O município do cadastro não substitui o GPS."}
      </p>
    </section>}

    <div className="professional-cockpit__columns">
      <div className="professional-cockpit__mobile-header" role="status">
        <span className="text-[11px] font-black tracking-wider text-[#FFBB00]">CARONAA</span>
        <span className={`professional-cockpit__mobile-pill ${fresh ? "professional-cockpit__mobile-pill--online" : ""}`}>
          <span className={`professional-cockpit__status-dot ${fresh ? "professional-cockpit__status-dot--online" : ""}`} aria-hidden="true"/>
          {!ready ? "Verificando..." : fresh ? "Disponível" : enabled ? "Buscando GPS" : "Você está Offline"}
          {fresh && municipality && <span className="max-w-[125px] truncate">· {municipality}</span>}
        </span>
      </div>
      <div className="professional-cockpit__left">
        <div className="professional-cockpit__card professional-cockpit__heading space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFBB00]/80">CARONAA MOTORISTA</span>
            <Link to="/cadastro-motorista" className="shrink-0 text-xs font-semibold text-[#FFBB00] hover:underline">Editar dados</Link>
          </div>
          <h1 className="professional-cockpit__title text-white">Cockpit Operacional</h1>
          <p className="text-xs leading-relaxed text-white/65">Acompanhe chamados, viagens e disponibilidade.</p>
        </div>
    {/* GPS, consent and dispatch logic are unchanged; only presentation differs.
        The legacy one-tap action "Ficar disponível e compartilhar GPS" remains the
        same operational command; its shorter visible label is "Ficar Disponível". */}
    <section className="professional-cockpit__card space-y-3" aria-label="Controle de disponibilidade">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span role="status" className={`professional-cockpit__status-pill rounded-full px-3 py-1.5 text-xs font-bold ${!ready
          ? "border border-white/15 bg-white/10 text-white/60"
          : fresh
            ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            : enabled
              ? "border border-amber-500/30 bg-amber-500/15 text-amber-400"
              : "bg-white/10 text-white/60"}`}>
          <span aria-hidden="true" className={`professional-cockpit__status-dot ${fresh ? "professional-cockpit__status-dot--online" : ""}`} />
          {!ready ? "Verificando cadastro" : fresh ? "Online" : enabled ? "Aguardando GPS" : "Offline"}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-white/65">
          <MapPin aria-hidden="true" size={13} className="shrink-0 text-[#FFBB00]" />
          <span className="max-w-[145px] truncate">{municipality || "Município não confirmado"}</span>
        </span>
      </div>
      <p className="professional-cockpit__status-description text-xs leading-relaxed text-white/65">
        {!ready ? "Verificando sua disponibilidade." :
          fresh ? "Localização verificada. Você pode receber chamados." :
          enabled ? "Disponibilidade ativada. Aguardando confirmação da localização." :
          "Ative sua disponibilidade quando estiver pronto para receber chamados."}
      </p>
      {!authorized && ready && (
        <div role="status" className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-semibold">{professionalReview === "PENDING"
            ? "Confirme seus dados para concluir a habilitação."
            : professionalReview === "CHANGES_REQUESTED"
              ? "O cadastro possui uma restrição anterior. Procure o suporte CARONAA."
              : professionalReview === "REJECTED"
                ? "O cadastro possui uma restrição anterior. Procure o suporte CARONAA."
                : "Complete o cadastro profissional para receber corridas."}</p>
          {simpleMototaxi && professionalMissing.length > 0 && (
            <div role="alert">
              <p className="text-xs font-bold">Dados que faltam:</p>
              <ul className="ml-4 list-disc space-y-0.5 text-xs">
                {professionalMissing.map(code => <li key={code}>{MISSING_LABELS[code]}</li>)}
              </ul>
            </div>
          )}
          {professionalReview !== "CHANGES_REQUESTED" && professionalReview !== "REJECTED" &&
            pilotVehicle==="MOTO" && (
            <Link to="/cadastro-motorista"
              className="inline-flex min-h-11 items-center rounded-xl bg-[#FFBB00] px-4 py-2 font-bold text-[#121212]">
              {professionalMissing.length ? "Corrigir dados profissionais" : "Concluir cadastro e habilitar corridas"}
            </Link>
          )}
          {professionalReview !== "CHANGES_REQUESTED" && professionalReview !== "REJECTED" &&
            pilotVehicle==="CAR" && (
            <p className="text-xs text-amber-100/80">
              Para concluir a habilitação de carro, abra Configurações do motorista e confirme os dados profissionais.
            </p>
          )}
        </div>
      )}
      <Button
        variant={enabled ? "outline" : "default"}
        className={`professional-cockpit__availability-button min-h-14 w-full rounded-2xl font-[Sora] text-base font-black transition-colors ${enabled
          ? "border-amber-400/55 bg-transparent text-amber-200 hover:border-amber-300 hover:bg-amber-400/10 hover:text-amber-100"
          : "bg-[#FFBB00] text-[#121212] hover:bg-[#eeb000]"}`}
        disabled={!ready||busy||(enabled&&activeQuickRide)||(!enabled&&(!authorized&&!pilotEnabled))}
        onClick={()=>void toggleOnline(!enabled)}>
        {busy ? "Atualizando..." : enabled && activeQuickRide ? "Finalize a corrida antes de pausar" : enabled ? "PAUSAR DISPONIBILIDADE" : "FICAR ONLINE AGORA"}
      </Button>
      {enabled && !sharing && <button type="button" onClick={()=>{
        if(userId)window.localStorage.setItem(professionalRadarConsentKey(userId),"yes");
        startGps(municipality,pilotVehicle,userId);
      }} className="min-h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10">
        Tentar compartilhar GPS novamente
      </button>}
    </section>
    {error && <div role="alert" className="professional-cockpit__banner">
      <AlertTriangle size={15} className="shrink-0 text-[#FFBB00]" aria-hidden="true"/>
      <span className="text-white/90">{visibleGpsError}</span>
    </div>}
    {accuracyWarning && enabled && <div role="status" className="professional-cockpit__banner">
      <AlertTriangle size={15} className="shrink-0 text-amber-300" aria-hidden="true"/>
      <span className="text-white/85">Localização com precisão reduzida. Verifique seu sinal.</span>
    </div>}

      </div>
      <div className="professional-cockpit__right" data-expanded={sheetOpen ? "true" : "false"} data-can-start={ready && !enabled && (authorized || pilotEnabled) ? "true" : "false"}>
        <button
          type="button"
          className="professional-cockpit__sheet-toggle"
          aria-label={activeRide ? sheetOpen
            ? "Recolher painel e mostrar navegação"
            : "Expandir painel da corrida e código de embarque"
            : ready && !enabled && (authorized || pilotEnabled) && !sheetExpanded
              ? "FICAR ONLINE AGORA" : sheetOpen ? "Recolher painel de chamados" : "Abrir painel de chamados e disponibilidade"}
          aria-expanded={sheetOpen}
          onTouchStart={event=>{sheetTouchStart.current=event.touches[0]?.clientY??null;}}
          onTouchEnd={event=>{
            const last=event.changedTouches[0]?.clientY;
            const start=sheetTouchStart.current;sheetTouchStart.current=null;
            if(start===null||last===undefined||Math.abs(last-start)<36)return;
            sheetSwiped.current=true;
            setSheetExpanded(last<start);
          }}
          onClick={()=>{
            if(sheetSwiped.current){sheetSwiped.current=false;return;}
            if (ready && !enabled && (authorized || pilotEnabled) && !sheetExpanded && !activeRide) void toggleOnline(true);
            else setSheetExpanded(v=>!v);
          }}>
          <span className="professional-cockpit__sheet-handle" aria-hidden="true"/>
          <span>{activeRide
            ? activeRide.status==="ARRIVED" ? "Embarque · inserir código" :
              activeRide.status==="IN_PROGRESS" ? "Em viagem · acompanhar destino" : "A caminho do passageiro"
            : hasPendingCalls ? "Novos chamados" : ready && !enabled && (authorized || pilotEnabled) && !sheetExpanded ? "FICAR ONLINE AGORA" : "Chamados e disponibilidade"}</span>
        </button>
        {!activeRide&&<div className="professional-cockpit__mobile-connection">
          <Button variant={enabled ? "outline" : "default"}
            className={`professional-cockpit__availability-button min-h-14 w-full rounded-2xl font-[Sora] text-base font-black ${enabled
              ? "border border-[#FFBB00] bg-[#121212] text-[#FFBB00]"
              : "bg-[#FFBB00] text-[#121212]"}`}
            disabled={!ready||busy||(enabled&&activeQuickRide)||(!enabled&&(!authorized&&!pilotEnabled))}
            onClick={()=>void toggleOnline(!enabled)}>
            {busy ? "Atualizando..." : enabled && activeQuickRide ? "Finalize a corrida antes de pausar" : enabled ? "PAUSAR DISPONIBILIDADE" : "FICAR ONLINE AGORA"}
          </Button>
          {!authorized && ready && <p role="alert" className="mt-2 text-xs text-amber-300">Finalize os dados profissionais para receber corridas.</p>}
        </div>}
    <QuickRideDriverQueue
      onActiveChange={setActiveQuickRide}
      onActiveRideChange={setActiveRide}
      onHasPendingChange={setHasPendingCalls}
      onFollowMap={followRideOnMap}
      municipality={municipality}
      online={enabled && authorized}
      gpsReady={fresh}
    />

        <details className="professional-cockpit__card professional-cockpit__advanced">
          <summary className="cursor-pointer text-xs font-semibold text-white/50 transition-colors hover:text-white/80">Configurações do motorista</summary>
          <div className="professional-cockpit__details mt-3 space-y-3">
    <div className="space-y-2">
      <h3 className="font-semibold text-white">Privacidade da localização</h3>
      {error && <details className="hidden sm:block opacity-40"><summary className="cursor-pointer text-xs">Detalhes técnicos</summary><p className="mt-1 break-words text-xs">{error}</p></details>}
      <p className="text-xs text-white/70">Você pode retirar seu consentimento de GPS a qualquer momento. Isso impede novos chamados enquanto estiver sem localização válida.</p>
      {enabled && <button type="button" onClick={()=>{
        if(userId)window.localStorage.removeItem(professionalRadarConsentKey(userId));
        void stop();
      }} className="min-h-11 w-full rounded-xl border px-3 text-sm font-semibold">
        Parar compartilhamento de GPS
      </button>}
    </div>
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
    <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-semibold">Município inicial e configurações</summary>
      <p className="my-2 text-xs text-muted-foreground">A cidade selecionada não limita sua atuação: o GPS verificado define onde você pode receber pedidos.</p>
      <MunicipalitySelect value={municipality} onChange={setMunicipality} disabled={enabled||busy}/>
    </details>

    <section aria-label="Status da localização" className="hidden space-y-2 rounded-xl border p-4 text-sm sm:block">
      <p className="font-bold">{!ready?"Carregando...":fresh?"Online e transmitindo GPS":fix?.simulated?"SIMULAÇÃO — somente na sua conta":enabled?"Disponível · aguardando sinal GPS":"Offline"}</p>
      <p>Município: <strong>{municipality||"Aguardando verificação"}</strong></p>
      <p>Coordenadas: <strong>{fix?`${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`:"Não enviadas"}</strong>
        {fix?.simulated?" (centro simulado do município)":""}</p>
      <p>Último sinal: <strong>{fix?fix.at.toLocaleTimeString("pt-BR"):"Aguardando"}</strong></p>
      {enabled&&!fresh&&!fix?.simulated&&<p className="text-muted-foreground">
        Sem GPS confirmado recente, o veículo não aparece no radar público.
      </p>}
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      {(error.includes("DB_WRITE_FAILED") || error.includes("DB_SCHEMA_MISMATCH")) && <p className="text-xs text-muted-foreground">
        GPS obtido, mas o banco recusou a publicação. Procure nos logs do servidor a referência (ref)
        do diagnóstico F07 e confira SQLSTATE, autorização e migrations. A posição não foi publicada.
      </p>}
    </section>
    <details className="hidden rounded-xl border border-muted-foreground/30 p-4 text-sm opacity-40 sm:block">
      <summary className="cursor-pointer font-semibold">Diagnóstico técnico F07 ({diagnostics.length} eventos)</summary>
      <p className="my-2 text-xs text-muted-foreground">Eventos também aparecem no Console sob [CARONAA][F07][GPS]. Este relatório não inclui coordenadas exatas, identidade, senhas nem tokens.</p>
      <button type="button" className="mb-2 min-h-10 rounded-lg border px-3"
        onClick={()=>void navigator.clipboard.writeText(
          diagnostics.slice().reverse().map(entry=>JSON.stringify(entry)).join("\n")
        ).then(()=>setCopied(true)).catch(()=>setCopied(false))}>
        {copied?"Log copiado":"Copiar diagnóstico sem GPS"}
      </button>
      <pre aria-label="Eventos do radar" className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-2 text-xs">
        {diagnostics.length ? diagnostics.map(entry=>JSON.stringify(entry)).join("\n") : "Nenhum evento registrado."}
      </pre>
    </details>


          </div>
        </details>
      </div>
    </div>
  </div>;
}
