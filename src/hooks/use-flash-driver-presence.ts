import { useCallback, useEffect, useRef, useState } from "react";
import { setFlashDriverOffline, setFlashDriverOnline, pingFlashDriverPresence, updateFlashDriverHeartbeatGPS, FlashDriverError, type FlashDriverOnlineInput } from "@/services/flash-driver-service";

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
  const presenceTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const lastGpsAt=useRef(0);
  const lastSentAt=useRef(0);
  const sending=useRef(false);
  const active=useRef(false);
  const inFlightStart=useRef(false);
  const currentFix=useRef<DriverGpsFix|null>(null);
  const currentMunicipality=useRef("");
  const stopWatch=useCallback(()=>{
    if(watch.current!==null && typeof navigator!=="undefined"&&navigator.geolocation)
      navigator.geolocation.clearWatch(watch.current);
    watch.current=null;
    if(staleTimer.current!==null)clearInterval(staleTimer.current);
    staleTimer.current=null;
    if(presenceTimer.current!==null)clearInterval(presenceTimer.current);
    presenceTimer.current=null;
  },[]);
  const sendHeartbeat=useCallback(async(fix:DriverGpsFix,force=false)=>{
    if(!active.current||sending.current)return false;
    if(!force && Date.now()-lastSentAt.current<FLASH_GPS_THROTTLE_MS)return true;
    sending.current=true;
    try{
      await updateFlashDriverHeartbeatGPS(fix.lat,fix.lng,fix.accuracyM,currentMunicipality.current);
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
    if(typeof window==="undefined")return false;
    inFlightStart.current=true;
    setState(s=>({...s,busy:true,error:null,gpsConnected:false}));
    try{
      // Online presence and dispatch eligibility are intentionally different.
      // Do not block pressing 'Ficar disponível' on GPS permission/accuracy,
      // registration region, Pix, or delayed device sensor initialization.
      currentMunicipality.current=input.municipality??"";
      await setFlashDriverOnline(input);
      active.current=true;
      lastGpsAt.current=0;
      lastSentAt.current=0;
      setState(s=>({...s,online:true,gpsConnected:false,error:null}));
      const ping=()=>{if(active.current&&navigator.onLine)
        void pingFlashDriverPresence().catch(()=>undefined);};
      void ping();
      presenceTimer.current=setInterval(ping,20000);

      if(navigator.geolocation&&window.isSecureContext){
        watch.current=navigator.geolocation.watchPosition(pos=>{
          if(!active.current)return;
          const fix=sample(pos);
          if(!Number.isFinite(fix.accuracyM)||fix.accuracyM<=0||fix.accuracyM>150){
            setState(state=>({...state,gpsConnected:false,
              error:"Online. Aguardando GPS com precisão suficiente para receber pedidos."}));
            return;
          }
          lastGpsAt.current=fix.at;
          currentFix.current=fix;
          setState(state=>({...state,gps:fix}));
          void sendHeartbeat(fix);
        },()=>{
          if(active.current)setState(state=>({...state,gpsConnected:false,
            error:"Online. Localização pendente: autorize o GPS para receber pedidos."}));
        },{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
      }else{
        setState(state=>({...state,error:"Online. GPS indisponível neste dispositivo; pedidos aguardam localização autorizada."}));
      }
      staleTimer.current=setInterval(()=>{
        if(!active.current)return;
        const age=Date.now()-lastGpsAt.current;
        const backendAge=Date.now()-lastSentAt.current;
        if(age>FLASH_GPS_STALE_MS||backendAge>FLASH_GPS_STALE_MS){
          setState(state=>state.gpsConnected?({...state,gpsConnected:false,
            error:"Online. GPS desatualizado; reconectando para receber pedidos."}):state);
        }
        if(navigator.onLine&&currentFix.current&&age<30000&&
          Date.now()-lastSentAt.current>=FLASH_GPS_THROTTLE_MS){
          void sendHeartbeat(currentFix.current);
        }
      },4000);
      return true;
    }catch(error){
      active.current=false;
      stopWatch();
      setState(state=>({...state,online:false,gpsConnected:false,error:gpsFailure(error)}));
      return false;
    }finally{
      inFlightStart.current=false;
      setState(state=>({...state,busy:false}));
    }
  },[sendHeartbeat,stopWatch]);

  useEffect(()=>{
    const resume=()=>{
      if(!active.current||!navigator.onLine)return;
      const recent=currentFix.current;
      if(recent&&Date.now()-recent.at<30000){
        void sendHeartbeat(recent,true);
      }else if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(position=>{
          if(!active.current)return;
          const fix=sample(position);
          if(!Number.isFinite(fix.accuracyM)||fix.accuracyM<=0||fix.accuracyM>150)return;
          currentFix.current=fix;lastGpsAt.current=fix.at;
          setState(s=>({...s,gps:fix}));
          void sendHeartbeat(fix,true);
        },()=>undefined,{enableHighAccuracy:true,maximumAge:10000,timeout:12000});
      }
    };
    window.addEventListener("online",resume);
    window.addEventListener("pageshow",resume);
    window.addEventListener("focus",resume);
    return()=>{
      window.removeEventListener("online",resume);
      window.removeEventListener("pageshow",resume);
      window.removeEventListener("focus",resume);
    };
  },[sendHeartbeat]);

  useEffect(()=>()=>{// Suspending a PWA or navigating never forces an offline transition.
    // Heartbeats expire naturally; explicit 'Ficar indisponível' remains the
    // only user action that clears presence before server TTL.
    active.current=false;
    stopWatch();
  },[stopWatch]);
  return {...state,goOnline,markOffline};
}
