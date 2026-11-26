import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlashDriverPresence } from "@/hooks/use-flash-driver-presence";

const api=vi.hoisted(()=>({online:vi.fn(),offline:vi.fn(),heartbeat:vi.fn(),ping:vi.fn()}));
vi.mock("@/services/flash-driver-service",()=>({
  setFlashDriverOnline:api.online,setFlashDriverOffline:api.offline,
  updateFlashDriverHeartbeatGPS:api.heartbeat,pingFlashDriverPresence:api.ping,
  FlashDriverError:class extends Error{},
}));
const config={online:true as const,mode:"EXCLUSIVE" as const,seats:1,vehicleType:"MOTO" as const,municipality:"Acarape"};
function makeSentinel(){
  const s={released:false,release:vi.fn(async()=>{s.released=true;})};
  return s;
}
let request:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  vi.clearAllMocks();
  Object.defineProperty(window,"isSecureContext",{configurable:true,value:false});
  api.online.mockResolvedValue(undefined);api.offline.mockResolvedValue(undefined);api.ping.mockResolvedValue(true);
  request=vi.fn(async()=>makeSentinel());
  Object.defineProperty(navigator,"wakeLock",{configurable:true,value:{request}});
});
afterEach(()=>{cleanup();delete (navigator as unknown as Record<string,unknown>)["wakeLock"];});
const flush=()=>act(async()=>{await Promise.resolve();await Promise.resolve();});

describe("driver screen wake lock",()=>{
  it("acquires the screen lock when online and releases it on Ficar indisponível",async()=>{
    const {result}=renderHook(()=>useFlashDriverPresence());
    expect(request).not.toHaveBeenCalled();
    await act(async()=>{await result.current.goOnline(config);});
    await flush();
    expect(request).toHaveBeenCalledWith("screen");
    const sentinel=await request.mock.results[0]!.value;
    await act(async()=>{await result.current.markOffline();});
    expect(sentinel.release).toHaveBeenCalled();
  });
  it("releases on unmount",async()=>{
    const {result,unmount}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    await flush();
    const sentinel=await request.mock.results[0]!.value;
    unmount();
    expect(sentinel.release).toHaveBeenCalled();
  });
  it("re-requests the lock when the page becomes visible again",async()=>{
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    await flush();
    const first=await request.mock.results[0]!.value;
    first.released=true;
    Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});
    await act(async()=>{document.dispatchEvent(new Event("visibilitychange"));});
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("tolerates missing API and denied requests",async()=>{
    delete (navigator as unknown as Record<string,unknown>)["wakeLock"];
    const a=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{expect(await a.result.current.goOnline(config)).toBe(true);});
    expect(a.result.current.online).toBe(true);
    a.unmount();
    Object.defineProperty(navigator,"wakeLock",{configurable:true,value:{request:vi.fn(async()=>{throw new Error("NotAllowed");})}});
    const b=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await b.result.current.goOnline(config);});
    await flush();
    expect(b.result.current.online).toBe(true);
  });
});
