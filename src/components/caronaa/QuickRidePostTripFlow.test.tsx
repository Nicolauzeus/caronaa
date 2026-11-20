import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRidePostTripFlow } from "./QuickRidePostTripFlow";
import { quickPostTripActiveKey, quickPostTripSeenKey, shouldPresentQuickPostTrip } from "@/lib/quick-rides/post-trip-prompt";

const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
vi.mock("./QuickRidePixCard",()=>({
  QuickRidePixCard:({rideId}:{rideId:string})=><p>Pix passageiro da corrida {rideId}</p>,
}));
vi.mock("./QuickRideDriverSettlement",()=>({
  QuickRideDriverSettlement:({rideId}:{rideId:string})=><p>Recebimento motorista da corrida {rideId}</p>,
}));
vi.mock("./QuickRideRatingModal",()=>({
  QuickRideRatingModal:({onClose}:{onClose:()=>void})=>
    <button type="button" onClick={onClose}>Fechar avaliação de teste</button>,
}));

const rideId="9fb58a77-7ba4-437a-b8f1-51713c295712";
const recent={id:rideId,requested_at:new Date().toISOString()};
const completed={ride_id:rideId,role:"PASSENGER",completed_at:new Date().toISOString()};

beforeEach(()=>{
  window.localStorage.clear();
  vi.resetAllMocks();
  api.rpc.mockImplementation(async(name:string)=>{
    if(name==="quick_ride_my_posttrip_pending")return {data:[completed],error:null};
    if(name==="quick_ride_ack_posttrip")return {data:true,error:null};
    return {data:[],error:null};
  });
});
afterEach(()=>cleanup());

describe("F07 checkout persisted per account after COMPLETED",()=>{
  it("shows Pix and optional rating and records viewing without declaring payment",async()=>{
    render(<QuickRidePostTripFlow role="PASSENGER" completedRide={recent}/>);
    expect(await screen.findByRole("dialog",{name:"Corrida concluída"})).toBeInTheDocument();
    expect(screen.getByText("Pix passageiro da corrida "+rideId)).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Avaliar motorista (opcional)"})).toBeEnabled());
    expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_rating",{p_id:rideId});
    fireEvent.click(screen.getByRole("button",{name:"Avaliar motorista (opcional)"}));
    expect(screen.getByRole("button",{name:"Fechar avaliação de teste"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Fechar avaliação de teste"}));
    fireEvent.click(screen.getByRole("button",{name:"Continuar no CARONAA"}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_ack_posttrip",{p_id:rideId}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument());
    expect(window.localStorage.getItem(quickPostTripSeenKey("PASSENGER",rideId))).toBe("1");
  });

  it("recovers checkout for driver with old request and a new device",async()=>{
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="quick_ride_my_posttrip_pending")return {data:[{...completed,role:"DRIVER"}],error:null};
      if(name==="quick_ride_ack_posttrip")return {data:true,error:null};
      return {data:[],error:null};
    });
    const old={id:rideId,requested_at:"2026-01-01T00:00:00Z"};
    const {rerender}=render(<QuickRidePostTripFlow role="DRIVER" activeRideId={rideId}/>);
    expect(window.localStorage.getItem(quickPostTripActiveKey("DRIVER"))).toBe(rideId);
    rerender(<QuickRidePostTripFlow role="DRIVER" activeRideId={null} completedRide={old}/>);
    expect(await screen.findByText("Recebimento motorista da corrida "+rideId)).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Avaliar passageiro (opcional)"})).toBeEnabled());
  });

  it("does not cover a new active ride with an earlier checkout",async()=>{
    render(<QuickRidePostTripFlow role="DRIVER" activeRideId="another-active-ride" completedRide={recent}/>);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_posttrip_pending"));
    expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument();
  });

  it("server acknowledgement prevents reopening, even with stale local storage",async()=>{
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="quick_ride_my_posttrip_pending")return {data:[],error:null};
      return {data:[],error:null};
    });
    render(<QuickRidePostTripFlow role="PASSENGER" completedRide={recent}/>);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_posttrip_pending"));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument());
  });

  it("never treats a stored rating as pending",async()=>{
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="quick_ride_my_posttrip_pending")return {data:[completed],error:null};
      if(name==="quick_ride_my_rating")return {data:[{score:5}],error:null};
      return {data:[],error:null};
    });
    render(<QuickRidePostTripFlow role="PASSENGER" completedRide={recent}/>);
    expect(await screen.findByText("Sua avaliação já foi registrada. Obrigado!")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Avaliar motorista (opcional)"})).not.toBeInTheDocument();
  });
});

describe("F07 legacy fallback when 0217 has not been applied",()=>{
  it("requires a real ride and respects local seen flags",()=>{
    const now=Date.parse("2026-11-18T14:00:00Z");
    expect(shouldPresentQuickPostTrip(null,null,false,now)).toBe(false);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:new Date(now-60000).toISOString()},null,false,now)).toBe(true);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:new Date(now-4*3600000).toISOString()},null,false,now)).toBe(false);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:"2026-01-01T00:00:00Z"},rideId,false,now)).toBe(true);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:new Date(now).toISOString()},rideId,true,now)).toBe(false);
  });
});
