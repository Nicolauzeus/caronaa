import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FlashDriverError,getFlashDriverRadarOrders,getMyActiveFlashRide,
  respondFlashOrder,setFlashDriverOffline,setFlashDriverOnline,
  startFlashRideWithPin,updateFlashDriverHeartbeatGPS,
} from "./flash-driver-service";

const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
const route=[{lat:-3.731,lng:-38.521},{lat:-3.735,lng:-38.515}];
beforeEach(()=>{vi.clearAllMocks();api.rpc.mockResolvedValue({data:true,error:null});});
describe("Flash driver RPC boundaries",()=>{
  it("online with destination sends one server-verified GeoJSON line",async()=>{
    await setFlashDriverOnline({
      online:true,mode:"ON_ROUTE",seats:2,vehicleType:"CAR",
      destination:{lat:-3.735,lng:-38.515,label:"Unifor"},routePath:route,
    });
    expect(api.rpc).toHaveBeenCalledWith("set_flash_driver_online",expect.objectContaining({
      p_is_online:true,p_dispatch_mode:"ON_ROUTE",p_available_seats:2,
      p_route_geojson:{type:"LineString",coordinates:[[-38.521,-3.731],[-38.515,-3.735]]},
    }));
    expect(api.rpc).toHaveBeenCalledTimes(1);
  });
  it("destinationless car goes online without geometry or Google route",async()=>{
    await setFlashDriverOnline({online:true,mode:"EXCLUSIVE",seats:4,vehicleType:"CAR"});
    expect(api.rpc).toHaveBeenCalledWith("set_flash_driver_online",expect.objectContaining({
      p_destination_lat:null,p_destination_lng:null,p_route_geojson:null,
    }));
  });
  it("moto never offers more than one seat",async()=>{
    await expect(setFlashDriverOnline({online:true,mode:"ALL",seats:2,vehicleType:"MOTO"}))
      .rejects.toMatchObject({code:"INVALID"});
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("42501 blocks commission activation and never claims online",async()=>{
    api.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"pending fees"}});
    await expect(setFlashDriverOnline({online:true,mode:"EXCLUSIVE",seats:1,vehicleType:"CAR"}))
      .rejects.toMatchObject({code:"COMMISSION_BLOCKED"});
  });
  it("heartbeat accepts only valid GPS and a positive server response",async()=>{
    const sampled=Date.now();
    await updateFlashDriverHeartbeatGPS(-3.731,-38.521,28,sampled);
    expect(api.rpc).toHaveBeenCalledWith("update_flash_driver_heartbeat_gps_v2",{
      p_lat:-3.731,p_lng:-38.521,p_accuracy_m:28,p_sampled_at_ms:sampled,
    });
    await expect(updateFlashDriverHeartbeatGPS(NaN,-38.5,40)).rejects.toMatchObject({code:"INVALID"});
    api.rpc.mockResolvedValue({data:false,error:null});
    await expect(updateFlashDriverHeartbeatGPS(-3.73,-38.51,30)).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
  it("offline is only successful after backend ACK",async()=>{
    await setFlashDriverOffline();
    expect(api.rpc).toHaveBeenCalledWith("set_flash_driver_online",{p_is_online:false});
    api.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
    await expect(setFlashDriverOffline()).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
  it("maps actual SQL order columns (meters, cents, seconds)",async()=>{
    api.rpc.mockResolvedValue({data:[{
      ride_id:"ride-1",service_mode:"EXCLUSIVE",seats_requested:1,
      distance_to_pickup_m:2400,driver_earnings_cents:735,
      meeting_point_label:"Praça",destination_label:"Universidade",
      expires_in_seconds:120,
    }],error:null});
    expect(await getFlashDriverRadarOrders()).toEqual([expect.objectContaining({
      id:"ride-1",distanceKm:2.4,driverEarnings:7.35,
      pickupLabel:"Praça",
    })]);
  });
  it("accept needs real backend confirmation; ALREADY_TAKEN is safe",async()=>{
    api.rpc.mockResolvedValue({data:{status:"ACCEPTED"},error:null});
    expect(await respondFlashOrder("ride-1",true)).toBe("ACCEPTED");
    expect(api.rpc).toHaveBeenCalledWith("respond_flash_order",{p_ride_id:"ride-1",p_accept:true});
    api.rpc.mockResolvedValue({data:null,error:{code:"P0001",message:"ALREADY_TAKEN"}});
    await expect(respondFlashOrder("ride-1",true)).rejects.toMatchObject({code:"ALREADY_TAKEN"});
    api.rpc.mockResolvedValue({data:false,error:null});
    await expect(respondFlashOrder("ride-1",true)).rejects.toMatchObject({code:"ALREADY_TAKEN"});
  });
  it("acknowledges skipped Flash orders using the actual backend shape",async()=>{
    api.rpc.mockResolvedValue({data:{success:true,action:"SKIPPED"},error:null});
    expect(await respondFlashOrder("ride-1",false)).toBe("REJECTED");
  });
  it("preserves the existing PIN start RPC contract",async()=>{
    await startFlashRideWithPin("ride-1","1234");
    expect(api.rpc).toHaveBeenCalledWith("quick_ride_start_with_code",{
      p_id:"ride-1",p_code:"1234",
    });
    await expect(startFlashRideWithPin("ride-1","12345")).rejects.toMatchObject({code:"INVALID"});
  });
  it("reads active ride through existing F07 participant RPC",async()=>{
    api.rpc.mockResolvedValue({data:[{
      id:"ride-1",role:"DRIVER",status:"ARRIVED",origin_label:"Praça",
      destination_label:"Campus",vehicle_type:"MOTO",municipality:"Fortaleza",
    }],error:null});
    expect(await getMyActiveFlashRide()).toEqual(expect.objectContaining({
      id:"ride-1",status:"ARRIVED",vehicleType:"MOTO",
    }));
  });
});
