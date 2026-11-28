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
  activeRole: "PASSAGEIRO" as "PASSAGEIRO"|"MOTORISTA",
  roadRoute: vi.fn(),
  unifiedFare: vi.fn(),
  roleRefresh: vi.fn(),
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
vi.mock("@/lib/map-routing.functions", () => ({ getMapDrivingRoute: api.roadRoute }));
vi.mock("@/lib/pricing/unified-fare-engine", () => ({ quoteUnifiedFare: api.unifiedFare }));
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
// These component tests isolate both resolvers with the same controlled address fixture.
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: api.reverse, reversePassengerPickupServerFn: api.reverse }));
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
// Home's role resolution is exercised by dedicated role hook tests. Keep this
// page suite deterministic and focused on its map and journey interactions.
vi.mock("@/lib/role/use-active-role", () => ({
  useActiveRole: () => ({
    activeRole: api.activeRole,
    isDriverEligible: false,
    vehicleStatus: { isComplete: false },
    vehicleType: "car",
    vehicleSeats: 1,
    loading: false,
    busy: false,
    roleLoadFailed: false,
    error: null,
    refresh: api.roleRefresh,
    switchRole: vi.fn(),
    saveVehicle: vi.fn(),
  }),
  getVehicleStatus: () => ({ isComplete: false }),
}));
vi.mock("@/lib/use-profile-gender", () => ({ useProfileGender: () => null }));
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
    return <div aria-label="Mapa do seu trajeto">
      <span data-testid="gps-marker">{props.userPosition?.lat}</span>
      {props.selectingOrigin&&<button type="button" onClick={()=>props.onPickOrigin({lat:-3.755,lng:-38.531})}>Selecionar ponto no mapa</button>}
    </div>;
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
    onChange: (value: string, details?: any) => void;
  }) => (
    <label>
      {label}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value,{
        rawText:e.target.value,formattedAddress:e.target.value+", Fortaleza",lat:-3.75,lng:-38.50,city:"Fortaleza",
      })} />
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
    api.activeRole="PASSAGEIRO";
    vi.spyOn(Route, "useSearch").mockReturnValue({intent:undefined});
    clearRideIntentDraft();
    vi.clearAllMocks();
    api.roleRefresh.mockResolvedValue(undefined);
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
    api.roadRoute.mockResolvedValue({distanceKm:11,durationMinutes:18,
      routePath:[{lat:-3.73,lng:-38.52},{lat:-3.75,lng:-38.50}],legs:[]});
    api.unifiedFare.mockResolvedValue({mode:"EXCLUSIVE",vehicleType:"CAR",distanceKm:11,
      totalFare:6,totalFareCents:600,perSeatFare:6,seats:1,configSource:"FALLBACK"});
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
  it("monta o planner atual sem esperar dados secundários", () => {
    api.load.mockReturnValue(new Promise(() => {}));
    render(<Home />);
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"Para onde vamos?"})).toBeInTheDocument();
    expect(screen.getByLabelText("Mapa do seu trajeto")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Ajustar no mapa a origem"})).toBeInTheDocument();
  });

  it("mostra os modos atuais do passageiro e alterna Agora e Agendar sem trocar de rota",()=>{
    render(<Home/>);
    expect(screen.getByRole("navigation",{name:"Tipo de serviço"})).toBeInTheDocument();
    const now=screen.getByRole("button",{name:"Agora"});
    const scheduled=screen.getByRole("button",{name:"Agendar"});
    expect(now).toHaveAttribute("aria-pressed","true");
    fireEvent.click(scheduled);
    expect(scheduled).toHaveAttribute("aria-pressed","true");
    expect(api.navigate).not.toHaveBeenCalled();
    fireEvent.click(now);
    expect(now).toHaveAttribute("aria-pressed","true");
  });

  it("deixa o rascunho de oferta para a rota de oferta, sem consumi-lo na Home passageiro",()=>{
    const draft={origin:"Centro, Fortaleza",destination:"UNILAB, Redenção",
      originLocation:{rawText:"Centro",lat:-3.73,lng:-38.52},
      destinationLocation:{rawText:"UNILAB",lat:-4.23,lng:-38.73},
      passengerMode:"MOTO" as const,offerVehicle:"MOTO" as const,date:"2026-11-10",time:"15:30"};
    saveRideIntentDraft(draft);
    render(<Home/>);
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
    expect(consumeRideIntentDraft()).toEqual(expect.objectContaining({origin:draft.origin,destination:draft.destination}));
    expect(api.request).not.toHaveBeenCalled();
  });

  it("expande e recolhe o painel interativo sem cobrir o mapa",()=>{
    render(<Home/>);
    const sheet=screen.getByRole("region",{name:"Planejar viagem CARONAA"});
    expect(sheet).toHaveAttribute("data-snap","peek");
    const handle=screen.getByRole("button",{name:/Alça do painel/});
    fireEvent.keyDown(handle,{key:"ArrowUp"});
    expect(sheet).toHaveAttribute("data-snap","half");
    expect(screen.getByLabelText("Para onde vamos?")).toBeInTheDocument();
    fireEvent.keyDown(handle,{key:"ArrowDown"});
    expect(sheet).toHaveAttribute("data-snap","peek");
    expect(screen.getByLabelText("Mapa do seu trajeto")).toBeInTheDocument();
  });

  it("seleciona destino e pede cotação de rota pela integração rodoviária",async()=>{
    render(<Home/>);
    act(()=>fix(position(-3.73,15)));
    fireEvent.click(screen.getByRole("button",{name:"Para onde vamos?"}));
    fireEvent.change(screen.getByLabelText("Para onde vamos?"),{target:{value:"Campus Fortaleza"}});
    await waitFor(()=>expect(api.roadRoute).toHaveBeenCalled());
    expect(api.roadRoute).toHaveBeenCalledWith(expect.objectContaining({data:{points:expect.any(Array)}}));
    expect(api.map.mock.lastCall?.[0].destination).toEqual(expect.objectContaining({lat:-3.75,lng:-38.5}));
  });

  it("não transforma GPS aproximado em embarque preciso nem geocodifica fix grosseiro",async()=>{
    render(<Home/>);
    act(()=>fix(position(-3.73,1029)));
    await waitFor(()=>expect(api.map.mock.lastCall?.[0].userPosition).toEqual(expect.objectContaining({lat:-3.73,accuracy:1029})));
    expect(api.reverse).not.toHaveBeenCalled();
    expect(api.map.mock.lastCall?.[0].origin).toBeUndefined();
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
  });

  it("recupera localização após fix grosseiro com uma leitura GPS confiável",async()=>{
    render(<Home/>);
    act(()=>fix(position(-3.73,1029)));
    expect(api.reverse).not.toHaveBeenCalled();
    act(()=>move(position(-3.731,25)));
    await waitFor(()=>expect(api.reverse).toHaveBeenCalledWith({data:{lat:-3.731,lng:-38.52}}));
    expect(api.map.mock.lastCall?.[0].origin).toEqual(expect.objectContaining({lat:-3.731,lng:-38.52}));
  });

  it("permite selecionar manualmente o embarque tocando no mapa",async()=>{
    render(<Home/>);
    fireEvent.click(screen.getByRole("button",{name:"Ajustar no mapa a origem"}));
    fireEvent.click(screen.getByRole("button",{name:"Escolher no mapa"}));
    fireEvent.click(screen.getByRole("button",{name:"Selecionar ponto no mapa"}));
    await waitFor(()=>expect(api.map.mock.lastCall?.[0].origin).toEqual(expect.objectContaining({lat:-3.755,lng:-38.531})));
    expect(api.map.mock.lastCall?.[0].originIsCurrent).toBe(false);
  });

  it("mantém o ponto manual escolhido apesar de novas posições do GPS",async()=>{
    render(<Home/>);
    fireEvent.click(screen.getByRole("button",{name:"Ajustar no mapa a origem"}));
    fireEvent.click(screen.getByRole("button",{name:"Escolher no mapa"}));
    fireEvent.click(screen.getByRole("button",{name:"Selecionar ponto no mapa"}));
    await waitFor(()=>expect(api.map.mock.lastCall?.[0].origin).toEqual(expect.objectContaining({lat:-3.755,lng:-38.531})));
    act(()=>fix(position(-3.73,10)));
    act(()=>move(position(-3.74,8)));
    expect(api.map.mock.lastCall?.[0].origin).toEqual(expect.objectContaining({lat:-3.755,lng:-38.531}));
    expect(api.map.mock.lastCall?.[0].userPosition).toEqual(expect.objectContaining({lat:-3.74}));
  });

  it("mantém escolha manual disponível após permissão GPS negada",()=>{
    render(<Home/>);
    act(()=>gpsFailure({code:1} as GeolocationPositionError));
    fireEvent.click(screen.getByRole("button",{name:"Ajustar no mapa a origem"}));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Escolher no mapa"})).toBeEnabled();
    expect(screen.getByRole("button",{name:"Usar localização atual"})).toBeEnabled();
  });

  it("retém destino e permite recuperação manual quando reverse geocoding falha",async()=>{
    api.reverse.mockRejectedValue(new Error("network unavailable"));
    render(<Home/>);
    act(()=>fix(position(-3.73,15)));
    fireEvent.click(screen.getByRole("button",{name:"Para onde vamos?"}));
    fireEvent.change(screen.getByLabelText("Para onde vamos?"),{target:{value:"Aldeota"}});
    await waitFor(()=>expect(api.roadRoute).toHaveBeenCalled());
    expect(screen.getByLabelText("Para onde vamos?")).toHaveValue("Aldeota");
    expect(api.map.mock.lastCall?.[0].destination).toEqual(expect.objectContaining({lat:-3.75,lng:-38.5}));
    expect(api.navigate).not.toHaveBeenCalled();
  });

  it("integra Flash Moto e Carro ao painel persistente com os pontos cotados",async()=>{
    render(<Home/>);
    act(()=>fix(position(-3.73,15)));
    fireEvent.click(screen.getByRole("button",{name:"Para onde vamos?"}));
    fireEvent.change(screen.getByLabelText("Para onde vamos?"),{target:{value:"Campus"}});
    await waitFor(()=>expect(api.roadRoute).toHaveBeenCalled());
    await waitFor(()=>expect(api.unifiedFare).toHaveBeenCalled());
    expect(await screen.findByRole("radio",{name:/Flash Carro/})).toBeInTheDocument();
    expect(screen.getByRole("radio",{name:/Flash Moto/})).toBeInTheDocument();
    expect(screen.getAllByText("Buscando motoristas na sua área…")).toHaveLength(2);
    expect(api.quickPanel).toHaveBeenLastCalledWith(expect.objectContaining({
      originPoint:expect.objectContaining({lat:-3.73,lng:-38.52}),
      destinationPoint:expect.objectContaining({lat:-3.75,lng:-38.5}),
    }));
    expect(api.quickPanel.mock.lastCall?.[0].driverCounts).toEqual({CAR:0,MOTO:0});
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
    expect(api.navigate).not.toHaveBeenCalled();
  });

  it("abre a Home do motorista e preserva o mapa ao alternar o papel ativo",()=>{
    const view=render(<Home/>);
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
    api.activeRole="MOTORISTA";
    view.rerender(<Home/>);
    expect(screen.getByRole("region",{name:"Painel do motorista CARONAA"})).toBeInTheDocument();
    expect(screen.getByLabelText("Mapa do seu trajeto")).toBeInTheDocument();
  });

  it("usa o planejador de carona agendada do motorista sem perder o mapa",()=>{
    api.activeRole="MOTORISTA";
    render(<Home/>);
    fireEvent.click(screen.getByRole("button",{name:"Oferecer carona"}));
    expect(screen.getByLabelText("Data e hora de saída")).toBeInTheDocument();
    expect(screen.getByLabelText("Destino")).toBeInTheDocument();
    expect(screen.getByLabelText("Mapa do seu trajeto")).toBeInTheDocument();
  });

  it("recupera o painel e a Home após atualização do estado operacional",async()=>{
    render(<Home/>);
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
    api.roleRefresh.mockClear();
    window.dispatchEvent(new Event("caronaa:app-refresh"));
    await waitFor(()=>expect(api.roleRefresh).toHaveBeenCalled());
    expect(screen.getByRole("region",{name:"Planejar viagem CARONAA"})).toBeInTheDocument();
    expect(screen.getByLabelText("Mapa do seu trajeto")).toBeInTheDocument();
  });

  it("não inicia novamente o carregamento da publicação de pesquisa encerrada",()=>{
    render(<Home/>);
    expect(api.seed).not.toHaveBeenCalled();
    expect(screen.queryByText(/trajeto STS/i)).not.toBeInTheDocument();
  });

  it("não mostra opções de saída vinculadas à inscrição antiga do evento",()=>{
    render(<Home/>);
    expect(screen.queryByText("Opções de saída")).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/inscrição STS/i})).not.toBeInTheDocument();
  });
});
