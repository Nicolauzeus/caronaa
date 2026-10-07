import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StsFormLink } from "@/components/caronaa/StsFormLink";
import { useAuth } from "@/lib/auth-context";

vi.mock("@/lib/auth-context", () => ({ useAuth: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/formulario">{children}</a>,
}));

describe("Atalhos do formulário STS", () => {
  it.each([
    { user: null, loading: false, visible: true },
    { user: { id: "registered-user" }, loading: false, visible: false },
    { user: null, loading: true, visible: false },
  ])("respeita sessão $visible / loading $loading", ({ user, loading, visible }) => {
    vi.mocked(useAuth).mockReturnValue({ user, loading } as ReturnType<typeof useAuth>);
    render(<StsFormLink to="/formulario">Participar STS</StsFormLink>);
    expect(Boolean(screen.queryByRole("link", { name: "Participar STS" }))).toBe(visible);
  });
});
