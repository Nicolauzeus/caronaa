import { describe, expect, it } from "vitest";
import { tripMarkerIcon, tripMarkerSvg, type TripMarkerKind } from "./trip-marker-icons";

describe("CARONAA identity markers", () => {
  it.each([
    ["you", "Você"],
    ["driver", "Motorista"],
    ["passenger", "Passageiro"],
    ["destination", "Destino"],
    ["meeting", "Embarque"],
    ["origin", "Origem"],
  ] as Array<[TripMarkerKind, string]>)("%s has a permanent label and distinct icon", (kind, label) => {
    const svg = tripMarkerSvg(kind);
    expect(svg).toContain(label);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("<path");
    const icon = tripMarkerIcon(kind);
    expect(decodeURIComponent(icon.url.split(",")[1])).toBe(svg);
  });

  it("makes self and assigned driver visually distinct", () => {
    expect(tripMarkerSvg("you")).toContain("#2563EB");
    expect(tripMarkerSvg("driver")).toContain("#121212");
    expect(tripMarkerSvg("driver")).toContain("#FFBB00");
    expect(tripMarkerSvg("destination")).toContain("#FFBB00");
    expect(tripMarkerSvg("destination")).toContain("Destino");
  });

  it("renders a distinct valid motorcycle radar marker", () => {
    const svg = tripMarkerSvg("availableMoto");
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="48"');
    expect(svg).toContain('stroke="#FFBB00"');
    expect(svg).toContain('fill="#121212"');
    expect(svg).toContain('<circle cx="16" cy="27"');
    expect(svg).toContain('<circle cx="32" cy="27"');
    expect(svg).not.toContain('Motorista</text>');
    expect(decodeURIComponent(tripMarkerIcon("availableMoto").url.split(",")[1])).toBe(svg);
    expect(svg).not.toBe(tripMarkerSvg("availableDriver"));
  });

  it("does not mislabel a radar driver as the assigned driver", () => {
    const available = tripMarkerSvg("availableDriver");
    expect(available).not.toContain("Motorista</text>");
    expect(available).not.toContain("Destino");
    expect(available).toContain('width="48"');
  });
});
