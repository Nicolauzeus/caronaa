import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { LiveRideMap, type LiveMapPoint } from "@/components/caronaa/LiveRideMap";

vi.mock("@/lib/map-routing.functions", () => ({ getMapDrivingRoute: vi.fn() }));
vi.mock("@/components/caronaa/GoogleMapSurface", () => ({
  GoogleMapSurface: ({
    points, ariaLabel, fitKey, children,
  }: {
    points: Array<{ kind?: string; title?: string }>;
    ariaLabel: string;
    fitKey: string;
    children: ReactNode;
  }) => (
    <section aria-label={ariaLabel}>
      <output data-testid="marker-kinds">{points.map((p) => p.kind).join("|")}</output>
      <output data-testid="marker-titles">{points.map((p) => p.title).join("|")}</output>
      <output data-testid="fit-key">{fitKey}</output>
      {children}
    </section>
  ),
}));

const driver: LiveMapPoint = { lat: -3.73, lng: -38.52, title: "Motorista", type: "driver" };
const passenger: LiveMapPoint = { lat: -3.74, lng: -38.51, title: "Passageiro", type: "passenger" };
const meeting: LiveMapPoint = { lat: -3.735, lng: -38.515, title: "Ponto de encontro", type: "meeting" };
const destination: LiveMapPoint = { lat: -3.76, lng: -38.48, title: "Destino", type: "destination" };
afterEach(() => cleanup());

describe("Trip map role identity", () => {
  it("shows passenger as YOU while driver and destination stay distinct", () => {
    render(<LiveRideMap points={[driver, {...passenger, isViewer: true, title: "Você (passageiro)"}, meeting, destination]} />);
    expect(screen.getByTestId("marker-kinds")).toHaveTextContent("driver|you|meeting|destination");
    expect(screen.getByTestId("marker-titles")).toHaveTextContent("Você (passageiro)");
    expect(screen.getByTestId("fit-key")).toHaveTextContent("destination|driver|meeting|passenger");
  });

  it("shows driver as YOU when the authenticated viewer drives", () => {
    render(<LiveRideMap points={[{...driver, isViewer: true, title: "Você (motorista)"}, passenger, destination]} />);
    expect(screen.getByTestId("marker-kinds")).toHaveTextContent("you|passenger|destination");
    expect(screen.getByTestId("marker-titles")).toHaveTextContent("Você (motorista)");
  });

  it("never invents a YOU pin from a scheduled meeting point", () => {
    render(<LiveRideMap points={[meeting, destination]} />);
    expect(screen.getByTestId("marker-kinds")).toHaveTextContent("meeting|destination");
    expect(screen.getByTestId("marker-kinds")).not.toHaveTextContent("you");
  });
});
