import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DriverHomeDashboard } from "./DriverHomeDashboard";

const api = vi.hoisted(() => ({
  trips: vi.fn(), opportunities: vi.fn(), accept: vi.fn(),
  success: vi.fn(), error: vi.fn(),
}));
vi.mock("@/services/driver-scheduled-service", () => ({
  getDriverScheduledTrips: api.trips,
  getDriverScheduledOpportunities: api.opportunities,
  acceptDriverScheduledRequest: api.accept,
}));
vi.mock("sonner", () => ({ toast: { success: api.success, error: api.error } }));

const future = () => new Date(Date.now() + 2 * 60 * 60_000).toISOString();
beforeEach(() => {
  vi.clearAllMocks();
  api.trips.mockResolvedValue([]);
  api.opportunities.mockResolvedValue([]);
  api.accept.mockResolvedValue({ seatsRemaining: 1 });
});
afterEach(() => { vi.useRealTimers(); });

describe("Driver Home — actual scheduled ride inbox", () => {
  it("opens a separate shared-driver cockpit and lets the user start offering", async () => {
    const onOffer = vi.fn(), onOpenTrips = vi.fn();
    render(<DriverHomeDashboard onOffer={onOffer} onOpenTrips={onOpenTrips}/>);
    expect(screen.getByRole("heading", { name: "Painel do motorista" })).toBeInTheDocument();
    await screen.findByText("Ainda não há trajetos publicados");
    expect(screen.queryByText("Motorista online")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Oferecer carona/i }));
    expect(onOffer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Minhas viagens/i }));
    expect(onOpenTrips).toHaveBeenCalledOnce();
  });

  it("shows real rider requests and accepts only through the authorized service", async () => {
    api.trips.mockResolvedValue([{
      offerId: "offer-1", origin:"Centro",destination:"Redenção",
      departureAt:future(),seatsRemaining:2,vehicleType:"CAR",passengers:[],
    }]);
    api.opportunities.mockResolvedValue([{
      requestId:"request-1",passengerName:"Pessoa de teste",passengers:1,
      potentialEarnings:6,meetingDistanceMeters:90,meetingName:"Parada central",
    }]);
    render(<DriverHomeDashboard onOffer={vi.fn()} onOpenTrips={vi.fn()}/>);
    await screen.findByText("Pessoa de teste");
    expect(api.opportunities).toHaveBeenCalledWith("offer-1");
    fireEvent.click(screen.getByRole("button",{name:"Aceitar solicitação"}));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith("offer-1","request-1"));
  });

  it("shows a recoverable error without inventing requests", async () => {
    api.trips.mockRejectedValue(new Error("Unavailable"));
    render(<DriverHomeDashboard onOffer={vi.fn()} onOpenTrips={vi.fn()}/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não conseguimos consultar");
    expect(screen.queryByText("Pessoa de teste")).toBeNull();
  });
});
