import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedMyTripsPanel } from "./UnifiedMyTripsPanel";

const api=vi.hoisted(()=>({rpc:vi.fn(),success:vi.fn(),error:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
vi.mock("sonner",()=>({toast:{success:api.success,error:api.error}}));

const sample={
  id:"schedule-test-id", source:"SCHEDULED",category:"AGENDADAS",
  status:"WAITING",departure_at:new Date(Date.now()+20*60000).toISOString(),
  origin:"Centro",destination:"Universidade",mode:"ON_ROUTE",
  vehicle_type:"CAR",seats:2,estimated_fare:12,can_cancel:true,
};

beforeEach(()=>{
  vi.clearAllMocks();
  api.rpc.mockImplementation(async(name:string)=>{
    if(name==="get_my_unified_trips")return {data:[sample],error:null};
    if(name==="cancel_scheduled_caronaa_request")return {data:true,error:null};
    return {data:null,error:{message:"unknown RPC"}};
  });
});
afterEach(cleanup);

describe("CARONAA — Minhas Viagens na Casca Única",()=>{
  it("lists scheduled trips with date, route and estimated fare",async()=>{
    render(<UnifiedMyTripsPanel onClose={vi.fn()}/>);
    await screen.findByText("Aguardando motorista");
    expect(screen.getByText("Centro")).toBeTruthy();
    expect(screen.getByText("Universidade")).toBeTruthy();
    expect(screen.getByText(/Na Rota/)).toBeTruthy();
    expect(screen.getByText(/R\$\s?12,00/)).toBeTruthy();
    expect(screen.getByText(/Nenhum motorista confirmou ainda/)).toBeTruthy();
    expect(api.rpc).toHaveBeenCalledWith("get_my_unified_trips");
  });

  it("only cancels after confirmation and positive RPC response",async()=>{
    render(<UnifiedMyTripsPanel onClose={vi.fn()}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Cancelar viagem"}));
    expect(screen.getByRole("dialog",{name:"Confirmar cancelamento"})).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalledWith("cancel_scheduled_caronaa_request",expect.anything());
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Confirmar cancelamento"}));});
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("cancel_scheduled_caronaa_request",{
      p_request_id:"schedule-test-id",
    }));
    expect(api.success).toHaveBeenCalledWith("Agendamento cancelado.");
  });

  it("does not claim cancellation when the RPC returns false",async()=>{
    api.rpc.mockImplementation(async(name:string)=>name==="get_my_unified_trips"
      ?{data:[sample],error:null}:{data:false,error:null});
    render(<UnifiedMyTripsPanel onClose={vi.fn()}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Cancelar viagem"}));
    await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Confirmar cancelamento"}));});
    expect(api.success).not.toHaveBeenCalled();
    expect(api.error).toHaveBeenCalled();
  });

  it("does not expose cancel for non-cancellable trips and does not confuse matched with confirmed",async()=>{
    api.rpc.mockResolvedValue({data:[{...sample,status:"matched",can_cancel:false}],error:null});
    render(<UnifiedMyTripsPanel onClose={vi.fn()}/>);
    await screen.findByText("matched");
    expect(screen.queryByRole("button",{name:"Cancelar viagem"})).toBeNull();
    expect(screen.queryByText("Confirmada")).toBeNull();
  });

  it("switches tabs and returns to the planner without navigation",async()=>{
    const close=vi.fn();
    render(<UnifiedMyTripsPanel onClose={close}/>);
    await screen.findByText("Aguardando motorista");
    fireEvent.click(screen.getByRole("tab",{name:"Em andamento"}));
    expect(screen.getByText("Nenhuma viagem em andamento.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Fechar Minhas Viagens"}));
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows safe error when unified listing RPC is absent",async()=>{
    api.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
    render(<UnifiedMyTripsPanel onClose={vi.fn()}/>);
    await screen.findByRole("alert");
    expect(screen.getByRole("button",{name:"Tentar novamente"})).toBeTruthy();
  });
});
