import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated/home";
import { clearRideIntentDraft, consumeRideIntentDraft, saveRideIntentDraft } from "@/lib/ride-intent-draft";

const api = vi.hoisted(() => ({
  load: vi.fn(),
  request: vi.fn(),
  quote: vi.fn(),
  reverse: vi.fn(),
  seed: vi.fn(),
  account: vi.fn(),
  navigate: vi.fn(),
  map: vi.fn(),
  quickPanel: vi.fn(),
  selfRadar: vi.fn(),
  offerPanel: vi.fn(),
  preview: null as any,
}));
// Isolated component tests must not initialize authenticated Supabase server middleware.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: { driverAllowed: true }, error: null }),
    from: vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));
vi.mock("@/components/onboarding/FavoriteCommuteSuggestion", () => ({
  FavoriteCommuteSuggestion: () => null,
}));
vi.mock("@/components/caronaa/StrictPickupPanel", () => ({
  StrictPickupPanel: ({ rideId, onPreviewChange }: any) => {
    useEffect(() => {
      onPreviewChange?.(api.preview);
    }, [onPreviewChange]);
    return <div data-testid="authorized-pickup">{rideId}</div>;
  },
}));
vi.mock("@/lib/travel-preferences-service", () => ({
  loadTravelPreferences: async () => null,
  saveTravelPreferences: async () => undefined,
}));
vi.mock("@/lib/home.functions", () => ({
  getActiveHomeJourneys: api.load,
  getRecentHomeDestinations: () => Promise.resolve([]),
}));
vi.mock("@/lib/ride-matching.functions", () => ({ createRideRequest: api.request }));
vi.mock("@/lib/ride-pricing.functions", () => ({ previewRequestFare: api.quote }));
// This is a component test: isolate reverse-geocoding responses per test.
// The real session-wide request cache is exercised by its own tests.
vi.mock("@/lib/session-request-cache", () => ({
  sessionRequest: (_key: string, request: () => Promise<unknown>) => request(),
}));
vi.mock("@tanstack/react-start", () => {
  // Server functions are imported transitively by map components.
  // Keep this component test isolated from actual server middleware creation.
  const middleware: any = {};
  middleware.server = () => middleware;
  middleware.client = () => middleware;
  middleware.middleware = () => middleware;

  const serverFn: any = {};
  serverFn.middleware = () => serverFn;
  serverFn.inputValidator = () => serverFn;
  serverFn.validator = () => serverFn;
  serverFn.handler = () => vi.fn();

  return {
    useServerFn: (fn: unknown) => fn,
    createMiddleware: () => middleware,
    createServerFn: () => serverFn,
  };
});
vi.mock("@/lib/quick-rides/f07-radar-diagnostic.functions", () => ({
  getF07TestSelfRadar: api.selfRadar,
}));
vi.mock("@/components/caronaa/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: api.reverse }));
vi.mock("@/lib/formulario/ride-activation.functions", () => ({
  getStsRideDraft: api.seed,
  publishStsRide: vi.fn(),
}));
vi.mock("@/lib/formulario/account-activation", () => ({
  getFormAccountActivation: api.account,
  confirmFormAccountActivation: vi.fn(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "user", user_metadata: {} } }),
}));
vi.mock("@/components/caronaa/HomeOfferPanel", () => ({
  HomeOfferPanel: (props: any) => {
    api.offerPanel(props);
    return <div data-testid="home-offer-flow">Oferta no mesmo mapa · {props.origin} → {props.destination}</div>;
  },
}));
vi.mock("@/components/caronaa/QuickRideHomePanel", () => ({
  QuickRideHomePanel: (props: any) => {
    api.quickPanel(props);
    return <div data-testid="quick-ride-home">Corrida Rápida integrada ao mapa · {props.vehicle}</div>;
  },
}));
vi.mock("@/components/caronaa/HomeRideMap", () => ({
  HomeRideMap: (props: any) => {
    api.map(props);
    return <div aria-label="Mapa do seu trajeto">{props.userPosition?.lat}</div>;
  },
}));
vi.mock("@/components/formulario/LocationAutocomplete", () => ({
  LocationAutocomplete: ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original()),
  useNavigate: () => api.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/minhas-caronas">{children}</a>,
}));

