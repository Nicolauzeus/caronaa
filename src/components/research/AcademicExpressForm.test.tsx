import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { AcademicExpressForm } from "./AcademicExpressForm";
import { academicExpressUrbanTemplate, academicExpressF01Template } from "@/lib/formulario/academic-express-schema";
import { freshTemplate } from "@/lib/formulario/research-templates";
import { newResearchConfiguration } from "@/lib/formulario/research-configuration";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: vi.fn() }));
vi.mock("@/components/formulario/LocationAutocomplete", () => ({
  LocationAutocomplete: ({ value, placeholder, onChange }: {
    value?: string;
    placeholder?: string;
    onChange: (value: string) => void;
  }) => (
    <input value={value ?? ""} placeholder={placeholder}
      onChange={event => onChange(event.target.value)}/>
  ),
}));
const calls = vi.hoisted(() => ({
  submit: vi.fn(async () => undefined),
  interest: vi.fn(async () => "INTERESSE_REGISTRADO"),
  capture: vi.fn(async () => undefined),
}));
vi.mock("@/lib/formulario/research-configuration-service", () => ({
  submitConfiguredResearch: calls.submit,
  registerResearchInterest: calls.interest,
}));
vi.mock("@/lib/formulario/research-lead", () => ({
  validResearchEmail: (value: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value),
  captureResearchLead: calls.capture,
}));

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
    expect(screen.getByText(/Domínio de UNIFOR reconhecido imediatamente/)).toBeInTheDocument();
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

describe("University route search + consented GPS", () => {
  const v2 = { ...mockForm, schema: freshTemplate(academicExpressF01Template) };
  it.each([{ label: "UNILAB-style V1", sample: mockForm }, { label: "F01 V2", sample: v2 }])(
    "shows both mobile location actions for $label and permits manual search without GPS",
    ({ sample }) => {
      render(<AcademicExpressForm form={sample} captureEnabled user={null}/>);
      fireEvent.change(screen.getByPlaceholderText(sample.schema.experience === "ACADEMIC_EXPRESS_F01_V2"
        ? "Seu nome completo" : "Como prefere ser chamado(a)"), { target: { value: "Pessoa Teste" } });
      fireEvent.change(screen.getByRole("combobox", {name:"Vínculo com a universidade"}),
        { target: { value: "ESTUDANTE" } });
      fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"),
        { target: { value: "pessoa@unifor.br" } });
      fireEvent.click(screen.getByRole("button", {name:/Continuar/i}));
      fireEvent.click(screen.getByRole("button", {name:/Quero pegar carona/i}));
      expect(screen.getByRole("button", {name:"Usar localização atual"})).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", {name:"Buscar localização"}));
      expect(screen.getByRole("dialog", {name:"Buscar bairro ou região"})).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText("Digite o bairro, município ou local..."),
        {target:{value:"PAJUÇARA"}});
      fireEvent.click(screen.getByRole("button", {name:"Usar localidade digitada"}));
      expect(screen.getByRole("textbox",{name:"Bairro ou região de origem"})).toHaveValue("PAJUÇARA");
      expect(screen.getByRole("combobox",{name:"Horário habitual de retorno"})).toBeInTheDocument();
    }
  );
  it("never requests GPS before an explicit tap and keeps manual entry after denial", () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    const getCurrentPosition = vi.fn((_success: unknown, fail: (reason: unknown) => void) =>
      fail({ code: 1, message: "Permission denied" }));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true, value: { getCurrentPosition },
    });
    try {
      render(<AcademicExpressForm form={mockForm} captureEnabled user={null}/>);
      fireEvent.change(screen.getByPlaceholderText("Como prefere ser chamado(a)"),
        { target: { value: "Estudante Teste" } });
      fireEvent.change(screen.getByRole("combobox", {name:"Vínculo com a universidade"}),
        { target: { value: "ESTUDANTE" } });
      fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"),
        { target: { value: "teste@unifor.br" } });
      fireEvent.click(screen.getByRole("button", {name:/Continuar/i}));
      fireEvent.click(screen.getByRole("button", {name:/Quero pegar carona/i}));
      expect(getCurrentPosition).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", {name:"Usar localização atual"}));
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toHaveTextContent(/buscar ou digitar o bairro normalmente/i);
      fireEvent.change(screen.getByRole("textbox",{name:"Bairro ou região de origem"}),
        { target: { value:"Acarape" } });
      expect(screen.getByRole("textbox",{name:"Bairro ou região de origem"}))
        .toHaveValue("Acarape");
    } finally {
      if (previous) Object.defineProperty(navigator, "geolocation", previous);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });
});

