import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RideLiveTracker } from "@/components/caronaa/RideLiveTracker";
import type { RideSafety } from "@/lib/ride-safety";
import * as rideSafetyService from "@/lib/ride-safety-service";

vi.mock("@/lib/ride-safety-service", () => ({
  updateRideTransitStage: vi.fn().mockResolvedValue("DRIVER_EN_ROUTE"),
  revokeRideLocation: vi.fn().mockResolvedValue(undefined),
  updateRideLocation: vi.fn().mockResolvedValue(undefined),
}));

const mockSafety: RideSafety = {
  status: "CONFIRMED",
  transitStage: "CONFIRMED",
  driverUserId: "driver-id-123",
  passengerUserId: "passenger-id-456",
  boardedAt: null,
  pin: "12345678",
  locations: [
    {
      userId: "driver-id-123",
      latitude: -3.7319,
      longitude: -38.5267,
      accuracyM: 8,
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  routeDetails: {
    origin: "Praça Luíza Távora",
    destination: "Campus do Pici",
    originLat: -3.7319,
    originLng: -38.5267,
    destinationLat: -3.745,
    destinationLng: -38.578,
    passengerOriginLat: -3.735,
    passengerOriginLng: -38.53,
  },
  completionConfirmed: false,
  myRating: null,
  receivedRating: null,
  otherUserRating: { average: 5.0, count: 8 },
  myUserRating: { average: 4.9, count: 15 },
};

describe("RideLiveTracker Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the 5 stages of the ride tracking stepper", () => {
    render(
      <RideLiveTracker
        rideId="ride-test-1"
        role="driver"
        viewerUserId="driver-id-123"
        status="CONFIRMED"
        safety={mockSafety}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText("Motorista a caminho")).toBeInTheDocument();
    expect(screen.getByText("Aguardando embarque")).toBeInTheDocument();
    expect(screen.getByText("Em viagem")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
  });

  it("renders the map legend with distinct markers for all ride entities", () => {
    render(
      <RideLiveTracker
        rideId="ride-test-1"
        role="passenger"
        viewerUserId="passenger-id-456"
        status="CONFIRMED"
        safety={mockSafety}
        onRefresh={vi.fn()}
      />,
    );

    const legend = screen.getByText("Legenda do percurso").parentElement;
    expect(legend).toBeInTheDocument();
    expect(screen.getAllByText("Motorista").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Passageiro").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ponto de Encontro")).toBeInTheDocument();
    expect(screen.getByText("Destino Final")).toBeInTheDocument();
  });

  it("does not misrepresent straight-line distance as verified road ETA", () => {
    render(
      <RideLiveTracker
        rideId="ride-test-1"
        role="driver"
        viewerUserId="driver-id-123"
        status="CONFIRMED"
        safety={mockSafety}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/O mapa calcula o percurso pelas vias quando o serviço estiver disponível/i),
    ).toBeInTheDocument();
  });

  it("presents the mandatory mobile lockscreen/background GPS warning", () => {
    render(
      <RideLiveTracker
        rideId="ride-test-1"
        role="passenger"
        viewerUserId="passenger-id-456"
        status="CONFIRMED"
        safety={mockSafety}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/Aviso sobre dispositivos móveis/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Navegadores em celulares suspendem a localização/i),
    ).toBeInTheDocument();
  });

  it("allows driver to advance transit stage with confirmation", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <RideLiveTracker
        rideId="ride-test-1"
        role="driver"
        viewerUserId="driver-id-123"
        status="CONFIRMED"
        safety={mockSafety}
        onRefresh={onRefresh}
      />,
    );

    const button = screen.getByRole("button", {
      name: /Estou a caminho do ponto de encontro/i,
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => {
      expect(rideSafetyService.updateRideTransitStage).toHaveBeenCalledWith(
        "ride-test-1",
        "DRIVER_EN_ROUTE",
      );
    });
  });

  it("handles toggling location sharing and invokes revocation when paused", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <RideLiveTracker
        rideId="ride-test-1"
        role="driver"
        viewerUserId="driver-id-123"
        status="CONFIRMED"
        safety={mockSafety}
        onRefresh={onRefresh}
      />,
    );

    const toggle = screen.getByRole("switch", {
      name: /Compartilhar minha localização nesta viagem/i,
    });
    expect(toggle).toBeInTheDocument();

    // Ativa
    fireEvent.click(toggle);

    // Pausa/Revoga
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(rideSafetyService.revokeRideLocation).toHaveBeenCalledWith("ride-test-1");
    });
  });
  it("restores only explicit consent for the same user and ride", () => {
    sessionStorage.setItem('caronaa:location:driver-id-123:ride-test-1','yes');
    render(<RideLiveTracker rideId="ride-test-1" role="driver" viewerUserId="driver-id-123" status="CONFIRMED" safety={mockSafety} onRefresh={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');
  });
  it("keeps location enabled when the refresh callback changes", () => {
    const props={rideId:'ride-test-1',role:'driver' as const,viewerUserId:'driver-id-123',status:'CONFIRMED',safety:mockSafety};
    const {rerender}=render(<RideLiveTracker {...props} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('switch'));
    rerender(<RideLiveTracker {...props} onRefresh={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');
  });
});
