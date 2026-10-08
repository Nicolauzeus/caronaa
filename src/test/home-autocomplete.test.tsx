import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
const api = vi.hoisted(() => ({ search: vi.fn(), details: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/location.functions", () => ({
  searchLocationsServerFn: api.search,
  getLocationDetailsServerFn: api.details,
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
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "UNIFOR" } });
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("option", { name: /Unifor/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }),
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
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "UNIFOR" } });
    await waitFor(() => expect(api.search).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Limpar localização" }));
    await act(async () => resolve({ suggestions: [suggestion] }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