describe("F01 academic express (dynamic institutions, no extra public pages)", () => {
  const form = { ...mockForm, schema: freshTemplate(academicExpressF01Template) };

  function fillIdentity(institutionEmail = "lead@unifor.br") {
    fireEvent.change(screen.getByPlaceholderText("Seu nome completo"), {
      target: { value: "Pessoa acadêmica" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Vínculo com a universidade" }), {
      target: { value: "ESTUDANTE" },
    });
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: institutionEmail },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
  }

  function fillRoute() {
    fireEvent.change(screen.getByPlaceholderText("Bairro ou região de origem"), { target: { value: "Messejana" } });
    fireEvent.click(screen.getByRole("button", { name: "Seg–Sex" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Horário habitual de saída" }), {
      target: { value: "07:00" },
    });
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
    expect(screen.getByText(/Domínio de Campus Teste reconhecido imediatamente/)).toBeInTheDocument();
    expect(screen.getByText(/O vínculo e o acesso dependem da verificação do e-mail/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("voce@universidade.br"), {
      target: { value: "pessoa@gmail.com" },
    });
    expect(screen.getByText(/será necessário ativar sua conta/)).toBeInTheDocument();
  });

  it("keeps the mandatory social pains together in stage 4 of 5", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null}/>);
    fillIdentity();
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar carona/i }));
    fillRoute();
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Qual veículo usaria?")).not.toBeInTheDocument();
    expect(screen.queryByText("Como você vai hoje?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Economia no trajeto" }));
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


  it("skips all driver pain questions and keeps moto at one passenger", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null} />);
    fillIdentity("motorista@example.com");
    fireEvent.click(screen.getByRole("button", { name: /Quero oferecer carona/i }));
    fillRoute();
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Moto" }));
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Seus desafios no trajeto")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", {name:/O que mais dificulta seu deslocamento/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar etapa" }));
    expect(screen.getByText(/Moto: 1 vaga de passageiro/)).toBeInTheDocument();
    expect(screen.queryByRole("button", {name:"2"})).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", {name:/Quantidade de vagas/})).not.toBeInTheDocument();
  });

  it("accepts manual one-to-four seats for a car but never five", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null} />);
    fillIdentity("motorista@example.com");
    fireEvent.click(screen.getByRole("button", { name: /Quero oferecer carona/i }));
    fillRoute();
    fireEvent.click(screen.getByRole("button", { name: "Carro" }));
    const input=screen.getByRole("spinbutton",{name:"Quantidade de vagas do carro"});
    fireEvent.change(input,{target:{value:"3"}});
    expect(input).toHaveValue(3);
    fireEvent.change(input,{target:{value:"5"}});
    expect(input).toHaveValue(3);
    fireEvent.click(screen.getByRole("button", {name:/Continuar/i}));
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
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
    expect(screen.getByText("Seus desafios no trajeto")).toBeInTheDocument();
  });


  it("requires explicit research consent, then records one-tap interest without a real booking", async () => {
    calls.submit.mockClear();
    calls.interest.mockClear();
    calls.capture.mockClear();
    render(<AcademicExpressForm form={form} captureEnabled user={null}/>);
    fillIdentity("pessoa@unifor.br");
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar carona/i }));
    fillRoute();
    fireEvent.click(screen.getByRole("button", { name: "Economia no trajeto" }));
    fireEvent.click(within(screen.getByRole("group", { name: /O que mais dificulta seu deslocamento/ }))
      .getByRole("button", { name: "Ônibus lotados" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    const primary = screen.getByRole("button", { name: /Pré-agendar meu interesse/i });
    expect(primary).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Li o aviso de privacidade/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Autorizo vincular esta participação/i }));
    expect(primary).toBeEnabled();
    fireEvent.click(primary);
    await waitFor(() => expect(calls.interest).toHaveBeenCalledTimes(1));
    expect(calls.interest).toHaveBeenCalledWith("f", expect.any(String), "PASSAGEIRO", true, expect.any(Object));
    expect(calls.submit).toHaveBeenCalledTimes(1);
    expect(calls.capture).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Interesse no trajeto registrado separadamente/)).toBeInTheDocument();
  });


  it("never sends a research answer or lead from the admin preview", async () => {
    calls.submit.mockClear();
    calls.interest.mockClear();
    calls.capture.mockClear();
    render(<AcademicExpressForm form={form} captureEnabled user={null} previewMode/>);
    fillIdentity("preview@unifor.br");
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar carona/i }));
    fillRoute();
    fireEvent.click(screen.getByRole("button", { name: "Economia no trajeto" }));
    fireEvent.click(within(screen.getByRole("group", { name: /O que mais dificulta seu deslocamento/ }))
      .getByRole("button", { name: "Ônibus lotados" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Li o aviso de privacidade/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Autorizo vincular esta participação/i }));
    fireEvent.click(screen.getByRole("button", { name: /Pré-agendar meu interesse/i }));
    expect(screen.getByText(/Prévia finalizada/)).toBeInTheDocument();
    expect(calls.submit).not.toHaveBeenCalled();
    expect(calls.interest).not.toHaveBeenCalled();
    expect(calls.capture).not.toHaveBeenCalled();
  });

  it("automatically advances a driver after selecting the vehicle and a seat count", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null}/>);
    fillIdentity("condutor@gmail.com");
    fireEvent.click(screen.getByRole("button", { name: /Quero oferecer carona/i }));
    fillRoute();
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carro" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Seus desafios no trajeto")).not.toBeInTheDocument();
    expect(screen.queryByText("Qual veículo usaria?")).not.toBeInTheDocument();
  });

  it("keeps passenger and both profiles' social pains in one pane without hiding the primary difficulty", () => {
    render(<AcademicExpressForm form={form} captureEnabled user={null}/>);
    fillIdentity();
    fireEvent.click(screen.getByRole("button", { name: /Quero pegar carona/i }));
    fillRoute();
    fireEvent.click(screen.getByRole("button", { name: "Economia no trajeto" }));
    const group = screen.getByRole("group", { name: /O que mais dificulta seu deslocamento/ });
    fireEvent.click(within(group).getByRole("button", { name: "Ônibus lotados" }));
    fireEvent.click(within(group).getByRole("button", { name: "Preço alto do transporte" }));
    expect(screen.getByRole("group", { name: /Qual dessas é a principal/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: /Qual dessas é a principal/ }))
      .getByRole("button", { name: "Preço alto do transporte" }));
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
  });
});
