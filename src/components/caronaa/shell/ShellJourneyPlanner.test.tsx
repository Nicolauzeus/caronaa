import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellJourneyPlanner } from "./ShellJourneyPlanner";

const api=vi.hoisted(()=>({
  route:vi.fn(),quote:vi.fn(),rpc:vi.fn(),upsert:vi.fn(),getUser:vi.fn(),
}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:api.route}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:api.quote}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({onChange}:{onChange:(label:string,location:unknown)=>void})=>
    <button type="button" onClick={()=>onChange("Praça central",{
      rawText:"Praça central",lat:-4.23,lng:-38.72,city:"Redenção",
    })}>Selecionar destino</button>,
}));
vi.mock("@/integrations/supabase/client",()=>({
  supabase:{
    auth:{getUser:api.getUser},
    rpc:api.rpc,
    from:()=>({upsert:api.upsert}),
  },
}));

const props={
  originPoint:{lat:-4.22,lng:-38.73},
  originMunicipality:"Redenção",
  serviceType:"FLASH" as const,
  onServiceTypeChange:vi.fn(),
  gender:"FEMININO",
};
beforeEach(()=>{
  vi.clearAllMocks();
  api.rpc.mockResolvedValue({data:[],error:null});
  api.getUser.mockResolvedValue({data:{user:{id:"authenticated-user"}},error:null});
  api.upsert.mockResolvedValue({error:null});
  api.route.mockResolvedValue({distanceKm:11,durationMinutes:18,routePath:[],legs:[]});
  api.quote.mockResolvedValue({totalFare:6,distanceKm:11,configSource:"FALLBACK",totalFareCents:600});
});
afterEach(()=>{vi.useRealTimers();cleanup();});

describe("CARONAA unified home journey planner",()=>{
  it("peek displays destination and Flash/Agendada dock",()=>{
    render(<ShellJourneyPlanner {...props} snap="peek"/>);
    expect(screen.getByRole("button",{name:/para onde vamos/i})).toBeTruthy();
    expect(screen.getByRole("button",{name:/flash/i})).toBeTruthy();
    expect(screen.getByRole("button",{name:/agendada/i})).toBeTruthy();
    expect(screen.queryByText("Modalidade")).toBeNull();
  });

  it("half shows shared/exclusive modes, vehicle seats and live route quote",async()=>{
    render(<ShellJourneyPlanner {...props} snap="half"/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    expect(screen.getByText("Modalidade")).toBeTruthy();
    expect(screen.getByRole("button",{name:"Na Rota"})).toBeTruthy();
    expect(screen.getByRole("button",{name:"Exclusiva"})).toBeTruthy();
    await waitFor(()=>expect(api.quote).toHaveBeenCalledWith(expect.objectContaining({
      distanceKm:11,mode:"ON_ROUTE",vehicleType:"CAR",seats:1,
    })),{timeout:2500});
    fireEvent.click(screen.getByRole("button",{name:"Moto"}));
    expect((screen.getByRole("combobox",{name:"Quantidade de vagas"}) as HTMLSelectElement).value).toBe("1");
    expect((screen.getByRole("combobox",{name:"Quantidade de vagas"}) as HTMLSelectElement).disabled).toBe(true);
  });

  it("full reveals only female-eligible Carona Mulher and boarding details",()=>{
    render(<ShellJourneyPlanner {...props} snap="full"/>);
    expect(screen.getByText("Preferências e embarque")).toBeTruthy();
    expect(screen.getByText("Carona Mulher")).toBeTruthy();
    expect(screen.getByText(/Origem:/)).toBeTruthy();
  });

  it("starts Flash only after user action and offers waitlist after 60s",async()=>{
    render(<ShellJourneyPlanner {...props} snap="half"/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalled());
    await waitFor(()=>expect(api.quote).toHaveBeenCalled(),{timeout:2500});
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button",{name:/Ver disponibilidade Flash/i}));
    expect(screen.getByText(/fase inicial e estamos avisando nossos motoristas/i)).toBeTruthy();
    await act(async()=>{vi.advanceTimersByTime(60_000);});
    expect(screen.getByRole("button",{name:/Entrar na lista de espera/i})).toBeTruthy();
    await act(async()=>{
      fireEvent.click(screen.getByRole("button",{name:/Entrar na lista de espera/i}));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id:"authenticated-user",
      origin_municipality:"Redenção",
      vehicle_type:"CAR",
    }),expect.objectContaining({onConflict:"user_id,origin_municipality,vehicle_type,service_mode"}));
  });
});
