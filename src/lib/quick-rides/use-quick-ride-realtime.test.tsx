import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickRideRealtime } from "./use-quick-ride-realtime";

const channelState=vi.hoisted(()=>({
  event:undefined as (()=>void)|undefined,
  status:undefined as ((status:string)=>void)|undefined,
  remove:vi.fn(),
}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{
  channel:()=>{
    const channel={
      on:(_kind:string,_filter:unknown,callback:()=>void)=>{channelState.event=callback;return channel;},
      subscribe:(callback:(status:string)=>void)=>{channelState.status=callback;return channel;},
    };
    return channel;
  },
  removeChannel:channelState.remove,
}}));

function Harness({refresh,enabled=true}:{refresh:()=>void;enabled?:boolean}){
  useQuickRideRealtime("Fortaleza",refresh,enabled);
  return null;
}

describe("quick ride realtime reconciliation",()=>{
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
    channelState.event=undefined;channelState.status=undefined;channelState.remove.mockReset();
    Object.defineProperty(document,"hidden",{configurable:true,value:false});
  });
  afterEach(()=>{cleanup();vi.useRealTimers();});

  it("reconciles missed events on an active channel at a bounded cadence",async()=>{
    const refresh=vi.fn();
    const view=render(<Harness refresh={refresh}/>);
    act(()=>channelState.status?.("SUBSCRIBED"));
    await act(async()=>{vi.advanceTimersByTime(150);});
    expect(refresh).toHaveBeenCalledTimes(1); // initial authorized read
    await act(async()=>{vi.advanceTimersByTime(40_150);});
    expect(refresh).toHaveBeenCalledTimes(2); // missed invalidation recovery
    await act(async()=>{vi.advanceTimersByTime(40_000);});
    expect(refresh).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(channelState.remove).toHaveBeenCalledOnce();
  });

  it("deduplicates periodic reconciliation after a recent realtime event",async()=>{
    const refresh=vi.fn();
    render(<Harness refresh={refresh}/>);
    act(()=>channelState.status?.("SUBSCRIBED"));
    await act(async()=>{vi.advanceTimersByTime(150);});
    await act(async()=>{vi.advanceTimersByTime(10_000);});
    act(()=>channelState.event?.());
    await act(async()=>{vi.advanceTimersByTime(150);});
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async()=>{vi.advanceTimersByTime(20_000);});
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async()=>{vi.advanceTimersByTime(20_150);});
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("reconciles on app return and skips background polling",async()=>{
    const refresh=vi.fn();
    render(<Harness refresh={refresh}/>);
    act(()=>channelState.status?.("SUBSCRIBED"));
    await act(async()=>{vi.advanceTimersByTime(150);});
    Object.defineProperty(document,"hidden",{configurable:true,value:true});
    await act(async()=>{vi.advanceTimersByTime(60_000);});
    expect(refresh).toHaveBeenCalledTimes(1);
    Object.defineProperty(document,"hidden",{configurable:true,value:false});
    act(()=>window.dispatchEvent(new Event("focus")));
    await act(async()=>{vi.advanceTimersByTime(150);});
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not overlap a periodic read with an in-flight focus reconciliation",async()=>{
    let finish!:()=>void;
    const refresh=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
    render(<Harness refresh={refresh}/>);
    await act(async()=>{vi.advanceTimersByTime(150);});
    expect(refresh).toHaveBeenCalledTimes(1);
    act(()=>window.dispatchEvent(new Event("focus")));
    await act(async()=>{vi.advanceTimersByTime(30_000);});
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async()=>{finish();await Promise.resolve();});
    act(()=>window.dispatchEvent(new Event("focus")));
    await act(async()=>{vi.advanceTimersByTime(150);});
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
