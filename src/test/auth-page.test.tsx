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

  it("mostra apenas dois perfis e exige a escolha antes dos dados", () => {
    render(<AuthComponent />);
    fireEvent.click(screen.getByRole("button", { name: /^Criar conta$/i }));
    expect(screen.getByRole("heading", {name: /Como quer usar a CARONAA/i})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: /Sou passageiro/i})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: /Sou motorista/i})).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: /Ambos/i})).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {name: /Sou passageiro/i}));
    expect(screen.getByLabelText(/Nome completo/i)).toBeRequired();
    expect(screen.getByLabelText("E-mail")).toBeRequired();
    expect(screen.getByLabelText("Senha")).toBeRequired();
    expect(screen.getByRole("button", {name: /Alterar/i})).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: /Como quer usar a CARONAA/i })).toBeInTheDocument();
  });

  it("preserva cadastro após conclusão do formulário", () => {
    mockSearchState = { mode: "cadastro", submissionId: "b51c1e71-59d8-4aab-850a-af4a584fc103" };
    render(<AuthComponent />);
    fireEvent.click(screen.getByRole("button", {name: /Sou motorista/i}));
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
  });
});
