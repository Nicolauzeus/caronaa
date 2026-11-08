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
      <HomeRideMap {...base} origin={{ lat: -3.73, lng: -38.52 }} destination={{ lat: -3.79, lng: -38.48 }} />,
    );
    await waitFor(() => expect(api.fitBounds).toHaveBeenCalled());
    expect(container.querySelector('[data-map-provider="google"]')).toBeTruthy();
    expect(loadGoogleMaps).toHaveBeenCalledWith("test-browser");
    expect(api.circle).toHaveBeenCalledWith(expect.objectContaining({ radius: 20 }));
    expect(screen.getByText(/11,0 km/)).toBeInTheDocument();
  });
  it("labels GPS and destination but marks available radar drivers as unassigned", async () => {
    render(
      <HomeRideMap
        {...base}
        destination={{ lat: -3.79, lng: -38.48 }}
        professionalDrivers={[{
          driver_key: "available-1",
          lat: -3.75,
          lng: -38.51,
          seen_at: new Date().toISOString(),
        }]}
      />,
    );
    await waitFor(() => expect(api.marker.mock.calls.length).toBeGreaterThanOrEqual(3));
    const markers = api.marker.mock.calls.map(([options]) => options as {
      title: string;
      icon: { url: string };
    });
    const decoded = (title: string) => {
      const marker = markers.find((m) => m.title.includes(title));
      expect(marker).toBeDefined();
      return decodeURIComponent(marker!.icon.url.split(",")[1]);
    };
    expect(decoded("Você · localização GPS")).toContain("Você");
    expect(decoded("Destino")).toContain("Destino");
    expect(decoded("Motorista disponível no radar")).toContain('width="48"');
    expect(screen.getByText(/ainda não atribuídos à viagem/i)).toBeInTheDocument();
  });
  it("não desenha o pino 'Você' nem círculo para um GPS estimado em 1029m", async () => {
    render(<HomeRideMap {...base}
      userPosition={{ lat: -3.73, lng: -38.52, accuracy: 1029 }}
      origin={{ lat: -3.73, lng: -38.52 }}
      destination={{ lat: -3.76, lng: -38.50 }}
    />);
    await waitFor(() => expect(api.marker).toHaveBeenCalled());
    const titles = api.marker.mock.calls.map(([config]) => config.title);
    expect(titles).toContain("Destino");
    expect(titles.some((title: string) => title.startsWith("GPS aproximado (±1029 m)"))).toBe(true);
    expect(titles.some((title: string) => title.startsWith("Você"))).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent(/Localização aproximada.*1029 m/);
    expect(api.circle).not.toHaveBeenCalled();
    expect(api.polyline).not.toHaveBeenCalled();
  });

  it("centraliza automaticamente no GPS sem pedir uma corrida", async () => {
    render(<HomeRideMap {...base} userPosition={{ lat: -3.731, lng: -38.521, accuracy: 17 }} />);
    await waitFor(() => expect(api.panTo).toHaveBeenCalledWith({lat:-3.731,lng:-38.521}));
    expect(api.marker).toHaveBeenCalledWith(expect.objectContaining({
      title: "Você · localização GPS",
    }));
  });

  it("aperta centralizar e navega ao GPS mesmo quando há saída manual", async () => {
    const chosen = {lat:-3.76,lng:-38.54};
    const { rerender } = render(<HomeRideMap {...base}
      originIsCurrent={false} following={false} origin={chosen} />);
    await waitFor(() => expect(api.panTo).toHaveBeenCalledWith(chosen));
    api.panTo.mockClear();
    fireEvent.click(screen.getByRole("button", {name:"Centralizar na minha localização"}));
    expect(base.onRecenter).toHaveBeenCalledOnce();
    rerender(<HomeRideMap {...base} originIsCurrent={false} following={false}
      origin={chosen} recenterVersion={1} />);
    expect(api.panTo).toHaveBeenCalledWith({lat:-3.73,lng:-38.52});
  });

  it("não fica mudo quando o navegador bloqueia a localização", async () => {
    render(<HomeRideMap {...base} userPosition={null}
      gpsFailure="Acesso à localização negado. Habilite nas permissões." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso à localização negado");
    const button = screen.getByRole("button", {name:"Centralizar na minha localização"});
    fireEvent.click(button);
    expect(base.onRecenter).toHaveBeenCalledOnce();
  });

  it("representa a saída manual como 'Você' quando o GPS está impreciso, sem segundo pino falso", async () => {
    const selected = { lat: -3.746, lng: -38.533 };
    render(<HomeRideMap {...base}
      userPosition={{ lat: -3.73, lng: -38.52, accuracy: 1029 }}
      originIsCurrent={false}
      following={false}
      origin={selected}
    />);
    await waitFor(() => expect(api.marker).toHaveBeenCalled());
    expect(api.marker.mock.calls).toHaveLength(1);
    const marker = api.marker.mock.calls[0][0] as {position: unknown; title: string; icon: {url:string}};
    expect(marker.position).toEqual(selected);
    expect(marker.title).toContain("Sua saída escolhida");
    expect(decodeURIComponent(marker.icon.url.split(",")[1])).toContain("Você");
    expect(api.circle).not.toHaveBeenCalled();
    expect(api.panTo).toHaveBeenCalledWith(selected);
  });

  it("mantém a saída GPS inicialmente confiável quando a leitura ao vivo piora", async () => {
    const selected = { lat: -3.748, lng: -38.535 };
    render(<HomeRideMap {...base}
      userPosition={{ lat: -3.73, lng: -38.52, accuracy: 310 }}
      originIsCurrent
      originAccuracyM={20}
      origin={selected}
      destination={{ lat: -3.78, lng: -38.55 }}
    />);
    await waitFor(() => expect(api.marker).toHaveBeenCalled());
    const titles = api.marker.mock.calls.map(([m]) => m.title as string);
    expect(titles).toContain("Sua saída registrada · último GPS confiável (não ao vivo)");
    expect(titles).not.toContain("Você · localização GPS");
    expect(api.circle).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Trajeto pelas ruas/)).toBeInTheDocument());
  });

  it("usa a saída manual como único ponto Você, mesmo quando GPS distante diz ter boa precisão", async () => {
    const selected = { lat: -3.77, lng: -38.55 };
    render(<HomeRideMap {...base}
      originIsCurrent={false}
      following={false}
      origin={selected}
    />);
    await waitFor(() => expect(api.marker).toHaveBeenCalled());
    const markers = api.marker.mock.calls.map(([marker]) => marker as { title:string; position:{lat:number;lng:number} });
    expect(markers).toHaveLength(1);
    expect(markers[0].title).toContain("Sua saída escolhida");
    expect(markers[0].position).toEqual(selected);
    expect(api.circle).not.toHaveBeenCalled();
  });

  it("permite escolher a saída no mapa apenas quando esse modo é habilitado", async () => {
    const onPickOrigin = vi.fn();
    const { rerender } = render(<HomeRideMap {...base} onPickOrigin={onPickOrigin} />);
    await waitFor(() => expect(api.on).toHaveBeenCalledWith("dragstart", expect.any(Function)));
    expect(api.on.mock.calls.some(([name]) => name === "click")).toBe(false);
    rerender(<HomeRideMap {...base} selectingOrigin onPickOrigin={onPickOrigin} />);
    await waitFor(() => expect(api.on).toHaveBeenCalledWith("click", expect.any(Function)));
    const callback = api.on.mock.calls.find(([name]) => name === "click")![1] as (event:any)=>void;
    act(() => callback({latLng:{lat:()=>-3.754,lng:()=>-38.531}}));
    expect(onPickOrigin).toHaveBeenCalledWith({lat:-3.754,lng:-38.531});
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
