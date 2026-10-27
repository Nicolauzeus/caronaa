import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UnifiedCrmWorkspace } from "./UnifiedCrmWorkspace";
import type { UnifiedCrmContact } from "@/lib/crm/unified-crm-service";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/crm/unified-crm-service", async original => {
  const actual = await original<typeof import("@/lib/crm/unified-crm-service")>();
  return {
    ...actual,
    getUnifiedCrmContacts: api.list,
    updateUnifiedCrmStatus: api.save,
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const testContacts: UnifiedCrmContact[] = [
  {
    id:"research:r1",contact_key:"email:ana@example.edu.br",name:"Ana",email:"ana@example.edu.br",
    whatsapp:"85999998888",can_contact:true,institutional_email:true,
    source_form:"UNILAB-1",source_forms:["UNILAB-1","0K9K09K"],
    academic_role:"ESTUDANTE",mobility_role:"PASSAGEIRO",mobility_roles:["PASSAGEIRO","AMBOS"],
    route_origin:"Redenção",route_destination:"Campus",outbound_time:"07:30",
    vehicle_type:"CARRO",seats:2,pains:["LOTACAO","ESPERA_LONGA"],
    created_at:"2026-10-27T10:00:00Z",status:"NOVO",
    raw_payload:{name:"Ana"},
    participations:[
      {id:"research:r1",source_type:"RESEARCH",source_form:"UNILAB-1",source_label:"UNILAB",
       created_at:"2026-10-27T10:00:00Z",academic_role:"ESTUDANTE",mobility_role:"PASSAGEIRO",
       route_origin:"Redenção",route_destination:"Campus",outbound_time:"07:30",
       vehicle_type:"CARRO",seats:2,pains:["LOTACAO"],raw_payload:{"Questionário":{Dificuldade:"Lotação"}}},
      {id:"research:r2",source_type:"RESEARCH",source_form:"0K9K09K",source_label:"UNIFOR",
       created_at:"2026-10-26T10:00:00Z",academic_role:"ESTUDANTE",mobility_role:"AMBOS",
       route_origin:"Messejana",route_destination:"UNIFOR",outbound_time:"08:00",
       vehicle_type:"CARRO",seats:2,pains:["ESPERA_LONGA"],raw_payload:{"Questionário":{Dificuldade:"Espera"}}},
    ],
  },
  {
    id:"pitch:p1",contact_key:"email:investidor@example.com",name:"Investidor",
    email:"investidor@example.com",whatsapp:"85977776666",can_contact:false,institutional_email:false,
    source_form:"PITCH",source_forms:["PITCH"],academic_role:null,mobility_role:"INVESTIDOR",
    mobility_roles:["INVESTIDOR"],route_origin:null,route_destination:null,outbound_time:null,
    vehicle_type:null,seats:null,pains:[],created_at:"2026-10-25T10:00:00Z",status:"CONTACTADO",
    raw_payload:{},participations:[{id:"pitch:p1",source_type:"PITCH",source_form:"PITCH",
      source_label:"Pitch / Manual",created_at:"2026-10-25T10:00:00Z",
      academic_role:null,mobility_role:"INVESTIDOR",route_origin:null,route_destination:null,
      outbound_time:null,vehicle_type:null,seats:null,pains:[],raw_payload:{message:"Contato"}}],
  },
];

describe("CRM multiformulários admin", () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue(testContacts);
    api.save.mockReset().mockResolvedValue(undefined);
  });

  it("exibe métricas e filtros reais a partir de UNIFOR, UNILAB e Pitch", async () => {
    render(<UnifiedCrmWorkspace/>);
    await screen.findByText("Ana");
    expect(screen.getByText("CRM & Relacionamentos CARONAA")).toBeInTheDocument();
    expect(screen.getByRole("region",{name:"Indicadores CRM"})).toHaveTextContent("Total de contatos2");
    fireEvent.change(screen.getByRole("combobox",{name:"Filtrar origem"}),{target:{value:"0K9K09K"}});
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Investidor")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox",{name:"Filtrar dores"}),{target:{value:"LOTACAO"}});
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("apresenta ficha, respostas salvas e atualiza status somente após confirmação do servidor", async () => {
    render(<UnifiedCrmWorkspace/>);
    await screen.findByText("Ana");
    fireEvent.click(screen.getAllByRole("button",{name:"Ver ficha"})[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Participações e respostas completas/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByText(/UNIFOR ·/));
    expect(within(dialog).getByText("Espera")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("combobox",{name:"Alterar status do CRM"}),
      {target:{value:"EM_ACOMPANHAMENTO"}});
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({name:"Ana"}),"EM_ACOMPANHAMENTO",
    ));
    await waitFor(() => expect(screen.getByText("Em acompanhamento")).toBeInTheDocument());
  });

  it("distingue lista de respostas de cadastro Pitch pré-existente", async () => {
    render(<UnifiedCrmWorkspace mode="responses"/>);
    await screen.findByText("Ana");
    expect(screen.getByText("Respostas de todos os formulários")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
  });
});
