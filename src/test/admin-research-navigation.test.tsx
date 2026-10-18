import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Route } from "@/routes/admin/formularios/$code";

const api = vi.hoisted(() => ({ hash: "", read: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ code: "DEMO" }) }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { hash: api.hash } }),
  useNavigate: () => api.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: api.read }) }) }) },
}));
vi.mock("@/lib/formulario/research-catalog", () => ({
  researchPublicUrl: () => "/pesquisas/DEMO",
}));
vi.mock("@/components/admin/ResearchInsights", () => ({
  ResearchInsights: () => <div>Análise da pesquisa</div>,
}));
vi.mock("@/components/admin/ResearchAnswerInsights", () => ({
  ResearchAnswerInsights: () => <div>Análise das respostas</div>,
}));
vi.mock("@/components/admin/ResearchFormEditor", () => ({
  ResearchFormEditor: () => <div>Editor preservado</div>,
}));
vi.mock("@/components/admin/ResearchShare", () => ({ ResearchShare: () => null }));
vi.mock("@/components/admin/ResearchBrandManager", () => ({
  ResearchBrandManager: () => <div>Identidade da pesquisa</div>,
}));
vi.mock("@/components/admin/ResearchFormRemovalDialog", () => ({
  ResearchFormRemovalDialog: () => <div>Confirmação de remoção</div>,
}));
vi.mock("@/components/research/ResearchFields", () => ({
  ResearchBrandHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

describe("Research detail navigation preserves management workflows", () => {
  const Page = Route.options.component!;
  beforeEach(() => {
    vi.clearAllMocks();
    api.hash = "";
    api.navigate.mockImplementation(({ hash }: { hash: string }) => {
      api.hash = hash;
    });
    api.read.mockResolvedValue({
      error: null,
      data: {
        id: "form-test",
        code: "DEMO",
        title: "Pesquisa de teste",
        nature: "EVENTO",
        status: "RASCUNHO",
        audience: "GERAL",
        mobility_mode: "COMPARTILHADA",
        is_enabled: false,
      },
    });
  });
  it.each(["config", "imagem"])("opens settings directly through #%s", async (hash) => {
    api.hash = hash;
    render(<Page />);
    expect(await screen.findByText("Identidade da pesquisa")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Configurações" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("keeps draft review/publication and removal controls available", async () => {
    render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: "Revisar e publicar" }));
    expect(await screen.findByText("Editor preservado")).toBeInTheDocument();
    expect(api.navigate).toHaveBeenCalledWith(expect.objectContaining({ hash: "perguntas" }));
    fireEvent.click(screen.getByRole("button", { name: "Arquivar / Lixeira" }));
    expect(screen.getByText("Confirmação de remoção")).toBeInTheDocument();
  });
  it("blocks editing a trashed form on a direct URL", async () => {
    api.read.mockResolvedValue({
      error: null,
      data: {
        id: "form-test", code: "DEMO", title: "Pesquisa de teste",
        nature: "EVENTO", status: "ARQUIVADO", audience: "GERAL",
        mobility_mode: "COMPARTILHADA", is_enabled: false,
        trashed_at: "2026-10-18T16:00:00Z",
      },
    });
    render(<Page />);
    expect(await screen.findByText("Pesquisa na lixeira")).toBeInTheDocument();
    expect(screen.queryByText("Editor preservado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar ou publicar/ })).not.toBeInTheDocument();
  });
  it("switches tabs without refetching the form or dropping deep response links", async () => {
    const view = render(<Page />);
    await screen.findByText("Análise da pesquisa");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Respostas" }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() => expect(api.hash).toBe("respostas"));
    view.rerender(<Page />);
    expect(screen.getByRole("link", { name: /Ver registros históricos/ })).toHaveAttribute(
      "href",
      "/admin/formularios/respostas",
    );
    expect(api.read).toHaveBeenCalledTimes(1);
  });
});
