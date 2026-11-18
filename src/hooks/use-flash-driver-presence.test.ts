import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_GPS_STALE_MS, useFlashDriverPresence } from "./use-flash-driver-presence";

const api=vi.hoisted(()=>({
  online:vi.fn(),offline:vi.fn(),heartbeat:vi.fn(),verify:vi.fn(),
  watch:vi.fn(),clear:vi.fn(),current:vi.fn(),
}));
vi.mock("@tanstack/react-start",()=>({useServerFn:()=>api.verify}));
vi.mock("@/lib/professional-radar.functions",()=>({publishVerifiedProfessionalPosition:api.verify}));
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
const pos=()=>({coords,timestamp:Date.now()}) as GeolocationPosition;
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
  api.verify.mockResolvedValue({published:true,municipality:"Fortaleza"});
});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe("Flash driver GPS presence",()=>{
  it("starts a single high-accuracy watcher only after online and GPS acknowledgment",async()=>{
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(api.online).toHaveBeenCalledOnce();
    expect(api.heartbeat).toHaveBeenCalledWith(-3.731,-38.521,21,expect.any(Number));
    // A previously verified server sample avoids duplicate geocoding.
    expect(api.verify).not.toHaveBeenCalled();
    expect(api.watch).toHaveBeenCalledTimes(1);
    expect(result.current.online).toBe(true);
    expect(result.current.gpsConnected).toBe(true);
    await act(async()=>{vi.advanceTimersByTime(4300);});
    // Never refresh a stale GPS sample by replaying it as a new heartbeat.
    expect(api.heartbeat).toHaveBeenCalledTimes(1);
  });
  it("falls back to server GPS verification if there is no fresh sample yet",async()=>{
    api.heartbeat.mockRejectedValueOnce(new Error("VERIFIED_GPS_REQUIRED"));
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(result.current.online).toBe(true);
    expect(api.verify).toHaveBeenCalledOnce();
    expect(api.heartbeat).toHaveBeenCalledTimes(2);
  });
  it("does not claim online when both verified heartbeat attempts fail",async()=>{
    api.heartbeat.mockRejectedValue(new Error("timeout"));
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    expect(result.current.online).toBe(false);
    expect(api.watch).not.toHaveBeenCalled();
    expect(api.offline).toHaveBeenCalled();
  });
  it("stops sharing and tries offline when GPS goes stale",async()=>{
    // Initial fresh GPS succeeds; all subsequent forced refreshes time out.
    api.current.mockImplementationOnce((resolve:(value:GeolocationPosition)=>void)=>resolve(pos()));
    api.current.mockImplementation((_resolve:unknown,reject:(error:GeolocationPositionError)=>void)=>
      reject({code:3,message:"TIMEOUT"} as GeolocationPositionError));
    const {result}=renderHook(()=>useFlashDriverPresence());
    await act(async()=>{await result.current.goOnline(config);});
    await act(async()=>{vi.advanceTimersByTime(FLASH_GPS_STALE_MS+4500);});
    expect(api.clear).toHaveBeenCalledWith(42);
    expect(api.offline).toHaveBeenCalled();
    expect(result.current.online).toBe(false);
  });
});
