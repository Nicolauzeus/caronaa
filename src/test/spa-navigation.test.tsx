import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => api.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { SearchForm } from "@/components/caronaa/PageParts";

describe("CARONAA SPA search navigation", () => {
  beforeEach(() => api.navigate.mockClear());

  it("passes the itinerary through the router without reloading the page", () => {
    render(<SearchForm />);
    fireEvent.change(screen.getByPlaceholderText("De onde você sai?"), {
      target: { value: "Centro de Fortaleza" },
    });
    fireEvent.change(screen.getByPlaceholderText("Para onde vai?"), {
      target: { value: "UNILAB Redenção" },
    });
    fireEvent.change(screen.getByLabelText("Data da viagem"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Buscar caronas/i }));
    expect(api.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/buscar",
      search: { origem: "Centro de Fortaleza", destino: "UNILAB Redenção", data: "2026-12-01" },
    });
  });
});
