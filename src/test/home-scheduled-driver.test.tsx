import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated/home";

const api=vi.hoisted(()=>({
  quote:vi.fn(),publish:vi.fn(),opportunities:vi.fn(),reverse:vi.fn(),map:vi.fn(),flash:vi.fn(),
  location:{} as Record<string,any>,
}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/offer-pricing.functions",()=>({quoteOfferRoute:api.quote}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:vi.fn()}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:vi.fn()}));
// Both address providers are isolated; these tests assert pickup behavior, not provider selection.
vi.mock("@/lib/location.functions",()=>({reverseGeocodeServerFn:api.reverse,reversePassengerPickupServerFn:api.reverse}));
vi.mock("@/lib/location/use-user-location",async original=>({
  ...await original<typeof import("@/lib/location/use-user-location")>(),
  useUserLocation:()=>api.location,
}));
vi.mock("@/lib/session-request-cache",()=>({sessionRequest:(_key:string,request:()=>Promise<unknown>)=>request()}));
vi.mock("@/lib/role/use-active-role",()=>({useActiveRole:()=>({
  activeRole:"MOTORISTA",vehicleType:"carro",vehicleSeats:3,loading:false,busy:false,
  switchRole:vi.fn(),saveVehicle:vi.fn(),
})}));
vi.mock("@/lib/use-profile-gender",()=>({useProfileGender:()=>"FEMININO"}));
vi.mock("@/lib/admin/entry",()=>({getMyAdminEntry:vi.fn(),getAdminAppPreview:vi.fn()}));
vi.mock("@/lib/onboarding/progressive-onboarding",()=>({readOnboarding:vi.fn()}));
vi.mock("@/lib/onboarding/research-gate",()=>({resolvePostOnboardingDestination:vi.fn()}));
vi.mock("@/components/caronaa/AppShell",()=>({AppShell:({children}:any)=><main>{children}</main>}));
vi.mock("@/components/caronaa/CaronaaPerformanceDiagnostic",()=>({
  CaronaaPerformanceDiagnostic:()=>null,beginCaronaaPhase:vi.fn(),endCaronaaPhase:vi.fn(),
}));
vi.mock("@/components/caronaa/shell/InteractiveBottomSheet",()=>({
  InteractiveBottomSheet:({children}:any)=><section>{children}</section>,
}));
vi.mock("@/components/caronaa/shell/QuickVehicleModal",()=>({QuickVehicleModal:()=>null}));
vi.mock("@/components/caronaa/shell/UnifiedMyTripsPanel",()=>({UnifiedMyTripsPanel:()=>null}));
vi.mock("@/components/caronaa/shell/DriverScheduledTripsPanel",()=>({DriverScheduledTripsPanel:()=>null}));
vi.mock("@/components/caronaa/DriverPlatformFees",()=>({DriverPlatformFees:()=>null}));
vi.mock("@/components/caronaa/WomenOnlyToggle",()=>({WomenOnlyToggle:()=>null}));
vi.mock("@/components/caronaa/QuickRideHomePanel",()=>({QuickRideHomePanel:()=>null}));
vi.mock("@/components/caronaa/QuickRideOperationalMap",()=>({QuickRideOperationalMap:()=>null}));
vi.mock("@/components/caronaa/shell/DriverHomeDashboard",()=>({
  DriverHomeDashboard:({onOffer,onOpenTrips}:any)=><div aria-label="Início do motorista">
    <button type="button" onClick={onOffer}>Planejar carona agendada</button>
    <button type="button" onClick={onOpenTrips}>Ver pedidos</button>
  </div>,
}));
vi.mock("@/components/caronaa/shell/DriverFlashPlanner",()=>({
  DriverFlashPlanner:(props:any)=>{api.flash(props);return <button type="button"
    onClick={()=>props.onServiceTypeChange("AGENDADA")}>Planejar carona agendada</button>;},
}));
vi.mock("@/components/caronaa/HomeRideMap",()=>({
  HomeRideMap:(props:any)=>{api.map(props);return <div aria-label="Mapa">
    {props.selectingOrigin&&<button type="button" onClick={()=>props.onPickOrigin({lat:-3.71,lng:-38.56})}>
      Escolher saída neste ponto
    </button>}
  </div>;},
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({id,onChange}:any)=>id==="driver-scheduled-destination"?<button type="button"
    onClick={()=>onChange("UNIFOR",{lat:-3.768,lng:-38.478,city:"Fortaleza"})}>Selecionar UNIFOR</button>:null,
}));
vi.mock("@/services/driver-scheduled-service",()=>({
  publishScheduledDriverOffer:api.publish,getDriverScheduledOpportunities:api.opportunities,
  acceptDriverScheduledRequest:vi.fn(),DriverScheduledError:class extends Error{},
}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{
  rpc:vi.fn().mockResolvedValue({data:[],error:null}),auth:{getUser:vi.fn()},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn(),
}}));

const Home=Route.options.component!;
const fix=(accuracy:number,lat=-3.73)=>({lat,lng:-38.53,accuracy});
const setFix=(accuracy:number,lat=-3.73)=>{
  const point=fix(accuracy,lat);
  api.location={...api.location,position:point,addressPosition:point,
    originAccuracyM:accuracy,accuracyM:accuracy,locating:false};
};
const schedule=()=>{
  const d=new Date(Date.now()+2*60*60*1000);
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  fireEvent.change(screen.getByLabelText("Data e hora de saída"),{target:{value:local}});
};
const plan=()=>fireEvent.click(screen.getByRole("button",{name:"Planejar carona agendada"}));
const lastMap=()=>api.map.mock.lastCall?.[0];
beforeEach(()=>{
  vi.resetAllMocks();
  vi.spyOn(Route,"useSearch").mockReturnValue({});
  vi.spyOn(window,"matchMedia").mockReturnValue({matches:true} as MediaQueryList);
  api.reverse.mockResolvedValue(null);
  api.publish.mockResolvedValue("offer-123");
  api.opportunities.mockResolvedValue([]);
  api.location={position:null,addressPosition:null,originAccuracyM:null,accuracyM:null,
    failure:null,locating:true,isFollowingUser:true,recenterVersion:0,locate:vi.fn(),setFollowing:vi.fn()};
  api.quote.mockImplementation(async({data})=>({
    quoteId:"e01301cd-a91b-4b60-b95d-98921e162d0f",distanceKm:11,durationMinutes:18,
    pricePerPassenger:6,routePath:[data.originPoint,data.destinationPoint],
    originPoint:data.originPoint,destinationPoint:data.destinationPoint,
    expiresAt:new Date(Date.now()+15*60*1000).toISOString(),
  }));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe("Home — origem da carona tradicional",()=>{
  it("opens the shared-driver cockpit by default, not passenger search",()=>{
    const view=render(<Home/>);
    expect(screen.getByLabelText("Início do motorista")).toBeInTheDocument();
    expect(screen.queryByLabelText("Escolha sua carona")).toBeNull();
    view.unmount();
  });
    it("starts the selected itinerary when GPS arrives, without reselecting the destination",async()=>{
    const {rerender}=render(<Home/>);plan();
    fireEvent.click(screen.getByRole("button",{name:"Selecionar UNIFOR"}));schedule();
    expect(screen.getByText(/Destino selecionado. Aguardando sua localização/)).toBeTruthy();
    setFix(20);rerender(<Home/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar publicação"})).not.toBeDisabled());
    expect(api.quote).toHaveBeenCalledTimes(1);
    setFix(25,-3.72);rerender(<Home/>);
    expect(api.quote).toHaveBeenCalledTimes(1);
    expect(lastMap().origin).toEqual(expect.objectContaining({lat:-3.73,lng:-38.53}));
  });

  it("requires confirmation of a real approximate F03 origin while retaining strict F07 map GPS",async()=>{
    setFix(150);render(<Home/>);
    expect(lastMap().passengerPreview).toBe(false);
    expect(lastMap().following).toBe(false);
    expect(lastMap().origin).toBeUndefined();
    plan();fireEvent.click(screen.getByRole("button",{name:"Selecionar UNIFOR"}));schedule();
    await waitFor(()=>expect(screen.getByText(/Valor sugerido por vaga/)).toHaveTextContent("6,00"));
    expect(lastMap().passengerPreview).toBe(true);
    expect(screen.getByRole("button",{name:"Revisar publicação"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Confirmar ponto de saída"}));
    expect(screen.getByRole("dialog")).toHaveTextContent("De onde sua carona vai sair?");
    fireEvent.click(screen.getByRole("button",{name:"Confirmar este ponto de saída"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar publicação"})).not.toBeDisabled());
    expect(api.quote).toHaveBeenCalledTimes(1);expect(api.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Revisar publicação"}));
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(api.publish).toHaveBeenCalledWith(expect.objectContaining({
      quoteId:"e01301cd-a91b-4b60-b95d-98921e162d0f",originPoint:{lat:-3.73,lng:-38.53},
    }));
  });

  it("does not silently use a fix beyond 300m and preserves an explicit map departure against late GPS",async()=>{
    setFix(500);const {rerender}=render(<Home/>);plan();
    fireEvent.click(screen.getByRole("button",{name:"Selecionar UNIFOR"}));schedule();
    expect(screen.getByText(/Destino selecionado. Defina a saída no mapa/)).toBeTruthy();
    expect(api.quote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:/Origem:.*Ajustar no mapa/}));
    expect(screen.queryByRole("navigation",{name:"Papel ativo no CARONAA"})).toBeNull();
    expect(screen.getByText(/Definir saída:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Escolher saída neste ponto"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Revisar publicação"})).not.toBeDisabled());
    expect(screen.queryByRole("navigation",{name:"Papel ativo no CARONAA"})).toBeNull();
    expect(api.quote).toHaveBeenCalledTimes(1);
    expect(lastMap().origin).toEqual(expect.objectContaining({lat:-3.71,lng:-38.56}));
    setFix(10,-3.69);rerender(<Home/>);
    expect(api.quote).toHaveBeenCalledTimes(1);
    expect(lastMap().origin).toEqual(expect.objectContaining({lat:-3.71,lng:-38.56}));
  });
});
