import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRideHomePanel } from "./QuickRideHomePanel";

const api = vi.hoisted(() => ({
  coverage: vi.fn(),
  preview: vi.fn(),
  submit: vi.fn(),
  interest: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => {
  const chain = {
    server: vi.fn(() => chain),
    client: vi.fn(() => chain),
    middleware: vi.fn(() => chain),
  };
  return {
    useServerFn: (fn: unknown) => fn,
    createMiddleware: vi.fn(() => chain),
  };
});
vi.mock("./QuickRideOperationalMap",()=>({
  QuickRideOperationalMap:()=>null,
}));
vi.mock("./QuickRideRatingModal",()=>({
  QuickRideRatingModal:()=>null,
}));
vi.mock("@/lib/quick-rides/use-quick-ride-realtime",()=>({
  useQuickRideRealtime:()=>undefined,
}));
vi.mock("@/lib/quick-rides/quick-ride.functions", () => ({
  getQuickRideCoverage: api.coverage,
  getQuickRideFarePreview: api.preview,
  submitQuotedQuickRide: api.submit,
  registerQuickRideRegionInterest: api.interest,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: api.rpc },
}));
vi.mock("./QuickRidePixCard",()=>({
  QuickRidePixCard:({rideId}:{rideId:string})=><div>QR Pix pronto: {rideId}</div>,
}));

const origin = { rawText:"Saída",lat:-4.224,lng:-38.71 };
const destination = { rawText:"Destino",lat:-4.24,lng:-38.72 };
const basic = {
  origin:"Campus Auroras, Redenção",
  destination:"Rua Teste, Acarape",
  originPoint:origin,
  destinationPoint:destination,
  vehicle:"MOTO" as const,
  onVehicleChange:vi.fn(),
  driverCount:2,
};
const enabled = {
  municipality:"Redenção",
  region:"MACICO_BATURITE" as const,
  status:"ENABLED" as const,
  radar:true,dispatch:true,
};
beforeEach(()=>{
  window.localStorage.clear();
  vi.clearAllMocks();
  api.coverage.mockResolvedValue(enabled);
  api.rpc.mockResolvedValue({data:[],error:null});
  api.interest.mockResolvedValue({ok:true});
  api.submit.mockResolvedValue({rideId:"0f066ee8-bb89-47e2-85cf-20121e1b021f"});
  api.preview.mockResolvedValue({
    quoteId:"135e553c-1516-4a28-a49c-9ad0e3926821",
    expiresAt:"2099-01-01T00:00:00.000Z",municipality:"Redenção",
    region:"MACICO_BATURITE",vehicleType:"MOTO",
    distanceKm:4.3,durationMinutes:13.1,
    customerPaysCents:750,driverReceivesCents:600,
    platformCommissionCents:150,commissionBps:2000,
    commissionSource:"MACICO",policyVersion:"test",
  });
});
afterEach(()=>cleanup());

describe("Corrida Rápida dentro do mapa inicial",()=>{
  it("não consulta o radar ou cotação sem saída confiável",()=>{
    render(<QuickRideHomePanel {...basic} originPoint={undefined} driverCount={0}/>);
    expect(screen.getByText(/Escolha uma saída com coordenadas verificadas/i)).toBeInTheDocument();
    expect(api.coverage).not.toHaveBeenCalled();
    expect(api.preview).not.toHaveBeenCalled();
  });

  it("recusa GPS impreciso e permite saída manual",()=>{
    render(<QuickRideHomePanel {...basic} gpsOriginIsImprecise />);
    expect(screen.getByText(/GPS impreciso/i)).toBeInTheDocument();
    expect(api.coverage).not.toHaveBeenCalled();
  });

  it("mostra motoristas autorizados por modalidade sem sair da home", async ()=>{
    render(<QuickRideHomePanel {...basic}/>);
    await waitFor(()=>expect(api.coverage).toHaveBeenCalledWith({
      data:{lat:origin.lat,lng:origin.lng,vehicleType:"MOTO"},
    }),{timeout:2500});
    expect(screen.getByText(/2 profissionais autorizados e online/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Moto"})).toHaveAttribute("aria-pressed","true");
    fireEvent.click(screen.getByRole("button",{name:"Carro"}));
    expect(basic.onVehicleChange).toHaveBeenCalledWith("CAR");
  });

  it("registra interesse sem criar pedidos onde a modalidade está desabilitada",async()=>{
    api.coverage.mockResolvedValue({
      municipality:"Pacatuba",region:"FORTALEZA_CORRIDOR",
      status:"WAITLIST",radar:false,dispatch:false,
    });
    render(<QuickRideHomePanel {...basic}/>);
    const button=await screen.findByRole("button",{name:"Avise-me quando chegar aqui"},{timeout:2500});
    fireEvent.click(button);
    await waitFor(()=>expect(api.interest).toHaveBeenCalledWith({
      data:{municipality:"Pacatuba",vehicleType:"MOTO"},
    }));
    expect(screen.getByText(/Interesse registrado/)).toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("exibe valor verificado no servidor antes de confirmar a solicitação",async()=>{
    render(<QuickRideHomePanel {...basic}/>);
    expect(screen.queryByRole("button",{name:/Calcular preço/})).not.toBeInTheDocument();
    expect(await screen.findByText(/R\$\s*7,50/,{selector:"p"},{timeout:3000})).toBeInTheDocument();
    expect(api.preview).toHaveBeenCalledWith({
      data:{
        origin:{lat:origin.lat,lng:origin.lng},
        destination:{lat:destination.lat,lng:destination.lng},
        originLabel:basic.origin,
        destinationLabel:basic.destination,
        vehicleType:"MOTO",
      },
    });
    fireEvent.click(screen.getByRole("button",{name:/Confirmar corrida por/}));
    await waitFor(()=>expect(api.submit).toHaveBeenCalledWith({
      data:{quoteId:"135e553c-1516-4a28-a49c-9ad0e3926821"},
    }));
  });

  it("invalida cotação anterior quando o destino muda",async()=>{
    const {rerender}=render(<QuickRideHomePanel {...basic}/>);
    await screen.findByRole("button",{name:/Confirmar corrida por/},{timeout:3000});
    rerender(<QuickRideHomePanel {...basic} destination="Novo destino"
      destinationPoint={{rawText:"Novo destino",lat:-4.26,lng:-38.75}}/>);
    expect(screen.queryByRole("button",{name:/Confirmar corrida por/})).not.toBeInTheDocument();
    await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(2),{timeout:3000});
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("permite cotação de Carro com destino intermunicipal validado no servidor", async()=>{
    api.preview.mockResolvedValueOnce({
      quoteId:"135e553c-1516-4a28-a49c-9ad0e3926821",
      expiresAt:"2099-01-01T00:00:00.000Z",
      municipality:"Redenção",destinationMunicipality:"Fortaleza",
      region:"MACICO_BATURITE",vehicleType:"CAR",
      distanceKm:70,durationMinutes:95,customerPaysCents:17350,
      driverReceivesCents:13880,platformCommissionCents:3470,
      commissionBps:2000,commissionSource:"MACICO",
      policyVersion:"macico-car-piloto",
    });
    render(<QuickRideHomePanel {...basic} vehicle="CAR" destination="Fortaleza"
      destinationPoint={{rawText:"Fortaleza",lat:-3.73,lng:-38.52}}/>);
    expect(await screen.findByText(/R\$\s*173,50/,{selector:"p"},{timeout:3000})).toBeInTheDocument();
    expect(api.preview).toHaveBeenCalledWith({data:expect.objectContaining({
      vehicleType:"CAR",destination:{lat:-3.73,lng:-38.52},
    })});
  });

  it("calcula sem clique, mas não permite confirmar sem motorista online",async()=>{
    render(<QuickRideHomePanel {...basic} driverCount={0}/>);
    expect(await screen.findByText(/R\$\s*7,50/,{selector:"p"},{timeout:3000})).toBeInTheDocument();
    const confirm=screen.getByRole("button",{name:"Aguardando motorista disponível"});
    expect(confirm).toBeDisabled();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("não realiza cotação antes de destino válido",async()=>{
    render(<QuickRideHomePanel {...basic} destination="" destinationPoint={undefined}/>);
    await screen.findByText(/Escolha o destino para visualizar o preço automaticamente/,{exact:false});
    expect(api.preview).not.toHaveBeenCalled();
  });

  it("permite nova cotação e persiste a liberação da corrida concluída", async()=>{
    const completed="0f066ee8-bb89-47e2-85cf-20121e1b021f";
    api.rpc.mockImplementation(async (name:string)=>{
      if(name==="quick_ride_my_requests")return {data:[{
        id:completed,role:"PASSENGER",status:"COMPLETED",
        vehicle_type:"MOTO",municipality:"Redenção",
      }],error:null};
      return {data:[],error:null};
    });
    render(<QuickRideHomePanel {...basic}/>);
    expect(await screen.findByText("QR Pix pronto: "+completed)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Concluir e fazer nova corrida/i})).toBeInTheDocument();
    // A historical COMPLETED must not block a fresh quoted trip.
    await waitFor(()=>expect(api.preview).toHaveBeenCalled(),{timeout:3500});
    fireEvent.click(screen.getByRole("button",{name:/Concluir e fazer nova corrida/i}));
    expect(window.localStorage.getItem("caronaa-completed-dismissed:"+completed)).toBe("1");
    expect(screen.queryByText("QR Pix pronto: "+completed)).not.toBeInTheDocument();
    expect(await screen.findByRole("button",{name:/Confirmar corrida por/})).toBeEnabled();
    fireEvent.click(screen.getByRole("button",{name:/Confirmar corrida por/}));
    await waitFor(()=>expect(api.submit).toHaveBeenCalled());
  });

  it("mantém dispensada a corrida concluída após remontar o painel",async()=>{
    const completed="0f066ee8-bb89-47e2-85cf-20121e1b021f";
    window.localStorage.setItem("caronaa-completed-dismissed:"+completed,"1");
    api.rpc.mockImplementation(async (name:string)=>
      name==="quick_ride_my_requests"
        ?{data:[{id:completed,role:"PASSENGER",status:"COMPLETED",
                 vehicle_type:"MOTO",municipality:"Redenção"}],error:null}
        :{data:[],error:null});
    render(<QuickRideHomePanel {...basic}/>);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_requests"));
    await waitFor(()=>expect(api.preview).toHaveBeenCalled(),{timeout:3500});
    expect(screen.queryByText("QR Pix pronto: "+completed)).not.toBeInTheDocument();
    expect(await screen.findByRole("button",{name:/Confirmar corrida por/})).toBeEnabled();
  });

});
