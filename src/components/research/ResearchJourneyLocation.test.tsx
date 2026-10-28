import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SimpleResearchJourney } from "./SimpleResearchJourney";
import { ResearchJourneyFields, initialResearchJourney } from "./ResearchJourneyFields";
import { newResearchConfiguration } from "@/lib/formulario/research-configuration";
import { EVENT_EXIT_MATCH_KEY } from "@/lib/formulario/event-exit-match";

vi.mock("@/components/formulario/LocationAutocomplete", () => ({
  LocationAutocomplete: ({ id, label, value, onChange, placeholder }: {
    id: string; label: string; value: string;
    onChange: (next: string) => void; placeholder?: string;
  }) => (
    <label htmlFor={id}>{label}
      <input id={id} value={value} placeholder={placeholder}
        onChange={event => onChange(event.target.value)} />
    </label>
  ),
}));
vi.mock("@/lib/location.functions", () => ({ reverseGeocodeServerFn: vi.fn() }));

const config = newResearchConfiguration("UNIVERSIDADE_URBANA_CARONAA");

describe("Location options on public F01 journeys", () => {
  it("shows GPS and searchable origin before route inputs on simple forms", () => {
    function Journey() {
      const [value, setValue] = useState<ReturnType<typeof initialResearchJourney>>({
        ...initialResearchJourney(config),
        originLat: -3.9, originLng: -38.6,
      });
      return <SimpleResearchJourney config={config} value={value} onChange={setValue} />;
    }
    render(<Journey />);
    const gps = screen.getByRole("button", { name: "Usar localização atual" });
    const search = screen.getByRole("button", { name: "Buscar localização" });
    const origin = screen.getByLabelText("De onde costuma sair?");
    expect(gps.compareDocumentPosition(origin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(search);
    expect(document.activeElement).toBe(origin);
    fireEvent.change(origin, { target: { value: "Redenção" } });
    expect(origin).toHaveValue("Redenção");
    expect(screen.getByLabelText("Para onde costuma ir?")).toBeInTheDocument();
  });

  it("clears exact coordinates when choosing a locality in configured journeys", () => {
    const initial = { ...initialResearchJourney(config), originLat: -3.9, originLng: -38.6 };
    const onChange = vi.fn();
    render(<ResearchJourneyFields config={config} value={initial}
      onChange={onChange} phase="locations" />);
    const origin = screen.getByLabelText("Bairro ou município de origem");
    fireEvent.click(screen.getByRole("button", { name: "Buscar localização" }));
    expect(document.activeElement).toBe(origin);
    fireEvent.change(origin, { target: { value: "Maracanaú" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      originArea: "Maracanaú", originLat: null, originLng: null,
    }));
  });

  it("keeps a preconfigured event departure rather than replacing it with GPS", () => {
    const event = { ...config, templateKey: EVENT_EXIT_MATCH_KEY };
    render(<ResearchJourneyFields config={event} value={initialResearchJourney(event)}
      onChange={vi.fn()} phase="locations" />);
    expect(screen.queryByRole("button", { name: "Usar localização atual" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ponto de saída do evento")).toBeInTheDocument();
  });
});
