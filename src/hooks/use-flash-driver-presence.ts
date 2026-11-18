import { useCallback, useEffect, useRef, useState } from "react";
import { setFlashDriverOffline, setFlashDriverOnline, updateFlashDriverHeartbeatGPS, FlashDriverError, type FlashDriverOnlineInput } from "@/services/flash-driver-service";

export type DriverGpsFix={lat:number;lng:number;accuracyM:number;at:number};
export type FlashPresenceState={
  online:boolean;busy:boolean;gps:DriverGpsFix|null;
  gpsConnected:boolean;error:string|null;
};
const INITIAL:FlashPresenceState={online:false,busy:false,gps:null,gpsConnected:false,error:null};
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
  accuracyM:pos.coords.accuracy,at:Date.now(),
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
      setState(s=>({...s,online:false,busy:false,error:null}));
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
    setState(s=>({...s,busy:true,error:null,gpsConnected:false}));
    try{
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>
        navigator.geolocation.getCurrentPosition(resolve,reject,{
          enableHighAccuracy:true,timeout:15000,maximumAge:0,
        }));
      const initial=sample(position);
      if(!Number.isFinite(initial.accuracyM)||initial.accuracyM<=0||initial.accuracyM>5000)
        throw new FlashDriverError("INVALID");
      await setFlashDriverOnline(input);
      active.current=true;
      lastGpsAt.current=Date.now();
      currentFix.current=initial;
      setState(s=>({...s,gps:initial}));
      // A successful online RPC is not sufficient to claim connected GPS:
      // GPS publication must still be acknowledged.
      const published=await sendHeartbeat(initial,true);
      if(!published)throw new FlashDriverError("UNAVAILABLE");
      setState(s=>({...s,online:true,gpsConnected:true}));
      watch.current=navigator.geolocation.watchPosition(pos=>{
        if(!active.current)return;
        const fix=sample(pos);
        if(!Number.isFinite(fix.accuracyM)||fix.accuracyM<=0||fix.accuracyM>5000){
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
      },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
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
      setState(s=>({...s,online:false,gpsConnected:false,error:gpsFailure(error)}));
      // The activation RPC may have succeeded before a browser GPS exception.
      // Best-effort rollback; the server must also enforce a 60-second TTL.
      void setFlashDriverOffline().catch(()=>undefined);
      return false;
    }finally{
      inFlightStart.current=false;
      setState(s=>({...s,busy:false}));
    }
  },[sendHeartbeat,stopWatch]);

  useEffect(()=>{
    const close=()=>{
      if(!active.current)return;
      active.current=false;
      // Browsers do not guarantee asynchronous RPC completion on page unload.
      // The backend TTL is the authoritative defense against ghost drivers.
      void setFlashDriverOffline().catch(()=>undefined);
    };
    window.addEventListener("pagehide",close);
    window.addEventListener("beforeunload",close);
    return()=>{
      window.removeEventListener("pagehide",close);
      window.removeEventListener("beforeunload",close);
      const wasActive=active.current;
      active.current=false;
      stopWatch();
      if(wasActive)void setFlashDriverOffline().catch(()=>undefined);
    };
  },[stopWatch]);
  return {...state,goOnline,markOffline};
}
