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
    const signal=()=>{
      if(disposed)return;
      if(debounce)clearTimeout(debounce);
      debounce=setTimeout(()=>{
        debounce=null;
        if(!disposed)void callback.current();
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
    // Reconcile even on a connected socket: delivery of change events is not guaranteed.
    // This reads an authorized Supabase RPC only; it never invokes Google APIs.
    const fallback=window.setInterval(()=>{
      if(!document.hidden)signal();
    },6_000);
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
