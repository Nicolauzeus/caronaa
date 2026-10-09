import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminRelacionamentosPage } from "@/components/admin/RelationshipsPage";
import { Route as SingularRoute } from "@/routes/admin/relacionamento";
import { Route as PluralRoute } from "@/routes/admin/relacionamentos";
import * as pitchService from "@/lib/pitch/pitch-service";
import type { PitchContact } from "@/lib/pitch/types";

const { mockContacts } = vi.hoisted(() => {
  const contacts: PitchContact[] = [
    {
      id: "contact-1",
      created_at: "2026-10-07T14:30:00.000Z",
      interest: "INVESTIDOR",
      name: "Carlos Drummond",
      whatsapp: "(85) 98888-1111",
      phone: "(85) 98888-1111",
      same_phone_whatsapp: true,
      email: "carlos@investimentos.ce.gov.br",
      investor_update_preference: "PRINCIPAIS_RESULTADOS",
      institution_name: null,
      institution_type: null,
      institution_address: null,
      partnership_type: null,
      partnership_type_custom: null,
      message: "Gostei do modelo de carona para campus universitários.",
      consent_contact: true,
      consent_newsletter: true,
      status: "NOVO",
      suggestion_status: "NOVA",
      notes: "Primeiro contato agendado.",
      source: "pitch_sts_2026",
      raw_payload: null,
    },
    {
      id: "contact-2",
      created_at: "2026-10-07T16:00:00.000Z",
      interest: "PARCEIRO",
      name: "Renata Vasconcelos",
      whatsapp: "(85) 97777-2222",
      phone: "(85) 97777-2222",
      same_phone_whatsapp: true,
      email: "renata@unifor.br",
      investor_update_preference: null,
      institution_name: "Universidade de Fortaleza",
      institution_type: "UNIVERSIDADE",
      institution_address: "Av. Washington Soares, 1321",
      partnership_type: "PILOTO",
      partnership_type_custom: null,
      message: "Queremos rodar um piloto da CARONAA no campus.",
      consent_contact: true,
      consent_newsletter: true,
      status: "EM_ACOMPANHAMENTO",
      suggestion_status: "NOVA",
      notes: "Aguardando reunião com o DAE.",
      source: "pitch_sts_2026",
      raw_payload: null,
    },
    {
      id: "contact-3",
      created_at: "2026-10-07T18:00:00.000Z",
      interest: "AMBOS",
      name: "Eduardo Bezerra",
      whatsapp: "(85) 96666-3333",
      phone: "(85) 96666-3333",
      same_phone_whatsapp: true,
      email: "eduardo@hubinovacao.com",
      investor_update_preference: "CONVERSAR_DIRETO",
      institution_name: "Hub Criativo",
      institution_type: "EMPRESA",
      institution_address: "Praia de Iracema",
      partnership_type: "TESTAR_INSTITUICAO",
      partnership_type_custom: null,
      message: "Podemos entrar com capital semente e conectar as empresas associadas.",
      consent_contact: true,
      consent_newsletter: true,
      status: "CONVERTIDO",
      suggestion_status: "NOVA",
      notes: "Termo de parceria assinado.",
      source: "pitch_sts_2026",
      raw_payload: null,
    },
  ];
  return { mockContacts: contacts };
});

vi.mock("@/lib/pitch/pitch-service", async () => {
  const actual = await vi.importActual<typeof pitchService>("@/lib/pitch/pitch-service");
  return {
    ...actual,
    getPitchContacts: vi.fn().mockResolvedValue({ data: mockContacts }),
    updatePitchContactStatus: vi.fn().mockResolvedValue({ success: true }),
    updatePitchContactNotes: vi.fn().mockResolvedValue({ success: true }),
    savePitchContact: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: "new-contact-uuid",
        created_at: new Date().toISOString(),
        interest: "PARCEIRO",
        name: "Contato Teste",
        whatsapp: "(85) 99999-0000",
        phone: "(85) 99999-0000",
        same_phone_whatsapp: true,
        email: "teste@empresa.com",
        status: "NOVO",
        message: "Contato criado manualmente.",
        source: "admin_manual",
      },
    }),
    exportPitchContactsToCsv: vi.fn(),
  };
});

