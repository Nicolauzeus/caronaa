import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishScheduledDriverOffer, getDriverScheduledOpportunities,
  acceptDriverScheduledRequest, getDriverScheduledTrips, driverWhatsappLink,
} from "./driver-scheduled-service";

const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:mocks.rpc}}));
const draft={
  origin:"Centro",destination:"Universidade",
  departureAt:"2030-11-16T13:00:00Z",
  quoteId:"8b9f53e9-2728-4985-b866-d912fba5bd5e",
  originPoint:{lat:-3.7301,lng:-38.5301},
  destinationPoint:{lat:-3.7501,lng:-38.5101},
  routePath:[{lat:-3.73,lng:-38.53},{lat:-3.75,lng:-38.51}],
  bookingMode:"ALL" as const,vehicleType:"CAR" as const,
  seats:3,suggestedFarePerSeat:6,
  preferences:{conversation:"any" as const,music:"any" as const,
    smoking:"any" as const,pets:"any" as const,luggage:1},
  womenOnly:false,airConditioning:true,
};
beforeEach(()=>vi.clearAllMocks());
describe("driver scheduled RPC contracts",()=>{
  it("publishes the trusted quote with selected endpoints, independently of road snapping",async()=>{
    mocks.rpc.mockResolvedValue({data:{offer_id:"offer-1"},error:null});
    expect(await publishScheduledDriverOffer(draft)).toBe("offer-1");
    expect(mocks.rpc).toHaveBeenCalledWith("publish_scheduled_driver_offer",expect.objectContaining({
      p_route_path:draft.routePath,
      p_quote_id:draft.quoteId,
      p_booking_mode:"ALL",p_available_seats:3,p_total_price:6,
      p_ride_date:"2030-11-16",p_departure_time:"10:00:00",
      p_origin_lat:-3.7301,p_destination_lng:-38.5101,p_women_only:false,
      p_travel_preferences:draft.preferences,
    }));
    const args=mocks.rpc.mock.calls[0][1];
    expect(args).not.toHaveProperty("p_departure_at");
    expect(args).not.toHaveProperty("p_preferences");
  });
  it("sends women-only offer flag to the server gender check",async()=>{
    mocks.rpc.mockResolvedValue({data:{offer_id:"offer-2"},error:null});
    await publishScheduledDriverOffer({...draft,womenOnly:true});
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_women_only:true});
  });
  it("rejects motorcycle with more than one passenger",async()=>{
    await expect(publishScheduledDriverOffer({...draft,vehicleType:"MOTO",seats:2})).rejects.toMatchObject({
      code:"INVALID_INPUT",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("maps an explicit platform debt diagnostic without confusing permissions with debt",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"PLATFORM_FEE_PENDING"}});
    await expect(publishScheduledDriverOffer(draft)).rejects.toMatchObject({code:"DEBT_PENDING"});
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"permission denied"}});
    await expect(publishScheduledDriverOffer(draft)).rejects.toMatchObject({code:"FORBIDDEN"});
  });
  it.each([
    ["QUOTE_EXPIRED","QUOTE_EXPIRED"],
    ["QUOTE_REQUIRED","QUOTE_EXPIRED"],
    ["QUOTE_INVALID","QUOTE_EXPIRED"],
    ["QUOTE_ALREADY_USED","ALREADY_PUBLISHED"],
    ["INVALID_SCHEDULE","INVALID_SCHEDULE"],
    ["VEHICLE_REQUIRED","VEHICLE_REQUIRED"],
    ["WOMEN_ONLY_NOT_ALLOWED","FORBIDDEN"],
    ["QUOTE_MISMATCH","INVALID_INPUT"],
  ])("keeps actionable publication error %s",async(message,code)=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"P0001",message}});
    await expect(publishScheduledDriverOffer(draft)).rejects.toMatchObject({code});
  });
  it("requires a saved quote and valid route points before attempting publication",async()=>{
    for(const invalid of [
      {...draft,quoteId:""},
      {...draft,routePath:[]},
      {...draft,routePath:[draft.originPoint]},
      {...draft,originPoint:{lat:91,lng:-38.5}},
      {...draft,routePath:[draft.originPoint,{lat:NaN,lng:-38.5}]},
    ]){
      await expect(publishScheduledDriverOffer(invalid)).rejects.toMatchObject({code:"INVALID_INPUT"});
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps the same quote on a transport retry so the server can deduplicate",async()=>{
    mocks.rpc.mockRejectedValueOnce(new Error("network disconnected"))
      .mockResolvedValue({data:{offer_id:"offer-1"},error:null});
    await expect(publishScheduledDriverOffer(draft)).rejects.toMatchObject({code:"UNAVAILABLE"});
    await expect(publishScheduledDriverOffer(draft)).resolves.toBe("offer-1");
    expect(mocks.rpc.mock.calls[0][1]).toEqual(mocks.rpc.mock.calls[1][1]);
  });
  it("does not report success for an explicitly rejected response",async()=>{
    mocks.rpc.mockResolvedValue({data:{success:false,offer_id:"offer-1",message:"QUOTE_EXPIRED"},error:null});
    await expect(publishScheduledDriverOffer(draft)).rejects.toMatchObject({code:"QUOTE_EXPIRED"});
  });
  it("uses the Fortaleza calendar day when UTC is already the following day",async()=>{
    mocks.rpc.mockResolvedValue({data:"offer-1",error:null});
    await publishScheduledDriverOffer({...draft,departureAt:"2030-11-17T01:10:00Z"});
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_ride_date:"2030-11-16",p_departure_time:"22:10:00"});
  });
  it("asks for a new departure time when the selected time is no longer valid",async()=>{
    await expect(publishScheduledDriverOffer({...draft,departureAt:new Date().toISOString()}))
      .rejects.toMatchObject({code:"INVALID_SCHEDULE"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("lets the server recover a previously committed retry after the local schedule window",async()=>{
    const attempt={...draft,departureAt:new Date(Date.now()-60000).toISOString()};
    mocks.rpc.mockResolvedValueOnce({data:{offer_id:"original-offer"},error:null});
    await expect(publishScheduledDriverOffer(attempt,{retry:true})).resolves.toBe("original-offer");
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({p_quote_id:draft.quoteId});
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"22023",message:"INVALID_SCHEDULE"}});
    await expect(publishScheduledDriverOffer(attempt,{retry:true})).rejects.toMatchObject({code:"INVALID_SCHEDULE"});
  });
  it("loads authorized opportunities with no raw realtime payload",async()=>{
    mocks.rpc.mockResolvedValue({data:[{
      request_id:"req-1",passenger_name:"Passageira confirmada",
      passenger_avatar_url:null,average_rating:4.6,passenger_count:2,
      potential_earnings:14.25,meeting_distance_meters:90,
      meeting_name:"Parada",
    }],error:null});
    expect(await getDriverScheduledOpportunities("offer-1")).toEqual([expect.objectContaining({
      requestId:"req-1",passengers:2,potentialEarnings:14.25,meetingDistanceMeters:90,
    })]);
    expect(mocks.rpc).toHaveBeenCalledWith("get_driver_scheduled_opportunities",{p_offer_id:"offer-1"});
  });
  it("accepts only atomic server-confirmed seat balance",async()=>{
    mocks.rpc.mockResolvedValue({data:{accepted:true,seats_remaining:1},error:null});
    expect(await acceptDriverScheduledRequest("offer-1","req-1")).toEqual({seatsRemaining:1});
    expect(mocks.rpc).toHaveBeenCalledWith("driver_accept_scheduled_request",{
      p_offer_id:"offer-1",p_request_id:"req-1",
    });
  });
  it("reads the deployed opportunity field names without inventing earnings or distance",async()=>{
    mocks.rpc.mockResolvedValue({data:[{
      request_id:"req-1",passenger_name:"Passageira confirmada",passenger_count:1,
      passenger_avatar:"https://example.com/avatar.png",estimated_earnings:6,
      pickup_walk_m:75,meeting_label:"Parada combinada",
    }],error:null});
    await expect(getDriverScheduledOpportunities("offer-1")).resolves.toEqual([{
      requestId:"req-1",passengerName:"Passageira confirmada",passengers:1,
      passengerAvatarUrl:"https://example.com/avatar.png",potentialEarnings:6,
      meetingDistanceMeters:75,meetingName:"Parada combinada",
    }]);
  });
  it("recognizes the deployed atomic acceptance success without accepting failed bodies",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:{success:true,match_id:"match-1",request_id:"req-1",seats_remaining:1},error:null})
      .mockResolvedValueOnce({data:{success:false,status:"CONFIRMED",seats_remaining:1},error:null});
    await expect(acceptDriverScheduledRequest("offer-1","req-1")).resolves.toEqual({seatsRemaining:1});
    await expect(acceptDriverScheduledRequest("offer-1","req-1")).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
  it("handles already matched requests without false success",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"P0001",message:"ALREADY_MATCHED"}});
    await expect(acceptDriverScheduledRequest("offer-1","req-1")).rejects.toMatchObject({
      code:"ALREADY_MATCHED",
    });
    mocks.rpc.mockResolvedValue({data:true,error:null});
    await expect(acceptDriverScheduledRequest("offer-1","req-1")).rejects.toMatchObject({
      code:"UNAVAILABLE",
    });
  });
  it("loads confirmed passengers and builds a user-initiated safe WhatsApp link",async()=>{
    mocks.rpc.mockResolvedValue({data:[{
      offer_id:"offer-1",origin:"Centro",destination:"Universidade",
      departure_at:"2030-11-16T13:00:00Z",seats_remaining:1,vehicle_type:"CAR",
      passengers:[{id:"p1",name:"Joana",agreed_fare:6,whatsapp:"(85) 99999-8888",meeting_name:"Parada"}],
    }],error:null});
    const [trip]=await getDriverScheduledTrips();
    expect(trip.passengers[0].name).toBe("Joana");
    const url=driverWhatsappLink(trip,trip.passengers[0]);
    expect(url).toMatch(/^https:\/\/wa\.me\/5585999998888\?text=/);
    expect(decodeURIComponent(url!.split("text=")[1])).toContain("sou seu motorista do CARONAA");
    expect(driverWhatsappLink(trip,{...trip.passengers[0],whatsapp:"1234"})).toBeNull();
  });
  it("fails safely when a scheduled RPC does not exist",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
    await expect(getDriverScheduledTrips()).rejects.toMatchObject({code:"UNAVAILABLE"});
  });
});
