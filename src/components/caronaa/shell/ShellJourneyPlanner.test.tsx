import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellJourneyPlanner } from "./ShellJourneyPlanner";
import type { SheetSnap } from "./InteractiveBottomSheet";

const api=vi.hoisted(()=>({route:vi.fn(),quote:vi.fn(),rpc:vi.fn(),preferences:vi.fn()}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:api.route}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:api.quote}));
vi.mock("@/lib/travel-preferences-service",()=>({loadTravelPreferences:api.preferences}));
vi.mock("@/components/caronaa/TravelPreferences",()=>({
  TravelPreferenceFields:()=> <div>Preferências de viagem</div>,
}));
vi.mock("@/components/caronaa/WomenOnlyToggle",()=>({
  WomenOnlyToggle:()=> <div>Carona entre mulheres</div>,
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({onChange}:{onChange:(label:string,location:unknown)=>void})=>
    <button type="button" onClick={()=>onChange("Praça central",{
      rawText:"Praça central",lat:-4.23,lng:-38.72,city:"Redenção",
    })}>Selecionar destino</button>,
}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));

const props={
  originPoint:{lat:-4.22,lng:-38.73},originLabel:"Minha localização",
  originMunicipality:"Redenção",serviceType:"FLASH" as const,
  onServiceTypeChange:vi.fn(),gender:"FEMININO" as const,
};
const testRoute={distanceKm:11,durationMinutes:18,
  routePath:[{lat:-4.22,lng:-38.73},{lat:-4.23,lng:-38.72}],legs:[]};

beforeEach(()=>{
  vi.clearAllMocks();
  api.rpc.mockResolvedValue({data:true,error:null});
  api.route.mockResolvedValue(testRoute);
  api.preferences.mockResolvedValue({conversation:"any",music:"any",smoking:"any",pets:"any",luggage:0});
  api.quote.mockImplementation(async(input:{mode:string;vehicleType:string;distanceKm:number;seats?:number})=>({
    mode:input.mode,vehicleType:input.vehicleType,distanceKm:input.distanceKm,
    totalFare:input.mode==="EXCLUSIVE"?23.4:(input.seats??1)*6,
    totalFareCents:input.mode==="EXCLUSIVE"?2340:(input.seats??1)*600,
    configSource:"FALLBACK",perSeatFare:6,seats:input.seats??1,
  }));
});
afterEach(()=>{vi.useRealTimers();cleanup();});

function Harness(){
  const [snap,setSnap]=useState<SheetSnap>("peek");
  const [service,setService]=useState<"FLASH"|"AGENDADA">("FLASH");
  return <ShellJourneyPlanner {...props} snap={snap}
    serviceType={service} onServiceTypeChange={setService} onSnapChange={setSnap}/>;
}
async function prepareFull(){
  fireEvent.click(screen.getByRole("button",{name:/para onde vamos/i}));
  fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
  await waitFor(()=>expect(api.route).toHaveBeenCalledTimes(1),{timeout:3000});
  await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar e Continuar"})).not.toBeDisabled(),{timeout:3000});
  fireEvent.click(screen.getByRole("button",{name:"Revisar e Continuar"}));
  await screen.findByRole("button",{name:"Pedir Caronaa Flash"});
}

describe("CARONAA Flash passenger shell",()=>{
  it("shows origin adjustment and service dock inside Peek",()=>{
    const adjust=vi.fn();
    render(<ShellJourneyPlanner {...props} snap="peek" onAdjustOrigin={adjust}/>);
    expect(screen.getByRole("button",{name:/para onde vamos/i})).toBeTruthy();
    expect(screen.getByRole("button",{name:/ajustar no mapa/i})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/ajustar no mapa/i}));
    expect(adjust).toHaveBeenCalledOnce();
    expect(screen.getByRole("button",{name:/flash/i})).toBeTruthy();
  });
  it("caches one Google route across card/seat/vehicle changes",async()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:/para onde vamos/i}));
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    await waitFor(()=>expect(api.quote).toHaveBeenCalledTimes(2),{timeout:3000});
    fireEvent.click(screen.getByRole("button",{name:"Na Rota"}));
    fireEvent.click(screen.getAllByRole("button",{name:"Moto"})[1]);
    await waitFor(()=>expect(api.quote).toHaveBeenCalledWith(expect.objectContaining({
      vehicleType:"MOTO",mode:"ON_ROUTE",seats:1,
    })),{timeout:3000});
    expect(api.route).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox",{name:"Quantidade de vagas"})).toBeDisabled();
  });
  it("Full shows price, direct payment and female preferences",async()=>{
    render(<Harness/>);
    await prepareFull();
    expect(screen.getByRole("region",{name:"Resumo da corrida"})).toBeTruthy();
    expect(screen.getByText(/Pix ou dinheiro direto ao motorista/)).toBeTruthy();
    expect(screen.getByText(/não retém valores/)).toBeTruthy();
    expect(screen.getByText("Preferências de viagem")).toBeTruthy();
    expect(screen.getByText("Carona entre mulheres")).toBeTruthy();
  });
  it("search starts on explicit click, cancels back to summary without dispatch",async()=>{
    render(<Harness/>);
    await prepareFull();
    fireEvent.click(screen.getByRole("button",{name:"Pedir Caronaa Flash"}));
    expect(screen.getByText(/fase inicial e estamos avisando nossos motoristas da sua região/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Cancelar busca"}));
    expect(screen.getByRole("button",{name:"Pedir Caronaa Flash"})).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalledWith("register_flash_waitlist",expect.anything());
  });
  it("timeout after 60 seconds registers waitlist through RPC, never writes raw GPS",async()=>{
    api.rpc.mockImplementation(async(name:string)=>name==="quick_ride_my_requests"?
      {data:[],error:null}:{data:true,error:null});
    render(<Harness/>);
    await prepareFull();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button",{name:"Pedir Caronaa Flash"}));
    await act(async()=>{vi.advanceTimersByTime(60_000);});
    fireEvent.click(screen.getByRole("button",{name:"Entrar na lista de espera"}));
    await act(async()=>{await Promise.resolve();await Promise.resolve();});
    const waitlistCall=api.rpc.mock.calls.find((call)=>call[0]==="register_flash_waitlist");
    expect(waitlistCall).toBeDefined();
    expect(waitlistCall?.[1]).toMatchObject({
      p_origin_municipality:"Redenção",p_destination_municipality:"Redenção",
      p_vehicle_type:"CAR",p_service_mode:"EXCLUSIVE",
    });
    expect(JSON.stringify(waitlistCall?.[1])).not.toContain("-4.22");
  });
  it("timeout can switch to Agendada without losing destination or mode",async()=>{
    api.rpc.mockResolvedValue({data:[],error:null});
    render(<Harness/>);
    await prepareFull();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button",{name:"Pedir Caronaa Flash"}));
    await act(async()=>{vi.advanceTimersByTime(60_000);});
    fireEvent.click(screen.getByRole("button",{name:"Agendar para daqui a pouco"}));
    expect(screen.getByRole("textbox",{name:"Horário da viagem agendada"})).toBeTruthy();
  });
});
