import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AcademicExpressForm } from "./AcademicExpressForm";
import { academicExpressUrbanTemplate } from "@/lib/formulario/academic-express-schema";
import { freshTemplate } from "@/lib/formulario/research-templates";
import { newResearchConfiguration } from "@/lib/formulario/research-configuration";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

const settings = {
  ...newResearchConfiguration("UNIVERSIDADE_URBANA_CARONAA"),
  institutionId: "UNIFOR", institutionName: "UNIFOR", publicName: "UNIFOR",
  campus: "Fortaleza", region: "Ceará", days: [1, 2, 3, 4, 5],
  outboundTimes: ["07:00"], returnTimes: ["18:00"],
  emailCaptureEnabled: true, institutionalEmailDomains: ["unifor.br"],
};
const mockForm = {
  id: "f", version: "v", title: "UNIFOR", schema: freshTemplate(academicExpressUrbanTemplate),
  brandImagePath: null, brandAlt: null, brandName: null, caronaaPresenceOn: null,
  configuration: { revision: 1, settings },
};

describe("Academic express UX – five compact steps", () => {
  it("requires identity and shows only passenger questions after role selection", () => {
    render(<AcademicExpressForm form={mockForm} captureEnabled user={null} />);
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Informe seu nome, vínculo acadêmico/i);

    fireEvent.change(screen.getByPlaceholderText("Como prefere ser chamado(a)"), {
      target: { value: "Pessoa acadêmica" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Vínculo com a universidade" }), {
      target: { value: "ESTUDANTE" },
    });
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: "lead@unifor.br" },
    });
    expect(screen.getByText(/Domínio institucional reconhecido/)).toBeInTheDocument();
    expect(screen.queryByText(/Comunidade acadêmica verificada/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Passo 2 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar carona/i }));
    expect(screen.getByText("Qual é seu trajeto?")).toBeInTheDocument();
    expect(screen.getByText("Passo 3 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Qual veículo usaria?")).not.toBeInTheDocument();
  });

  it("keeps AMBOS on the five-stage route and blocks an incomplete route", () => {
    render(<AcademicExpressForm form={mockForm} captureEnabled user={null} />);
    fireEvent.change(screen.getByPlaceholderText("Como prefere ser chamado(a)"), {
      target: { value: "Aluno motorista" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Vínculo com a universidade" }), {
      target: { value: "ESTUDANTE" },
    });
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: "motorista@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Passo 2 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar e oferecer/i }));
    expect(screen.getByText("Passo 3 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Informe uma região de origem/i);
    expect(screen.getByText("Passo 3 de 5")).toBeInTheDocument();
  });
});
