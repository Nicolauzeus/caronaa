import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({rpc: vi.fn()}));
vi.mock("@/integrations/supabase/client", () => ({supabase:{rpc: api.rpc}}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({to,children}: {to:string;children:ReactNode}) => <a href={to}>{children}</a>,
}));
vi.mock("./MunicipalitySelect", () => ({MunicipalitySelect: () => <div>Município</div>}));
vi.mock("@/components/caronaa/ProfessionalAuthorizationBadge", () => ({
  ProfessionalAuthorizationBadge: () => <span>Autorizado</span>,
}));

import { ProfessionalAccessRequest } from "./ProfessionalAccessRequest";

beforeEach(() => {
  vi.clearAllMocks();
  api.rpc.mockResolvedValue({error:null,data:{
    authorized:false, profileMissing:[],
    request:{status:"PENDING",access_type:"MOTOTAXI_SIMPLE",vehicle_type:"MOTO",
      car_category:null,passenger_seats:1,municipality:"FORTALEZA",review_reason:null},
  }});
});
afterEach(cleanup);

describe("Mototaxi confirmado na tela de corridas", () => {
  it("shows a pending legacy registration with no second application", async () => {
    render(<ProfessionalAccessRequest/>);
    await screen.findByText(/Situação dos dados profissionais/i);
    expect(screen.getByText(/Confirmando cadastro/i)).toBeTruthy();
    expect(screen.queryByText(/Solicitar autorização/i)).toBeNull();
    expect(screen.queryByText(/Reenviar solicitação/i)).toBeNull();
    expect(api.rpc).toHaveBeenCalledTimes(1);
  });

  it("displays the exact server-missing data and returns to the same confirmation form", async () => {
    api.rpc.mockResolvedValue({error:null,data:{
      authorized:false,profileMissing:["PHOTO","WHATSAPP"],
      request:{status:"CHANGES_REQUESTED",access_type:"MOTOTAXI_SIMPLE",vehicle_type:"MOTO",
        car_category:null,passenger_seats:1,municipality:"FORTALEZA",review_reason:"Confirme a foto"},
    }});
    render(<ProfessionalAccessRequest/>);
    await screen.findByText(/Situação dos dados profissionais/i);
    expect(screen.getByText(/Foto real no perfil/i)).toBeTruthy();
    expect(screen.getByText(/WhatsApp com DDD/i)).toBeTruthy();
    expect(screen.getByText(/entre em contato com o suporte CARONAA/i)).toBeTruthy();
    expect(screen.queryByRole("link",{name:/Corrigir dados profissionais/i})).toBeNull();
    expect(screen.queryByText(/Solicitar autorização/i)).toBeNull();
  });
  it("submits complete car data without the fabricated missing vehicle color",async()=>{
    api.rpc.mockImplementation(async (name:string)=>{
      if(name==="get_my_professional_access")return {
        data:{authorized:false,profileMissing:[],request:null},error:null,
      };
      if(name==="submit_professional_access_request")return {
        data:"request-accepted",error:null,
      };
      return {data:null,error:{message:"Unknown RPC"}};
    });
    render(<ProfessionalAccessRequest initialVehicle={{
      type:"CAR",seats:3,municipality:"Fortaleza",
    }}/>);
    expect(await screen.findByText("Categoria do carro")).toBeTruthy();
    expect(screen.getByLabelText(/Vagas para passageiros/i)).toHaveValue(3);
    fireEvent.click(screen.getByRole("button",{name:/Confirmar dados e habilitar corridas/i}));
    expect(api.rpc).not.toHaveBeenCalledWith("submit_professional_access_request",expect.anything());
    fireEvent.change(screen.getByLabelText("Categoria do carro"),{target:{value:"HATCH"}});
    fireEvent.click(screen.getByRole("button",{name:/Confirmar dados e habilitar corridas/i}));
    await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("submit_professional_access_request",{
      p_vehicle_type:"CAR",p_car_category:"HATCH",p_seats:3,p_municipality:"Fortaleza",
    }));
  });

});
