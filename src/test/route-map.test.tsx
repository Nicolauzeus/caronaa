import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { RouteMap } from "@/components/caronaa/RouteMap";

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

  it("renders real route with coordinates, OpenStreetMap iframe embed and distance calculation", () => {
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

    // Bounding box map embed is rendered
    const iframe = screen.getByTitle(/Mapa da rota entre/i);
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src");
    expect(iframe.getAttribute("src")).toContain("openstreetmap.org/export/embed.html");

    // Route distance and time calculations
    expect(screen.getByText(/km • ~/i)).toBeInTheDocument();

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
    render(
      <RouteMap
        origin="Aldeota"
        destination="Unifor"
      />,
    );

    // Geocodes via catalog provider and loads map
    await waitFor(
      () => {
        expect(screen.getByTitle(/Mapa da rota entre/i)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
