import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  publish: vi.fn(),
  navigate: vi.fn(),
  gender: null as "FEMININO" | "MASCULINO" | null,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original()),
  useNavigate: () => api.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/lib/ride-matching.functions", () => ({ createRideOffer: api.publish }));
vi.mock("@/lib/use-profile-gender", () => ({ useProfileGender: () => api.gender }));
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: vi.fn() }));
vi.mock("@/lib/location/use-user-location", () => ({
  useUserLocation: () => ({
    position: null,
    addressPosition: null,
    locating: false,
    failure: null,
    locate: vi.fn(),
  }),
  locationFailureMessages: {},
}));
vi.mock("@/components/caronaa/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/caronaa/RideRoutineForm", () => ({
  RideRoutineForm: () => null,
  RideScheduleMode: () => null,
}));
vi.mock("@/components/caronaa/RouteMap", () => ({ RouteMap: () => null }));
vi.mock("@/components/caronaa/TravelPreferences", () => ({ JourneyPreferences: () => null }));
vi.mock("@/components/caronaa/OfferFarePreview", () => ({
  OfferFarePreview: ({ origin, destination, onQuote }: any) => {
    useEffect(() => {
      onQuote({
        quoteId: "trusted-quote",
        origin,
        destination,
        distanceKm: 22,
        pricePerPassenger: 12,
      });
    }, [origin, destination, onQuote]);
    return <div>R$ 12,00 por vaga</div>;
  },
}));
vi.mock("@/components/formulario/LocationAutocomplete", () => ({
  LocationAutocomplete: ({ id, label, value, onChange }: any) => (
    <label>
      {label}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "driver" } } }) },
    rpc: async () => ({ data: { driverAllowed: true }, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { vehicle_brand: "Honda", vehicle_description: "Fit", vehicle_plate: "ABC1D23" },
          }),
        }),
      }),
    }),
  },
}));
import { Route } from "@/routes/_authenticated/oferecer";
const Offer = Route.options.component!;
beforeEach(() => {
  vi.clearAllMocks();
  api.gender = null;
  vi.spyOn(Route, "useSearch").mockReturnValue({
    origem: "Redenção",
    destino: "Acarape",
    data: "2026-11-09",
    horario: "09:00",
  });
  api.publish.mockResolvedValue({ offerId: "published-offer" });
});
describe("Driver offer journey", () => {
  it("limits car seats to four and fixes motorcycles at one with helmet guidance", async () => {
    render(<Offer />);
    expect(screen.getByLabelText("Vagas disponíveis")).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar vagas" }));
    expect(screen.getByLabelText("Vagas disponíveis")).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: "Aumentar vagas" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Moto" }));
    expect(screen.getByText("1 vaga")).toBeInTheDocument();
    expect(screen.getByText("Capacete extra obrigatório")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aumentar vagas" })).not.toBeInTheDocument();
  });
  it("swaps the route and publishes the reviewed motorcycle and women-only settings", async () => {
    api.gender = "FEMININO";
    const { container } = render(<Offer />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Revisar carona/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Moto" }));
    fireEvent.change(screen.getByLabelText("Veículo desta viagem"), {
      target: { value: "Honda Biz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Inverter sentido" }));
    fireEvent.click(screen.getByRole("switch", { name: /Aceitar apenas passageiras mulheres/ }));
    fireEvent.submit(container.querySelector("form")!);
    expect(api.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Publicar Viagem/ }));
    await waitFor(() => expect(api.publish).toHaveBeenCalledOnce());
    expect(api.publish).toHaveBeenCalledWith({
      data: expect.objectContaining({
        origin: "Acarape",
        destination: "Redenção",
        availableSeats: 1,
        vehicleType: "MOTO",
        passengerGenderPreference: "FEMININO",
        vehicleDescription: "Honda Biz",
        quoteId: "trusted-quote",
      }),
    });
  });
  it.each(["MASCULINO", null] as const)("shows no women-only control for %s", (gender) => {
    api.gender = gender;
    render(<Offer />);
    expect(screen.queryByRole("switch", { name: /mulheres/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Quem pode viajar|Somente mulheres/)).not.toBeInTheDocument();
  });
});
