import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Route } from "@/routes/privacidade";

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

describe("Página Pública /privacidade (Política de Privacidade LGPD da CARONAA)", () => {
  const PrivacidadeComponent = Route.options.component!;

  it("renderiza o título principal e versão do documento", () => {
    render(<PrivacidadeComponent />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Política de Privacidade da CARONAA/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/privacidade_sts_2026_v1/i)).toBeInTheDocument();
  });

  it("exibe o destaque obrigatório de startup em fase inicial e evolução contínua", () => {
    render(<PrivacidadeComponent />);

    expect(
      screen.getByText(
        /CARONAA é uma startup em fase inicial e esta política poderá evoluir à medida que a plataforma e suas funcionalidades forem desenvolvidas\./i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso legal obrigatório de revisão jurídica", () => {
    render(<PrivacidadeComponent />);

    expect(
      screen.getByText(
        /Esta Política de Privacidade não substitui aconselhamento jurídico\. A versão publicada deverá ser revisada juridicamente antes do lançamento público definitivo\./i,
      ),
    ).toBeInTheDocument();
  });

  it("detalha todas as categorias de dados coletados", () => {
    render(<PrivacidadeComponent />);

    expect(screen.getByText(/a\) Dados de identificação/i)).toBeInTheDocument();
    expect(screen.getByText(/b\) Dados de contato/i)).toBeInTheDocument();
    expect(screen.getByText(/c\) Dados de localização e trajeto/i)).toBeInTheDocument();
    expect(screen.getByText(/d\) Dados de utilização e preferências/i)).toBeInTheDocument();
    expect(screen.getByText(/e\) Dados de pesquisas de validação e feedback/i)).toBeInTheDocument();
    expect(screen.getByText(/f\) Dados técnicos e telemetria/i)).toBeInTheDocument();
    expect(screen.getByText(/g\) Cookies e analytics/i)).toBeInTheDocument();
  });

  it("apresenta as finalidades de tratamento de dados de forma transparente", () => {
    render(<PrivacidadeComponent />);

    expect(screen.getByText(/Criar e gerenciar sua conta:/i)).toBeInTheDocument();
    expect(screen.getByText(/Permitir o funcionamento da CARONAA:/i)).toBeInTheDocument();
    expect(screen.getByText(/Procurar compatibilidade de trajetos:/i)).toBeInTheDocument();
    expect(screen.getByText(/Entrar em contato sobre caronas:/i)).toBeInTheDocument();
    expect(screen.getByText(/Melhorar o produto continuamente:/i)).toBeInTheDocument();
    expect(screen.getByText(/Realizar validação de problema e solução:/i)).toBeInTheDocument();
    expect(screen.getByText(/Medir conversão e utilização:/i)).toBeInTheDocument();
    expect(screen.getByText(/Segurança e prevenção de abuso:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cumprimento de obrigações legais:/i)).toBeInTheDocument();
  });

  it("garante proteção à privacidade de localização e ausência de endereço residencial exato", () => {
    render(<PrivacidadeComponent />);

    expect(
      screen.getByText(/Não exibimos publicamente seu endereço residencial exato sem necessidade/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Sempre que possível, utilizamos região e localização aproximada na interface pública/i,
      ),
    ).toBeInTheDocument();
  });

  it("diferencia consentimentos sem caixas genéricas", () => {
    render(<PrivacidadeComponent />);

    expect(
      screen.getByRole("heading", {
        name: /5\.\s*Consentimentos e escolhas \(Sem caixas genéricas\)/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tratamento necessário para o serviço/i)).toBeInTheDocument();
    expect(screen.getByText(/Participação em pesquisas de validação/i)).toBeInTheDocument();
    expect(screen.getByText(/Comunicações e novidades/i)).toBeInTheDocument();
  });

  it("explica os direitos do titular e limites de segurança", () => {
    render(<PrivacidadeComponent />);

    expect(screen.getByText(/Confirmação e Acesso:/i)).toBeInTheDocument();
    expect(screen.getByText(/Correção e Atualização:/i)).toBeInTheDocument();
    expect(screen.getByText(/Eliminação dos dados:/i)).toBeInTheDocument();
    expect(screen.getByText(/Revogação do consentimento:/i)).toBeInTheDocument();

    expect(screen.getByText(/não prometemos segurança absoluta/i)).toBeInTheDocument();
  });
});
