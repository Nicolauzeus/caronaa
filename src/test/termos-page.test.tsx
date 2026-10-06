import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Route } from "@/routes/termos";

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

describe("Página Pública /termos (Termos de Uso da CARONAA)", () => {
  const TermosComponent = Route.options.component!;

  it("renderiza o título principal e versão dos termos", () => {
    render(<TermosComponent />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Termos de Uso da CARONAA/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sts_2026_v1/i)).toBeInTheDocument();
  });

  it("exibe o destaque obrigatório da versão inicial/validação em situações reais", () => {
    render(<TermosComponent />);

    expect(
      screen.getByText(
        /Você está utilizando uma versão inicial da CARONAA, criada para validar a solução em situações reais\./i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso legal obrigatório sobre revisão jurídica", () => {
    render(<TermosComponent />);

    expect(
      screen.getByText(
        /Os Termos de Uso não substituem aconselhamento jurídico\. A versão publicada deverá ser revisada juridicamente antes do lançamento público definitivo\./i,
      ),
    ).toBeInTheDocument();
  });

  it("estabelece expressamente os limites da plataforma (não é empresa de transporte, não fornece veículo/motorista)", () => {
    render(<TermosComponent />);

    expect(screen.getByText(/Não é empresa de transporte/i)).toBeInTheDocument();
    expect(screen.getByText(/Não realiza diretamente as viagens/i)).toBeInTheDocument();
    expect(screen.getByText(/Não fornece motorista/i)).toBeInTheDocument();
    expect(screen.getByText(/Não fornece veículo/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Atua estritamente como plataforma tecnológica de conexão e comunicação/i),
    ).toBeInTheDocument();
  });

  it("deixa claro que combinação exibida não significa viagem confirmada e que não há segurança absoluta", () => {
    render(<TermosComponent />);

    expect(
      screen.getByText(
        /Uma combinação ou compatibilidade exibida pela plataforma não significa que uma viagem esteja automaticamente confirmada\./i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/A CARONAA não promete nem garante segurança absoluta\./i),
    ).toBeInTheDocument();
  });

  it("renderiza todas as 19 seções obrigatórias no conteúdo", () => {
    const { container } = render(<TermosComponent />);

    const secoesObrigatorias = [
      /1\s*Quem somos/i,
      /2\s*O que é a CARONAA/i,
      /3\s*Plataforma de conexão/i,
      /4\s*Como funciona/i,
      /5\s*Responsabilidades do usuário/i,
      /6\s*Responsabilidades de motoristas/i,
      /7\s*Responsabilidades de passageiros/i,
      /8\s*Segurança e verificação/i,
      /9\s*Combinação e confirmação de caronas/i,
      /10\s*Pagamentos e valores/i,
      /11\s*Cancelamentos/i,
      /12\s*Conteúdo e avaliações/i,
      /13\s*Condutas proibidas/i,
      /14\s*Acidentes, danos e incidentes/i,
      /15\s*Limitações da plataforma/i,
      /16\s*Proteção de dados/i,
      /17\s*Propriedade intelectual/i,
      /18\s*Alterações dos termos/i,
      /19\s*Contato/i,
    ];

    const headingsText = Array.from(container.querySelectorAll("h2, h3, h4")).map(
      (h) => h.textContent ?? "",
    );

    for (const regex of secoesObrigatorias) {
      expect(headingsText.some((text) => regex.test(text))).toBe(true);
    }
  });

  it("possui links de navegação para o formulário e retorno", () => {
    render(<TermosComponent />);

    expect(screen.getByRole("link", { name: /Ir para o formulário STS 2026/i })).toHaveAttribute(
      "href",
      "/formulario",
    );
    expect(screen.getByRole("link", { name: /Voltar ao início/i })).toHaveAttribute("href", "/");
  });
});
