import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResearchOriginLocationActions } from "./ResearchOriginLocationActions";

const api = vi.hoisted(() => ({ reverse: vi.fn() }));
vi.mock("@/lib/location.functions", () => ({
  reverseGeocodeServerFn: api.reverse,
}));

const originalGeo = Object.getOwnPropertyDescriptor(navigator, "geolocation");
const originalSecure = Object.getOwnPropertyDescriptor(window, "isSecureContext");

function configureGPS(getCurrentPosition: unknown) {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
}

describe("Mobile F01 origin location actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    if (originalGeo) Object.defineProperty(navigator, "geolocation", originalGeo);
    else Reflect.deleteProperty(navigator, "geolocation");
    if (originalSecure) Object.defineProperty(window, "isSecureContext", originalSecure);
    else Reflect.deleteProperty(window, "isSecureContext");
  });

  it("exposes search and GPS on narrow-screen flows, but never requests GPS on mount", () => {
    const getPosition = vi.fn();
    configureGPS(getPosition);
    const onSearch = vi.fn();
    render(<ResearchOriginLocationActions currentArea="" onChooseArea={vi.fn()} onSearch={onSearch} />);
    const group = screen.getByRole("group", { name: "Ferramentas de localização" });
    expect(group).toHaveTextContent("Usar localização atual");
    expect(group).toHaveTextContent("Buscar localização");
    expect(getPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar localização" }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(getPosition).not.toHaveBeenCalled();
  });

  it("resolves a permitted GPS fix into a locality, never coordinates in the form", async () => {
    const getPosition = vi.fn((success: (position: GeolocationPosition) => void) =>
      success({ coords: { latitude: -3.73, longitude: -38.54 } } as GeolocationPosition));
    configureGPS(getPosition);
    api.reverse.mockResolvedValue({ neighborhood: "Aldeota", city: "Fortaleza" });
    const choose = vi.fn();
    render(<ResearchOriginLocationActions currentArea="" onChooseArea={choose} onSearch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar localização atual" }));
    expect(getPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(choose).toHaveBeenCalledWith("Aldeota · Fortaleza"));
    expect(api.reverse).toHaveBeenCalledWith({ data: { lat: -3.73, lng: -38.54 } });
    expect(screen.getByRole("status")).toHaveTextContent(/região aproximada preenchida/i);
  });

  it("does not block searching or manual entry after GPS is denied", () => {
    configureGPS(vi.fn((_success: unknown, error: (reason: unknown) => void) =>
      error({ code: 1, message: "Permission denied" })));
    const onSearch = vi.fn();
    render(<ResearchOriginLocationActions currentArea="" onChooseArea={vi.fn()} onSearch={onSearch} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar localização atual" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/buscar ou digitar o bairro normalmente/i);
    fireEvent.click(screen.getByRole("button", { name: "Buscar localização" }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("ignores a late GPS fix when the user edits the origin", async () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    configureGPS(vi.fn((callback: (position: GeolocationPosition) => void) => { success = callback; }));
    api.reverse.mockResolvedValue({ neighborhood: "Outra região", city: "Fortaleza" });
    const choose = vi.fn();
    const onSearch = vi.fn();
    const view = render(<ResearchOriginLocationActions currentArea=""
      onChooseArea={choose} onSearch={onSearch} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar localização atual" }));
    view.rerender(<ResearchOriginLocationActions currentArea="Bairro digitado"
      onChooseArea={choose} onSearch={onSearch} />);
    success?.({ coords: { latitude: -3.8, longitude: -38.6 } } as GeolocationPosition);
    await Promise.resolve();
    await Promise.resolve();
    expect(choose).not.toHaveBeenCalled();
  });
});
