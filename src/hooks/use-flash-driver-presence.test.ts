import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_GPS_STALE_MS, useFlashDriverPresence } from "./use-flash-driver-presence";

const api=vi.hoisted(()=>({
  online:vi.fn(),offline:vi.fn(),heartbeat:vi.fn(),
  watch:vi.fn(),clear:vi.fn(),current:vi.fn(),
}));
vi.mock("@/services/flash-driver-service",()=>({
  setFlashDriverOnline:api.online,
  setFlashDriverOffline:api.offline,
  updateFlashDriverHeartbeatGPS:api.heartbeat,
  FlashDriverError:class FlashDriverError extends Error {
    constructor(public code:string){super(code);}
  },
}));
const config={online:true as const,mode:"EXCLUSIVE" as const,seats:1,vehicleType:"MOTO" as const};
const coords={latitude:-3.731,longitude:-38.521,accuracy:21};
const pos=()=>({coords,timestamp:Date.now()} as GeolocationPosition);
beforeEach(()=>{
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(window,"isSecureContext",{configurable:true,value:true});
  Object.defineProperty(navigator,"geolocation",{configurable:true,value:{
    getCurrentPosition:api.current,watchPosition:api.watch,clearWatch:api.clear,
  }});
  api.current.mockImplementation((resolve:(value:GeolocationPosition)=>void)=>resolve(pos()));
  api.watch.mockReturnValue(42);
  api.online.mockResolvedValue(undefined);
  api.offline.mockResolvedValue(undefined);
  api.heartbeat.mockResolvedValue(undefined);
});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe("Flash driver GPS presence",()=>{
  it("starts a single high-accuracy watcher only after online and GPS acknowledgment",async()=>{
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(api.online).toHaveBeenCalledOnce();
    expect(api.current).toHaveBeenCalledWith(expect.any(Function),expect.any(Function),
      expect.objectContaining({maximumAge:10000,enableHighAccuracy:true}));
    expect(api.heartbeat).toHaveBeenCalledWith(-3.731,-38.521,21);
    expect(api.watch).toHaveBeenCalledTimes(1);
    expect(result.current.online).toBe(true);
    expect(result.current.gpsConnected).toBe(true);
    expect(result.current.phase).toBe("online");
    await act(async()=>{vi.advanceTimersByTime(4300);});
    expect(api.heartbeat.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(api.heartbeat.mock.calls.length).toBeLessThanOrEqual(3);
  });
  it("does not claim online when the first GPS heartbeat is refused",async()=>{
    api.heartbeat.mockRejectedValue(new Error("timeout"));
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(result.current.online).toBe(false);
    expect(api.watch).not.toHaveBeenCalled();
    expect(api.offline).toHaveBeenCalled();
  });
  it("starts the presence RPC before the GPS warmup finishes",async()=>{
    let completeGps:((p:GeolocationPosition)=>void)|undefined;
    api.current.mockImplementation((resolve:(p:GeolocationPosition)=>void)=>{completeGps=resolve;});
    const {result}=renderHook(()=>useFlashDriverPresence());
    let connecting:Promise<boolean>|undefined;
    act(()=>{connecting=result.current.goOnline(config);});
    expect(api.online).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe("connecting");
    await act(async()=>{completeGps?.(pos());await connecting;});
    expect(result.current.online).toBe(true);
  });
  it("rejects ten-second-old GPS even when the browser returns it",async()=>{
    api.current.mockImplementation((resolve:(p:GeolocationPosition)=>void)=>resolve({
      coords,timestamp:Date.now()-11000,
    } as GeolocationPosition));
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(api.heartbeat).not.toHaveBeenCalled();
    expect(api.offline).toHaveBeenCalled();
    expect(result.current.online).toBe(false);
  });
  it("does not mark available if server activation is denied",async()=>{
    api.online.mockRejectedValue(new Error("denied"));
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(result.current.online).toBe(false);
    expect(api.heartbeat).not.toHaveBeenCalled();
    expect(api.offline).not.toHaveBeenCalled();
  });
  it("stops sharing and tries offline when GPS goes stale",async()=>{
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    await act(async()=>{vi.advanceTimersByTime(FLASH_GPS_STALE_MS+4500);});
    expect(api.clear).toHaveBeenCalledWith(42);
    expect(api.offline).toHaveBeenCalled();
    expect(result.current.online).toBe(false);
  });
});
