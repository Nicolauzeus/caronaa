import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CrmExecutiveProfile } from "./CrmExecutiveProfile";
import { consolidateCrmContacts, normalizeUnifiedCrmRows } from "@/lib/crm/unified-crm-service";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/formulario/research-whatsapp", () => ({
  formatBrazilWhatsapp: (value: string) => value,
}));
vi.mock("@/components/ui/dialog", () => ({
  DialogTitle: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogDescription: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const rows = normalizeUnifiedCrmRows({
  research: [
    {
      source_id: "unilab-1", source_form: "UNILAB-1", source_label: "UNILAB",
      name: "Participante sem identificação", email: "pessoa@exemplo.edu.br",
      whatsapp: "+5585999990000", academic_role:"ESTUDANTE", mobility_role:"PASSAGEIRO",
      created_at:"2026-10-23T14:00:00Z", route_origin:"Redenção", route_destination:"Liberdade",
      outbound_time:"07:00", pains:["DOR_04"], whatsapp_contact_consent:false,
      raw_payload: {
        answers: {
          "Qual dessas dificuldades é a principal?":"DOR_04",
          "Qual faixa de valor caberia no seu orçamento por trecho?":"DE_5_A_10",
          "Tem interesse em receber notícias sobre o lançamento?":"SIM",
        },
        journey:{direction:"IDA_E_VOLTA", days:[1,2,3,4,5],outboundTime:"07:00",returnTime:"22:00"},
        answers_raw:{"37c53fa3-2587-4466-8664-c074f21342b1":"DOR_04"},
      },
    },
    {
      source_id:"unifor-1", source_form:"0K9K09K", source_label:"UNIFOR",
      name:"Participante sem identificação", email:"pessoa@exemplo.edu.br",
      academic_role:"ESTUDANTE", mobility_role:"MOTORISTA",
      created_at:"2026-10-22T14:00:00Z", route_origin:"Messejana",
      route_destination:"Campus UNIFOR", outbound_time:"18:00", pains:[],
      whatsapp_contact_consent:false,
      raw_payload: {journey:{days:[2,4],direction:"IDA"}},
    },
  ], sts:[], pitch:[],
});
const contact = consolidateCrmContacts(rows)[0];

describe("Executive CRM dossier", () => {
  it("uses e-mail as identity, one contact section and distinct institutional journeys", () => {
    render(<CrmExecutiveProfile contact={contact} savingStatus={false} onStatusChange={vi.fn()}/>);
    expect(screen.getByRole("heading", {name:"pessoa@exemplo.edu.br"})).toBeInTheDocument();
    expect(screen.getByRole("region", {name:"Contato e status"})).toBeInTheDocument();
    const history = screen.getByRole("region", {name:"Histórico de participações"});
    expect(within(history).getByText("UNILAB")).toBeInTheDocument();
    expect(within(history).getByText("UNIFOR")).toBeInTheDocument();
    expect(screen.getByText("Redenção → Liberdade")).toBeInTheDocument();
    expect(screen.getByText("Messejana → Campus UNIFOR")).toBeInTheDocument();
    expect(screen.getByText("Segunda a sexta-feira")).toBeInTheDocument();
    expect(screen.getByText(/Dor principal:/)).toBeInTheDocument();
    expect(screen.getByText("Muito tempo gasto no deslocamento")).toBeInTheDocument();
    expect(screen.getByText("De R$ 5,00 a R$ 10,00")).toBeInTheDocument();
    const unilab = within(history).getByRole("button", {name:/UNILAB/});
    const unifor = within(history).getByRole("button", {name:/UNIFOR/});
    expect(unilab).toHaveAttribute("aria-expanded", "true");
    expect(unifor).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("heading", {name:"Rotina de deslocamento"})).toHaveLength(1);
    fireEvent.click(unifor);
    expect(unilab).toHaveAttribute("aria-expanded", "false");
    expect(unifor).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Terça-feira, Quinta-feira")).toBeInTheDocument();
    // Collapse the current participation, leaving only compact summaries.
    fireEvent.click(unifor);
    expect(unifor).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", {name:"Rotina de deslocamento"})).not.toBeInTheDocument();
  });

  it("hides raw UUIDs behind closed technical audit sections and preserves status editing", () => {
    const update = vi.fn();
    render(<CrmExecutiveProfile contact={contact} savingStatus={false} onStatusChange={update}/>);
    const audits = screen.getAllByText(/Auditoria técnica — JSON e identificadores/);
    expect(audits).toHaveLength(1);
    expect(audits[0].closest("details")).not.toHaveAttribute("open");
    const rawId = screen.getByText(/37c53fa3-2587-4466-8664-c074f21342b1/);
    expect(rawId.closest("details")).not.toHaveAttribute("open");
    const dropdown = screen.getByRole("combobox", {name:"Alterar status do CRM"});
    fireEvent.change(dropdown,{target:{value:"EM_ACOMPANHAMENTO"}});
    expect(update).toHaveBeenCalledWith("EM_ACOMPANHAMENTO");
    expect(screen.queryByRole("link", {name:/Conversar pelo WhatsApp/i})).not.toBeInTheDocument();
    expect(screen.getByText(/Responder à pesquisa não autoriza mensagens comerciais/i)).toBeInTheDocument();
  });

  it("offers a mobile back action without changing any contact or survey data", () => {
    const close = vi.fn();
    render(<CrmExecutiveProfile contact={contact} savingStatus={false}
      onClose={close} onStatusChange={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", {name:"Voltar para contatos"}));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not unlock WhatsApp interaction from presence of a phone alone", () => {
    const authorized = { ...contact, consented_whatsapp: "+5585999990000", can_contact:true };
    render(<CrmExecutiveProfile contact={authorized} savingStatus={false} onStatusChange={vi.fn()}/>);
    expect(screen.getByRole("link",{name:/Conversar pelo WhatsApp/i}))
      .toHaveAttribute("href","https://wa.me/5585999990000");
  });
});
