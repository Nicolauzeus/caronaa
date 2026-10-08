import { act, render, waitFor, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeRideMap } from "@/components/caronaa/HomeRideMap";

const api = vi.hoisted(() => ({
  setView: vi.fn(),
  panTo: vi.fn(),
  fitBounds: vi.fn(),
  remove: vi.fn(),
  on: vi.fn(),
  clear: vi.fn(),
  circle: vi.fn(),
  dot: vi.fn(),
  create: vi.fn(),
}));
vi.mock("leaflet", () => {
  const layer = () => ({
    addTo: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  });
  return {
    map: (...args: unknown[]) => {
      api.create(...args);
      return {
        setView: api.setView.mockReturnThis(),
        panTo: api.panTo,
        fitBounds: api.fitBounds,
        on: api.on,
        remove: api.remove,
      };
    },
    tileLayer: layer,
    layerGroup: () => ({ addTo: vi.fn().mockReturnThis(), clearLayers: api.clear }),
    circle: (...args: unknown[]) => {
      api.circle(...args);
      return layer();
    },
    circleMarker: (...args: unknown[]) => {
      api.dot(...args);
      return layer();
    },
  };
});
const base = {
  userPosition: { lat: -3.73, lng: -38.52, accuracy: 20 },
  origin: { lat: -3.73, lng: -38.52 },
  originIsCurrent: true,
  following: true,
  recenterVersion: 0,
  locating: false,
  onDrag: vi.fn(),
  onRecenter: vi.fn(),
};
describe("Mapa mobile controlado", () => {
  beforeEach(() => vi.clearAllMocks());
  it("enquadra origem/destino com padding e sem rota fictícia", async () => {
    render(<HomeRideMap {...base} destination={{ lat: -3.79, lng: -38.48 }} />);
    await waitFor(() =>
      expect(api.fitBounds).toHaveBeenCalledWith(
        [
          [-3.73, -38.52],
          [-3.79, -38.48],
        ],
        expect.objectContaining({ paddingBottomRight: [48, 72] }),
      ),
    );
    expect(api.circle).toHaveBeenCalledWith(
      [-3.73, -38.52],
      expect.objectContaining({ radius: 20 }),
    );
  });
  it("arrasto desativa follow e movimento atualiza marcador sem recriar mapa", async () => {
    const { rerender } = render(<HomeRideMap {...base} />);
    await waitFor(() => expect(api.on).toHaveBeenCalledWith("dragstart", expect.any(Function)));
    await waitFor(() => expect(api.dot).toHaveBeenCalledWith([-3.73, -38.52], expect.any(Object)));
    act(() => api.on.mock.calls.find(([name]) => name === "dragstart")![1]());
    expect(base.onDrag).toHaveBeenCalledOnce();
    api.panTo.mockClear();
    rerender(
      <HomeRideMap
        {...base}
        following={false}
        userPosition={{ lat: -3.74, lng: -38.53, accuracy: 80 }}
      />,
    );
    await waitFor(() => expect(api.dot).toHaveBeenCalledWith([-3.74, -38.53], expect.any(Object)));
    expect(api.panTo).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledOnce();
  });
  it("recenter volta ao usuário mesmo com destino e mantém ambos os pins", async () => {
    const { rerender, unmount } = render(
      <HomeRideMap {...base} destination={{ lat: -3.79, lng: -38.48 }} />,
    );
    await waitFor(() => expect(api.fitBounds).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Centralizar na minha localização" }));
    expect(base.onRecenter).toHaveBeenCalledOnce();
    api.setView.mockClear();
    rerender(
      <HomeRideMap {...base} destination={{ lat: -3.79, lng: -38.48 }} recenterVersion={1} />,
    );
    expect(api.setView).toHaveBeenCalledWith([-3.73, -38.52], 16, { animate: false });
    unmount();
    expect(api.remove).toHaveBeenCalledOnce();
  });
});
