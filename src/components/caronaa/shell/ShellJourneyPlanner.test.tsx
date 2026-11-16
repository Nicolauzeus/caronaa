import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellJourneyPlanner } from "./ShellJourneyPlanner";
import type { SheetSnap } from "./InteractiveBottomSheet";

const api=vi.hoisted(()=>({route:vi.fn(),quote:vi.fn(),rpc:vi.fn(),preferences:vi.fn(),approach:vi.fn(),search:vi.fn(),confirm:vi.fn(),toastInfo:vi.fn(),toastSuccess:vi.fn(),toastError:vi.fn(),dispatch:vi.fn(),refresh:null as null|(()=>Promise<void>)}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:api.route}));
vi.mock("@/lib/quick-ride-map.functions",()=>({getQuickRideApproach:api.approach}));
vi.mock("@/lib/quick-rides/use-quick-ride-realtime",()=>({
  useQuickRideRealtime:(_municipality:string,refresh:()=>Promise<void>,enabled:boolean)=>{
    api.refresh=enabled?refresh:null;
  },
}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:api.quote}));
vi.mock("sonner",()=>({toast:{info:api.toastInfo,success:api.toastSuccess,error:api.toastError}}));
vi.mock("@/services/on-route-service",()=>({
  searchOnRouteMatches:api.search,
  confirmOnRouteBooking:api.confirm,
  OnRouteServiceError:class OnRouteServiceError extends Error{
    constructor(public code:string){super(code);}
  },
}));
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
  api.refresh=null;
  api.search.mockResolvedValue({matches:[],diagnostic:"NO_ON_ROUTE_MATCHES"});
  api.confirm.mockResolvedValue({bookingId:"booking-1",status:"CONFIRMED"});
  api.approach.mockResolvedValue({distanceKm:1,durationMinutes:4,routePath:[]});
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
    serviceType={service} onServiceTypeChange={setService} onSnapChange={setSnap}
    flashOperationalPanel={<button type="button" onClick={api.dispatch}>Pedir Caronaa Flash</button>}/>;
}
async function prepareFull(){
  fireEvent.click(screen.getByRole("button",{name:/para onde vamos/i}));
  fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
  await waitFor(()=>expect(api.route).toHaveBeenCalledTimes(1),{timeout:3000});
  await screen.findByRole("radio",{name:/Flash Carro/});
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
    expect(screen.getByRole("button",{name:/agora/i})).toBeTruthy();
  });
  it("shows three direct choices and switches vehicle without extra Google routes",async()=>{
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:/para onde vamos/i}));
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    await waitFor(()=>expect(api.route).toHaveBeenCalledTimes(1),{timeout:3000});
    expect(screen.getByRole("radio",{name:/Flash Carro/})).toHaveAttribute("aria-checked","true");
    fireEvent.click(screen.getByRole("radio",{name:/Flash Moto/}));
    expect(screen.getByRole("radio",{name:/Flash Moto/})).toHaveAttribute("aria-checked","true");
    await waitFor(()=>expect(api.quote).toHaveBeenCalledWith(expect.objectContaining({
      vehicleType:"MOTO",mode:"EXCLUSIVE",
    })),{timeout:3000});
    fireEvent.click(screen.getByRole("radio",{name:/Carona Na Rota/}));
    expect(screen.getByRole("radio",{name:/Carona Na Rota/})).toHaveAttribute("aria-checked","true");
    expect(api.route).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button",{name:"Revisar e Continuar"})).toBeNull();
  });
  it("shows a single Flash decision without internal pricing or duplicated review",async()=>{
    render(<Harness/>);
    await prepareFull();
    expect(screen.getByRole("radio",{name:/Flash Moto/})).toBeTruthy();
    expect(screen.getByRole("radio",{name:/Flash Carro/})).toBeTruthy();
    expect(screen.getByRole("radio",{name:/Carona Na Rota/})).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Revisar e Continuar"})).toBeNull();
    expect(screen.queryByText("Preferências de viagem")).toBeNull();
    expect(screen.queryByText(/Comissão de/)).toBeNull();
  });
  it("shows only real Flash price when quote belongs to the selected vehicle",async()=>{
    render(<ShellJourneyPlanner {...props} snap="half"
      flashFare={{quoteId:"valid",vehicleType:"CAR",expiresAt:new Date(Date.now()+60000).toISOString(),
        customerPaysCents:1450,distanceKm:7,durationMinutes:14,region:"M",municipality:"Redenção",
        driverReceivesCents:1232,platformCommissionCents:218,commissionBps:1500,commissionSource:"STANDARD",
        policyVersion:"pilot"}}/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    await screen.findByRole("radio",{name:/Flash Carro/});
    expect(screen.getByText(/R\$\s*14,50/)).toBeTruthy();
  });
  it("delegates Flash CTA to the real operational panel, not an isolated timer",async()=>{
    render(<Harness/>);
    await prepareFull();
    fireEvent.click(screen.getByRole("button",{name:"Pedir Caronaa Flash"}));
    expect(api.dispatch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(/Prévia de busca: notificações não foram disparadas/i)).toBeNull();
    expect(api.rpc).not.toHaveBeenCalledWith("register_flash_waitlist",expect.anything());
  });
  it("does not create fake search expiration or driver matches",async()=>{
    render(<Harness/>);
    await prepareFull();
    fireEvent.click(screen.getByRole("button",{name:"Pedir Caronaa Flash"}));
    expect(screen.queryByText("Motorista confirmou")).toBeNull();
    expect(screen.queryByText(/Nenhum motorista confirmou neste período/i)).toBeNull();
  });

  it("Agendada validates 30-minute minimum, reuses route and confirms only after RPC",async()=>{
    api.rpc.mockImplementation(async(name:string)=>name==="schedule_caronaa_ride"
      ?{data:"scheduled-test-uuid",error:null}:{data:[],error:null});
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:"Agendar"}));
    fireEvent.click(screen.getByRole("button",{name:/para onde vamos/i}));
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    const field=screen.getByLabelText("Data e hora do agendamento") as HTMLInputElement;
    const near=new Date(Date.now()+10*60000);
    const local=(date:Date)=>[
      date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0"),
    ].join("-")+"T"+String(date.getHours()).padStart(2,"0")+":"+String(date.getMinutes()).padStart(2,"0");
    fireEvent.change(field,{target:{value:local(near)}});
    expect(screen.getByRole("button",{name:"Revisar Agendamento"})).toBeDisabled();
    fireEvent.change(field,{target:{value:local(new Date(Date.now()+60*60000))}});
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar Agendamento"})).not.toBeDisabled(),{timeout:3000});
    expect(api.route).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Revisar Agendamento"}));
    expect(screen.getByText(/Pix ou dinheiro direto ao motorista/)).toBeTruthy();
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Agendar Caronaa"}));});
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("schedule_caronaa_ride",expect.objectContaining({
      p_service_mode:"EXCLUSIVE",p_vehicle_type:"CAR",p_passenger_count:3,p_women_only:false,
    })));
    const sent=api.rpc.mock.calls.find((c:any[])=>c[0]==="schedule_caronaa_ride")![1];
    expect(sent).not.toHaveProperty("p_departure_at");expect(sent.p_price_cents).toBeGreaterThan(0);
    expect(screen.getByText("Carona agendada! Seus dados foram salvos.")).toBeTruthy();
    expect(screen.getByText("Aguardando motorista")).toBeTruthy();
    expect(api.route).toHaveBeenCalledTimes(1);
  });

  it("Agendada never pretends success when scheduling RPC is absent",async()=>{
    api.rpc.mockImplementation(async(name:string)=>name==="schedule_caronaa_ride"
      ?{data:null,error:{code:"PGRST202"}}:{data:[],error:null});
    render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:"Agendar"}));
    fireEvent.click(screen.getByRole("button",{name:/para onde vamos/i}));
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    const later=new Date(Date.now()+90*60000);
    const local=[later.getFullYear(),String(later.getMonth()+1).padStart(2,"0"),String(later.getDate()).padStart(2,"0")].join("-")+"T"+
      String(later.getHours()).padStart(2,"0")+":"+String(later.getMinutes()).padStart(2,"0");
    fireEvent.change(screen.getByLabelText("Data e hora do agendamento"),{target:{value:local}});
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar Agendamento"})).not.toBeDisabled(),{timeout:3000});
    fireEvent.click(screen.getByRole("button",{name:"Revisar Agendamento"}));
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Agendar Caronaa"}));});
    expect(screen.queryByText("Carona agendada! Seus dados foram salvos.")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("Na Rota automatically finds real offers and displays the safe meeting point",async()=>{
    api.search.mockResolvedValue({diagnostic:"OK",matches:[{
      offerId:"offer-1",driverUserId:"driver-1",driverName:"Motorista disponível",
      departureTime:"2026-11-16T12:00:00Z",availableSeats:3,seatsRemaining:2,
      pickupMeeting:{lat:-4.221,lng:-38.731,walkMeters:80,poiName:"Parada Unifor"},
      dropoffMeeting:{lat:-4.23,lng:-38.72,walkMeters:60,poiName:"Destino"},
      totalWalkMeters:140,estimatedPrice:6.5,
    }]});
    const selected=vi.fn();
    render(<ShellJourneyPlanner {...props} snap="half" onOnRouteMatchSelected={selected}/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    await waitFor(()=>expect(api.route).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("radio",{name:/Carona Na Rota/}));
    await screen.findByText("Parada Unifor");
    expect(screen.getByText(/80 m de caminhada até o embarque/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Escolher ponto de encontro"}));
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({offerId:"offer-1"}));
    expect(api.route).toHaveBeenCalledTimes(1);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:/Confirmar carona/i}));});
    expect(api.confirm).toHaveBeenCalledWith("offer-1",1,expect.objectContaining({
      pickupMeeting:expect.objectContaining({walkMeters:80}),
    }));
  });

});
