import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AcademicExpressForm } from "./AcademicExpressForm";
import { academicExpressUrbanTemplate, academicExpressF01Template } from "@/lib/formulario/academic-express-schema";
import { freshTemplate } from "@/lib/formulario/research-templates";
import { newResearchConfiguration } from "@/lib/formulario/research-configuration";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: vi.fn() }));

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

describe("F01 academic express (dynamic institutions, no extra public pages)", () => {
  const form = { ...mockForm, schema: freshTemplate(academicExpressF01Template) };

  function fillIdentity(institutionEmail = "lead@unifor.br") {
    fireEvent.change(screen.getByPlaceholderText("Seu nome completo"), {
      target: { value: "Pessoa acadêmica" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Estudante" }));
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: institutionEmail },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
  }

  function fillRoute() {
    fireEvent.change(screen.getByPlaceholderText("Bairro ou região de origem"), { target: { value: "Messejana" } });
    fireEvent.click(screen.getByRole("button", { name: "Seg–Sex" }));
    fireEvent.click(screen.getByRole("button", { name: /Manhã.*07:00/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
  }

  it("uses institution-configured email domains without access bypass", () => {
    const alt = { ...form, configuration: {
      revision: 1,
      settings: { ...settings, institutionName: "Campus Teste", institutionalEmailDomains: ["campus.test.br"] },
    } };
    render(<AcademicExpressForm form={alt} captureEnabled user={null}/>);
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: "pessoa@campus.test.br" },
    });
    expect(screen.getByText(/Domínio da comunidade Campus Teste reconhecido/)).toBeInTheDocument();
    expect(screen.getByText(/a titularidade e o acesso dependem de autenticação/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: "pessoa@gmail.com" },
    });
    expect(screen.getByText(/Link de ativação será necessário/)).toBeInTheDocument();
  });

  it("keeps the mandatory social pains together in stage 4 of 5", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null}/>);
    fillIdentity();
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar carona/i }));
    fillRoute();
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Qual veículo usaria?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ônibus" }));
    fireEvent.click(screen.getByRole("button", { name: "Economia no trajeto" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Seus desafios no trajeto")).toBeInTheDocument();
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    const painGroup = screen.getByRole("group", { name: /O que mais dificulta seu deslocamento/ });
    fireEvent.click(within(painGroup).getByRole("button", { name: "Ônibus lotados" }));
    fireEvent.click(within(painGroup).getByRole("button", { name: "Preço alto do transporte" }));
    fireEvent.click(within(screen.getByRole("group", { name: /Qual dessas é a principal/ }))
      .getByRole("button", { name: "Preço alto do transporte" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    expect(screen.getByText("Resumo do seu interesse")).toBeInTheDocument();
  });

  it("routes AMBOS through driver fields and passenger preference, not passenger transit", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null}/>);
    fillIdentity();
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar e oferecer/i }));
    fillRoute();
    expect(screen.getByText("Qual veículo usaria?")).toBeInTheDocument();
    expect(screen.queryByText("Como você costuma se deslocar como passageiro?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carro" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Economia no trajeto" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    expect(screen.getByText("Seus desafios no trajeto")).toBeInTheDocument();
  });
});
