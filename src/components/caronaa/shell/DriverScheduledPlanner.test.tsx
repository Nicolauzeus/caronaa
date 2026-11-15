import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverScheduledPlanner } from "./DriverScheduledPlanner";

const api=vi.hoisted(()=>({
  route:vi.fn(),quote:vi.fn(),preferences:vi.fn(),publish:vi.fn(),
  opportunities:vi.fn(),accept:vi.fn(),rpc:vi.fn(),channel:vi.fn(),removeChannel:vi.fn(),
}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:api.route}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:api.quote}));
vi.mock("@/lib/travel-preferences-service",()=>({loadTravelPreferences:api.preferences}));
vi.mock("@/components/caronaa/DriverPlatformFees",()=>({DriverPlatformFees:()=> <p>Minhas comissões</p>}));
vi.mock("@/components/caronaa/TravelPreferences",()=>({
  TravelPreferenceFields:()=> <p>Preferências</p>,
}));
vi.mock("@/components/caronaa/WomenOnlyToggle",()=>({
  WomenOnlyToggle:()=> <p>Apenas passageiras mulheres</p>,
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({onChange}:{onChange:(label:string,p:unknown)=>void})=>
    <button type="button" onClick={()=>onChange("Universidade",{
      lat:-3.75,lng:-38.51,city:"Fortaleza",
    })}>Selecionar destino</button>,
}));
vi.mock("@/services/driver-scheduled-service",()=>({
  publishScheduledDriverOffer:api.publish,
  getDriverScheduledOpportunities:api.opportunities,
  acceptDriverScheduledRequest:api.accept,
  DriverScheduledError:class DriverScheduledError extends Error{
    constructor(public code:string){super(code);}
  },
}));
vi.mock("@/integrations/supabase/client",()=>({
  supabase:{rpc:api.rpc,channel:api.channel,removeChannel:api.removeChannel},
}));

const points=[{lat:-3.73,lng:-38.53},{lat:-3.75,lng:-38.51}];
const base={
  snap:"half" as const,onSnapChange:vi.fn(),
  serviceType:"AGENDADA" as const,onServiceTypeChange:vi.fn(),
  vehicleType:"CAR" as const,maxSeats:3,
  gender:"FEMININO" as const,originPoint:points[0],
  originLabel:"Centro",originRevision:0,
  onAdjustOrigin:vi.fn(),onRouteChange:vi.fn(),onDestinationChange:vi.fn(),
};
beforeEach(()=>{
  vi.clearAllMocks();
  api.route.mockResolvedValue({distanceKm:11,durationMinutes:18,routePath:points});
  api.quote.mockResolvedValue({perSeatFare:6,totalFare:6});
  api.preferences.mockResolvedValue({conversation:"any",music:"any",smoking:"any",pets:"any",luggage:0});
  api.publish.mockResolvedValue("offer-123");
  api.opportunities.mockResolvedValue([]);
  api.accept.mockResolvedValue({seatsRemaining:1});
  api.removeChannel.mockResolvedValue(null);
  const channel={on:vi.fn().mockReturnThis(),subscribe:vi.fn().mockReturnThis()};
  api.channel.mockReturnValue(channel);
});
afterEach(cleanup);
const futureDate=()=>{
  const d=new Date(Date.now()+2*60*60*1000);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")+
    "T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
};

describe("Motorista — publicação na Casca Única",()=>{
  it("uses one route call regardless of vacancies, booking mode or time",async()=>{
    render(<DriverScheduledPlanner {...base}/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    await waitFor(()=>expect(api.quote).toHaveBeenCalled(),{timeout:3000});
    fireEvent.change(screen.getByLabelText("Data e hora de saída"),{target:{value:futureDate()}});
    fireEvent.change(screen.getByLabelText("Vagas disponíveis"),{target:{value:"2"}});
    fireEvent.click(screen.getByRole("button",{name:"Apenas Na Rota"}));
    fireEvent.click(screen.getByRole("button",{name:"Apenas Exclusiva"}));
    expect(api.route).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Valor sugerido por vaga/)).toBeTruthy();
  });

  it("publishes cached route and settings only on explicit confirmation",async()=>{
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    fireEvent.change(screen.getByLabelText("Data e hora de saída"),{target:{value:futureDate()}});
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar publicação"})).not.toBeDisabled(),{timeout:3000});
    fireEvent.click(screen.getByRole("button",{name:"Revisar publicação"}));
    expect(base.onSnapChange).toHaveBeenCalledWith("full");
    rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(api.publish).toHaveBeenCalledWith(expect.objectContaining({
      bookingMode:"ALL",vehicleType:"CAR",seats:3,
      routePath:points,
    }));
    expect(screen.getByText(/Carona agendada publicada/)).toBeTruthy();
    expect(api.route).toHaveBeenCalledTimes(1);
  });

  it("motorcycle allows exactly one seat",()=>{
    render(<DriverScheduledPlanner {...base} vehicleType="MOTO"/>);
    const combo=screen.getByLabelText("Vagas disponíveis") as HTMLSelectElement;
    expect(combo.value).toBe("1");
    expect(combo.disabled).toBe(true);
  });
});
