import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated/home";

const api = vi.hoisted(() => ({
  load: vi.fn(),
  request: vi.fn(),
  reverse: vi.fn(),
  seed: vi.fn(),
  account: vi.fn(),
}));
vi.mock("@/lib/home.functions", () => ({
  getActiveHomeJourneys: api.load,
  getRecentHomeDestinations: () => Promise.resolve([]),
}));
vi.mock("@/lib/ride-matching.functions", () => ({ createRideRequest: api.request }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
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
vi.mock("@/components/caronaa/HomeRideMap", () => ({
  HomeRideMap: ({ userPosition }: { userPosition: { lat: number } | null }) => (
    <div aria-label="Mapa do seu trajeto">{userPosition?.lat}</div>
  ),
}));
vi.mock("@/components/formulario/LocationAutocomplete", () => ({
  LocationAutocomplete: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original()),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/minhas-caronas">{children}</a>,
}));

describe("Home mobile", () => {
  const Home = Route.options.component!;
  let fix: PositionCallback;
  let move: PositionCallback;
  let gpsFailure: PositionErrorCallback;
  const position = (lat = -3.73) =>
    ({ coords: { latitude: lat, longitude: -38.52, accuracy: 10 } }) as GeolocationPosition;
  beforeEach(() => {
    vi.clearAllMocks();
    api.load.mockResolvedValue([]);
    api.request.mockResolvedValue({ requestId: "request" });
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
    expect(screen.getByRole("heading", { name: "Para onde vamos?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oferecer carona" })).toBeInTheDocument();
    expect(screen.queryByText("Caronas disponíveis")).toBeNull();
  });
  it("permite alternar os dois papéis da viagem", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Oferecer carona" }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pedir carona", pressed: false }));
    expect(screen.getByRole("combobox", { name: "Passageiros" })).toBeInTheDocument();
  });
  it("publica a solicitação com os campos informados", async () => {
    const { container } = render(<Home />);
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "CEC" } });
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Aldeota" } });
    fireEvent.change(screen.getByLabelText("Data da viagem"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("Horário de saída"), { target: { value: "20:00" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(api.request).toHaveBeenCalledOnce());
    expect(api.request).toHaveBeenCalledWith({
      data: expect.objectContaining({
        origin: "CEC",
        destination: "Aldeota",
        rideDate: "2026-10-08",
        departureTime: "20:00",
      }),
    });
  });
  it("preenche saída automaticamente com endereço e coordenadas reais", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    render(<Home />);
    act(() => fix(position()));
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Rua A, Fortaleza"));
    expect(screen.getByText("Localização atual")).toBeInTheDocument();
    expect(api.reverse).toHaveBeenCalledWith({ data: { lat: -3.73, lng: -38.52 } });
  });
  it("GPS negado permite informar saída sem reload", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    render(<Home />);
    act(() => gpsFailure({ code: 1 } as GeolocationPositionError));
    expect(screen.getByRole("button", { name: "Informar saída" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "CEC" } });
    expect(screen.getByLabelText("Saída")).toHaveValue("CEC");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
  it("movimento atualiza marcador sem sobrescrever saída manual", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    render(<Home />);
    act(() => fix(position()));
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
    await screen.findByText(/Suas coordenadas estão disponíveis/);
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "CEC" } });
    fireEvent.change(screen.getByLabelText("Data da viagem"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("Horário de saída"), { target: { value: "20:00" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(api.request).toHaveBeenCalledWith({
        data: expect.objectContaining({
          origin: "Localização atual",
          originLat: -3.73,
          originLng: -38.52,
        }),
      }),
    );
  });
  it("erro da RPC STS não bloqueia GPS nem criação manual e não expõe SQL", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    api.seed.mockRejectedValue(new Error("Could not find the function public.get_sts_ride_seed"));
    const { container } = render(<Home />);
    await screen.findByText(/Seu trajeto STS está indisponível agora/);
    expect(screen.queryByText(/Could not find/)).toBeNull();
    act(() => fix(position()));
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "CEC" } });
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Aldeota" } });
    fireEvent.change(screen.getByLabelText("Data da viagem"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("Horário de saída"), { target: { value: "20:00" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(api.request).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Mapa do seu trajeto")).toHaveTextContent("-3.73");
  });
  it("origem STS escolhida é preservada mesmo longe do GPS", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true }),
    });
    api.seed.mockResolvedValue({
      classification: "partial",
      details: { origin: "Centro de Eventos", originLat: -3.79, originLng: -38.48 },
      publicationId: null,
    });
    render(<Home />);
    await screen.findByRole("button", { name: "Concluir publicação" });
    fireEvent.click(screen.getByText("Opções de saída"));
    const button = await screen.findByRole("button", {
      name: "Usar origem da inscrição STS",
    });
    fireEvent.click(button);
    act(() => fix(position()));
    act(() => move(position(-3.8)));
    await waitFor(() => expect(screen.getByLabelText("Saída")).toHaveValue("Centro de Eventos"));
    expect(screen.getByText("Origem da inscrição STS")).toBeInTheDocument();
  });
});
