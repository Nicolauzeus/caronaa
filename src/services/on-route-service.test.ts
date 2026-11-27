import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmOnRouteBooking, mapOnRouteMatch, searchOnRouteMatches } from "./on-route-service";

const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:mock.rpc}}));
const sample={
  offer_id:"offer-1",driver_user_id:"driver-1",driver_name:"Motorista confirmado",
  driver_avatar_url:null,departure_time:"2026-11-16T13:00:00Z",
  available_seats:3,seats_remaining:2,
  pickup_meeting:{lat:-3.74,lng:-38.51,walk_meters:80,poi_name:"Parada Unifor"},
  dropoff_meeting:{lat:-3.72,lng:-38.49,walk_meters:90,poi_name:"Praça"},
  total_walk_meters:170,estimated_price:6.5,
};
const params={originLat:-3.741,originLng:-38.511,destLat:-3.721,destLng:-38.491,seats:1};
beforeEach(()=>{vi.clearAllMocks();mock.rpc.mockResolvedValue({data:[sample],error:null});});
describe("on-route search service",()=>{
  it("maps authorized snake_case results and nested points to camelCase",async()=>{
    const result=await searchOnRouteMatches(params);
    expect(result.diagnostic).toBe("OK");
    expect(result.matches[0]).toMatchObject({
      offerId:"offer-1",driverName:"Motorista confirmado",
      pickupMeeting:{poiName:"Parada Unifor",walkMeters:80},
      seatsRemaining:2,totalWalkMeters:170,estimatedPrice:6.5,
    });
    expect(mock.rpc).toHaveBeenCalledWith("find_on_route_matches",expect.objectContaining({
      p_origin_lat:params.originLat,p_destination_lng:params.destLng,
      p_seats:1,
    }));
  });
  it("empty result has safe diagnostic without retry",async()=>{
    mock.rpc.mockResolvedValue({data:[],error:null});
    expect(await searchOnRouteMatches(params)).toEqual({matches:[],diagnostic:"NO_ON_ROUTE_MATCHES"});
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it("invalid coordinates fail before any network call",async()=>{
    expect((await searchOnRouteMatches({...params,originLat:NaN})).diagnostic).toBe("INVALID_SEARCH");
    expect((await searchOnRouteMatches({...params,destLng:undefined as unknown as number})).matches).toEqual([]);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("network and absent RPC errors do not expose details",async()=>{
    mock.rpc.mockRejectedValue(new Error("sensitive upstream details"));
    expect(await searchOnRouteMatches(params)).toEqual({matches:[],diagnostic:"ON_ROUTE_SERVICE_UNAVAILABLE"});
  });
  it("rejects malformed or incomplete server records rather than inventing locations",async()=>{
    expect(mapOnRouteMatch({...sample,pickup_meeting:{lat:999,lng:0,walk_meters:0}})).toBeNull();
    mock.rpc.mockResolvedValue({data:[{...sample,driver_name:""}],error:null});
    expect((await searchOnRouteMatches(params)).diagnostic).toBe("ON_ROUTE_SERVICE_UNAVAILABLE");
  });
});
describe("on-route atomic confirmation client",()=>{
  const meetingDetails={pickupMeeting:{lat:-3.74,lng:-38.51,walkMeters:80,poiName:"Parada Unifor"},
    dropoffMeeting:{lat:-3.72,lng:-38.49,walkMeters:90,poiName:"Praça"}};
  it("confirms only server-authorized booking ID",async()=>{
    mock.rpc.mockResolvedValue({data:{booking_id:"booking-1",status:"CONFIRMED"},error:null});
    expect(await confirmOnRouteBooking("offer-1",2,meetingDetails)).toEqual({bookingId:"booking-1",status:"CONFIRMED"});
    expect(mock.rpc).toHaveBeenCalledWith("confirm_on_route_match",{
      p_offer_id:"offer-1",p_seats:2,p_meeting_details:meetingDetails,
    });
  });
  it("maps overbooking to safe machine-readable error",async()=>{
    mock.rpc.mockResolvedValue({data:null,error:{code:"P0001",message:"OVERBOOKING_PREVENTED"}});
    await expect(confirmOnRouteBooking("offer-1",2,meetingDetails)).rejects.toMatchObject({
      code:"OVERBOOKING_PREVENTED",
    });
  });
  it("does not expose unrelated server error text or claim a booking",async()=>{
    mock.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"private authorization detail"}});
    await expect(confirmOnRouteBooking("offer-1",2,meetingDetails)).rejects.toMatchObject({
      code:"ON_ROUTE_SERVICE_UNAVAILABLE",message:"ON_ROUTE_SERVICE_UNAVAILABLE",
    });
  });
  it("does not accept absent or ambiguous confirmation",async()=>{
    mock.rpc.mockResolvedValue({data:true,error:null});
    await expect(confirmOnRouteBooking("offer-1",1,meetingDetails)).rejects.toMatchObject({
      code:"ON_ROUTE_SERVICE_UNAVAILABLE",
    });
  });
  it("rejects invalid seats without RPC invocation",async()=>{
    await expect(confirmOnRouteBooking("offer-1",4,meetingDetails)).rejects.toMatchObject({code:"INVALID_BOOKING"});
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
