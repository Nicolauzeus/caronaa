import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverPlatformFees } from "./DriverPlatformFees";

const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  toDataURL: vi.fn(async () => "data:image/png;base64,TEST"),
  hasStatement: false,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: api.rpc },
}));
vi.mock("qrcode", () => ({ default: { toDataURL: api.toDataURL } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/minhas-caronas">{children}</a>,
}));

const rideId="ea1e7ba0-ec4a-4d51-9c2e-37dd46147b18";
const statementId="6aa0973b-cab9-4f9a-8c73-9e6ed4ff84f3";
const statement={
  id:statementId,status:"OPEN",totalCents:150,itemCount:1,
  pixKey:"caronaa@example.com",txid:"C6AA0973BCAB94F9A8C739E6E",
  claimReference:null,createdAt:"2026-11-08T10:00:00Z",verifiedAt:null,
};
const base={
  driverAllowed:true,pendingTrips:1,limit:3,totalOutstandingCents:150,
  readyToInvoiceCents:150,platformPixConfigured:true,
  dues:[{
    source:"QUICK",rideId,grossCents:750,feeCents:150,
    commissionBps:2000,status:"OPEN",statementId:null,createdAt:"2026-11-08T09:00:00Z",
  }],
  statements:[],
};
beforeEach(()=>{
  vi.clearAllMocks();
  api.hasStatement=false;
  api.rpc.mockImplementation(async (name:string,args:any)=>{
    if(name==="get_my_caronaa_commission_ledger")return{
      error:null,
      data: api.hasStatement?{
        ...base,readyToInvoiceCents:0,
        dues:[{...base.dues[0],statementId}],
        statements:[statement],
      }:base,
    };
    if(name==="create_my_caronaa_fee_statement"){
      api.hasStatement=true;
      return{data:statementId,error:null};
    }
    if(name==="claim_my_caronaa_fee_statement")return{data:true,error:null};
    return{data:null,error:{message:"unrecognized"}};
  });
});

describe("driver commission QR billing",()=>{
  it("uses the server price for the full balance, never a browser-entered amount",async()=>{
    render(<DriverPlatformFees/>);
    expect(await screen.findByText("R$ 1,50")).toBeInTheDocument();
    expect(screen.getByText(/1 viagem pendente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Gerar QR Pix para/}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith(
      "create_my_caronaa_fee_statement",{p_source:null,p_ride_id:null},
    ));
    expect(await screen.findByText(/Pix CARONAA · Valor fixo R\$/)).toBeInTheDocument();
    await waitFor(()=>expect(api.toDataURL).toHaveBeenCalled());
    const payload=api.toDataURL.mock.calls[0][0] as string;
    expect(payload).toContain("54041.50");
    expect(payload).toContain(statement.txid);
    expect(payload).toContain("caronaa@example.com");
    expect(screen.getByRole("img",{name:/QR Pix CARONAA/})).toBeInTheDocument();
  });
  it("can issue QR for a specific quick ride, and requires bank reference for claim",async()=>{
    render(<DriverPlatformFees/>);
    const button=await screen.findByRole("button",{name:"Gerar QR desta viagem"});
    fireEvent.click(button);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("create_my_caronaa_fee_statement",{
      p_source:"QUICK",p_ride_id:rideId,
    }));
    const claim=await screen.findByRole("button",{name:/Já paguei/});
    expect(claim).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Identificador bancário do Pix/),{
      target:{value:"E123456789BANKREF"},
    });
    expect(claim).toBeEnabled();
    fireEvent.click(claim);
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("claim_my_caronaa_fee_statement",{
      p_statement_id:statementId,p_reference:"E123456789BANKREF",
    }));
  });
  it("preserves legacy shared-ride claims before the new migration is applied",async()=>{
    api.rpc.mockImplementation(async (name:string)=>{
      if(name==="get_my_caronaa_commission_ledger")return{
        data:null,error:{code:"PGRST202",message:"function not available"},
      };
      if(name==="get_my_driver_platform_fees")return{
        data:{
          driverAllowed:true,pendingTrips:1,limit:3,amountOutstanding:0.9,
          platformPixKey:"caronaa@example.com",
          dues:[{rideId,grossAmount:6,feeAmount:0.9,status:"OPEN",createdAt:"2026-11-08T09:00:00Z"}],
        },error:null,
      };
      return{data:true,error:null};
    });
    render(<DriverPlatformFees/>);
    expect(await screen.findByText(/novo fechamento por QR ainda aguarda/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Enviei o Pix"})).toBeDisabled();
  });
});
