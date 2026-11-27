import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileAccountDrawer } from "@/components/caronaa/MobileAccountDrawer";

const roles = vi.hoisted(() => ({ value: [] as { role: string }[] }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "user", user_metadata: { full_name: "Participante" } } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: roles.value }) }) }),
    }),
  },
}));
vi.mock("@/lib/user-verifications", () => ({ getMyUserVerifications: vi.fn().mockResolvedValue([]) }));
vi.mock("@/components/caronaa/NotificationControls", () => ({ NotificationControls: () => null }));
vi.mock("@/components/caronaa/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    onClick?: () => void;
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe("Drawer mobile", () => {
  beforeEach(() => {
    roles.value = [];
  });
  it("abre com título acessível e não exibe administração para usuário comum", async () => {
    render(<MobileAccountDrawer signOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu da conta" }));
    expect(screen.getByRole("dialog", { name: "Participante" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administração" })).toBeNull();
    expect(screen.getByRole("link", { name: "Minhas viagens" })).toHaveAttribute(
      "href",
      "/minhas-caronas",
    );
  });
  it("fecha por Escape e devolve foco ao botão", async () => {
    render(<MobileAccountDrawer signOut={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Abrir menu da conta" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("exibe administração somente após papel admin confirmado", async () => {
    roles.value = [{ role: "admin" }];
    render(<MobileAccountDrawer signOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu da conta" }));
    expect(await screen.findByRole("link", { name: "Administração" })).toBeInTheDocument();
  });
});
