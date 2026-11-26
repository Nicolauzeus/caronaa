import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DEPARTMENTS } from "@/lib/admin/departments";
import { getDepartmentHome } from "@/lib/admin/module-navigation";
import { AdminAccessProvider } from "@/lib/admin/access";

const state = vi.hoisted(() => ({ pathname: "/admin", hash: "" }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/caronaa/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ cancelQueries: vi.fn(), clear: vi.fn() }) }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) => select({ location: state }),
  Link: ({
    to,
    hash,
    search: _search,
    activeOptions: _activeOptions,
    preload: _preload,
    children,
    ...props
  }: {
    to: string;
    hash?: string;
    search?: unknown;
    activeOptions?: unknown;
    preload?: unknown;
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
        <AdminAccessProvider value={{ isGlobalAdmin: true, departments: [] }}>
          <AdminShell>{department.id==="operations"?<h1>Central de Operações</h1>:<div>Conteúdo</div>}</AdminShell>
        </AdminAccessProvider>,
      );
      const nav = screen.getByRole("navigation", { name: "Navegação administrativa" });
      expect(within(nav).getAllByRole("link")).toHaveLength(10);
      const active = nav.querySelectorAll('[aria-current="page"]');
      expect(active).toHaveLength(1);
      expect(active[0]).toHaveTextContent(department.shortName);
      // Operações owns its module heading; the shell must not duplicate it.
      expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(department.id==="operations"?"Central de Operações":department.name);
      expect(
        screen.getByRole("navigation", { name: `Módulos de ${department.name}` }),
      ).toBeInTheDocument();
    },
  );
  it("keeps nested research details and their specific tab active", () => {
    state.pathname = "/admin/formularios/respostas";
    render(
      <AdminAccessProvider value={{ isGlobalAdmin: true, departments: [] }}>
        <AdminShell><div>Respostas</div></AdminShell>
      </AdminAccessProvider>,
    );
    const modules = screen.getByRole("navigation", { name: /Módulos de Pesquisa/ });
    expect(modules.querySelector('[aria-current="page"]')).toHaveTextContent("Respostas");
  });
  it("keeps restricted departments out of the visible navigation", () => {
    state.pathname = "/admin/tecnologia";
    render(
      <AdminAccessProvider value={{ isGlobalAdmin: false, departments: [{ id: "technology", canWrite: false }] }}>
        <AdminShell><div>Conteúdo</div></AdminShell>
      </AdminAccessProvider>,
    );
    const nav = screen.getByRole("navigation", { name: "Navegação administrativa" });
    expect(within(nav).getAllByRole("link")).toHaveLength(1);
    expect(within(nav).getByRole("link", { name: /Tecnologia/ })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /Financeiro/ })).not.toBeInTheDocument();
  });
  it("opens a modal mobile menu and closes after navigation", async () => {
    render(
      <AdminAccessProvider value={{ isGlobalAdmin: true, departments: [] }}>
        <AdminShell><div>Conteúdo</div></AdminShell>
      </AdminAccessProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu administrativo" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu administrativo" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Pesquisa" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
