import { useCallback, useEffect, useRef, useState } from "react";
import { setFlashDriverOffline, setFlashDriverOnline, updateFlashDriverHeartbeatGPS, FlashDriverError, type FlashDriverOnlineInput } from "@/services/flash-driver-service";

export type DriverGpsFix={lat:number;lng:number;accuracyM:number;at:number};
export type FlashPresenceState={
  online:boolean;busy:boolean;gps:DriverGpsFix|null;
  gpsConnected:boolean;error:string|null;
  phase:"idle"|"connecting"|"publishing"|"online";
};
const INITIAL:FlashPresenceState={online:false,busy:false,gps:null,gpsConnected:false,error:null,phase:"idle"};
export const FLASH_GPS_THROTTLE_MS=4000;
export const FLASH_GPS_STALE_MS=60000;
function gpsFailure(error:unknown):string{
  if(error instanceof FlashDriverError&&error.code==="MIGRATION_REQUIRED")
    return "O servidor ainda aplica uma restrição financeira desatualizada. Solicite a aplicação da migration 0212.";
  if(error instanceof FlashDriverError&&error.code==="ACCESS_DENIED")
    return "Acesso profissional não autorizado. Confira seu cadastro e sua habilitação.";
  if(error instanceof FlashDriverError&&error.code==="UNAVAILABLE")
    return "Serviço Flash indisponível no momento. Verifique a configuração e tente novamente.";
  return "GPS indisponível. Ative a localização e tente novamente.";
}
const sample=(pos:GeolocationPosition):DriverGpsFix=>({
  lat:pos.coords.latitude,lng:pos.coords.longitude,
  accuracyM:pos.coords.accuracy,at:pos.timestamp,
});
export function useFlashDriverPresence(){
  const [state,setState]=useState<FlashPresenceState>(INITIAL);
  const watch=useRef<number|null>(null);
  const staleTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const lastGpsAt=useRef(0);
  const lastSentAt=useRef(0);
  const sending=useRef(false);
  const active=useRef(false);
  const inFlightStart=useRef(false);
  const currentFix=useRef<DriverGpsFix|null>(null);
  const stopWatch=useCallback(()=>{
    if(watch.current!==null && typeof navigator!=="undefined"&&navigator.geolocation)
      navigator.geolocation.clearWatch(watch.current);
    watch.current=null;
    if(staleTimer.current!==null)clearInterval(staleTimer.current);
    staleTimer.current=null;
  },[]);
  const sendHeartbeat=useCallback(async(fix:DriverGpsFix,force=false)=>{
    if(!active.current||sending.current)return false;
    if(!force && Date.now()-lastSentAt.current<FLASH_GPS_THROTTLE_MS)return true;
    sending.current=true;
    try{
      await updateFlashDriverHeartbeatGPS(fix.lat,fix.lng,fix.accuracyM);
      lastSentAt.current=Date.now();
      setState(s=>({...s,gpsConnected:true,error:null}));
      return true;
    }catch(error){
      setState(s=>({...s,gpsConnected:false,error:gpsFailure(error)}));
      return false;
    }finally{sending.current=false;}
  },[]);
  const markOffline=useCallback(async()=>{
    active.current=false;
    stopWatch();
    setState(s=>({...s,busy:true,gpsConnected:false}));
    try{await setFlashDriverOffline();
      setState(s=>({...s,online:false,busy:false,error:null,phase:"idle"}));
    }catch{
      // Do not claim offline was committed if the server rejected the change.
      setState(s=>({...s,busy:false,error:"Não foi possível confirmar o modo indisponível no servidor."}));
    }
  },[stopWatch]);

  const goOnline=useCallback(async(input:FlashDriverOnlineInput)=>{
    if(active.current||inFlightStart.current)return false;
    if(typeof window==="undefined"||!window.isSecureContext||!navigator.geolocation){
      setState(s=>({...s,error:"O GPS precisa de HTTPS e permissão de localização."}));return false;
    }
    inFlightStart.current=true;
    setState(s=>({...s,busy:true,error:null,gpsConnected:false,phase:"connecting"}));
    let serverActivated=false;
    try{
      // Warm GPS and authorized server presence concurrently. The map/radar
      // stays unavailable until a fresh, real sample is acknowledged by SQL.
      const [presenceResult,gpsResult]=await Promise.allSettled([
        setFlashDriverOnline(input),
        new Promise<GeolocationPosition>((resolve,reject)=>
          navigator.geolocation.getCurrentPosition(resolve,reject,{
            enableHighAccuracy:true,timeout:15000,maximumAge:10000,
          })),
      ]);
      if(presenceResult.status==="rejected")throw presenceResult.reason;
      serverActivated=true;
      if(gpsResult.status==="rejected")throw gpsResult.reason;
      const initial=sample(gpsResult.value);
      const age=Date.now()-initial.at;
      if(!Number.isFinite(initial.lat)||!Number.isFinite(initial.lng)||
         !Number.isFinite(initial.accuracyM)||initial.accuracyM<=0||initial.accuracyM>5000||
         !Number.isFinite(age)||age< -5000||age>10000)
        throw new FlashDriverError("INVALID");
      setState(s=>({...s,phase:"publishing"}));
      active.current=true;
      lastGpsAt.current=Date.now();
      currentFix.current=initial;
      setState(s=>({...s,gps:initial}));
      // A successful online RPC is not sufficient to claim connected GPS:
      // GPS publication must still be acknowledged.
      const published=await sendHeartbeat(initial,true);
      if(!published)throw new FlashDriverError("UNAVAILABLE");
      setState(s=>({...s,online:true,gpsConnected:true,phase:"online"}));
      watch.current=navigator.geolocation.watchPosition(pos=>{
        if(!active.current)return;
        const fix=sample(pos);
        const age=Date.now()-fix.at;
        if(!Number.isFinite(fix.lat)||!Number.isFinite(fix.lng)||
           !Number.isFinite(fix.accuracyM)||fix.accuracyM<=0||fix.accuracyM>5000||
           !Number.isFinite(age)||age< -5000||age>25000){
          setState(state=>({...state,gpsConnected:false,
            error:"O GPS está impreciso. Aguardando uma localização válida."}));
          return;
        }
        lastGpsAt.current=fix.at;
        currentFix.current=fix;
        setState(s=>({...s,gps:fix}));
        void sendHeartbeat(fix);
      },()=>{
        setState(s=>({...s,gpsConnected:false,error:"Sinal GPS perdido. Verifique a localização."}));
      },{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
      staleTimer.current=setInterval(()=>{
        if(!active.current)return;
        const age=Date.now()-lastGpsAt.current;
        const backendAge=Date.now()-lastSentAt.current;
        if(age>FLASH_GPS_STALE_MS||backendAge>FLASH_GPS_STALE_MS){
          active.current=false;
          stopWatch();
          setState(s=>({...s,gpsConnected:false,error:"Sem GPS por mais de 60 segundos. Disponibilidade encerrada."}));
          void setFlashDriverOffline().then(()=>setState(s=>({...s,online:false}))).catch(()=>
            setState(s=>({...s,error:"GPS expirado; o servidor deve encerrar a presença por TTL."})));
        }else if(currentFix.current&&Date.now()-lastSentAt.current>=FLASH_GPS_THROTTLE_MS){
          void sendHeartbeat(currentFix.current);
        }
      },4000);
      return true;
    }catch(error){
      active.current=false;
      stopWatch();
      setState(s=>({...s,online:false,gpsConnected:false,phase:"idle",error:gpsFailure(error)}));
      // Only rollback a presence transition confirmed by this attempt.
      // SQL still enforces its TTL in case the compensating RPC fails.
      if(serverActivated)void setFlashDriverOffline().catch(()=>undefined);
      return false;
    }finally{
      inFlightStart.current=false;
      setState(s=>({...s,busy:false}));
    }
  },[sendHeartbeat,stopWatch]);

  useEffect(()=>{
    // Backgrounding or route navigation is not an explicit offline request.
    // Stop this local sensor on unmount; server TTL prevents ghost drivers.
    // Only the "Ficar Indisponível" action requests permanent offline.
    return()=>{active.current=false;stopWatch();};
  },[stopWatch]);
  return {...state,goOnline,markOffline};
}
