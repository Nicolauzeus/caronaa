import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import {
  isExactKaluandaAddress,
  isKaluandaNightActive,
  makeKaluandaLocation,
  KALUANDA_NIGHT,
} from "@/lib/location/kaluanda-night";

const api = vi.hoisted(() => ({
  search: vi.fn(),
  details: vi.fn(),
  geocode: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/caronaa/GoogleMapSurface", () => ({ GoogleMapSurface: () => null }));
vi.mock("@/lib/location.functions", () => ({
  searchLocationsServerFn: api.search,
  getLocationDetailsServerFn: api.details,
  geocodeAddressServerFn: api.geocode,
}));

const verified = {
  rawText: "Rua Edmilson Medeiros, 23, Redenção - CE",
  formattedAddress: "R. Edmilson Medeiros, 23 - Redenção, CE, Brasil",
  street: "Rua Edmilson Medeiros", streetNumber: "23",
  city: "Redenção", state: "CE", country: "BR",
  source: "google" as const, isApproximate: false,
  lat: -4.2, lng: -38.7, placeId: "ChIJ_test_venue",
};

describe("Kaluanda Night launch suggestion - mobility only", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T21:30:00Z"));
    vi.clearAllMocks();
    api.geocode.mockResolvedValue(verified);
  });
  afterEach(() => vi.useRealTimers());

  it("is time boxed to launch night in America/Fortaleza", () => {
    expect(isKaluandaNightActive(new Date("2026-11-19T23:59:59-03:00"))).toBe(false);
    expect(isKaluandaNightActive(new Date("2026-11-20T20:00:00-03:00"))).toBe(true);
    expect(isKaluandaNightActive(new Date("2026-11-21T05:59:00-03:00"))).toBe(true);
    expect(isKaluandaNightActive(new Date("2026-11-21T06:00:00-03:00"))).toBe(false);
  });

  it("renders one low-noise suggestion with no Google request before a tap", () => {
    render(<LocationAutocomplete id="destination-event" label="Destino"
      value="" onChange={vi.fn()} variant="glass" featuredEvent="kaluanda-night"/>);
    expect(screen.getByRole("button", { name: /Selecionar Kaluanda Night/i })).toHaveTextContent("23 R. Edmilson Medeiros");
    expect(screen.getByText("Para todos")).toBeInTheDocument();
    expect(api.geocode).not.toHaveBeenCalled();
    expect(api.search).not.toHaveBeenCalled();
  });

  it("requires exact Google-confirmed city, street and house number", () => {
    expect(isExactKaluandaAddress(verified)).toBe(true);
    expect(isExactKaluandaAddress({ ...verified, streetNumber: "32" })).toBe(false);
    expect(isExactKaluandaAddress({ ...verified, city: "Fortaleza" })).toBe(false);
    expect(isExactKaluandaAddress({ ...verified, street: "Rua Teste" })).toBe(false);
    expect(isExactKaluandaAddress({ ...verified, source: "manual" })).toBe(false);
    expect(isExactKaluandaAddress({ ...verified, lat: undefined })).toBe(false);
    expect(makeKaluandaLocation(verified).details.lat).toBe(verified.lat);
  });

  it("resolves the house number only after tap and supplies real coordinates", async () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="kaluanda" label="Destino"
      onChange={onChange} onSelect={onSelect} variant="glass" featuredEvent="kaluanda-night"/>);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar Kaluanda Night/i }));
    await waitFor(() => expect(api.geocode).toHaveBeenCalledWith({ data: {
      address: KALUANDA_NIGHT.googleQuery,
    } }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining("Kaluanda Night"),
      expect.objectContaining({lat: verified.lat, lng: verified.lng,
        city: "Redenção", streetNumber: "23", source: "google", isApproximate: false})
    ));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Para todos")).not.toBeInTheDocument();
  });

  it("rejects unverifiable pin without updating quote or destination", async () => {
    api.geocode.mockResolvedValue({ ...verified, streetNumber: undefined,
      formattedAddress: "Rua Edmilson Medeiros, Redenção, CE" });
    const onChange = vi.fn();
    render(<LocationAutocomplete id="invalid-venue" label="Destino"
      onChange={onChange} featuredEvent="kaluanda-night" />);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar Kaluanda Night/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Não foi possível confirmar o nº 23"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps research/origin autocomplete free of promotional UI", () => {
    render(<LocationAutocomplete id="origin" label="Origem" onChange={vi.fn()} />);
    expect(screen.queryByText("Kaluanda Night (PUB vibe)")).toBeNull();
  });

  it("does not show a stale launch-event suggestion after the night", () => {
    vi.setSystemTime(new Date("2026-11-21T10:00:00Z"));
    render(<LocationAutocomplete id="expired" label="Destino" onChange={vi.fn()}
      featuredEvent="kaluanda-night" />);
    expect(screen.queryByText("Kaluanda Night (PUB vibe)")).toBeNull();
  });

  it("never resurrects a stale event geocode if the field is cleared", async () => {
    let resolve!: (v: unknown) => void;
    api.geocode.mockReturnValue(new Promise(done => { resolve = done; }));
    const onChange = vi.fn();
    render(<LocationAutocomplete id="cancelled-event" label="Destino" value="" onChange={onChange}
      featuredEvent="kaluanda-night" />);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar Kaluanda Night/i }));
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Meu destino" } });
    await act(async () => { resolve(verified); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("Meu destino", expect.objectContaining({ lat: undefined }));
  });
});
