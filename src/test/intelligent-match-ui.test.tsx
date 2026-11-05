import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RideCard } from "@/components/caronaa/RideCard";
import type { RideSummary } from "@/lib/rides.functions";
const request = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => request }));
vi.mock("@/lib/rides.functions", () => ({ requestRideOffer: {} }));
vi.mock("@/components/caronaa/VerificationBadges", () => ({ VerificationBadges: () => null }));
const ride: RideSummary = {
  id: "offer",
  kind: "offer",
  role: "available",
  origin: "Origem",
  destination: "Destino",
  rideDate: "2030-01-02",
  departureTime: "07:00",
  seats: 3,
  seatsRemaining: 3,
  status: "available",
  createdAt: "2030-01-01",
  updatedAt: "2030-01-01",
  rideId: null,
  requestId: null,
  offerId: "offer",
  driver: null,
  passenger: null,
  viewerUserId: "passenger",
  totalPrice: 0,
  confirmedPassengers: 0,
  passengerContribution: 0,
  matchEvaluation: {
    classification: "opportunity",
    pickupAt: "2030-01-02T07:20:00-03:00",
    differenceMinutes: -40,
    score: 80,
    preferenceBonus: 0,
    reasons: [],
    roadGeometry: true,
    pickupDistanceKm: 0.6,
    dropoffDistanceKm: 0.1,
    requiresAdjustment: true,
    timeEstimated: true,
  },
};
const segmentRequest = {
  quoteId: "quote",
  distanceKm: 11,
  pricePerPassenger: 6,
  rideDate: "2030-01-02",
  departureTime: "08:00",
  timeToleranceMinutes: 15 as const,
};
beforeEach(() => request.mockReset().mockResolvedValue({ requestId: "request" }));
describe("opportunity consent", () => {
  it("shows estimates without reserving seats and requires consent before requesting", async () => {
    render(<RideCard ride={ride} segmentRequest={segmentRequest} />);
    expect(screen.getByText("Oportunidade")).toBeInTheDocument();
    expect(screen.getByText(/40 min antes/)).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Revisar vagas e valor" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirmar 1 vaga" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar 1 vaga" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acceptAdjustment: true,
          expectedPickup: ride.matchEvaluation!.pickupAt,
          departureTime: "08:00",
          quoteId: "quote",
        }),
      }),
    );
  });
  it("keeps compatible requests actionable without an adjustment checkbox", () => {
    render(
      <RideCard
        ride={{
          ...ride,
          matchEvaluation: {
            ...ride.matchEvaluation!,
            classification: "compatible",
            requiresAdjustment: false,
          },
        }}
        segmentRequest={segmentRequest}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar vagas e valor" })).toBeEnabled();
  });
});
