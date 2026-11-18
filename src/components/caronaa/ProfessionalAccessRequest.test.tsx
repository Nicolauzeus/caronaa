import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
    const link=screen.getByRole("link",{name:/Corrigir dados profissionais/i});
    expect(link.getAttribute("href")).toBe("/cadastro-motorista");
    expect(screen.queryByText(/Solicitar autorização/i)).toBeNull();
  });
});
