import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Route } from "@/routes/seguranca";

// Mock router link
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
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

// Mock AppShell to keep test focused
vi.mock("@/components/caronaa/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

describe("Página Pública /seguranca (Segurança começa antes da carona)", () => {
  const SegurancaComponent = Route.options.component!;

  it("renderiza o título oficial e subtítulo explicativo", () => {
    render(<SegurancaComponent />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Segurança começa antes da carona\./i }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /A CARONAA está criando mecanismos para ajudar pessoas a tomar decisões mais conscientes antes de compartilhar um trajeto\./i,
      ),
    ).toBeInTheDocument();
  });

  it("estabelece os limites e a natureza da plataforma com clareza", () => {
    render(<SegurancaComponent />);

    expect(screen.getByText(/A CARONAA é uma/i)).toBeInTheDocument();
    expect(screen.getByText(/plataforma tecnológica de conexão/i)).toBeInTheDocument();

    expect(screen.getByText(/Não é transportadora/i)).toBeInTheDocument();
    expect(screen.getByText(/Não fornece motoristas/i)).toBeInTheDocument();
    expect(screen.getByText(/Não garante que um usuário será confiável/i)).toBeInTheDocument();
    expect(screen.getByText(/Não garante que uma viagem ocorrerá/i)).toBeInTheDocument();
    expect(screen.getByText(/Não substitui cuidados pessoais/i)).toBeInTheDocument();

    expect(screen.getByText(/não promete segurança absoluta/i)).toBeInTheDocument();
  });

  it("renderiza todas as 7 seções práticas obrigatórias", () => {
    render(<SegurancaComponent />);

    expect(
      screen.getByRole("heading", { name: /1\.\s*Conheça antes de combinar/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /2\.\s*Confira o perfil/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /3\.\s*Confirme origem, destino e horário/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /4\.\s*Não compartilhe informações desnecessárias/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /5\.\s*Combine em local adequado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /6\.\s*Se algo parecer errado, não continue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /7\.\s*Respeite as regras de trânsito/i }),
    ).toBeInTheDocument();
  });

  it("renderiza o bloco de situação de risco ou emergência com canais públicos de socorro", () => {
    render(<SegurancaComponent />);

    expect(
      screen.getByText(
        /Em caso de situação de risco ou emergência, procure imediatamente os serviços públicos de emergência apropriados\./i,
      ),
    ).toBeInTheDocument();

    expect(screen.getByText(/Polícia Militar: 190/i)).toBeInTheDocument();
    expect(screen.getByText(/SAMU: 192/i)).toBeInTheDocument();
    expect(screen.getByText(/Corpo de Bombeiros: 193/i)).toBeInTheDocument();
  });

  it("possui todos os links obrigatórios para navegação e documentação", () => {
    render(<SegurancaComponent />);

    expect(screen.getByRole("link", { name: /Termos de Uso/i })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("link", { name: /Política de Privacidade/i })).toHaveAttribute(
      "href",
      "/privacidade",
    );
    expect(screen.getByRole("link", { name: /Entrar na CARONAA/i })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("link", { name: /Participar da validação/i })).toHaveAttribute(
      "href",
      "/formulario",
    );
  });
});
