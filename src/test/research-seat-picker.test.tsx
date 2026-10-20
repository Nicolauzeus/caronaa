import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResearchSeatPicker } from "@/components/research/ResearchSeatPicker";

describe("Mobile-first passenger-seat input", () => {
  it("supports quick selection without opening a number keypad", () => {
    const changed = vi.fn();
    render(<ResearchSeatPicker id="seats" value="3" min={1} max={7} onChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(changed).toHaveBeenCalledWith("4");
    expect(screen.queryByLabelText("Informar quantidade de vagas")).not.toBeInTheDocument();
  });

  it("provides instant feedback for large cars and rejects more than seven", () => {
    const changed = vi.fn();
    const view = render(<ResearchSeatPicker id="seats" value="4" min={1} max={7} onChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Informar quantidade manualmente" }));
    const entry = screen.getByLabelText("Informar quantidade de vagas");
    fireEvent.change(entry, { target: { value: "7" } });
    expect(changed).toHaveBeenCalledWith("7");
    view.rerender(<ResearchSeatPicker id="seats" value="7" min={1} max={7} onChange={changed} />);
    expect(screen.getByText(/7 vagas disponíveis/)).toBeInTheDocument();
    fireEvent.change(entry, { target: { value: "8" } });
    view.rerender(<ResearchSeatPicker id="seats" value="8" min={1} max={7} onChange={changed} />);
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 e 7");
  });

  it("allows research respondents to declare zero without creating a real offer", () => {
    render(<ResearchSeatPicker id="seats" value="0" min={0} max={7} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "0" })).toHaveAttribute("aria-pressed", "true");
  });
});
