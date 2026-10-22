import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AdminOverview } from "@/components/admin/AdminOverview";

const api = vi.hoisted(() => ({
  users: vi.fn(),
  operations: vi.fn(),
  forms: vi.fn(),
  funnel: vi.fn(),
  retention: vi.fn(),
  attention: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/lib/admin.functions", () => ({ getAdminUsers: api.users }));
vi.mock("@/lib/operational-metrics", () => ({ getOperationalMetrics: api.operations }));
vi.mock("@/lib/formulario/metrics", () => ({ getFormMetrics: api.forms }));
vi.mock("@/lib/main-funnel-metrics", () => ({ getMainFunnelMetrics: api.funnel }));
vi.mock("@/lib/retention-metrics", () => ({ getRetentionMetrics: api.retention }));
vi.mock("@/lib/admin-operations", () => ({ loadAdminOperations: api.attention }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { hash: "" } }),
  useNavigate: () => api.navigate,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminOverview />
    </QueryClientProvider>,
  );
}

describe("Administrative overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.users.mockResolvedValue([]);
    api.operations.mockResolvedValue({
      request: {
        eligibleRequests: 0,
        matchedRequests: 0,
        unmatchedRequests: 0,
        requestMatchRate: 0,
      },
      offer: { eligibleOffers: 0, utilizedOffers: 0, unmatchedOffers: 0, offerMatchRate: 0 },
      match: { total: 0, completed: 0, cancelled: 0, averageMinutesToMatch: null },
      seats: { seatFillRate: null, availableSeats: null, occupiedSeats: null },
    });
    api.forms.mockResolvedValue({
      totals: { started: 0, completed: 0, leads: 0, completionRate: null },
    });
    api.funnel.mockResolvedValue({ stages: [], cohortSize: 0 });
    api.retention.mockResolvedValue({
      repeatRate7d: 0,
      repeatRate30d: 0,
      distribution: { one: 0, two: 0, threeToFive: 0, sixOrMore: 0 },
    });
    api.attention.mockResolvedValue({ requests: [], offers: [], rides: [], reviews: [] });
  });
  it("renders real zero values, periods and an explicit empty attention queue", async () => {
    mount();
    expect(await screen.findByRole("link", { name: "Usuários cadastrados: 0" })).toHaveAttribute(
      "href",
      "/admin/usuarios",
    );
    expect(
      await screen.findByText("Nenhuma pendência nas filas operacionais consultadas."),
    ).toBeInTheDocument();
    const essential = screen.getByRole("region", { name: "Indicadores essenciais" });
    expect(within(essential).getAllByRole("link")).toHaveLength(4);
    expect(within(essential).getAllByText("Últimos 30 dias")).toHaveLength(3);
    expect(api.operations).toHaveBeenCalledWith(
      expect.objectContaining({ periodStart: expect.any(String), periodEnd: expect.any(String) }),
    );
  });
  it("does not turn failed metrics into zero or expose backend messages; retries", async () => {
    api.operations.mockRejectedValueOnce(new Error("relation private_missing does not exist"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os dados",
    );
    expect(screen.queryByText(/private_missing/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Caronas concluídas: Dados indisponíveis" }),
    ).toHaveTextContent("Indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("link", { name: "Caronas concluídas: 0" });
  });
  it("distinguishes forbidden sources and keeps successful sources available", async () => {
    api.users.mockRejectedValue({ code: "42501" });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("não tem permissão");
    expect(await screen.findByRole("link", { name: "Ofertas elegíveis: 0" })).toBeInTheDocument();
  });
  it("lists only real nonempty operational queues", async () => {
    api.attention.mockResolvedValue({
      requests: [{ status: "open" }],
      offers: [],
      rides: [],
      reviews: [],
    });
    mount();
    expect(await screen.findByRole("link", { name: /Pedidos em busca/ })).toHaveAttribute(
      "href",
      "/admin/solicitacoes",
    );
    expect(screen.queryByRole("link", { name: /Combinações aguardando/ })).not.toBeInTheDocument();
  });
  it("keeps query failures distinct from an empty attention queue", async () => {
    api.attention.mockRejectedValue(new Error("RPC unavailable"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as pendências operacionais",
    );
    expect(
      screen.queryByText("Nenhuma pendência nas filas operacionais consultadas."),
    ).not.toBeInTheDocument();
  });
  it("pushes section navigation without replacing browser history", async () => {
    mount();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Pessoas e recorrência" }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith(expect.objectContaining({ hash: "people" })),
    );
    expect(api.navigate.mock.calls[0][0]).not.toHaveProperty("replace");
  });
});