describe("Página de Relacionamento & Pitch no Admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exporta tanto a rota singular /admin/relacionamento quanto plural /admin/relacionamentos com o mesmo componente", () => {
    expect(SingularRoute.options.component).toBe(AdminRelacionamentosPage);
    expect(PluralRoute.options.component).toBe(AdminRelacionamentosPage);
  });

  it("renderiza o cabeçalho, botões de ação e métricas do CRM", async () => {
    render(<AdminRelacionamentosPage />);

    expect(screen.getByText("Relacionamentos & Pitch STS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo Contato/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atualizar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Carlos Drummond")).toBeInTheDocument();
      expect(screen.getByText("Renata Vasconcelos")).toBeInTheDocument();
      expect(screen.getByText("Eduardo Bezerra")).toBeInTheDocument();
    });

    // Métricas calculadas
    expect(screen.getByText("Total Contatos")).toBeInTheDocument();
    expect(screen.getByText("Investidores")).toBeInTheDocument();
    expect(screen.getByText("Parceiros")).toBeInTheDocument();
    expect(screen.getByText("Novos")).toBeInTheDocument();
    expect(screen.getByText("Em Acompanhamento")).toBeInTheDocument();
    expect(screen.getByText("Convertidos")).toBeInTheDocument();
  });

  it("filtra contatos por busca de texto", async () => {
    render(<AdminRelacionamentosPage />);

    await waitFor(() => {
      expect(screen.getByText("Carlos Drummond")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /Buscar por nome, WhatsApp, e-mail, instituição ou mensagem/i,
    );
    fireEvent.change(searchInput, { target: { value: "UNIFOR" } });

    await waitFor(() => {
      expect(screen.queryByText("Carlos Drummond")).not.toBeInTheDocument();
      expect(screen.getByText("Renata Vasconcelos")).toBeInTheDocument();
    });
  });

  it("abre modal com detalhes completos do contato e salva anotações da equipe", async () => {
    render(<AdminRelacionamentosPage />);

    await waitFor(() => {
      expect(screen.getByText("Carlos Drummond")).toBeInTheDocument();
    });

    // Clica em 'Ver Detalhes' no card do primeiro contato
    const detailsButtons = screen.getAllByRole("button", { name: /Ver Detalhes/i });
    fireEvent.click(detailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Anotações Internas da Equipe:")).toBeInTheDocument();
      expect(screen.getByText("Preferência de Atualização:")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ligamos no dia/i);
    fireEvent.change(textarea, { target: { value: "Reunião de alinhamento feita." } });

    const saveButton = screen.getByRole("button", { name: /Salvar Anotações/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(pitchService.updatePitchContactNotes).toHaveBeenCalledWith(
        "contact-1",
        "Reunião de alinhamento feita.",
      );
    });
  });

  it("permite cadastrar um novo contato manualmente através do formulário administrativo", async () => {
    render(<AdminRelacionamentosPage />);

    const newContactBtn = screen.getByRole("button", { name: /Novo Contato/i });
    fireEvent.click(newContactBtn);

    await waitFor(() => {
      expect(screen.getByText("Cadastrar Novo Contato")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Nome completo/i);
    const waInput = screen.getByLabelText(/WhatsApp com DDD/i);

    fireEvent.change(nameInput, { target: { value: "Mariana Costa" } });
    fireEvent.change(waInput, { target: { value: "(85) 99123-4567" } });

    const submitBtn = screen.getByRole("button", { name: /Salvar Contato/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(pitchService.savePitchContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mariana Costa",
          whatsapp: "(85) 99123-4567",
          source: "admin_manual",
          consent_contact: false,
          consent_newsletter: false,
        }),
      );
    });
  });

  it("aciona exportação de contatos CSV ao clicar no botão de download", async () => {
    render(<AdminRelacionamentosPage />);

    await waitFor(() => {
      expect(screen.getByText("Carlos Drummond")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /Exportar CSV/i });
    fireEvent.click(exportBtn);

    expect(pitchService.exportPitchContactsToCsv).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "Carlos Drummond" }),
        expect.objectContaining({ name: "Renata Vasconcelos" }),
      ]),
    );
  });
});
