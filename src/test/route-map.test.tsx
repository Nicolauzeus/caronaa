import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { RouteMap } from "@/components/caronaa/RouteMap";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/location.functions", () => ({
  geocodeAddressServerFn: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/caronaa/LiveRideMap", () => ({
  LiveRideMap: ({ points }: { points: Array<{ title: string }> }) => (
    <div
      role="img"
      aria-label={`Mapa da viagem: ${points.map((p) => p.title).join(", ")}`}
    />
  ),
}));

describe("RouteMap Component", () => {
  it("renders empty state placeholder when no origin or destination are provided", () => {
    render(<RouteMap />);
    expect(screen.getByText("Mapa interativo do trajeto")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Selecione a origem e o destino para visualizar a rota, distância e tempo estimado no mapa.",
      ),
    ).toBeInTheDocument();
  });

  it("renders road-routing map with the origin and destination coordinates", () => {
    render(
      <RouteMap
        origin="Aldeota, Fortaleza"
        destination="UNIFOR, Fortaleza"
        originLocation={{
          lat: -3.737,
          lng: -38.502,
          formattedAddress: "Aldeota, Fortaleza - CE",
        }}
        destinationLocation={{
          lat: -3.7698,
          lng: -38.4788,
          formattedAddress: "UNIFOR - Universidade de Fortaleza",
        }}
      />,
    );

    // Coordinates are passed to the real road-route component instead of a point-only iframe.
    expect(
      screen.getByRole("img", { name: /Mapa da viagem/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Trajeto pelas vias/i)).toBeInTheDocument();

    // External map link
    const externalLink = screen.getByRole("link", { name: /Abrir mapa/i });
    expect(externalLink).toBeInTheDocument();
    expect(externalLink).toHaveAttribute("href");
    expect(externalLink.getAttribute("href")).toContain("google.com/maps/dir");
    expect(externalLink.getAttribute("href")).toContain("-3.737");
    expect(externalLink.getAttribute("href")).toContain("-3.7698");

    // Shows coordinate pins
    expect(screen.getByText(/-3.7370/)).toBeInTheDocument();
    expect(screen.getByText(/-3.7698/)).toBeInTheDocument();
  });

  it("geocodes text-only addresses using local catalog and renders route", async () => {
    render(<RouteMap origin="Aldeota" destination="Unifor" />);

    // Geocodes via catalog provider and loads map
    await waitFor(
      () => {
        expect(
          screen.getByRole("img", { name: /Mapa da viagem/i }),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
