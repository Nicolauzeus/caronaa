import { useEffect, useState } from "react";
import { operationsService, type OperationalOverview, type OperationsPeriod } from "@/services/operations-service";

type OverviewState={key:string; data:OperationalOverview|null; loading:boolean; error:string};
const empty:OverviewState={key:"",data:null,loading:false,error:""};

/** Isolate advanced reporting from legacy history and reject stale filter responses. */
export function useOperationalOverview(period:OperationsPeriod,enabled:boolean,reload:number){
 const {from,to,service}=period;
 const key=JSON.stringify([from,to,service,reload]);
 const [state,setState]=useState<OverviewState>(empty);
 useEffect(()=>{
  let active=true;
  if(!enabled){setState(empty);return;}
  setState({key,data:null,loading:true,error:""});
  void Promise.resolve().then(()=>operationsService.getOverview({from,to,service})).then(data=>{
   if(active)setState({key,data,loading:false,error:""});
  }).catch(()=>{
   if(active)setState({key,data:null,loading:false,error:"Indicadores avançados indisponíveis. Verifique as migrations 0247–0257."});
  });
  return()=>{active=false;};
 },[from,to,service,key,enabled]);
 if(!enabled)return empty;
 return state.key===key?state:{key,data:null,loading:true,error:""};
}
