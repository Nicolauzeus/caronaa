import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRideHomePanel } from "./QuickRideHomePanel";
import { quickQuoteCoordinator } from "@/lib/quick-rides/quick-quote-coordinator";

const api=vi.hoisted(()=>({account:"passenger-one",coverage:vi.fn(),preview:vi.fn(),submit:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth-context",()=>({useAuth:()=>({user:{id:api.account},loading:false})}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/quick-rides/quick-ride.functions",()=>({
  getQuickRideCoverage:api.coverage,getQuickRideFarePreview:api.preview,
  submitQuotedQuickRide:api.submit,registerQuickRideRegionInterest:vi.fn(),
}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
vi.mock("@/lib/quick-rides/use-quick-ride-realtime",()=>({useQuickRideRealtime:()=>undefined}));
vi.mock("./QuickRidePixCard",()=>({QuickRidePixCard:()=>null}));
vi.mock("./QuickRideRatingModal",()=>({QuickRideRatingModal:()=>null}));
const props={origin:"Minha localização atual",destination:"Destino confirmado",
  originPoint:{rawText:"Origem",lat:-4.22,lng:-38.71},destinationPoint:{rawText:"Destino",lat:-4.24,lng:-38.72},
  vehicle:"CAR" as const,onVehicleChange:vi.fn(),driverCount:2,shellMode:true};
const fare=(vehicleType:string)=>({
  quoteId:vehicleType,vehicleType,expiresAt:"2099-01-01T00:00:00Z",municipality:"Redenção",
  region:"MACICO_BATURITE",distanceKm:4,durationMinutes:12,customerPaysCents:vehicleType==="CAR"?1400:750,
  driverReceivesCents:600,platformCommissionCents:150,commissionBps:2000,commissionSource:"MACICO",policyVersion:"test",
});
beforeEach(()=>{
  quickQuoteCoordinator.setAccount(null);
  window.localStorage.clear();vi.clearAllMocks();api.account="passenger-one";
  api.rpc.mockResolvedValue({data:[],error:null});
  api.coverage.mockResolvedValue({municipality:"Redenção",region:"MACICO_BATURITE",status:"ENABLED",radar:true,dispatch:true});
  api.preview.mockImplementation(async({data}:{data:{vehicleType:string}})=>fare(data.vehicleType));
});
afterEach(()=>{cleanup();quickQuoteCoordinator.setAccount(null);vi.restoreAllMocks();});

describe("Authenticated passenger quote lifecycle",()=>{
  it("StrictMode and ten address-label updates still perform one CAR and one MOTO quote",async()=>{
    const {rerender}=render(<StrictMode><QuickRideHomePanel {...props}/></StrictMode>);
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Carro/})).toBeEnabled(),{timeout:3500});
    for(let i=0;i<10;i++)rerender(<StrictMode><QuickRideHomePanel {...props} origin={"Rua confirmada "+i}/></StrictMode>);
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,900));});
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(api.preview.mock.calls.filter(([value])=>value.data.vehicleType==="CAR")).toHaveLength(1);
    expect(api.preview.mock.calls.filter(([value])=>value.data.vehicleType==="MOTO")).toHaveLength(1);
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("remount reuses the same-account server quote instead of spending another allowance",async()=>{
    const first=render(<QuickRideHomePanel {...props}/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Carro/})).toBeEnabled(),{timeout:3500});
    first.unmount();render(<QuickRideHomePanel {...props}/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Carro/})).toBeEnabled(),{timeout:3500});
    expect(api.preview).toHaveBeenCalledTimes(2);
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("a different passenger never receives a previous account's cached quote",async()=>{
    const {rerender}=render(<QuickRideHomePanel {...props}/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Carro/})).toBeEnabled(),{timeout:3500});
    api.account="passenger-two";rerender(<QuickRideHomePanel {...props}/>);
    await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(4),{timeout:3500});
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("rate-limit recovery is explicit, blocks clicks for 60 seconds and preserves the other category",async()=>{
    let carAttempts=0;
    api.preview.mockImplementation(async({data}:{data:{vehicleType:string}})=>{
      if(data.vehicleType==="CAR"&&++carAttempts===1)throw new Error("F07_QUOTE_RATE_LIMIT");
      return fare(data.vehicleType);
    });
    const {rerender}=render(<QuickRideHomePanel {...props}/>);
    const retry=await screen.findByRole("button",{name:/Tentar novamente em \d+s/},{timeout:3500});
    expect(retry).toBeDisabled();
    fireEvent.click(retry);fireEvent.click(retry);
    expect(api.preview).toHaveBeenCalledTimes(2);
    rerender(<QuickRideHomePanel {...props} vehicle="MOTO"/>);
    expect(screen.getByRole("button",{name:/Confirmar Flash Moto/})).toBeEnabled();
    rerender(<QuickRideHomePanel {...props}/>);
    vi.spyOn(Date,"now").mockReturnValue(Date.now()+61000);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Tentar novamente"})).toBeEnabled(),{timeout:1600});
    expect(api.preview).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Carro/})).toBeEnabled(),{timeout:3500});
    expect(api.preview).toHaveBeenCalledTimes(3);
    expect(api.preview.mock.calls.filter(([value])=>value.data.vehicleType==="MOTO")).toHaveLength(1);
    expect(api.submit).not.toHaveBeenCalled();
  },10000);
});
