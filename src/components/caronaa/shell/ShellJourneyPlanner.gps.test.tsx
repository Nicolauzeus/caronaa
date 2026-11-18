import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellJourneyPlanner } from "./ShellJourneyPlanner";

const api=vi.hoisted(()=>({route:vi.fn(),quote:vi.fn(),preferences:vi.fn(),rpc:vi.fn(),search:vi.fn(),confirm:vi.fn()}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:api.route}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:api.quote}));
vi.mock("@/lib/travel-preferences-service",()=>({loadTravelPreferences:api.preferences}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
vi.mock("@/components/caronaa/WomenOnlyToggle",()=>({WomenOnlyToggle:()=>null}));
vi.mock("@/services/on-route-service",()=>({
  searchOnRouteMatches:api.search,confirmOnRouteBooking:api.confirm,
  OnRouteServiceError:class extends Error{},
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({onChange}:{onChange:(label:string,details:any)=>void})=>
    <button type="button" onClick={()=>onChange("Campus Auroras",{
      rawText:"Campus Auroras",formattedAddress:"Campus Auroras",lat:-4.224,lng:-38.71,
    })}>Escolher destino de teste</button>,
}));
const origin={lat:-4.22,lng:-38.72};
const destination={lat:-4.224,lng:-38.71};
const props={snap:"full" as const,serviceType:"FLASH" as const,
  onServiceTypeChange:vi.fn(),onSnapChange:vi.fn(),
  originPoint:origin,originLabel:"Minha localização atual",originMunicipality:"Redenção",gender:null,
};
beforeEach(()=>{
  vi.resetAllMocks();
  api.preferences.mockResolvedValue({});
  api.route.mockResolvedValue({routePath:[origin,destination],distanceKm:4.2,durationMinutes:12,legs:[{distanceKm:4.2,durationMinutes:12}]});
  api.quote.mockResolvedValue({totalFare:8.5});
  api.search.mockResolvedValue({matches:[],diagnostic:"NO_ON_ROUTE_MATCHES"});
  api.rpc.mockResolvedValue({data:null,error:null});
});
afterEach(()=>cleanup());
describe("Passenger itinerary GPS and route recovery",()=>{
  it("shows location progress and vehicle loading instead of unavailable prices",()=>{
    render(<ShellJourneyPlanner {...props} locating originPoint={undefined}/>);
    expect(screen.getByRole("button",{name:"Localizando você…"})).toBeEnabled();
    expect(screen.getAllByRole("status",{name:"Aguardando localização"})).toHaveLength(2);
    expect(screen.queryByText("Indisponível")).not.toBeInTheDocument();
    expect(api.route).not.toHaveBeenCalled();expect(api.quote).not.toHaveBeenCalled();
  });
  it("offers manual pickup when GPS finishes without coordinates",()=>{
    const adjust=vi.fn();
    const {rerender}=render(<ShellJourneyPlanner {...props} locating originPoint={{}} onAdjustOrigin={adjust}/>);
    expect(screen.getByText("Localizando você…")).toBeInTheDocument();
    rerender(<ShellJourneyPlanner {...props} locating={false} originPoint={{}} onAdjustOrigin={adjust}/>);
    fireEvent.click(screen.getByRole("button",{name:"Definir ponto de embarque"}));
    expect(adjust).toHaveBeenCalledOnce();expect(api.route).not.toHaveBeenCalled();
  });
  it("shows a concrete GPS error and lets the passenger retry or choose a pickup",()=>{
    const retry=vi.fn(), adjust=vi.fn();
    render(<ShellJourneyPlanner {...props} locating={false} originPoint={undefined}
      gpsError="O GPS expirou antes de informar a posição."
      onRetryGps={retry} onAdjustOrigin={adjust}/>);
    expect(screen.getByText("O GPS expirou antes de informar a posição.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Tentar GPS novamente"}));
    expect(retry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button",{name:"Escolher embarque no mapa"}));
    expect(adjust).toHaveBeenCalledOnce();
    expect(api.route).not.toHaveBeenCalled();
  });
  it("starts the route when GPS arrives after the destination was already selected",async()=>{
    const changed=vi.fn();
    const {rerender}=render(<ShellJourneyPlanner {...props} locating originPoint={undefined} onRouteChange={changed}/>);
    fireEvent.click(screen.getByRole("button",{name:"Escolher destino de teste"}));
    expect(api.route).not.toHaveBeenCalled();
    rerender(<ShellJourneyPlanner {...props} locating={false} onRouteChange={changed}/>);
    await waitFor(()=>expect(api.route).toHaveBeenCalledExactlyOnceWith({data:{points:[origin,destination]}}));
    await waitFor(()=>expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({distanceKm:4.2}),origin));
    expect(screen.getByRole("button",{name:"Origem: Minha localização atual"})).toBeInTheDocument();
  });
  it("does not mistake zero coordinates for a missing origin",async()=>{
    render(<ShellJourneyPlanner {...props} locating originPoint={{lat:0,lng:0}} originLabel="Equador"/>);
    expect(screen.queryByText("Localizando você…")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Escolher destino de teste"}));
    await waitFor(()=>expect(api.route).toHaveBeenCalledWith({data:{points:[{lat:0,lng:0},destination]}}));
  });
  it("retries a failed route for the same pair without retyping the destination",async()=>{
    api.route.mockRejectedValueOnce(new Error("network timeout"));
    const changed=vi.fn();
    render(<ShellJourneyPlanner {...props} onRouteChange={changed}/>);
    fireEvent.click(screen.getByRole("button",{name:"Escolher destino de teste"}));
    expect(await screen.findByText("Não foi possível traçar a rota agora.")).toBeInTheDocument();
    expect(api.route).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Recalcular rota"}));
    await waitFor(()=>expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({distanceKm:4.2}),origin));
    expect(api.route).toHaveBeenCalledTimes(2);
    expect(api.route.mock.calls[1][0]).toEqual(api.route.mock.calls[0][0]);
    expect(screen.queryByText("Não foi possível traçar a rota agora.")).not.toBeInTheDocument();
  });
  it("retains the quoted origin through ordinary live GPS updates",async()=>{
    const changed=vi.fn();
    const {rerender}=render(<ShellJourneyPlanner {...props} onRouteChange={changed}/>);
    fireEvent.click(screen.getByRole("button",{name:"Escolher destino de teste"}));
    await waitFor(()=>expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({distanceKm:4.2}),origin));
    rerender(<ShellJourneyPlanner {...props} originPoint={{lat:-4.23,lng:-38.73}} onRouteChange={changed}/>);
    await waitFor(()=>expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({distanceKm:4.2}),origin));
    expect(api.route).toHaveBeenCalledTimes(1);
  });
  it("invalidates an old pickup during an explicit new-GPS request",async()=>{
    const changed=vi.fn();
    const {rerender}=render(<ShellJourneyPlanner {...props} originRevision={0} onRouteChange={changed}/>);
    fireEvent.click(screen.getByRole("button",{name:"Escolher destino de teste"}));
    await waitFor(()=>expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({distanceKm:4.2}),origin));
    rerender(<ShellJourneyPlanner {...props} originPoint={undefined} locating originRevision={1} onRouteChange={changed}/>);
    await waitFor(()=>expect(changed).toHaveBeenLastCalledWith(null,null));
    expect(api.route).toHaveBeenCalledTimes(1);
    const newOrigin={lat:-4.25,lng:-38.74};
    rerender(<ShellJourneyPlanner {...props} originPoint={newOrigin} locating={false} originRevision={1} onRouteChange={changed}/>);
    await waitFor(()=>expect(api.route).toHaveBeenLastCalledWith({data:{points:[newOrigin,destination]}}));
    expect(api.route).toHaveBeenCalledTimes(2);
  });
});
