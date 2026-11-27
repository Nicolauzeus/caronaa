import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

let channelSequence=0;

/**
 * Read-only Realtime notifications: payload contains only municipality and
 * timestamp. All ride details are fetched again through the existing
 * authorization-gated SQL RPC; no raw professional_quick_rides replication.
 */
export function useQuickRideRealtime(
  municipality:string,
  refresh:()=>void|Promise<void>,
  enabled=true,
) {
  const callback=useRef(refresh);
  callback.current=refresh;
  useEffect(()=>{
    if(!enabled)return;
    let subscribed=false;
    let disposed=false;
    let debounce:ReturnType<typeof setTimeout>|null=null;
    let lastReconciledAt=0;
    let refreshInFlight=false;
    const signal=()=>{
      if(disposed||refreshInFlight)return;
      if(debounce)clearTimeout(debounce);
      debounce=setTimeout(()=>{
        debounce=null;
        if(!disposed&&!refreshInFlight){
          refreshInFlight=true;
          lastReconciledAt=Date.now();
          try{
            const result=callback.current();
            if(result&&typeof result.then==="function")
              void result.catch(()=>undefined).finally(()=>{refreshInFlight=false;});
            else refreshInFlight=false;
          }catch{
            refreshInFlight=false;
          }
        }
      },150);
    };
    const visible=()=>{if(!document.hidden)signal();};
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    const city=municipality.trim();
    const client=supabase as any;
    const channel=city?client.channel(
      "f07-quick-queue-"+(++channelSequence)+"-"+city,
    ).on("postgres_changes",{
      event:"*",schema:"public",table:"caronaa_quick_queue_events",
      filter:"municipality=eq."+city,
    },signal).subscribe((status:string)=>{
      subscribed=status==="SUBSCRIBED";
      if(subscribed)signal();
    }):null;
    // Reconcile even on a healthy socket: SUBSCRIBED confirms the channel, not
    // delivery of every event. This recovers missed invalidations across
    // municipal boundaries while avoiding a duplicate RPC after recent events.
    const fallback=window.setInterval(()=>{
      if(!document.hidden&&Date.now()-lastReconciledAt>=30_000)signal();
    },10_000);
    signal(); // initial authorized RPC after mounting
    return ()=>{
      disposed=true;
      if(debounce)clearTimeout(debounce);
      window.clearInterval(fallback);
      window.removeEventListener("focus",visible);
      document.removeEventListener("visibilitychange",visible);
      if(channel)void client.removeChannel(channel);
    };
  },[municipality,enabled]);
}
