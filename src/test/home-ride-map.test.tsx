import { act, render, waitFor, fireEvent, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { HomeRideMap } from "@/components/caronaa/HomeRideMap";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps-loader";
const api = vi.hoisted(() => ({
  create: vi.fn(),
  panTo: vi.fn(),
  fitBounds: vi.fn(),
  on: vi.fn(),
  marker: vi.fn(),
  circle: vi.fn(),
  clear: vi.fn(),
  polyline: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/google-maps-browser.functions", () => ({
  getGoogleMapsBrowserKey: vi.fn(),
}));
vi.mock("@/lib/google-maps-loader", () => ({
  loadGoogleMaps: vi.fn(),
  onGoogleMapsAuthFailure: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/map-routing.functions", () => ({
  getMapDrivingRoute: vi.fn().mockResolvedValue({
    routePath: [
      { lat: -3.73, lng: -38.52 },
      { lat: -3.79, lng: -38.48 },
    ],
    distanceKm: 11,
    durationMinutes: 20,
  }),
}));
const base = {
  userPosition: { lat: -3.73, lng: -38.52, accuracy: 20 },
  originIsCurrent: true,
  following: true,
  recenterVersion: 0,
  locating: false,
  onDrag: vi.fn(),
  onRecenter: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGoogleMapsBrowserKey).mockResolvedValue("test-browser");
  vi.mocked(loadGoogleMaps).mockResolvedValue();
  vi.stubGlobal("google", {
    maps: {
      Map: class {
        constructor(options: unknown) {
          api.create(options);
        }
        addListener = api.on;
        panTo = api.panTo;
        fitBounds = api.fitBounds;
      },
      Marker: class {
        constructor(options: unknown) {
          api.marker(options);
        }
        setMap = api.clear;
      },
      Circle: class {
        constructor(options: unknown) {
          api.circle(options);
        }
        setMap = api.clear;
      },
      Polyline: class {
        constructor(options: unknown) {
          api.polyline(options);
        }
        setMap = api.clear;
      },
      LatLngBounds: class {
        extend = vi.fn();
      },
      SymbolPath: { CIRCLE: "circle" },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Google home map", () => {
  it("renders Google markers, GPS accuracy and official road geometry", async () => {
    const { container } = render(
      <HomeRideMap {...base} destination={{ lat: -3.79, lng: -38.48 }} />,
    );
    await waitFor(() => expect(api.fitBounds).toHaveBeenCalled());
    expect(container.querySelector('[data-map-provider="google"]')).toBeTruthy();
    expect(loadGoogleMaps).toHaveBeenCalledWith("test-browser");
    expect(api.circle).toHaveBeenCalledWith(expect.objectContaining({ radius: 20 }));
    expect(screen.getByText(/11,0 km/)).toBeInTheDocument();
  });
  it("updates GPS markers without recreating the map or following after a drag", async () => {
    const { rerender, unmount } = render(<HomeRideMap {...base} />);
    await waitFor(() => expect(api.on).toHaveBeenCalledWith("dragstart", expect.any(Function)));
    act(() => api.on.mock.calls[0][1]());
    expect(base.onDrag).toHaveBeenCalledOnce();
    api.panTo.mockClear();
    rerender(
      <HomeRideMap
        {...base}
        following={false}
        userPosition={{ lat: -3.74, lng: -38.53, accuracy: 80 }}
      />,
    );
    await waitFor(() =>
      expect(api.marker).toHaveBeenCalledWith(
        expect.objectContaining({ position: { lat: -3.74, lng: -38.53 } }),
      ),
    );
    expect(api.panTo).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Centralizar na minha localização" }));
    expect(base.onRecenter).toHaveBeenCalledOnce();
    rerender(<HomeRideMap {...base} recenterVersion={1} />);
    expect(api.panTo).toHaveBeenCalledWith({ lat: -3.73, lng: -38.52 });
    unmount();
    expect(api.clear).toHaveBeenCalled();
  });
  it("draws the authorized meeting point and real walking geometry, then removes the overlay", async () => {
    const pickupPreview = {
      passenger: { lat: -3.73, lng: -38.52 },
      route: [
        { lat: -3.73, lng: -38.53 },
        { lat: -3.79, lng: -38.48 },
      ],
      pickup: {
        point: { lat: -3.731, lng: -38.521 },
        label: "Na rota, próximo a Posto",
        source: "PLACE_REFERENCE" as const,
        placeId: "place",
        needsConfirmation: true as const,
      },
      walk: {
        distanceKm: 0.15,
        durationMinutes: 2,
        routePath: [
          { lat: -3.73, lng: -38.52 },
          { lat: -3.7305, lng: -38.5202 },
          { lat: -3.731, lng: -38.521 },
        ],
      },
      strict: true,
      highway: false,
    };
    const { rerender } = render(<HomeRideMap {...base} pickupPreview={pickupPreview} />);
    await waitFor(() =>
      expect(api.polyline).toHaveBeenCalledWith(
        expect.objectContaining({
          path: pickupPreview.walk.routePath,
          strokeOpacity: 0,
          icons: expect.any(Array),
        }),
      ),
    );
    expect(api.marker).toHaveBeenCalledWith(
      expect.objectContaining({
        position: pickupPreview.pickup.point,
        title: pickupPreview.pickup.label,
      }),
    );
    api.clear.mockClear();
    rerender(<HomeRideMap {...base} pickupPreview={null} />);
    expect(api.clear).toHaveBeenCalled();
  });
  it("shows a reload action on script failure without creating another map", async () => {
    vi.mocked(loadGoogleMaps).mockRejectedValue(new Error("network"));
    const { container } = render(<HomeRideMap {...base} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o Google Maps",
    );
    expect(screen.getByRole("button", { name: "Recarregar mapa" })).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    expect(container.querySelectorAll("iframe")).toHaveLength(0);
  });
  it("shows the error state when Google rejects domain authentication after loading", async () => {
    render(<HomeRideMap {...base} />);
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    act(() => vi.mocked(onGoogleMapsAuthFailure).mock.calls[0][0]());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
