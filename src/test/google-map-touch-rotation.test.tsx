import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GoogleMapSurface } from "@/components/caronaa/GoogleMapSurface";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/google-maps-browser.functions", () => ({ getGoogleMapsBrowserKey: async () => "test-key" }));
vi.mock("@/lib/google-maps-loader", () => ({
  loadGoogleMaps: async () => {},
  onGoogleMapsAuthFailure: () => () => {},
}));

let options: Record<string, unknown>;
const panTo = vi.fn();
const setHeading = vi.fn();
const setZoom = vi.fn();
const fitBounds = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("google", { maps: {
    RenderingType: { VECTOR: "VECTOR" },
    Map: class {
      constructor(_container: unknown, value: Record<string, unknown>) { options = value; }
      addListener() {}
      getRenderingType() { return "VECTOR"; }
      panTo = panTo;
      setHeading = setHeading;
      setZoom = setZoom;
      setTilt() {}
      fitBounds = fitBounds;
    },
    LatLngBounds: class { extend() {} getCenter() { return { lat: -3.73, lng: -38.53 }; } },
    Marker: class { setMap() {} },
    SymbolPath: { CIRCLE: "circle" },
  } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("native map touch rotation", () => {
  it.each([false, true])("enables rotation and retains native zoom for navigationMode=%s", async (navigationMode) => {
    render(<GoogleMapSurface points={[]} navigationMode={navigationMode} gestureHandling="greedy" />);
    await waitFor(() => expect(options.headingInteractionEnabled).toBe(true));
    expect(options.tiltInteractionEnabled).toBe(true);
    expect(options.gestureHandling).toBe("greedy");
  });

  it("does not enable gestures in a noninteractive preview", async () => {
    render(<GoogleMapSurface points={[]} previewOnly />);
    await waitFor(() => expect(options.headingInteractionEnabled).toBe(false));
    expect(options.tiltInteractionEnabled).toBe(false);
    expect(options.gestureHandling).toBe("none");
  });

  it("preserves a manual two-finger view across GPS updates until recenter is pressed", async () => {
    const props = { points: [], navigationMode: true, showControls: true, followKey: "ride", followHeading: 90 };
    const { rerender } = render(<GoogleMapSurface {...props} followPoint={{ lat: -3.73, lng: -38.53 }} />);
    await waitFor(() => expect(setHeading).toHaveBeenCalledWith(90));
    panTo.mockClear(); setHeading.mockClear();
    const allowed = fireEvent.touchStart(screen.getByRole("img"), { touches: [{ identifier: 1 }, { identifier: 2 }] });
    expect(allowed).toBe(true);
    rerender(<GoogleMapSurface {...props} followHeading={180} followPoint={{ lat: -3.74, lng: -38.54 }} />);
    expect(panTo).not.toHaveBeenCalled();
    expect(setHeading).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retomar acompanhamento do GPS" }));
    expect(panTo).toHaveBeenCalled();
    expect(setHeading).toHaveBeenCalledWith(180);
  });
});