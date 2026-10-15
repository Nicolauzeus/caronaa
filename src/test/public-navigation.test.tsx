import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicFooter } from "@/components/caronaa/PublicFooter";
import { AppShell } from "@/components/caronaa/AppShell";

// Mock @tanstack/react-router
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    hash,
    search,
    children,
    className,
    onClick,
    "aria-label": ariaLabel,
  }: {
    to: string;
    hash?: string;
    search?: Record<string, string>;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    "aria-label"?: string;
  }) => {
    let href = to;
    if (search && Object.keys(search).length > 0) {
      const params = new URLSearchParams(search);
      href += `?${params.toString()}`;
    }
    if (hash) {
      href += `#${hash}`;
    }
    return (
      <a href={href} className={className} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
  useRouterState: () => "/",
}));

// Mock useAuth
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    session: null,
  }),
}));

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Public Navigation & Institutional Footer", () => {
  describe("PublicFooter", () => {
    it("renderiza a marca CARONAA e a frase de posicionamento", () => {
      renderWithClient(<PublicFooter />);

      expect(screen.getByRole("img", { name: "CARONAA" })).toBeInTheDocument();
      expect(
        screen.getByText("Conectando quem precisa ir com quem já está indo."),
      ).toBeInTheDocument();
    });

    it("exibe badges institucionais de ecossistema e evento", () => {
      renderWithClient(<PublicFooter />);

      expect(screen.getByText("Startup do Unifor Hub")).toBeInTheDocument();
      expect(screen.getByText("Expositora no Siará Tech Summit 2026")).toBeInTheDocument();
    });

    it("renderiza todos os links obrigatórios sem inventar redes sociais", () => {
      renderWithClient(<PublicFooter />);

      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));

      // Links obrigatórios
      expect(screen.getByRole("link", { name: "Como funciona" })).toHaveAttribute(
        "href",
        "/como-funciona",
      );
      expect(screen.getByRole("link", { name: "Siará Tech Summit" })).toHaveAttribute(
        "href",
        "/#siara-tech-summit",
      );
      expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute(
        "href",
        "/termos",
      );
      expect(screen.getByRole("link", { name: "Privacidade" })).toHaveAttribute(
        "href",
        "/privacidade",
      );
      expect(screen.getByRole("link", { name: "Segurança" })).toHaveAttribute("href", "/seguranca");
      expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/auth");
      expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
        "href",
        "/auth?mode=signup",
      );

      // Não inventa redes sociais falsas (Instagram, Twitter, LinkedIn, Facebook, WhatsApp, etc)
      const prohibitedTerms = [
        "instagram",
        "twitter",
        "facebook",
        "linkedin",
        "tiktok",
        "whatsapp",
      ];
      hrefs.forEach((href) => {
        if (href) {
          prohibitedTerms.forEach((term) => {
            expect(href.toLowerCase()).not.toContain(term);
          });
        }
      });
    });
  });

  describe("AppShell com navegação pública (publicPage = true)", () => {
    it("renderiza o header público desktop com links institucionais e CTA destacado", () => {
      renderWithClient(
        <AppShell publicPage={true}>
          <div>Conteúdo da página</div>
        </AppShell>,
      );

      // Logo
      const logoImages = screen.getAllByRole("img", { name: "CARONAA" });
      expect(logoImages.length).toBeGreaterThanOrEqual(1);

      // Links no Header Desktop
      const desktopNav = screen.getByRole("navigation", { name: "Navegação institucional" });
      expect(desktopNav).toBeInTheDocument();

      expect(screen.getByRole("navigation", { name: "Navegação institucional" })).toHaveTextContent(
        "Como funciona",
      );
      expect(screen.getByRole("navigation", { name: "Navegação institucional" })).toHaveTextContent(
        "Siará Tech Summit",
      );
      expect(screen.getByRole("navigation", { name: "Navegação institucional" })).toHaveTextContent(
        "Segurança",
      );
      expect(screen.getByRole("navigation", { name: "Navegação institucional" })).toHaveTextContent(
        "Entrar",
      );

      // CTA destacado no desktop
      const desktopCta = screen.getByRole("link", { name: "Encontrar minha CARONAA" });
      expect(desktopCta).toBeInTheDocument();
      expect(desktopCta).toHaveAttribute("href", "/formulario");
    });

    it("renderiza o CTA mobile 'Participar' e abre o menu gaveta com as opções necessárias", () => {
      renderWithClient(
        <AppShell publicPage={true}>
          <div>Conteúdo da página</div>
        </AppShell>,
      );

      // CTA Mobile 'Participar'
      const mobileCta = screen.getByRole("link", { name: "Participar" });
      expect(mobileCta).toBeInTheDocument();
      expect(mobileCta).toHaveAttribute("href", "/formulario");

      // Botão de menu mobile
      const menuButton = screen.getByRole("button", { name: /Abrir menu/i });
      expect(menuButton).toBeInTheDocument();

      // Abrir o menu gaveta
      fireEvent.click(menuButton);

      const mobileDrawer = screen.getByRole("navigation", { name: "Menu de navegação mobile" });
      expect(mobileDrawer).toBeInTheDocument();

      // Links no menu mobile
      expect(mobileDrawer).toHaveTextContent("Como funciona");
      expect(mobileDrawer).toHaveTextContent("Siará Tech Summit");
      expect(mobileDrawer).toHaveTextContent("Entrar");

      // Fechar menu ao clicar no botão
      const closeButton = screen.getByRole("button", { name: /Fechar menu/i });
      fireEvent.click(closeButton);
      expect(
        screen.queryByRole("navigation", { name: "Menu de navegação mobile" }),
      ).not.toBeInTheDocument();
    });

    it("renderiza automaticamente o PublicFooter quando publicPage=true", () => {
      renderWithClient(
        <AppShell publicPage={true}>
          <div>Conteúdo público</div>
        </AppShell>,
      );

      expect(
        screen.getByRole("contentinfo", { name: "Rodapé institucional CARONAA" }),
      ).toBeInTheDocument();
    });
  });

  describe("AppShell na área autenticada (publicPage = false)", () => {
    it("não renderiza PublicFooter e mantém navegação da aplicação", () => {
      renderWithClient(
        <AppShell publicPage={false}>
          <div>Área logada</div>
        </AppShell>,
      );

      expect(
        screen.queryByRole("contentinfo", { name: "Rodapé institucional CARONAA" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Navegação inferior" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
    });
  });
});