describe("Home mobile", () => {
  const Home = Route.options.component!;
  let fix: PositionCallback;
  let move: PositionCallback;
  let gpsFailure: PositionErrorCallback;
  const position = (lat = -3.73, accuracy = 10) =>
    ({ coords: { latitude: lat, longitude: -38.52, accuracy } }) as GeolocationPosition;
  beforeEach(() => {
    vi.spyOn(Route, "useSearch").mockReturnValue({intent:undefined});
    clearRideIntentDraft();
    vi.clearAllMocks();
    api.load.mockResolvedValue([]);
    api.selfRadar.mockResolvedValue([]);
    api.preview = null;
    api.request.mockResolvedValue({ requestId: "request" });
    api.quote.mockResolvedValue({
      quoteId: "route-quote",
      distanceKm: 11,
      pricePerPassenger: 6,
      tariffReference: "caronaa-km-6-per-11-v1",
    });
    api.seed.mockResolvedValue(null);
    api.account.mockResolvedValue({ status: "none" });
    api.reverse.mockResolvedValue({
      rawText: "Rua A",
      formattedAddress: "Rua A, Fortaleza",
      lat: -3.73,
      lng: -38.52,
    });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false }),
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => {
          fix = success;
          gpsFailure = error;
        },
        watchPosition: (success: PositionCallback) => {
          move = success;
          return 7;
        },
        clearWatch: vi.fn(),
      },
    });
  });
  it("prioriza a ação sem dashboard e não espera o carregamento secundário", () => {
    api.load.mockReturnValue(new Promise(() => {}));
    render(<Home />);
    expect(screen.getByRole("heading", { name: /Encontre sua carona/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pesquisar destino no painel de carona" })).toBeInTheDocument();
    expect(screen.queryByText("Para onde vamos?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vou dirigindo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Caronas disponíveis")).toBeNull();
  });
  it("alterna pedir/oferecer no mesmo mapa e mantém a origem/destino sem navegação", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "Oferecer carona" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "Casa no Maracanaú" } });
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Campus Redenção" } });
    fireEvent.click(screen.getByRole("button", { name: "Oferecer carona" }));
    expect(screen.getByRole("heading", { name: "Ofereça sua carona" })).toBeInTheDocument();
    expect(screen.getByTestId("home-offer-flow")).toHaveTextContent("Casa no Maracanaú");
    expect(screen.getByTestId("home-offer-flow")).toHaveTextContent("Campus Redenção");
    expect(screen.getByLabelText("Saída")).toHaveValue("Casa no Maracanaú");
    expect(screen.getByLabelText("Destino")).toHaveValue("Campus Redenção");
    expect(screen.getByLabelText("Mapa do seu trajeto")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Carona Compartilhada/ })).not.toBeInTheDocument();
    expect(api.navigate).toHaveBeenCalledWith({
      to: "/home", search: {intent:"offer"}, replace:true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Pedir carona" }));
    expect(screen.getByRole("heading", { name: "Encontre sua carona" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Carona Compartilhada/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Saída")).toHaveValue("Casa no Maracanaú");
    expect(api.request).not.toHaveBeenCalled();
  });
  it("recupera o trajeto do motorista ao voltar para pedir carona sem reaproveitar cotação", async () => {
    saveRideIntentDraft({
      origin: "Centro, Fortaleza",
      destination: "UNILAB, Redenção",
      originLocation: { rawText:"Centro, Fortaleza",lat:-3.73,lng:-38.52 },
      destinationLocation: { rawText:"UNILAB, Redenção",lat:-4.23,lng:-38.73 },
      passengerMode: "MOTO",
      offerVehicle: "MOTO",
      date: "2026-11-10",
      time: "15:30",
    });
    render(<Home />);
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Centro, Fortaleza"));
    expect(screen.getByLabelText("Destino")).toHaveValue("UNILAB, Redenção");
    expect(screen.getByRole("radio",{name:/Carona Moto/})).toBeChecked();
    expect(screen.getByLabelText("Data da viagem")).toHaveValue("2026-11-10");
    expect(api.request).not.toHaveBeenCalled();
    expect(consumeRideIntentDraft()).toBeNull();
  });
  it("expande e recolhe o painel sem controles de motorista", () => {
    render(<Home />);
    expect(screen.queryByLabelText("Destino")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    expect(screen.getByText("Seus caminhos salvos").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("radio", { name: /Carona Compartilhada/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Carona Moto/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Corrida Rápida/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recolher detalhes" }));
    expect(screen.queryByLabelText("Destino")).not.toBeInTheDocument();
  });
  it("publica a solicitação com os campos informados", async () => {
    const { container } = render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "CEC" } });
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Aldeota" } });
    fireEvent.change(screen.getByLabelText("Data da viagem"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Horário de saída"), { target: { value: "20:00" } });
    await waitFor(() => expect(api.quote).toHaveBeenCalled());
    await screen.findByText(/R\$ 6,00 por pessoa/);
    fireEvent.submit(container.querySelector("form")!);
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.getByText("Revise antes de enviar")).toBeInTheDocument();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(api.request).toHaveBeenCalledOnce());
    expect(api.request).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quoteId: "route-quote",
        rideDate: "2026-10-15",
        departureTime: "20:00",
      }),
    });
  });
  it("não usa um fix de 1029m como origem real nem faz reverse geocode impreciso", async () => {
    render(<Home />);
    act(() => fix(position(-3.73, 1029)));
    expect(await screen.findByText(/GPS impreciso/i)).toBeInTheDocument();
    expect(api.reverse).not.toHaveBeenCalled();
    expect(api.map.mock.lastCall?.[0].origin).toBeUndefined();
    expect(screen.getAllByRole("button", { name: "Pesquisar destino no painel de carona" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Corrigir saída" }));
    expect(screen.getByLabelText("Saída")).toHaveValue("");
    expect(screen.getByText(/O GPS está com precisão de aproximadamente 1029 metros/)).toBeInTheDocument();
  });

  it("aceita nova leitura confiável depois de um fix inicial grosseiro", async () => {
    render(<Home />);
    act(() => fix(position(-3.73, 1029)));
    expect(api.reverse).not.toHaveBeenCalled();
    act(() => move(position(-3.731, 25)));
    await waitFor(() => expect(api.reverse).toHaveBeenCalledWith({
      data: { lat: -3.731, lng: -38.52 },
    }));
    expect(api.map.mock.lastCall?.[0].origin).toEqual(
      expect.objectContaining({ lat: -3.731, lng: -38.52 }),
    );
  });

  it("permite tocar no Google Maps para escolher uma saída sem usar centro aproximado", async () => {
    render(<Home />);
    act(() => fix(position(-3.73, 1029)));
    fireEvent.click(screen.getByRole("button", { name: "Corrigir saída" }));
    fireEvent.click(screen.getByRole("button", { name: /Escolher saída tocando no mapa/ }));
    expect(screen.getByText(/toque no local correto do mapa/i)).toBeInTheDocument();
    const onPickOrigin = api.map.mock.lastCall?.[0].onPickOrigin as (point: {lat:number;lng:number}) => void;
    act(() => onPickOrigin({ lat: -3.755, lng: -38.531 }));
    await waitFor(() => expect(api.map.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        origin: expect.objectContaining({ lat: -3.755, lng: -38.531 }),
        originIsCurrent: false,
      }),
    ));
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Rua A, Fortaleza"));
    expect(api.map.mock.lastCall?.[0].origin).toEqual(
      expect.objectContaining({ lat: -3.755, lng: -38.531 }),
    );
  });

  it("preenche saída automaticamente com endereço e coordenadas reais", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    render(<Home />);
    act(() => fix(position()));
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Rua A, Fortaleza"));
    expect(
      screen.getByRole("button", { name: "Usar minha localização atual" }),
    ).toBeInTheDocument();
    expect(api.reverse).toHaveBeenCalledWith({ data: { lat: -3.73, lng: -38.52 } });
  });
  it("GPS negado permite informar saída sem reload", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    render(<Home />);
    act(() => gpsFailure({ code: 1 } as GeolocationPositionError));
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "CEC" } });
    expect(screen.getByLabelText("Saída")).toHaveValue("CEC");
    expect(
      screen.getByRole("button", { name: "Usar minha localização atual" }),
    ).toBeInTheDocument();
  });
  it("movimento atualiza marcador sem sobrescrever saída manual", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    render(<Home />);
    act(() => fix(position()));
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Rua A, Fortaleza"));
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "Centro de Eventos" } });
    act(() => move(position(-3.74)));
    expect(screen.getByLabelText("Saída")).toHaveValue("Centro de Eventos");
    expect(screen.getByLabelText("Mapa do seu trajeto")).toHaveTextContent("-3.74");
    expect(api.reverse).toHaveBeenCalledOnce();
  });
  it("falha no reverse mantém coordenadas utilizáveis na publicação", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    api.reverse.mockResolvedValue(null);
    const { container } = render(<Home />);
    act(() => fix(position()));
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    await screen.findByText(/Não conseguimos identificar o endereço/);
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "CEC" } });
    fireEvent.change(screen.getByLabelText("Data da viagem"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Horário de saída"), { target: { value: "20:00" } });
    await screen.findByText(/R\$ 6,00 por pessoa/);
    fireEvent.submit(container.querySelector("form")!);
    expect(api.request).not.toHaveBeenCalled();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith({
        data: expect.objectContaining({ quoteId: "route-quote" }),
      }),
    );
  });
  it("permanece na mesma home ao escolher Corrida Rápida e preserva coordenadas", async () => {
    api.quote.mockResolvedValue({
      quoteId: "gps-quote",
      pricePerPassenger: 6,
      distanceKm: 11,
      originPoint: { lat: -3.73, lng: -38.52 },
      destinationPoint: { lat: -3.75, lng: -38.5 },
    });
    render(<Home />);
    act(() => fix(position()));
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Rua A, Fortaleza"));
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Campus" } });
    await screen.findByText(/R\$ 6,00 por pessoa/);
    fireEvent.click(screen.getByRole("radio", { name: /Corrida Rápida/ }));
    expect(screen.getByTestId("quick-ride-home")).toHaveTextContent("Corrida Rápida integrada ao mapa");
    expect(api.navigate).not.toHaveBeenCalled();
    expect(api.quickPanel).toHaveBeenLastCalledWith(expect.objectContaining({
      origin: "Rua A, Fortaleza",
      destination: "Campus",
      originPoint: expect.objectContaining({ lat: -3.73, lng: -38.52 }),
    }));
    expect(api.map.mock.lastCall?.[0].professionalDrivers).toEqual([]);
  });
  it("does not overwrite a manually chosen origin when an initial GPS fix arrives late", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Expandir e planejar viagem" }));
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "Saída escolhida" } });
    act(() => fix(position()));
    expect(screen.getByLabelText("Saída")).toHaveValue("Saída escolhida");
    expect(api.reverse).not.toHaveBeenCalled();
  });
  it("connects only a matched passenger ride to the suggested pickup and map", async () => {
    api.preview = {
      passenger: { lat: -3.73, lng: -38.52 },
      route: [],
      pickup: { point: { lat: -3.73, lng: -38.53 } },
    };
    api.load.mockResolvedValue([
      {
        id: "matched-ride",
        kind: "ride",
        role: "passenger",
        status: "MATCHED",
        origin: "Origem",
        destination: "Destino",
        ride_date: "2099-01-01",
        departure_time: "09:00",
      },
    ]);
    render(<Home />);
    expect(await screen.findByTestId("authorized-pickup")).toHaveTextContent("matched-ride");
    await waitFor(() =>
      expect(api.map).toHaveBeenLastCalledWith(
        expect.objectContaining({ pickupPreview: api.preview }),
      ),
    );
  });
  it("não inicia mais carregamento de publicação atribuída ao evento", () => {
    render(<Home />);
    expect(api.seed).not.toHaveBeenCalled();
    expect(screen.queryByText(/trajeto STS/i)).not.toBeInTheDocument();
  });
  it("não apresenta opções de saída vinculadas à inscrição do evento", () => {
    render(<Home />);
    expect(screen.queryByText("Opções de saída")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /inscrição STS/i })).not.toBeInTheDocument();
  });
});
