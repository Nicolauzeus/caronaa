import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverFlashPlanner } from "./DriverFlashPlanner";

const api=vi.hoisted(()=>({
  route:vi.fn(),goOnline:vi.fn(),markOffline:vi.fn(),
  getOrders:vi.fn(),getRide:vi.fn(),snapshot:vi.fn(),passenger:vi.fn(),respond:vi.fn(),
  arrived:vi.fn(),start:vi.fn(),
}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:api.route}));
vi.mock("@/hooks/use-flash-driver-presence",()=>({
  useFlashDriverPresence:()=>({
    online:false,busy:false,gps:null,gpsConnected:false,error:null,
    goOnline:api.goOnline,markOffline:api.markOffline,
  }),
}));
vi.mock("@/lib/quick-rides/use-quick-ride-realtime",()=>({useQuickRideRealtime:()=>undefined}));
vi.mock("@/services/flash-driver-service",()=>({
  FlashDriverError:class FlashDriverError extends Error{
    constructor(public code:string){super(code);}
  },
  getFlashDriverRadarOrders:api.getOrders,
  getMyActiveFlashRide:api.getRide,
  getMyFlashRideSnapshot:api.snapshot,
  getFlashPassengerDetails:api.passenger,
  respondFlashOrder:api.respond,
  markFlashDriverArrived:api.arrived,
  startFlashRideWithPin:api.start,
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({onChange}:{onChange:(name:string,details:unknown)=>void})=>
    <button type="button" onClick={()=>onChange("Campus",{
      lat:-3.741,lng:-38.514,city:"Fortaleza",
    })}>Selecionar destino</button>,
}));
const from={lat:-3.731,lng:-38.521};
const points=[from,{lat:-3.741,lng:-38.514}];
const props={
  snap:"half" as const,onSnapChange:vi.fn(),serviceType:"FLASH" as const,
  onServiceTypeChange:vi.fn(),vehicleType:"CAR" as const,
  municipality:"Fortaleza",originPoint:from,originLabel:"Centro",
  originRevision:0,onAdjustOrigin:vi.fn(),onRouteChange:vi.fn(),
  onDestinationChange:vi.fn(),onActiveRideChange:vi.fn(),
};
beforeEach(()=>{
  vi.clearAllMocks();
  api.route.mockResolvedValue({routePath:points,distanceKm:11,durationMinutes:18});
  api.goOnline.mockResolvedValue(true);
  api.markOffline.mockResolvedValue(undefined);
  api.getOrders.mockResolvedValue([]);
  api.getRide.mockResolvedValue(null);
  api.snapshot.mockResolvedValue({active:null,completed:null});
  api.passenger.mockResolvedValue(null);
  api.respond.mockResolvedValue("ACCEPTED");
});
afterEach(cleanup);
describe("Flash driver shell",()=>{
  it("enters exclusive-only availability without a destination or Google Routes",async()=>{
    render(<DriverFlashPlanner {...props}/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Ficar Disponível"}));});
    expect(api.goOnline).toHaveBeenCalledWith(expect.objectContaining({
      online:true,mode:"EXCLUSIVE",destination:null,routePath:null,
    }));
    expect(api.route).not.toHaveBeenCalled();
  });
  it("routes exactly once for a selected destination, even after mode and seat changes",async()=>{
    render(<DriverFlashPlanner {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
    fireEvent.click(screen.getByRole("button",{name:"Apenas Na Rota"}));
    fireEvent.change(screen.getByRole("combobox",{name:"Vagas livres"}),{target:{value:"4"}});
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Ficar Disponível"}));});
    await waitFor(()=>expect(api.goOnline).toHaveBeenCalledWith(expect.objectContaining({
      online:true,mode:"ON_ROUTE",seats:4,
      destination:expect.objectContaining({label:"Campus"}),
      routePath:points,
    })));
    expect(api.route).toHaveBeenCalledTimes(1);
  });
  it("renders a compact driver trip without the idle destination form",async()=>{
    api.snapshot.mockResolvedValue({active:{
      id:"ride-1",status:"ACCEPTED",originLabel:"Praça",destinationLabel:"Universidade",
      municipality:"Fortaleza",vehicleType:"MOTO",
    },completed:null});
    render(<DriverFlashPlanner {...props} snap="peek" vehicleType="MOTO"/>);
    expect(await screen.findByRole("button",{name:"Cheguei ao embarque"})).toBeInTheDocument();
    expect(screen.queryByText("Para onde você vai? (opcional)")).not.toBeInTheDocument();
  });
  it("keeps motorcycle occupancy fixed at one",()=>{
    render(<DriverFlashPlanner {...props} vehicleType="MOTO"/>);
    const seats=screen.getByRole("combobox",{name:"Vagas livres"}) as HTMLSelectElement;
    expect(seats.value).toBe("1");
    expect(seats.disabled).toBe(true);
  });
});
