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
  routePath:[{lat:-3.73,lng:-38.53},{lat:-3.75,lng:-38.51}],
  bookingMode:"ALL" as const,vehicleType:"CAR" as const,
  seats:3,suggestedFarePerSeat:6,
  preferences:{conversation:"any" as const,music:"any" as const,
    smoking:"any" as const,pets:"any" as const,luggage:1},
  womenOnly:false,airConditioning:true,
};
beforeEach(()=>vi.clearAllMocks());
describe("driver scheduled RPC contracts",()=>{
  it("publishes an existing road line as WGS84 GeoJSON with selected settings",async()=>{
    mocks.rpc.mockResolvedValue({data:{offer_id:"offer-1"},error:null});
    expect(await publishScheduledDriverOffer(draft)).toBe("offer-1");
    expect(mocks.rpc).toHaveBeenCalledWith("publish_scheduled_driver_offer",expect.objectContaining({
      p_route_path:{type:"LineString",coordinates:[[-38.53,-3.73],[-38.51,-3.75]]},
      p_booking_mode:"ALL",p_available_seats:3,p_total_price:6,
      p_ride_date:"2030-11-16",p_departure_time:"10:00:00",
      p_origin_lat:-3.73,p_destination_lng:-38.51,p_women_only:false,
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
  it("maps platform debt 42501 to safe driver-facing diagnostic",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"fee pending"}});
    await expect(publishScheduledDriverOffer(draft)).rejects.toMatchObject({code:"DEBT_PENDING"});
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
