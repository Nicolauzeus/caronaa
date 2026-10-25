import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SimpleResearchCreator } from "./SimpleResearchCreator";

const api=vi.hoisted(()=>({ check:vi.fn(), create:vi.fn() }));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:vi.fn(),from:vi.fn()}}));
vi.mock("@/lib/formulario/research-form-code",async original=>{
  const base=await original<typeof import("@/lib/formulario/research-form-code")>();
  return {...base,checkResearchFormCode:api.check};
});
vi.mock("@/lib/formulario/research-catalog",()=>({createResearchForm:api.create}));

describe("F01 — criação rápida mobile-first",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    api.check.mockResolvedValue({available:true});
    api.create.mockResolvedValue("new-form-id");
  });

  it("mostra três modelos como escolha principal sem apagar o fluxo avançado",()=>{
    const advanced=vi.fn();
    render(<SimpleResearchCreator occupiedCodes={[]} onCreated={vi.fn()} onAdvanced={advanced} onCancel={vi.fn()}/>);
    expect(screen.getByRole("button",{name:/Universidade/i})).toHaveAttribute("aria-pressed","true");
    expect(screen.getByRole("button",{name:/Rua e comunidade/i})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Empresa/i})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/construtor avançado/i}));
    expect(advanced).toHaveBeenCalledOnce();
  });

  it("cria rascunho empresarial com CRM consentido, não publica formulário",async()=>{
    const created=vi.fn();
    render(<SimpleResearchCreator occupiedCodes={[]} onCreated={created} onAdvanced={vi.fn()} onCancel={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:/Empresa/i}));
    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"),{target:{value:"Empresa Alfa"}});
    fireEvent.change(screen.getByPlaceholderText(/Como você se desloca/i),{target:{value:"Deslocamento de colaboradores"}});
    fireEvent.change(screen.getByLabelText(/Início das respostas/i),{target:{value:"2026-10-25"}});
    fireEvent.change(screen.getByLabelText(/Encerramento das respostas/i),{target:{value:"2026-12-10"}});
    fireEvent.click(screen.getByRole("button",{name:/Criar rascunho e revisar/i}));
    await waitFor(()=>expect(created).toHaveBeenCalledWith("new-form-id"));
    expect(api.check).toHaveBeenCalledOnce();
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      nature:"EMPRESA",
      templateKey:"F01_EMPRESA",
      configuration:expect.objectContaining({
        emailCaptureEnabled:true,
        institutionName:"Empresa Alfa",
        partnershipConfirmed:false,
      }),
    }));
  });

  it("não permite reutilizar um código ocupado",()=>{
    render(<SimpleResearchCreator occupiedCodes={["PESQUISA-2026"]} onCreated={vi.fn()} onAdvanced={vi.fn()} onCancel={vi.fn()}/>);
    fireEvent.click(screen.getByText(/Mais opções: código/i));
    fireEvent.change(screen.getByLabelText(/Código exclusivo/i),{target:{value:"PESQUISA-2026"}});
    expect(screen.getByRole("button",{name:/Criar rascunho e revisar/i})).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Código já utilizado/i);
  });
});
