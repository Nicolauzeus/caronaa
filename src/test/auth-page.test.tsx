// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Route } from "@/routes/auth";
import * as authContext from "@/lib/auth-context";
import * as conversionModule from "@/lib/formulario/conversion";

const mockNavigate = vi.fn();
let mockSearchState: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string;
      children: React.ReactNode;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

describe("Página /auth Redesenhada", () => {
  const AuthComponent = Route.options.component!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchState = {};
    vi.spyOn(Route, "useSearch").mockImplementation(() => mockSearchState as never);
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    });
    vi.spyOn(conversionModule, "getFormConversionDraft").mockReturnValue(null);
  });

  it("renderiza o Header oficial com logo, headline e contexto geral", () => {
    render(<AuthComponent />);

    // Logo
    expect(screen.getAllByAltText("CARONAA")[0]).toBeInTheDocument();

    // Headline exigida
    expect(
      screen.getByRole("heading", { level: 1, name: /Entre na sua conta/i }),
    ).toBeInTheDocument();

    // Contexto exigido
    expect(
      screen.getByText(/Acesse sua conta para continuar na CARONAA./i),
    ).toBeInTheDocument();

    // Apenas um caminho de cadastro e sem botões redundantes na tela de login.
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sou mototaxista — cadastro simplificado/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Criar conta$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeInTheDocument();
  });

  it("solicita somente os dados necessários em modo login e cadastro", () => {
    mockSearchState = { submissionId: "b51c1e71-59d8-4aab-850a-af4a584fc103" };
    const { container } = render(<AuthComponent />);

    // Modo inicial padrão: login
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Esqueci minha senha/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nome completo/i)).not.toBeInTheDocument();

    // Alterna para cadastro
    const createAccount = screen.getByRole("button", { name: /^Criar conta$/i });
    fireEvent.click(createAccount);

    // Cadastro inicial: nome completo, e-mail e senha.
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Esqueci minha senha/i })).not.toBeInTheDocument();

    // Botão de envio do formulário de cadastro
    const submitBtn = container.querySelector('button[type="submit"]');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveTextContent("Criar minha conta");
  });

  it("possui links obrigatórios para Termos de Uso, Privacidade e Segurança", () => {
    render(<AuthComponent />);

    expect(screen.getByRole("link", { name: /Termos de Uso/i })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("link", { name: /Privacidade/i })).toHaveAttribute(
      "href",
      "/privacidade",
    );
    expect(screen.getByRole("link", { name: /Segurança/i })).toHaveAttribute("href", "/seguranca");
  });

  it("permite iniciar cadastro sem submissão de evento", () => {
    mockSearchState = { mode: "cadastro" };
    render(<AuthComponent />);
    expect(screen.getByLabelText(/Nome completo/i)).toBeRequired();
    expect(screen.getByRole("heading", { name: /Crie sua conta/i })).toBeInTheDocument();
  });

  it("preserva cadastro após conclusão do formulário", () => {
    mockSearchState = { mode: "cadastro", submissionId: "b51c1e71-59d8-4aab-850a-af4a584fc103" };
    render(<AuthComponent />);
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
  });
});
