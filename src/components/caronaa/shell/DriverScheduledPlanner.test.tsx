import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverScheduledError } from "@/services/driver-scheduled-service";
import { DriverScheduledPlanner } from "./DriverScheduledPlanner";

const api=vi.hoisted(()=>({
  quote:vi.fn(),publish:vi.fn(),opportunities:vi.fn(),accept:vi.fn(),
  rpc:vi.fn(),channel:vi.fn(),removeChannel:vi.fn(),
}));
vi.mock("@tanstack/react-start",()=>({useServerFn:(fn:unknown)=>fn}));
vi.mock("@/lib/offer-pricing.functions",()=>({quoteOfferRoute:api.quote}));
vi.mock("@/lib/map-routing.functions",()=>({getMapDrivingRoute:vi.fn()}));
vi.mock("@/lib/pricing/unified-fare-engine",()=>({quoteUnifiedFare:vi.fn()}));
vi.mock("@/components/caronaa/DriverPlatformFees",()=>({DriverPlatformFees:()=> <p>Minhas comissões</p>}));
vi.mock("@/components/caronaa/WomenOnlyToggle",()=>({
  WomenOnlyToggle:()=> <p>Apenas passageiras mulheres</p>,
}));
vi.mock("@/components/formulario/LocationAutocomplete",()=>({
  LocationAutocomplete:({onChange}:{onChange:(label:string,p?:unknown)=>void})=><div>
    <button type="button" onClick={()=>onChange("Universidade",{
      lat:-3.75,lng:-38.51,city:"Fortaleza",
    })}>Selecionar destino</button>
    <button type="button" onClick={()=>onChange("Terminal",{
      lat:-3.77,lng:-38.56,city:"Fortaleza",
    })}>Selecionar outro destino</button>
    <button type="button" onClick={()=>onChange("Universidade")}>Digitar destino</button>
    <button type="button" onClick={()=>onChange("")}>Limpar destino</button>
  </div>,
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
const quoteResult=(overrides:Record<string,unknown>={})=>({
  quoteId:"quote-123",distanceKm:11,durationMinutes:18,routePath:points,
  originPoint:points[0],destinationPoint:points[1],pricePerPassenger:6,
  expiresAt:new Date(Date.now()+15*60*1000).toISOString(),...overrides,
});
const base={
  snap:"half" as const,onSnapChange:vi.fn(),
  serviceType:"AGENDADA" as const,onServiceTypeChange:vi.fn(),
  vehicleType:"CAR" as const,maxSeats:3,
  gender:"FEMININO" as const,originPoint:points[0],
  originLabel:"Centro",originRevision:0,
  onAdjustOrigin:vi.fn(),onRouteChange:vi.fn(),onDestinationChange:vi.fn(),
};
beforeEach(()=>{
  vi.resetAllMocks();
  api.quote.mockImplementation(()=>Promise.resolve(quoteResult()));
  api.publish.mockResolvedValue("offer-123");
  api.opportunities.mockResolvedValue([]);
  api.accept.mockResolvedValue({seatsRemaining:1});
  api.removeChannel.mockResolvedValue(null);
  const channel={on:vi.fn().mockReturnThis(),subscribe:vi.fn().mockReturnThis()};
  api.channel.mockReturnValue(channel);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const futureDate=()=>{
  const d=new Date(Date.now()+2*60*60*1000);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")+
    "T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
};
const selectDestination=()=>fireEvent.click(screen.getByRole("button",{name:"Selecionar destino"}));
const schedule=()=>fireEvent.change(screen.getByLabelText("Data e hora de saída"),{target:{value:futureDate()}});
const waitReady=()=>waitFor(()=>expect(screen.getByRole("button",{name:"Revisar publicação"})).not.toBeDisabled());
const deferred=()=>{
  let resolve!:(result:ReturnType<typeof quoteResult>)=>void;
  const promise=new Promise<ReturnType<typeof quoteResult>>(done=>{resolve=done;});
  return {promise,resolve};
};

describe("Motorista — publicação na Casca Única",()=>{
  it("quotes the selected road route once while schedule, seats and booking mode change",async()=>{
    render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();
    fireEvent.change(screen.getByLabelText("Vagas disponíveis"),{target:{value:"2"}});
    fireEvent.click(screen.getByRole("button",{name:"Apenas Na Rota"}));
    fireEvent.click(screen.getByRole("button",{name:"Apenas Exclusiva"}));
    expect(api.quote).toHaveBeenCalledTimes(1);
    expect(api.quote).toHaveBeenCalledWith({data:{
      origin:"Centro",destination:"Universidade",originPoint:points[0],destinationPoint:points[1],
    }});
    expect(api.publish).not.toHaveBeenCalled();
  });

  it("publishes the server quote and selected endpoints only on explicit confirmation",async()=>{
    const snappedRoute=[{lat:-3.7302,lng:-38.5301},{lat:-3.7502,lng:-38.5101}];
    api.quote.mockResolvedValue(quoteResult({routePath:snappedRoute,pricePerPassenger:0.55,distanceKm:1}));
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();
    expect(screen.getByText(/Valor sugerido por vaga/)).toHaveTextContent("0,55");
    fireEvent.click(screen.getByRole("button",{name:"Revisar publicação"}));
    expect(base.onSnapChange).toHaveBeenCalledWith("full");
    expect(api.publish).not.toHaveBeenCalled();
    rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    expect(screen.getByText(/3 vaga\(s\)/)).toHaveTextContent("Aceito tudo");
    expect(screen.getByText(/3 vaga\(s\)/)).not.toHaveTextContent("ALL");
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(api.publish).toHaveBeenCalledWith(expect.objectContaining({
      origin:"Centro",destination:"Universidade",quoteId:"quote-123",
      originPoint:points[0],destinationPoint:points[1],routePath:snappedRoute,
      bookingMode:"ALL",vehicleType:"CAR",seats:3,suggestedFarePerSeat:0.55,
    }));
    expect(screen.getByText(/Carona agendada publicada/)).toBeTruthy();
    expect(api.quote).toHaveBeenCalledTimes(1);
  });

  it("waits for a late GPS fix without asking to select the destination again",async()=>{
    const {rerender}=render(<DriverScheduledPlanner {...base} originPoint={null} originLabel="" locating/>);
    selectDestination();schedule();
    expect(screen.getByText(/Destino selecionado. Aguardando sua localização/)).toBeTruthy();
    expect(screen.queryByText("Escolha o destino")).toBeNull();
    expect(api.quote).not.toHaveBeenCalled();
    rerender(<DriverScheduledPlanner {...base} locating={false}/>);
    await waitReady();expect(api.quote).toHaveBeenCalledTimes(1);
  });

  it("explains that the origin is missing when a selected destination has no GPS fix",()=>{
    render(<DriverScheduledPlanner {...base} originPoint={null} originLabel=""/>);
    selectDestination();
    expect(screen.getByText(/Destino selecionado. Defina a saída no mapa/)).toBeTruthy();
    expect(screen.queryByText("Escolha o destino")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:/Origem:.*Ajustar no mapa/}));
    expect(base.onAdjustOrigin).toHaveBeenCalledTimes(1);expect(api.quote).not.toHaveBeenCalled();
  });

  it("requires an autocomplete selection when the address has only been typed",()=>{
    render(<DriverScheduledPlanner {...base}/>);
    fireEvent.click(screen.getByRole("button",{name:"Digitar destino"}));
    expect(screen.getByText(/Selecione o endereço na lista/)).toBeTruthy();expect(api.quote).not.toHaveBeenCalled();
  });

  it("keeps the selected origin and pending quote stable when live GPS or its label changes",async()=>{
    const pending=deferred();api.quote.mockReturnValue(pending.promise);
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitFor(()=>expect(api.quote).toHaveBeenCalledTimes(1));
    rerender(<DriverScheduledPlanner {...base} originPoint={{lat:-3.72,lng:-38.52}} originLabel="GPS posterior"/>);
    await act(async()=>{pending.resolve(quoteResult());});await waitReady();
    expect(api.quote).toHaveBeenCalledTimes(1);
    expect(base.onRouteChange).toHaveBeenLastCalledWith(expect.objectContaining({quoteId:"quote-123"}),points[0]);
    expect(screen.getByRole("button",{name:/Origem: Centro/})).toBeTruthy();
  });

  it("ignores an old quote after the user explicitly changes the departure point",async()=>{
    const old=deferred();const current=deferred();
    api.quote.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitFor(()=>expect(api.quote).toHaveBeenCalledTimes(1));
    const manual={lat:-3.71,lng:-38.54};
    rerender(<DriverScheduledPlanner {...base} originPoint={manual} originLabel="Saída escolhida" originRevision={1}/>);
    await waitFor(()=>expect(api.quote).toHaveBeenCalledTimes(2));
    await act(async()=>{current.resolve(quoteResult({quoteId:"new-quote",originPoint:manual,pricePerPassenger:12}));});await waitReady();
    await act(async()=>{old.resolve(quoteResult({pricePerPassenger:99}));});
    expect(screen.getByText(/Valor sugerido por vaga/)).toHaveTextContent("12,00");
    expect(base.onRouteChange).toHaveBeenLastCalledWith(expect.objectContaining({quoteId:"new-quote"}),manual);
    rerender(<DriverScheduledPlanner {...base} originPoint={{lat:-3.72,lng:-38.52}} originLabel="GPS posterior" originRevision={1}/>);
    expect(api.quote).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button",{name:/Origem: Saída escolhida/})).toBeTruthy();
  });

  it("invalidates the previous quote while a requested new GPS origin is still pending",async()=>{
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();
    rerender(<DriverScheduledPlanner {...base} originPoint={null} originLabel="" originRevision={1} locating/>);
    expect(screen.getByRole("button",{name:"Revisar publicação"})).toBeDisabled();
    expect(screen.getByText(/Destino selecionado. Aguardando sua localização/)).toBeTruthy();
    const replacement={lat:-3.72,lng:-38.54};api.quote.mockResolvedValue(quoteResult({originPoint:replacement}));
    rerender(<DriverScheduledPlanner {...base} originPoint={replacement} originRevision={1}/>);
    await waitReady();
    expect(api.quote).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({originPoint:replacement})}));
    expect(api.quote).toHaveBeenCalledTimes(2);
  });

  it("does not restore a stale route after the destination is cleared",async()=>{
    const pending=deferred();api.quote.mockReturnValue(pending.promise);
    render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitFor(()=>expect(api.quote).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button",{name:"Limpar destino"}));
    await act(async()=>{pending.resolve(quoteResult());});
    expect(screen.getByRole("button",{name:"Revisar publicação"})).toBeDisabled();
    expect(screen.getByText("Selecione um destino para visualizar a rota.")).toBeTruthy();
    expect(base.onRouteChange).toHaveBeenLastCalledWith(null,null);
  });

  it("can retry a failed quote without losing the selected itinerary",async()=>{
    api.quote.mockRejectedValueOnce(new Error("unavailable"));
    render(<DriverScheduledPlanner {...base}/>);selectDestination();schedule();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Tentar calcular novamente"})).toBeTruthy());
    expect(screen.queryByText("Escolha o destino")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Tentar calcular novamente"}));await waitReady();
    expect(api.quote).toHaveBeenCalledTimes(2);expect(api.quote.mock.calls[1][0]).toEqual(api.quote.mock.calls[0][0]);
  });

  it("can select the same destination again after a failed quote",async()=>{
    api.quote.mockRejectedValueOnce(new Error("unavailable"));
    render(<DriverScheduledPlanner {...base}/>);selectDestination();schedule();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Tentar calcular novamente"})).toBeTruthy());
    selectDestination();await waitReady();expect(api.quote).toHaveBeenCalledTimes(2);
  });

  it("reuses an unconsumed quote but creates a new one for an explicitly started next offer",async()=>{
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();selectDestination();await waitReady();
    expect(api.quote).toHaveBeenCalledTimes(1);
    rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    api.quote.mockResolvedValue(quoteResult({quoteId:"next-offer-quote"}));
    rerender(<DriverScheduledPlanner {...base} snap="half"/>);
    selectDestination();await waitReady();
    expect(api.quote).toHaveBeenCalledTimes(2);expect(api.publish).toHaveBeenCalledTimes(1);
  });

  it("previews an approximate origin but requires its explicit confirmation before publication",async()=>{
    const confirm=vi.fn();
    const {rerender}=render(<DriverScheduledPlanner {...base} originNeedsConfirmation onConfirmOrigin={confirm}/>);
    selectDestination();schedule();
    await waitFor(()=>expect(screen.getByText(/Valor sugerido por vaga/)).toHaveTextContent("6,00"));
    expect(screen.getByRole("button",{name:"Revisar publicação"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Confirmar ponto de saída"}));
    expect(confirm).toHaveBeenCalledTimes(1);expect(api.publish).not.toHaveBeenCalled();
    rerender(<DriverScheduledPlanner {...base} originNeedsConfirmation={false} onConfirmOrigin={confirm}/>);
    await waitReady();expect(api.quote).toHaveBeenCalledTimes(1);
  });

  it("requotes an expired price and waits for a second explicit publication confirmation",async()=>{
    const now=Date.now();
    api.quote.mockResolvedValueOnce(quoteResult({quoteId:"old-quote",expiresAt:new Date(now+60000).toISOString()}))
      .mockImplementation(()=>Promise.resolve(quoteResult({quoteId:"fresh-quote",pricePerPassenger:7})));
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    vi.spyOn(Date,"now").mockReturnValue(now+61000);
    fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));
    await waitFor(()=>expect(api.quote).toHaveBeenCalledTimes(2));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Publicar Carona Agendada"})).not.toBeDisabled());
    expect(api.publish).not.toHaveBeenCalled();expect(screen.getByText(/O valor anterior expirou/)).toBeTruthy();
    expect(screen.getByText(/sugeridos por vaga/).parentElement).toHaveTextContent("7,00");
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(api.publish).toHaveBeenCalledWith(expect.objectContaining({quoteId:"fresh-quote",suggestedFarePerSeat:7}));
  });

  it("recovers a server-expired quote without automatically publishing the new quote",async()=>{
    api.publish.mockRejectedValueOnce(new DriverScheduledError("QUOTE_EXPIRED"));
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();
    api.quote.mockResolvedValue(quoteResult({quoteId:"replacement-quote"}));
    rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    await waitFor(()=>expect(screen.getByRole("button",{name:"Publicar Carona Agendada"})).not.toBeDisabled());
    expect(api.publish).toHaveBeenCalledTimes(1);expect(api.quote).toHaveBeenCalledTimes(2);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(api.publish).toHaveBeenLastCalledWith(expect.objectContaining({quoteId:"replacement-quote"}));
  });

  it("keeps the same quote for an uncertain publication retry and blocks duplicate clicks",async()=>{
    const now=Date.now();
    let fail!:(error:Error)=>void;
    api.publish.mockReturnValueOnce(new Promise((_resolve,reject)=>{fail=reject;}));
    const onOpenTrips=vi.fn();
    const {rerender}=render(<DriverScheduledPlanner {...base} onOpenTrips={onOpenTrips}/>);
    selectDestination();schedule();await waitReady();rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    act(()=>{
      const button=screen.getByRole("button",{name:"Publicar Carona Agendada"});fireEvent.click(button);fireEvent.click(button);
    });
    expect(api.publish).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button",{name:"Voltar à edição"})).toBeDisabled();
    rerender(<DriverScheduledPlanner {...base} snap="half" onOpenTrips={onOpenTrips}/>);
    expect(screen.queryByLabelText("Data e hora de saída")).toBeNull();
    await act(async()=>{fail(new Error("network timeout"));});
    expect(screen.getByText(/Seus dados foram mantidos/)).toBeTruthy();
    expect(screen.getByRole("button",{name:"Voltar à edição"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Conferir Agendados"}));expect(onOpenTrips).toHaveBeenCalledTimes(1);
    // Recover the exact attempted offer even after both the quote and the
    // local 30-minute scheduling window have expired.
    vi.spyOn(Date,"now").mockReturnValue(now+2*60*60*1000);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Verificar publicação"}));});
    expect(api.publish).toHaveBeenCalledTimes(2);
    expect(api.publish.mock.calls[1][0]).toEqual(api.publish.mock.calls[0][0]);expect(api.quote).toHaveBeenCalledTimes(1);
    expect(api.publish.mock.calls[1][1]).toEqual({retry:true});
  });

  it("releases an uncertain attempt only after the server confirms its quote expired",async()=>{
    api.publish.mockRejectedValueOnce(new DriverScheduledError("UNAVAILABLE"))
      .mockRejectedValueOnce(new DriverScheduledError("QUOTE_EXPIRED"));
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    api.quote.mockResolvedValue(quoteResult({quoteId:"confirmed-new-quote"}));
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Verificar publicação"}));});
    await waitFor(()=>expect(screen.getByRole("button",{name:"Publicar Carona Agendada"})).not.toBeDisabled());
    expect(api.quote).toHaveBeenCalledTimes(2);expect(api.publish).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button",{name:"Voltar à edição"})).not.toBeDisabled();
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(api.publish).toHaveBeenCalledTimes(3);
    expect(api.publish).toHaveBeenLastCalledWith(expect.objectContaining({quoteId:"confirmed-new-quote"}));
  });

  it("points to Agendados for an already-used quote without creating another offer",async()=>{
    api.publish.mockRejectedValueOnce(new DriverScheduledError("ALREADY_PUBLISHED"));
    const openTrips=vi.fn();
    const {rerender}=render(<DriverScheduledPlanner {...base} onOpenTrips={openTrips}/>);
    selectDestination();schedule();await waitReady();
    rerender(<DriverScheduledPlanner {...base} snap="full" onOpenTrips={openTrips}/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(screen.getByText(/Esta carona já foi publicada/)).toBeTruthy();
    expect(screen.getByRole("button",{name:"Publicar Carona Agendada"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Conferir Agendados"}));expect(openTrips).toHaveBeenCalledTimes(1);
    expect(api.publish).toHaveBeenCalledTimes(1);expect(api.quote).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["INVALID_SCHEDULE","Escolha uma saída com pelo menos 30 minutos"],
    ["VEHICLE_REQUIRED","Confira os dados do veículo"],
    ["FORBIDDEN","Entre novamente na sua conta"],
    ["INVALID_INPUT","Revise a saída, o destino e as vagas"],
  ] as const)("explains %s without treating it as platform debt",async(code,message)=>{
    api.publish.mockRejectedValue(new DriverScheduledError(code));
    const {rerender}=render(<DriverScheduledPlanner {...base}/>);
    selectDestination();schedule();await waitReady();rerender(<DriverScheduledPlanner {...base} snap="full"/>);
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Publicar Carona Agendada"}));});
    expect(screen.getByRole("alert")).toHaveTextContent(message);expect(screen.queryByText(/Regularizar pendências/)).toBeNull();
  });

  it.each([
    {quoteId:""},{pricePerPassenger:Number.NaN},{pricePerPassenger:-1},{expiresAt:"invalid"},
  ])("cannot publish an invalid server quote: %j",async invalid=>{
    api.quote.mockResolvedValue(quoteResult(invalid));
    render(<DriverScheduledPlanner {...base}/>);selectDestination();schedule();
    await waitFor(()=>expect(screen.getByRole("button",{name:"Tentar calcular novamente"})).toBeTruthy());
    expect(screen.getByRole("button",{name:"Revisar publicação"})).toBeDisabled();expect(api.publish).not.toHaveBeenCalled();
  });

  it("motorcycle allows exactly one seat",()=>{
    render(<DriverScheduledPlanner {...base} vehicleType="MOTO"/>);
    const combo=screen.getByLabelText("Vagas disponíveis") as HTMLSelectElement;
    expect(combo.value).toBe("1");expect(combo.disabled).toBe(true);
  });
});
