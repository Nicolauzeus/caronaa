import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ load: vi.fn(), suggest: vi.fn(), surface: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/safe-pickup.functions", () => ({
  getStrictPickupContext: api.load,
  suggestStrictPickup: api.suggest,
}));
vi.mock("@/components/caronaa/GoogleMapSurface", () => ({
  GoogleMapSurface: (props: unknown) => {
    api.surface(props);
    return <div data-testid="pickup-map" />;
  },
}));
import { StrictPickupPanel } from "@/components/caronaa/StrictPickupPanel";
const fixed = {
  passenger: { lat: 0.001, lng: 0.02 },
  route: [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.1 },
  ],
  strict: true,
  highway: false,
};
const preview = {
  ...fixed,
  pickup: {
    point: { lat: 0, lng: 0.02 },
    label: "Na rota, próximo a Posto",
    source: "PLACE_REFERENCE" as const,
    placeId: "place",
    needsConfirmation: true as const,
  },
  walk: {
    distanceKm: 0.15,
    durationMinutes: 2,
    routePath: [fixed.passenger, { lat: 0, lng: 0.02 }],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  api.load.mockResolvedValue(fixed);
  api.suggest.mockResolvedValue(preview);
});
describe("Pickup preview after an authorized match", () => {
  it("automatically loads a compact preview and forwards real geometry to the Home map", async () => {
    const change = vi.fn();
    render(
      <StrictPickupPanel
        rideId="auto-preview"
        autoSuggest
        showMap={false}
        onPreviewChange={change}
      />,
    );
    expect(
      await screen.findByText("Na rota, próximo a Posto", {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/150 m.*~2 min a pé/)).toBeInTheDocument();
    // The parent callback is delivered by a React effect after the preview
    // becomes visible; full-suite scheduling need not flush it synchronously.
    await waitFor(() => expect(change).toHaveBeenCalledWith(preview));
    expect(screen.queryByTestId("pickup-map")).not.toBeInTheDocument();
  });
  it("retains explicit suggestion requests in the existing trip screen", async () => {
    render(<StrictPickupPanel rideId="manual-preview" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver ponto de encontro sugerido" }));
    await waitFor(() => expect(api.suggest).toHaveBeenCalledOnce(), { timeout: 2500 });
    expect(await screen.findByTestId("pickup-map")).toBeInTheDocument();
  });
  it("does not call Places/Routes when the context is ineligible or unavailable", async () => {
    api.load.mockResolvedValue(null);
    const { container } = render(<StrictPickupPanel rideId="unavailable" autoSuggest />);
    await waitFor(() => expect(api.load).toHaveBeenCalled());
    expect(api.suggest).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
