import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import type { ReactNode } from "react";

const auth = vi.hoisted(() => ({
  check: vi.fn(),
  user: { id: "admin-test" } as { id: string } | null,
  pathname: "/admin",
  scope: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => auth.check }));
vi.mock("@/lib/admin.functions", () => ({ getAdminAccess: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: auth.scope } }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: auth.pathname } }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

describe("Existing administrative authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { id: "admin-test" };
    auth.pathname = "/admin";
    auth.scope.mockResolvedValue({ data: { is_global_admin: false, departments: [] }, error: null });
  });
  it("allows the global admin confirmed by the backend", async () => {
    auth.check.mockResolvedValue({ isAdmin: true });
    render(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(await screen.findByText("Dados administrativos")).toBeInTheDocument();
  });
  it.each(["user", "moderator"])("blocks %s even on a direct administrative URL", async () => {
    auth.user = { id: "non-admin" };
    auth.check.mockResolvedValue({ isAdmin: false });
    render(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(await screen.findByText("Acesso restrito")).toBeInTheDocument();
    expect(screen.queryByText("Dados administrativos")).not.toBeInTheDocument();
  });
  it("grants scoped access to the assigned department only", async () => {
    auth.pathname = "/admin/tecnologia";
    auth.check.mockResolvedValue({ isAdmin: false });
    auth.scope.mockResolvedValue({ data: { is_global_admin: false, departments: [{ id: "technology", can_write: false }] }, error: null });
    const view = render(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(await screen.findByText("Dados administrativos")).toBeInTheDocument();
    auth.pathname = "/admin/financeiro";
    view.rerender(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(await screen.findByText("Acesso não autorizado")).toBeInTheDocument();
    expect(screen.queryByText("Dados administrativos")).not.toBeInTheDocument();
  });
  it("fails closed if authorization fails", async () => {
    auth.check.mockRejectedValue(new Error("Network failed"));
    render(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(await screen.findByText("Verificação de acesso indisponível")).toBeInTheDocument();
    expect(screen.queryByText("Dados administrativos")).not.toBeInTheDocument();
  });
  it("does not query restricted data without an authenticated account", async () => {
    auth.user = null;
    render(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(await screen.findByText("Acesso restrito")).toBeInTheDocument();
    expect(auth.check).not.toHaveBeenCalled();
  });
  it("does not reuse an authorization result after changing accounts", async () => {
    auth.check.mockResolvedValueOnce({ isAdmin: true });
    const view = render(<AdminGuard>Dados administrativos</AdminGuard>);
    await screen.findByText("Dados administrativos");
    auth.user = { id: "other-account" };
    auth.check.mockImplementationOnce(() => new Promise(() => {}));
    view.rerender(<AdminGuard>Dados administrativos</AdminGuard>);
    expect(screen.queryByText("Dados administrativos")).not.toBeInTheDocument();
    expect(screen.getByText("Verificando acesso")).toBeInTheDocument();
  });
});
