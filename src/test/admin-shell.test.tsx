import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DEPARTMENTS } from "@/lib/admin/departments";
import { getDepartmentHome } from "@/lib/admin/module-navigation";

const state = vi.hoisted(() => ({ pathname: "/admin", hash: "" }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/caronaa/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) => select({ location: state }),
  Link: ({
    to,
    hash,
    search: _search,
    activeOptions: _activeOptions,
    children,
    ...props
  }: {
    to: string;
    hash?: string;
    search?: unknown;
    activeOptions?: unknown;
    children: ReactNode;
  }) => (
    <a href={to + (hash ? `#${hash}` : "")} {...props}>
      {children}
    </a>
  ),
}));

describe("Shared administrative navigation", () => {
  beforeEach(() => {
    state.pathname = "/admin";
    state.hash = "";
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  it.each(DEPARTMENTS)(
    "keeps one active department and shared header for $shortName",
    (department) => {
      state.pathname = getDepartmentHome(department.id);
      render(
        <AdminShell>
          <div>Conteúdo</div>
        </AdminShell>,
      );
      const nav = screen.getByRole("navigation", { name: "Navegação administrativa" });
      expect(within(nav).getAllByRole("link")).toHaveLength(10);
      const active = nav.querySelectorAll('[aria-current="page"]');
      expect(active).toHaveLength(1);
      expect(active[0]).toHaveTextContent(department.shortName);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(department.name);
      expect(
        screen.getByRole("navigation", { name: `Módulos de ${department.name}` }),
      ).toBeInTheDocument();
    },
  );
  it("keeps nested research details and their specific tab active", () => {
    state.pathname = "/admin/formularios/respostas";
    render(
      <AdminShell>
        <div>Respostas</div>
      </AdminShell>,
    );
    const modules = screen.getByRole("navigation", { name: /Módulos de Pesquisa/ });
    expect(modules.querySelector('[aria-current="page"]')).toHaveTextContent("Respostas");
  });
  it("opens a modal mobile menu and closes after navigation", async () => {
    render(
      <AdminShell>
        <div>Conteúdo</div>
      </AdminShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu administrativo" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu administrativo" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Pesquisa" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
