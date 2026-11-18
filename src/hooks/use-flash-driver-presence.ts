import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishVerifiedProfessionalPosition } from "@/lib/professional-radar.functions";
import { GPS_POLICY, isFreshGpsTimestamp } from "@/lib/location/gps-policy";
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
  if(error instanceof FlashDriverError&&error.code==="COMMISSION_BLOCKED")
    return "Você possui 3 repasses pendentes. Quite a comissão da plataforma para voltar a ficar online.";
  if(error instanceof FlashDriverError&&error.code==="UNAVAILABLE")
    return "Serviço Flash indisponível no momento. Verifique a configuração e tente novamente.";
  return "GPS indisponível. Ative a localização e tente novamente.";
}
const sample=(pos:GeolocationPosition):DriverGpsFix=>({
  lat:pos.coords.latitude,lng:pos.coords.longitude,
  accuracyM:pos.coords.accuracy,at:pos.timestamp,
});
export function useFlashDriverPresence(){
  const verifyPosition=useServerFn(publishVerifiedProfessionalPosition);
  const [state,setState]=useState<FlashPresenceState>(INITIAL);
  const watch=useRef<number|null>(null);
  const staleTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const lastGpsAt=useRef(0);
  const lastSentAt=useRef(0);
  const lastVerifiedAt=useRef(0);
  const lastVerifiedFixAt=useRef(0);
  const sending=useRef(false);
  const verifying=useRef(false);
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
    if(!active.current||sending.current||!isFreshGpsTimestamp(fix.at,GPS_POLICY.driverSampleMaxAgeMs))return false;
    if(!force && Date.now()-lastSentAt.current<FLASH_GPS_THROTTLE_MS)return true;
    sending.current=true;
    try{
      await updateFlashDriverHeartbeatGPS(fix.lat,fix.lng,fix.accuracyM,fix.at);
      lastSentAt.current=Date.now();
      setState(s=>({...s,gpsConnected:true,error:null}));
      return true;
    }catch(error){
      setState(s=>({...s,gpsConnected:false,error:gpsFailure(error)}));
      return false;
    }finally{sending.current=false;}
  },[]);
  const verifyFix=useCallback(async(fix:DriverGpsFix)=>{
    if(verifying.current)return false;
    if(fix.accuracyM>GPS_POLICY.driverMaxAccuracyM||
       !isFreshGpsTimestamp(fix.at,GPS_POLICY.driverSampleMaxAgeMs))return false;
    verifying.current=true;
    try{
      const result=await verifyPosition({data:{
        lat:fix.lat,lng:fix.lng,accuracyM:fix.accuracyM,sampledAtMs:fix.at,
      }});
      if(!result.published)return false;
      lastVerifiedAt.current=Date.now();
      lastVerifiedFixAt.current=fix.at;
      return true;
    }catch{return false;}
    finally{verifying.current=false;}
  },[verifyPosition]);
  const onGpsFix=useCallback(async(fix:DriverGpsFix)=>{
    if(!active.current)return;
    if(!isFreshGpsTimestamp(fix.at,GPS_POLICY.driverSampleMaxAgeMs)||
       !Number.isFinite(fix.accuracyM)||fix.accuracyM<=0||
       fix.accuracyM>GPS_POLICY.driverMaxAccuracyM){
      setState(s=>({...s,gpsConnected:false,error:"Sinal GPS antigo ou acima de 150 m. Aguardando melhor precisão."}));
      return;
    }
    // Only publish to the privileged professional radar on a real GPS sample,
    // and no more than once every 25 seconds.
    if(Date.now()-lastVerifiedAt.current>=25000 &&
       fix.at>lastVerifiedFixAt.current) {
      await verifyFix(fix);
    }
    lastGpsAt.current=fix.at;
    currentFix.current=fix;
    setState(s=>({...s,gps:fix}));
    void sendHeartbeat(fix);
  },[verifyFix,sendHeartbeat]);
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
      if(!isFreshGpsTimestamp(initial.at,GPS_POLICY.driverSampleMaxAgeMs)||
         !Number.isFinite(initial.accuracyM)||initial.accuracyM<=0||
         initial.accuracyM>GPS_POLICY.driverMaxAccuracyM)
        throw new FlashDriverError("INVALID");
      await setFlashDriverOnline(input);
      active.current=true;
      lastGpsAt.current=initial.at;
      currentFix.current=initial;
      setState(s=>({...s,gps:initial}));
      // First try the DB against a recent verified sample already published
      // by ProfessionalRadarSync. This prevents a double geocoding/rate-gate
      // race when both professional and Flash cockpit are mounted.
      // A backend ACK can only happen after validating the verified GPS.
      let published=await sendHeartbeat(initial,true);
      if(published) {
        lastVerifiedAt.current=Date.now();
        lastVerifiedFixAt.current=initial.at;
      }else{
        const verified=await verifyFix(initial);
        if(!verified)throw new FlashDriverError("UNAVAILABLE");
        published=await sendHeartbeat(initial,true);
        if(!published)throw new FlashDriverError("UNAVAILABLE");
      }
      setState(s=>({...s,online:true,gpsConnected:true}));
      watch.current=navigator.geolocation.watchPosition(pos=>{
        if(!active.current)return;
        void onGpsFix(sample(pos));
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
        }else if(Date.now()-lastVerifiedAt.current>=25000 &&
                 !verifying.current){
          // Fresh sensor read, not a replay of an old currentFix sample.
          navigator.geolocation.getCurrentPosition(
            pos=>{void onGpsFix(sample(pos));},
            ()=>setState(s=>({...s,gpsConnected:false,
              error:"Aguardando nova amostra GPS para manter o radar."})),
            {enableHighAccuracy:true,timeout:15000,maximumAge:0},
          );
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
  },[sendHeartbeat,stopWatch,verifyFix,onGpsFix]);

  useEffect(()=>{
    // On iOS/Android the browser may suspend geolocation in the background.
    // Page navigation is NOT withdrawal of location consent: leave presence
    // until the database TTL, instead of unexpectedly setting the driver offline.
    return()=>{
      active.current=false;
      stopWatch();
    };
  },[stopWatch]);
  return {...state,goOnline,markOffline};
}
