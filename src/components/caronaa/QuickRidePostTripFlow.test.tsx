import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRidePostTripFlow } from "./QuickRidePostTripFlow";
import {
  quickPostTripActiveKey, quickPostTripSeenKey, shouldPresentQuickPostTrip,
} from "@/lib/quick-rides/post-trip-prompt";

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

beforeEach(()=>{
  window.localStorage.clear();
  vi.resetAllMocks();
  api.rpc.mockResolvedValue({data:[],error:null});
});
afterEach(()=>cleanup());

describe("F07 checkout automatic after COMPLETED",()=>{
  it("prompts the passenger with Pix and optional rating without a manual trip-history click",async()=>{
    render(<QuickRidePostTripFlow role="PASSENGER" completedRide={recent}/>);
    expect(await screen.findByRole("dialog",{name:"Corrida concluída"})).toBeInTheDocument();
    expect(screen.getByText("Pix passageiro da corrida "+rideId)).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Avaliar motorista (opcional)"})).toBeEnabled());
    expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_rating",{p_id:rideId});
    fireEvent.click(screen.getByRole("button",{name:"Avaliar motorista (opcional)"}));
    expect(screen.getByRole("button",{name:"Fechar avaliação de teste"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Fechar avaliação de teste"}));
    expect(await screen.findByText("Pix passageiro da corrida "+rideId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Continuar no CARONAA"}));
    expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument();
    expect(window.localStorage.getItem(quickPostTripSeenKey("PASSENGER",rideId))).toBe("1");
  });

  it("preserves a driver's completion across a reload, even with an older request timestamp",async()=>{
    const old={id:rideId,requested_at:"2026-01-01T00:00:00Z"};
    const {rerender}=render(<QuickRidePostTripFlow role="DRIVER" activeRideId={rideId}/>);
    expect(window.localStorage.getItem(quickPostTripActiveKey("DRIVER"))).toBe(rideId);
    rerender(<QuickRidePostTripFlow role="DRIVER" activeRideId={null} completedRide={old}/>);
    expect(await screen.findByText("Recebimento motorista da corrida "+rideId)).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Avaliar passageiro (opcional)"})).toBeEnabled());
  });

  it("never blocks the driver with old completed rides while a new ride is active",()=>{
    render(<QuickRidePostTripFlow role="DRIVER" activeRideId="another-active-ride" completedRide={recent}/>);
    expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("does not re-open checkout after it was intentionally dismissed",()=>{
    window.localStorage.setItem(quickPostTripSeenKey("PASSENGER",rideId),"1");
    render(<QuickRidePostTripFlow role="PASSENGER" completedRide={recent}/>);
    expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument();
  });

  it("acknowledges a rating already stored in Supabase without asking twice",async()=>{
    api.rpc.mockResolvedValue({data:[{score:5}],error:null});
    render(<QuickRidePostTripFlow role="PASSENGER" completedRide={recent}/>);
    expect(await screen.findByText("Sua avaliação já foi registrada. Obrigado!")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Avaliar motorista (opcional)"})).not.toBeInTheDocument();
  });
});

describe("F07 prompt eligibility",()=>{
  it("requires a real ride and respects seen flags",()=>{
    const now=Date.parse("2026-11-18T14:00:00Z");
    expect(shouldPresentQuickPostTrip(null,null,false,now)).toBe(false);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:new Date(now-60000).toISOString()},null,false,now)).toBe(true);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:new Date(now-4*3600000).toISOString()},null,false,now)).toBe(false);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:"2026-01-01T00:00:00Z"},rideId,false,now)).toBe(true);
    expect(shouldPresentQuickPostTrip({id:rideId,requested_at:new Date(now).toISOString()},rideId,true,now)).toBe(false);
  });
});
