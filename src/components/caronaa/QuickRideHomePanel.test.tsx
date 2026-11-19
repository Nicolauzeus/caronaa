import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickRideHomePanel } from "./QuickRideHomePanel";
const api=vi.hoisted(()=>({coverage:vi.fn(),preview:vi.fn(),submit:vi.fn(),interest:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth-context",()=>({useAuth:()=>({user:null,loading:false})}));
vi.mock("@tanstack/react-start",()=>{
  const chain={server:vi.fn(()=>chain),client:vi.fn(()=>chain),middleware:vi.fn(()=>chain)};
  return {useServerFn:(fn:unknown)=>fn,createMiddleware:vi.fn(()=>chain)};
});
vi.mock("./QuickRideOperationalMap",()=>({QuickRideOperationalMap:()=>null}));
vi.mock("./QuickRideRatingModal",()=>({QuickRideRatingModal:({onClose}:{onClose:()=>void})=>
  <button type="button" onClick={onClose}>Fechar avaliação de teste</button>}));
vi.mock("@/lib/quick-rides/use-quick-ride-realtime",()=>({useQuickRideRealtime:()=>undefined}));
vi.mock("@/lib/quick-rides/quick-ride.functions",()=>({
  getQuickRideCoverage:api.coverage,getQuickRideFarePreview:api.preview,
  submitQuotedQuickRide:api.submit,registerQuickRideRegionInterest:api.interest,
}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
vi.mock("./QuickRidePixCard",()=>({QuickRidePixCard:({rideId}:{rideId:string})=><div>QR Pix pronto: {rideId}</div>}));
const origin={rawText:"Saída",lat:-4.224,lng:-38.71};
const destination={rawText:"Destino",lat:-4.24,lng:-38.72};
const basic={origin:"Campus Auroras, Redenção",destination:"Rua Teste, Acarape",
  originPoint:origin,destinationPoint:destination,vehicle:"MOTO" as const,onVehicleChange:vi.fn(),driverCount:2};
const enabled={municipality:"Redenção",region:"MACICO_BATURITE" as const,status:"ENABLED" as const,radar:true,dispatch:true};
const fare={quoteId:"135e553c-1516-4a28-a49c-9ad0e3926821",expiresAt:"2099-01-01T00:00:00.000Z",
  municipality:"Redenção",region:"MACICO_BATURITE",vehicleType:"MOTO",distanceKm:4.3,durationMinutes:13.1,
  customerPaysCents:750,driverReceivesCents:600,platformCommissionCents:150,commissionBps:2000,
  commissionSource:"MACICO",policyVersion:"test"};
beforeEach(()=>{
  window.localStorage.clear();vi.resetAllMocks();
  api.coverage.mockResolvedValue(enabled);api.rpc.mockResolvedValue({data:[],error:null});
  api.interest.mockResolvedValue({ok:true});api.submit.mockResolvedValue({rideId:"0f066ee8-bb89-47e2-85cf-20121e1b021f"});
  api.preview.mockResolvedValue(fare);
});
afterEach(()=>cleanup());
describe("Corrida Rápida dentro do mapa inicial",()=>{
  it("consulta Carro e Moto automaticamente e reutiliza cotações ao trocar veículo",async()=>{
    api.preview.mockImplementation(async({data}:{data:{vehicleType:string}})=>({...fare,
      quoteId:data.vehicleType,vehicleType:data.vehicleType,customerPaysCents:data.vehicleType==="CAR"?1450:750,
    }));
    const changed=vi.fn();
    const {rerender}=render(<QuickRideHomePanel {...basic} shellMode onFaresChange={changed}/>);
    await waitFor(()=>expect(changed).toHaveBeenCalledWith(expect.objectContaining({
      CAR:expect.objectContaining({customerPaysCents:1450}),MOTO:expect.objectContaining({customerPaysCents:750}),
    })),{timeout:3500});
    expect(api.preview).toHaveBeenCalledTimes(2);
    rerender(<QuickRideHomePanel {...basic} shellMode vehicle="CAR" onFaresChange={changed}/>);
    fireEvent.click(await screen.findByRole("button",{name:/Confirmar Flash Carro/}));
    await waitFor(()=>expect(api.submit).toHaveBeenCalledWith({data:{quoteId:"CAR"}}));
    expect(api.preview).toHaveBeenCalledTimes(2);
  });
  it("abre confirmação de embarque somente no CTA e não envia antes do consentimento",async()=>{
    const confirm=vi.fn();
    const {rerender}=render(<QuickRideHomePanel {...basic} pickupNeedsConfirmation onConfirmPickup={confirm}/>);
    const request=await screen.findByRole("button",{name:/Confirmar corrida por/},{timeout:3500});
    expect(request).toBeEnabled();expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"Confirmar local"})).not.toBeInTheDocument();
    fireEvent.click(request);
    expect(confirm).toHaveBeenCalledOnce();expect(api.submit).not.toHaveBeenCalled();
    // Closing the dialog without approval leaves the gate active.
    rerender(<QuickRideHomePanel {...basic} pickupNeedsConfirmation onConfirmPickup={confirm}/>);
    fireEvent.click(screen.getByRole("button",{name:/Confirmar corrida por/}));
    expect(confirm).toHaveBeenCalledTimes(2);expect(api.submit).not.toHaveBeenCalled();
    // The parent only clears the gate after explicit confirmation of this point.
    rerender(<QuickRideHomePanel {...basic} pickupNeedsConfirmation={false} onConfirmPickup={confirm}/>);
    expect(api.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:/Confirmar corrida por/}));
    await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
  });
  it("mostra GPS pendente no CTA sem consultar cobertura ou preço com coordenadas ausentes",()=>{
    const pending=vi.fn();
    render(<QuickRideHomePanel {...basic} shellMode locating originPoint={undefined} onFarePendingChange={pending}/>);
    expect(screen.getByRole("button",{name:"Obtendo sua localização…"})).toBeDisabled();
    expect(screen.queryByText("Preço indisponível")).not.toBeInTheDocument();
    expect(pending).toHaveBeenCalledWith(true);
    expect(api.coverage).not.toHaveBeenCalled();expect(api.preview).not.toHaveBeenCalled();expect(api.submit).not.toHaveBeenCalled();
  });
  it("um objeto sem lat/lng continua sendo localização pendente",()=>{
    render(<QuickRideHomePanel {...basic} shellMode locating originPoint={{rawText:"Minha localização atual"}}/>);
    expect(screen.getByRole("button",{name:"Obtendo sua localização…"})).toBeDisabled();
    expect(api.coverage).not.toHaveBeenCalled();expect(api.preview).not.toHaveBeenCalled();
  });
  it("libera escolha manual após falha de GPS sem permanecer em spinner",()=>{
    const adjust=vi.fn();
    const {rerender}=render(<QuickRideHomePanel {...basic} shellMode locating originPoint={undefined} onConfirmPickup={adjust}/>);
    rerender(<QuickRideHomePanel {...basic} shellMode locating={false} originPoint={undefined} onConfirmPickup={adjust}/>);
    expect(screen.queryByRole("button",{name:"Obtendo sua localização…"})).not.toBeInTheDocument();
    const button=screen.getByRole("button",{name:"Definir ponto de embarque"});
    expect(button).toBeEnabled();fireEvent.click(button);expect(adjust).toHaveBeenCalledOnce();
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("inicia automaticamente as duas cotações quando o GPS chega depois do destino",async()=>{
    const {rerender}=render(<QuickRideHomePanel {...basic} shellMode locating originPoint={undefined}/>);
    expect(api.preview).not.toHaveBeenCalled();
    rerender(<QuickRideHomePanel {...basic} shellMode locating={false}/>);
    await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(2),{timeout:3500});
    expect(api.preview).toHaveBeenCalledWith({data:expect.objectContaining({vehicleType:"MOTO",origin:{lat:origin.lat,lng:origin.lng}})});
    expect(api.preview).toHaveBeenCalledWith({data:expect.objectContaining({vehicleType:"CAR",origin:{lat:origin.lat,lng:origin.lng}})});
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("aceita coordenadas zero e não as trata como GPS ausente",async()=>{
    render(<QuickRideHomePanel {...basic} originPoint={{rawText:"Equador",lat:0,lng:0}}/>);
    await waitFor(()=>expect(api.coverage).toHaveBeenCalledWith({data:{lat:0,lng:0,vehicleType:"MOTO"}}),{timeout:2500});
    await waitFor(()=>expect(api.preview).toHaveBeenCalledWith({data:expect.objectContaining({origin:{lat:0,lng:0}})}),{timeout:3500});
  });
  it("recupera cotação após timeout com Tentar novamente sem recarregar nem despachar",async()=>{
    api.preview.mockRejectedValueOnce(new Error("timeout de rede"));
    render(<QuickRideHomePanel {...basic} shellMode={false}/>);
    expect(await screen.findByText("Não foi possível calcular o preço agora.",{},{timeout:3500})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Tentar novamente"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar corrida por/})).toBeEnabled(),{timeout:3500});
    expect(api.preview).toHaveBeenCalledTimes(2);expect(api.submit).not.toHaveBeenCalled();
    expect(api.coverage).toHaveBeenCalledTimes(1);
  });
  it("retry de uma categoria mantém a cotação válida da outra sem outra cobrança de consulta",async()=>{
    let carAttempts=0;
    api.preview.mockImplementation(async({data}:{data:{vehicleType:string}})=>{
      if(data.vehicleType==="CAR"&&++carAttempts===1)throw new Error("network error");
      return {...fare,quoteId:data.vehicleType,vehicleType:data.vehicleType,customerPaysCents:data.vehicleType==="CAR"?1450:750};
    });
    const changed=vi.fn();
    const {rerender}=render(<QuickRideHomePanel {...basic} shellMode onFaresChange={changed}/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Moto/})).toBeEnabled(),{timeout:3500});
    rerender(<QuickRideHomePanel {...basic} shellMode vehicle="CAR" onFaresChange={changed}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Tentar novamente"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirmar Flash Carro/})).toBeEnabled(),{timeout:3500});
    expect(api.preview.mock.calls.filter(([arg])=>arg.data.vehicleType==="MOTO")).toHaveLength(1);
    expect(api.preview.mock.calls.filter(([arg])=>arg.data.vehicleType==="CAR")).toHaveLength(2);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({CAR:expect.any(Object),MOTO:expect.any(Object)}));
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("falha de uma categoria não descarta a cotação válida da outra",async()=>{
    api.preview.mockImplementation(async({data}:{data:{vehicleType:string}})=>{
      if(data.vehicleType==="CAR")throw new Error("unavailable");return {...fare,quoteId:"moto"};
    });
    render(<QuickRideHomePanel {...basic} shellMode/>);
    expect(await screen.findByRole("button",{name:/Confirmar Flash Moto/},{timeout:3500})).toBeEnabled();
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("não consulta radar nem cotação sem saída válida",()=>{
    render(<QuickRideHomePanel {...basic} originPoint={undefined} driverCount={0}/>);
    expect(screen.getByText(/Defina seu ponto de embarque para consultar os preços/i)).toBeInTheDocument();
    expect(api.coverage).not.toHaveBeenCalled();expect(api.preview).not.toHaveBeenCalled();
  });
  it("recusa GPS acima da tolerância e permite saída manual",()=>{
    render(<QuickRideHomePanel {...basic} gpsOriginIsImprecise/>);
    expect(screen.getByText(/GPS impreciso/i)).toBeInTheDocument();expect(api.coverage).not.toHaveBeenCalled();
  });
  it("mostra motoristas autorizados por modalidade sem sair da home",async()=>{
    render(<QuickRideHomePanel {...basic}/>);
    await waitFor(()=>expect(api.coverage).toHaveBeenCalledWith({data:{lat:origin.lat,lng:origin.lng,vehicleType:"MOTO"}}),{timeout:2500});
    expect(screen.getByText(/2 profissionais autorizados e online/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Moto"})).toHaveAttribute("aria-pressed","true");
    fireEvent.click(screen.getByRole("button",{name:"Carro"}));expect(basic.onVehicleChange).toHaveBeenCalledWith("CAR");
  });
  it("registra interesse sem criar pedido onde a modalidade está desabilitada",async()=>{
    api.coverage.mockResolvedValue({municipality:"Pacatuba",region:"FORTALEZA_CORRIDOR",status:"WAITLIST",radar:false,dispatch:false});
    render(<QuickRideHomePanel {...basic}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Avise-me quando chegar aqui"},{timeout:2500}));
    await waitFor(()=>expect(api.interest).toHaveBeenCalledWith({data:{municipality:"Pacatuba",vehicleType:"MOTO"}}));
    expect(screen.getByText(/Interesse registrado/)).toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();expect(api.submit).not.toHaveBeenCalled();
  });
  it("exibe valor do servidor antes de confirmar a solicitação",async()=>{
    render(<QuickRideHomePanel {...basic}/>);
    expect(screen.queryByRole("button",{name:/Calcular preço/})).not.toBeInTheDocument();
    expect(await screen.findByText(/R\$\s*7,50/,{selector:"p"},{timeout:3000})).toBeInTheDocument();
    expect(api.preview).toHaveBeenCalledWith({data:{origin:{lat:origin.lat,lng:origin.lng},destination:{lat:destination.lat,lng:destination.lng},originLabel:basic.origin,destinationLabel:basic.destination,vehicleType:"MOTO"}});
    fireEvent.click(screen.getByRole("button",{name:/Confirmar corrida por/}));
    await waitFor(()=>expect(api.submit).toHaveBeenCalledWith({data:{quoteId:fare.quoteId}}));
  });
  it("invalida cotação anterior quando o destino muda",async()=>{
    const {rerender}=render(<QuickRideHomePanel {...basic}/>);
    await screen.findByRole("button",{name:/Confirmar corrida por/},{timeout:3000});
    rerender(<QuickRideHomePanel {...basic} destination="Novo destino" destinationPoint={{rawText:"Novo destino",lat:-4.26,lng:-38.75}}/>);
    expect(screen.queryByRole("button",{name:/Confirmar corrida por/})).not.toBeInTheDocument();
    await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(2),{timeout:3000});expect(api.submit).not.toHaveBeenCalled();
  });
  it("permite cotação de Carro com destino intermunicipal validado no servidor",async()=>{
    api.preview.mockResolvedValueOnce({...fare,destinationMunicipality:"Fortaleza",vehicleType:"CAR",distanceKm:70,durationMinutes:95,
      customerPaysCents:17350,driverReceivesCents:13880,platformCommissionCents:3470,policyVersion:"macico-car-piloto"});
    render(<QuickRideHomePanel {...basic} vehicle="CAR" destination="Fortaleza" destinationPoint={{rawText:"Fortaleza",lat:-3.73,lng:-38.52}}/>);
    expect(await screen.findByText(/R\$\s*173,50/,{selector:"p"},{timeout:3000})).toBeInTheDocument();
    expect(api.preview).toHaveBeenCalledWith({data:expect.objectContaining({vehicleType:"CAR",destination:{lat:-3.73,lng:-38.52}})});
  });
  it("calcula sem clique mas não confirma sem motorista online",async()=>{
    render(<QuickRideHomePanel {...basic} driverCount={0}/>);
    expect(await screen.findByText(/R\$\s*7,50/,{selector:"p"},{timeout:3000})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Aguardando motorista disponível"})).toBeDisabled();expect(api.submit).not.toHaveBeenCalled();
  });
  it("não realiza cotação antes de destino válido",async()=>{
    render(<QuickRideHomePanel {...basic} destination="" destinationPoint={undefined}/>);
    await screen.findByText(/Escolha o destino para visualizar o preço automaticamente/,{exact:false});expect(api.preview).not.toHaveBeenCalled();
  });
  it("libera imediatamente a Home após corrida concluída, sem exigir Nova corrida",async()=>{
    const completed="0f066ee8-bb89-47e2-85cf-20121e1b021f";
    api.rpc.mockImplementation(async(name:string)=>name==="quick_ride_my_requests"
      ?{data:[{id:completed,role:"PASSENGER",status:"COMPLETED",vehicle_type:"MOTO",municipality:"Redenção"}],error:null}
      :{data:[],error:null});
    render(<QuickRideHomePanel {...basic}/>);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_requests"));
    const request=await screen.findByRole("button",{name:/Confirmar corrida por/},{timeout:3500});
    await waitFor(()=>expect(request).toBeEnabled(),{timeout:3500});
    expect(screen.queryByRole("button",{name:"Nova corrida"})).not.toBeInTheDocument();
    expect(screen.queryByText("QR Pix pronto: "+completed)).not.toBeInTheDocument();
    fireEvent.click(request);
    await waitFor(()=>expect(api.submit).toHaveBeenCalledOnce());
  });
  it("encerra visualmente uma busca quando seu prazo passou, mesmo se RPC ainda retornar SEARCHING",async()=>{
    const expired=new Date(Date.now()-10000).toISOString();
    api.rpc.mockImplementation(async(name:string)=>name==="quick_ride_my_requests"
      ?{data:[{id:"expired-ride",role:"PASSENGER",status:"SEARCHING",expires_at:expired,
        vehicle_type:"MOTO",municipality:"Redenção"}],error:null}
      :{data:[],error:null});
    render(<QuickRideHomePanel {...basic}/>);
    expect(await screen.findByText("Busca encerrada")).toBeInTheDocument();
    expect(screen.queryByText(/Procurando um profissional autorizado/)).not.toBeInTheDocument();
    expect(await screen.findByRole("button",{name:/Confirmar corrida por/},{timeout:3500})).toBeEnabled();
  });
  it("mostra SEARCHING somente após retorno de ID autorizado pelo servidor",async()=>{
    render(<QuickRideHomePanel {...basic} shellMode shellSnap="full"/>);
    const button=await screen.findByRole("button",{name:/Confirmar Flash Moto/i},{timeout:3500});
    expect(api.submit).not.toHaveBeenCalled();fireEvent.click(button);
    await waitFor(()=>expect(api.submit).toHaveBeenCalledWith({data:{quoteId:fare.quoteId}}));
    expect(await screen.findByText("Procurando motorista")).toBeInTheDocument();
  });
  it("prioriza desembarque e contesta pela RPC existente",async()=>{
    const rideId="0f066ee8-bb89-47e2-85cf-20121e1b021f";
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="quick_ride_my_requests")return {data:[{id:rideId,role:"PASSENGER",status:"IN_PROGRESS",vehicle_type:"MOTO",municipality:"Redenção"}],error:null};
      if(name==="quick_ride_dropoff_state")return {data:[{deadline_at:new Date(Date.now()+25000).toISOString(),passenger_response:null,resolved_at:null}],error:null};
      return {data:true,error:null};
    });
    render(<QuickRideHomePanel {...basic}/>);
    expect(await screen.findByRole("alert",{name:"Confirmação de desembarque pendente"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Ainda não / Tenho um problema"}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_respond_dropoff",{p_id:rideId,p_response:"CONTESTED"}));
  });
  it("entrega ao pai a viagem ativa para usar um único mapa na Home",async()=>{
    const changed=vi.fn();
    api.rpc.mockImplementation(async(name:string)=>name==="quick_ride_my_requests"?{data:[{
      id:"0f066ee8-bb89-47e2-85cf-20121e1b021f",role:"PASSENGER",status:"ACCEPTED",vehicle_type:"MOTO",municipality:"Redenção",
    }],error:null}:{data:[],error:null});
    render(<QuickRideHomePanel {...basic} onOperationalRideChange={changed}/>);
    await waitFor(()=>expect(changed).toHaveBeenCalledWith({id:"0f066ee8-bb89-47e2-85cf-20121e1b021f",status:"ACCEPTED",municipality:"Redenção"}));
  });
  it("libera nova solicitação em PENDING_REVIEW sem cobrar ou avaliar antes da decisão",async()=>{
    const reviewId="ab317262-8dfc-452a-9db0-f2d414127c31";
    api.rpc.mockImplementation(async(name:string)=>name==="quick_ride_my_requests"
      ?{data:[{id:reviewId,role:"PASSENGER",status:"PENDING_REVIEW",
        vehicle_type:"MOTO",municipality:"Redenção"}],error:null}
      :{data:[],error:null});
    render(<QuickRideHomePanel {...basic}/>);
    expect(await screen.findByText("Aguardando sua confirmação")).toBeInTheDocument();
    expect(await screen.findByRole("button",{name:/Confirmar corrida por/},{timeout:3500})).toBeEnabled();
    expect(screen.queryByRole("dialog",{name:"Corrida concluída"})).not.toBeInTheDocument();
    expect(api.rpc.mock.calls.some(([name])=>name==="get_completed_quick_ride_pix")).toBe(false);
  });
  it("permite ao passageiro confirmar desembarque mesmo após o prazo antigo, sem chamar o admin",async()=>{
    const rideId="fc782126-1834-4a0a-82ad-f146eb3b27e6";
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="quick_ride_my_requests")return {data:[{
        id:rideId,role:"PASSENGER",status:"PENDING_REVIEW",
        vehicle_type:"MOTO",municipality:"Redenção"}],error:null};
      if(name==="quick_ride_dropoff_state")return {data:[{
        deadline_at:new Date(Date.now()-180000).toISOString(),
        passenger_response:null,resolved_at:null}],error:null};
      if(name==="quick_ride_respond_dropoff")return {data:true,error:null};
      return {data:[],error:null};
    });
    render(<QuickRideHomePanel {...basic}/>);
    const confirm=await screen.findByRole("button",{name:"Sim, já desembarquei"});
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_respond_dropoff",{
      p_id:rideId,p_response:"CONFIRMED"}));
    expect(api.rpc.mock.calls.some(([name])=>name==="admin_resolve_quick_ride_dispute")).toBe(false);
  });
  it("mantém dispensada a corrida concluída após remontar painel",async()=>{
    const completed="0f066ee8-bb89-47e2-85cf-20121e1b021f";window.localStorage.setItem("caronaa-completed-dismissed:"+completed,"1");
    api.rpc.mockImplementation(async(name:string)=>name==="quick_ride_my_requests"?{data:[{id:completed,role:"PASSENGER",status:"COMPLETED",vehicle_type:"MOTO",municipality:"Redenção"}],error:null}:{data:[],error:null});
    render(<QuickRideHomePanel {...basic}/>);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("quick_ride_my_requests"));
    await waitFor(()=>expect(api.preview).toHaveBeenCalled(),{timeout:3500});
    expect(screen.queryByText("QR Pix pronto: "+completed)).not.toBeInTheDocument();
    expect(await screen.findByRole("button",{name:/Confirmar corrida por/})).toBeEnabled();
  });
});
