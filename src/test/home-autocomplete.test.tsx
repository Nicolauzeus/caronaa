import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
const api = vi.hoisted(() => ({ search: vi.fn(), details: vi.fn(), geocode: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
// Map rendering is outside the scope of this autocomplete interaction test.
vi.mock("@/components/caronaa/GoogleMapSurface", () => ({
  GoogleMapSurface: () => <div data-testid="map-preview" />,
}));
vi.mock("@/lib/location.functions", () => ({
  searchLocationsServerFn: api.search,
  getLocationDetailsServerFn: api.details,
  geocodeAddressServerFn: api.geocode,
}));
const suggestion = {
  providerId: "ce_1",
  mainText: "Rua real",
  secondaryText: "Fortaleza",
  formattedAddress: "Rua real, Fortaleza",
  lat: -3.73,
  lng: -38.52,
};
describe("Seleção de destino na home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.details.mockResolvedValue({ details: suggestion });
  });
  it("seleção conserva coordenadas e descarta resposta antiga da busca", async () => {
    let resolve!: (value: unknown) => void;
    api.search.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const onChange = vi.fn();
    render(
      <LocationAutocomplete
        id="destination"
        label="Destino"
        value=""
        onChange={onChange}
        variant="simple"
      />,
    );
    fireEvent.change(screen.getByLabelText("Destino"), {
      target: { value: "UNIFOR" },
    });
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("option", { name: /Unifor/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
      ),
    );
    await act(async () => resolve({ suggestions: [suggestion] }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("limpar campo impede resultado atrasado de reabrir sugestões", async () => {
    let resolve!: (value: unknown) => void;
    api.search.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(
      <LocationAutocomplete
        id="destination"
        label="Destino"
        value=""
        onChange={vi.fn()}
        variant="simple"
      />,
    );
    fireEvent.change(screen.getByLabelText("Destino"), {
      target: { value: "UNIFOR" },
    });
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Limpar localização" }));
    await act(async () => resolve({ suggestions: [suggestion] }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Google Places New selection", () => {
  it("shows official provenance and delivers precise details immediately after the details response", async () => {
    const official = {
      providerId: "ChIJ_precise",
      mainText: "Shopping Precisão",
      secondaryText: "Av. Teste, Centro, Redenção - CE",
      formattedAddress: "Shopping Precisão, Redenção - CE",
      source: "google",
    };
    api.search.mockResolvedValue({ suggestions: [official] });
    let resolve!: (value: unknown) => void;
    api.details.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const onSelect = vi.fn(),
      onChange = vi.fn();
    render(
      <LocationAutocomplete
        id="precise"
        label="Destino preciso"
        onChange={onChange}
        onSelect={onSelect}
        variant="simple"
      />,
    );
    fireEvent.change(screen.getByLabelText("Destino preciso"), {
      target: { value: "Shopping Precisão" },
    });
    const option = await screen.findByRole("option", {
      name: /Shopping Precisão/,
    });
    expect(option).toHaveTextContent("Google Maps");
    expect(option).toHaveTextContent("Redenção - CE");
    fireEvent.click(option);
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () =>
      resolve({
        details: {
          ...official,
          lat: -4.2182,
          lng: -38.714,
          city: "Redenção",
          state: "CE",
          neighborhood: "Auroras",
          postalCode: "62790-000",
          street: "Av. Teste",
        },
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      "Shopping Precisão",
      expect.objectContaining({
        lat: -4.2182,
        lng: -38.714,
        city: "Redenção",
        state: "CE",
        neighborhood: "Auroras",
        postalCode: "62790-000",
        source: "google",
        isApproximate: false,
      }),
    );
  });
  it("keeps manual text available when details fail, without invented coordinates", async () => {
    const official = {
      providerId: "ChIJ_offline",
      mainText: "Destino sem conexão",
      secondaryText: "Fortaleza - CE",
      formattedAddress: "Destino sem conexão, Fortaleza - CE",
      source: "google",
    };
    api.search.mockResolvedValue({ suggestions: [official] });
    api.details.mockRejectedValue(new Error("offline"));
    const onSelect = vi.fn();
    render(
      <LocationAutocomplete
        id="offline"
        label="Destino offline"
        onChange={vi.fn()}
        onSelect={onSelect}
        variant="simple"
      />,
    );
    fireEvent.change(screen.getByLabelText("Destino offline"), {
      target: { value: "Destino sem conexão" },
    });
    fireEvent.click(
      await screen.findByRole("option", { name: /Destino sem conexão/ }),
    );
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        "Destino sem conexão",
        expect.objectContaining({
          lat: undefined,
          lng: undefined,
          isApproximate: true,
        }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("sem coordenadas");
  });
  it("ignores details from a selection cleared while its request was pending", async () => {
    const official = {
      providerId: "ChIJ_stale",
      mainText: "Lugar atrasado",
      secondaryText: "Fortaleza - CE",
      formattedAddress: "Lugar atrasado",
      source: "google",
    };
    api.search.mockResolvedValue({ suggestions: [official] });
    let resolve!: (value: unknown) => void;
    api.details.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const onSelect = vi.fn();
    render(
      <LocationAutocomplete
        id="stale"
        label="Destino atrasado"
        onChange={vi.fn()}
        onSelect={onSelect}
        variant="simple"
      />,
    );
    fireEvent.change(screen.getByLabelText("Destino atrasado"), {
      target: { value: "Lugar atrasado" },
    });
    fireEvent.click(
      await screen.findByRole("option", { name: /Lugar atrasado/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Limpar localização" }));
    await act(async () =>
      resolve({ details: { ...official, lat: -3.7, lng: -38.5 } }),
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Destino atrasado")).toHaveValue("");
  });
});

describe("session isolation for Google Places", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "fd5992c0-1fac-4d32-8db0-3e7f1f2b8ce0" });
    api.search.mockResolvedValue({ suggestions: [{
      providerId: "ChIJ_token", mainText: "Destino de teste",
      secondaryText: "Fortaleza", formattedAddress: "Destino de teste, Fortaleza",
      source: "google",
    }] });
    api.details.mockResolvedValue({ details: {
      providerId: "ChIJ_token", formattedAddress: "Destino de teste, Fortaleza",
      lat: -3.73, lng: -38.52, source: "google",
    } });
  });
  it("reuses one token through autocomplete and details, then starts another session", async () => {
    render(<LocationAutocomplete id="session-test" label="Buscar ponto" onChange={vi.fn()} variant="simple" />);
    const input = screen.getByLabelText("Buscar ponto");
    fireEvent.change(input, { target: { value: "Destino de teste" } });
    const option = await screen.findByRole("option", { name: /Destino de teste/ });
    expect(api.search).toHaveBeenCalledWith({ data: {
      query: "Destino de teste", sessionToken: "fd5992c0-1fac-4d32-8db0-3e7f1f2b8ce0",
    } });
    fireEvent.click(option);
    await waitFor(() => expect(api.details).toHaveBeenCalledWith({ data: {
      placeId: "ChIJ_token", sessionToken: "fd5992c0-1fac-4d32-8db0-3e7f1f2b8ce0",
    } }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar localização" }));
    expect(screen.getByLabelText("Buscar ponto")).toHaveValue("");
  });
});
